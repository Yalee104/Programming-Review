# C/C++ Kernel Writing & Operator Mapping — Interview Prep

A hands-on, progressive tutorial for low-level ML-kernel interviews (Quadric-style
GPNPU: a 2D array of processing elements (PEs), each with MAC units + a 32-bit
**fixed-point** ALU; memory hierarchy DDR/LPDDR → on-chip L2 → per-PE local
register memory (LRM); mostly **memory-bandwidth-bound**; **no FPU** assumed, so
integer/fixed-point math is preferred; branch-heavy code maps poorly to a PE
array, so **branchless/masked** techniques are valued).

**Format.** Each topic = short concept → one fully worked, compiled-and-verified
example → exercises solved by the learner (problem first, attempt, then review).
Every code block here was compiled with `g++ -std=c++17 -O2` and run; the
`-> ... -- verified` comments are real program output, cross-checked against a
float reference. See the companion reference `nn_operators_summary.md` for the
Quadric/Chimera-style operator kernels this tutorial builds toward.

**Roadmap.**
1. Fixed-point arithmetic (Q-format, scaling, rounding, saturation, overflow)
2. Branchless / SIMD-friendly C++
3. Core ML kernels from scratch (dot product, INT8 GEMM, conv2d, im2col, activations, NMS)
4. Tiling & data reuse (roofline, DMA/prefetch)
5. Operator mapping (ONNX op → PE-array loops, fusion, graph partitioning)
6. Debugging a port (numerically wrong or too slow)
7. LLM / Transformer deep-dive from the C++ kernel angle (multi-head, causal mask, embeddings, KV-cache)
8. Timed mock coding round

---

## 1. Fixed-Point Arithmetic (Q-format)

### 1.0 First principles — think in *cents* (start here)

You already do fixed-point with money. A register never stores `1.50`; it stores
**150 cents**, a plain integer, under one agreed rule: *the integer is in
hundredths of a dollar*. That agreed multiplier — **100** — is the **scale**.

- store: `dollars × 100` → `1.50 × 100 = 150`
- read back: `stored / 100` → `150 / 100 = 1.50`

**Qm.n is the identical trick with a power-of-two scale instead of 100.** The
name just says where the binary point is frozen: `n` fractional bits → scale
`2^n`.

| Q-format | frac bits `n` | scale `2^n` | stored integer means… |
|----------|--------------|-------------|-----------------------|
| Q8.8   | 8  | 256   | 256ths |
| Q16.16 | 16 | 65536 | 65536ths |
| Q24.8  | 8  | 256   | 256ths (more integer room) |

So `1.5` in Q16.16 = `1.5 × 65536 = 98304`, exactly like `$1.50 = 150 cents`.

**Add** just works — both are "in cents": `150 + 200 = 350` = $3.50.

**Multiply needs a shift RIGHT.** `$1.50 × $2.00 = $3.00 = 300 cents`. But the
integers give `150 × 200 = 30000` — off by **100×**, because each operand had the
scale baked in, so the product has it **twice**:
```
150 × 200 = (1.50×100) × (2.00×100) = 3.00 × 100 × 100 = 30000   (two scales)
30000 / 100 = 300 cents = $3.00                                   (remove one)
```
Dividing by the scale `2^n` in binary *is* `>> n`. → `q_mul = (a*b) >> n`.

**Divide needs a shift LEFT.** `$1.50 / $2.00 = 0.75`. Integers give
`150 / 200 = 0` — the scales **cancel**, leaving a bare ratio with *no* scale:
```
150 / 200 = (1.50×100)/(2.00×100) = 0.75   (both scales cancelled → wrong units)
(150 × 100) / 200 = 15000/200 = 75 cents = $0.75   (pre-multiply to keep one)
```
Multiplying the numerator by `2^n` in binary is `<< n`. → `q_div = (a<<n)/b`.

**What a shift literally does** (like decimal, but ×2 per place):
```
5 = 101(bin);  101<<1 = 1010 = 10 (×2);  101<<2 = 10100 = 20 (×4);  1010>>1 = 101 = 5 (÷2)
```
So `<<16` = ×65536 and `>>16` = ÷65536 — exactly the scale ops. Right shift
**truncates** (`7>>1 = 3`, the .5 dropped), so we add half a unit `2^(n-1)`
before shifting to round to nearest.

**The bits of `1.5` (=98304) in Q16.16**, split at the frozen point:
```
98304 = 0000000000000001 . 1000000000000000
        └─ 16 int bits ─┘   └─ 16 frac bits ─┘
              = 1                 = 0.5          →  1 + 0.5 = 1.5
```
`98304 >> 16 = 1` (integer part); `98304 & 0xFFFF = 32768`, and
`32768/65536 = 0.5` (fraction). The point never moves — that's why it's
**fixed**-point.

> **One-liner:** a Qm.n value is an integer measured in units of `1/2^n` (cents
> are units of `1/100`); add works directly, multiply doubles the scale so `>>n`
> fixes it, divide cancels the scale so `<<n` preserves it.

### 1.1 The same thing, stated formally

**What "fixed-point" is.** A float stores a number as *mantissa × 2^exponent* —
the binary point *floats* to wherever the value needs it, and dedicated FPU
hardware tracks it. On a core with **no FPU**, we instead pick *one* fixed
location for the binary point and store the number as a plain integer scaled by a
constant power of two. That is **Q-format**.

**Q*m*.*n* notation.** `Qm.n` means: use a signed integer with `m` integer bits
and `n` fractional bits (plus 1 sign bit). The stored integer is the real value
multiplied by `2^n` (the **scale**). Q16.16 in a 32-bit int: `1 sign + 16 int +
16 frac`, scale `2^16 = 65536`.

- Store the value `v` as the integer `round(v × 2^n)`.
- Read it back as `stored / 2^n`.
- So `1.5` in Q16.16 is `1.5 × 65536 = 98304`; and `98304 / 65536 = 1.5`.

**The scaling rules — this is the whole game:**

| op | why | code |
|----|-----|------|
| **add / sub** | both operands share scale `2^n`, so `(a·2^n) ± (b·2^n) = (a±b)·2^n` — already correct scale. | `a + b` |
| **multiply** | `(a·2^n)·(b·2^n) = (a·b)·2^(2n)` — scale is now `2^(2n)`, **too big by 2^n**. Shift right by `n` to restore. Multiply in **64-bit** first (a 32-bit product overflows), and add `2^(n-1)` before the shift to **round** instead of truncate. | `(int32_t)(((int64_t)a*b + (1<<(n-1))) >> n)` |
| **divide** | `(a·2^n)/(b·2^n) = a/b` — scale `2^0`, **too small by 2^n**. Shift the numerator up by `n` first (in 64-bit). | `(int32_t)(((int64_t)a << n) / b)` |

**Overflow & saturation.** Fixed-point results can exceed the integer range. Raw
integer add **wraps** (a huge positive value silently becomes negative — a
catastrophic error in a kernel). Hardware ALUs instead **saturate**: clamp to the
representable max/min. We emulate that by computing in a wider type and clamping.

### Worked example (compiled & verified)

```cpp
#include <cstdint>
#include <cstdio>
#include <cmath>
#include <initializer_list>

// ---- Q16.16 fixed-point: a 32-bit signed int holding value * 2^16 ----
static const int FRAC = 16;                 // number of fractional bits (n)
static const int32_t ONE = 1 << FRAC;       // 65536 == the value 1.0

// float -> Q16.16 (round to nearest instead of truncating)
int32_t to_q(double x) { return (int32_t)std::lround(x * ONE); }
// Q16.16 -> float (only for printing / checking)
double  to_f(int32_t q) { return (double)q / ONE; }

int32_t q_add(int32_t a, int32_t b) { return a + b; }          // shared scale

int32_t q_mul(int32_t a, int32_t b) {                          // >> n, rounded
    int64_t p = (int64_t)a * (int64_t)b;    // Q32.32 intermediate, 64-bit
    return (int32_t)((p + (1 << (FRAC - 1))) >> FRAC);         // +2^15 rounds
}

int32_t q_div(int32_t a, int32_t b) {                          // numerator << n
    int64_t num = (int64_t)a << FRAC;       // Q48.16 numerator, 64-bit
    return (int32_t)(num / b);
}

int32_t q_add_sat(int32_t a, int32_t b) {                      // clamp, no wrap
    int64_t s = (int64_t)a + (int64_t)b;
    if (s > INT32_MAX) s = INT32_MAX;
    if (s < INT32_MIN) s = INT32_MIN;
    return (int32_t)s;
}

int main() {
    int32_t a = to_q(1.5);      // 1.5 -> 98304
    int32_t b = to_q(2.0);      // 2.0 -> 131072
    printf("a=%d (%.4f)  b=%d (%.4f)\n", a, to_f(a), b, to_f(b));
    printf("q_add raw=%d -> %.4f\n", q_add(a,b), to_f(q_add(a,b)));
    printf("q_mul raw=%d -> %.4f\n", q_mul(a,b), to_f(q_mul(a,b)));
    printf("q_div raw=%d -> %.4f\n", q_div(a,b), to_f(q_div(a,b)));

    int32_t third = q_div(to_q(1.0), to_q(3.0));   // 1/3, then *3 back near 1.0
    printf("1/3 raw=%d -> %.6f ; (1/3)*3 -> %.6f\n",
           third, to_f(third), to_f(q_mul(third, to_q(3.0))));

    int32_t big = INT32_MAX - 5;                    // wrap vs saturate
    printf("wrap: big+10    = %d\n", (int32_t)(big + 10));
    printf("sat:  add_sat   = %d\n", q_add_sat(big, 10));

    for (double x : {0.0, 1.0, 2.5, -3.0}) {        // port y = 0.5*x + 0.25
        int32_t y = q_add(q_mul(to_q(0.5), to_q(x)), to_q(0.25));
        printf("y(%.2f) fixed=%.4f  float=%.4f\n", x, to_f(y), 0.5*x + 0.25);
    }
    return 0;
}
```

Program output (`g++ -std=c++17 -O2` — **verified**):

```
a=98304 (1.5000)  b=131072 (2.0000)
q_add raw=229376 -> 3.5000
q_mul raw=196608 -> 3.0000
q_div raw=49152 -> 0.7500
1/3 raw=21845 -> 0.333328 ; (1/3)*3 -> 0.999985
wrap: big+10    = -2147483644
sat:  add_sat   = 2147483647
y(0.00) fixed=0.2500  float=0.2500
y(1.00) fixed=0.7500  float=0.7500
y(2.50) fixed=1.5000  float=1.5000
y(-3.00) fixed=-1.2500  float=-1.2500
```

**Walk the numbers by hand.**
- `q_mul(1.5, 2.0)`: raw `98304 × 131072 = 12884901888` (Q32.32). `+2^15` then
  `>> 16` gives `196608` = `196608/65536 = 3.0`. ✅
- `1/3` can't be represented exactly: `21845/65536 = 0.333328…`, off by ~2e-5.
  Multiplying back by 3 gives `0.999985`, not exactly 1.0 — **quantization error
  is real and it accumulates**; picking enough fractional bits is a design
  decision.
- `big + 10` **wrapped** to a large negative number (silent corruption);
  `q_add_sat` **clamped** to `INT32_MAX`. On the target ALU you want saturation.

### Exercises (attempt before looking at solutions)

Post your code and I'll review it, then I'll add the verified reference solution
to this file.

**1.1 (easy) — Q8.8 round-trip.** Write `to_q88`/`to_f88` for **Q8.8** (16-bit
`int16_t`, scale `2^8 = 256`). Convert `3.14`, print the stored integer and the
value read back. What is the largest positive value Q8.8 can hold, and what is
its resolution (smallest step)?

**1.2 (medium) — rounding vs truncation.** Implement `q_mul` **twice** for
Q16.16: one truncating (`>> 16` with no bias) and one rounding (`+ 2^15` first).
Multiply `0.1 × 0.1` with each and compare to the true `0.01`. Which is closer,
and by how many raw units (LSBs)? Show the two raw integers.

**1.3 (interview) — saturating Q16.16 multiply.** `q_mul` currently returns
`int32_t` but the true product of two Q16.16 numbers can exceed the Q16.16 range
(e.g. `256.0 × 256.0 = 65536.0` needs 17 integer bits). Write `q_mul_sat` that
computes the 64-bit product, rounds, and **saturates** the Q16.16 result to
`[INT32_MIN, INT32_MAX]` *before* narrowing to `int32_t` — with **no undefined
behaviour** on the narrowing. Test with `256.0 × 256.0` and `40000.0 × 40000.0`.

---
