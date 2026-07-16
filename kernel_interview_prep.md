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

### Solution 1.1 (verified)

Key idea: **the stored integer is never the value — divide by the scale to get
the value.** `ONE8 = 1<<8 = 256` represents `1.0`. `INT16_MAX = 32767` is the
largest stored *integer*, not the largest *value*.

```cpp
static const int    FRAC8 = 8;                 // fractional bits (n)
static const int16_t ONE8 = 1 << FRAC8;        // 256 == the value 1.0 (scale=2^8)

int16_t to_q88(double x){ return (int16_t)std::lround(x * ONE8); } // float -> Q8.8
double  to_f88(int16_t q){ return (double)q / ONE8; }             // Q8.8  -> float
int16_t q_add88(int16_t a, int16_t b){ return a + b; }            // shared scale
```

Verified output:

```
ONE8 = 256
to_q88(3.14) = 804 ; to_f88 -> 3.140625          // 3.14*256=803.84 -> round 804; /256=3.140625
largest value  = INT16_MAX/256 = 32767/256 = 127.99609
most negative  = INT16_MIN/256 = -32768/256 = -128.00000
resolution     = 1/256          = 0.00390625      // one stored unit is worth 1/scale
q_add88(1.5,2.25) raw=960 -> 3.7500
```

- **Largest value** = `32767/256 ≈ 127.996` (not 32767). Range `[-128, +127.996]`.
- **Resolution** = `1/256 ≈ 0.0039` (not 256). Scale and resolution are
  reciprocals: scale = steps per 1.0, resolution = size of one step.
- Common trap: quoting the *stored integer* as the value, or the *scale* as the
  step. Always `value = stored / scale`.

### Solution 1.2 (verified)

```cpp
int32_t q_mul_trunc(int32_t a, int32_t b){          // floor: drops low bits
    int64_t p = (int64_t)a * (int64_t)b;
    return (int32_t)(p >> FRAC);
}
int32_t q_mul_round(int32_t a, int32_t b){          // round to nearest
    int64_t p = (int64_t)a * (int64_t)b;
    return (int32_t)((p + (1 << (FRAC - 1))) >> FRAC);   // NOTE the parentheses
}
```

**Precedence footgun:** writing `p + (1<<15) >> FRAC` *without* the outer parens
still works (in C++ `+` binds tighter than `>>`, so it is `(p+32768)>>16`), but
`g++ -Wparentheses` warns and the next reader will misread it. Always
parenthesize the add before the shift.

Verified output (Q16.16, scale 65536):

```
0.10^2: q=6554 prod=42954916 | trunc=655 round=655 truth=655 | dropped_frac=0.4400
0.01^2: q=655  prod=429025   | trunc=6   round=7   truth=7   | dropped_frac=0.5464
```

- `0.1 × 0.1`: both give **655**, truth **655** → **0 LSB difference**. Rounding
  and truncation only diverge when the dropped fraction is **≥ 0.5**; here it is
  `0.44`, so both floor to the same value.
- `0.01 × 0.01`: dropped fraction `0.55` → **truncation = 6 (off by 1 LSB),
  rounding = 7 (exact, truth = round(6.5536) = 7).** This is the case that shows
  why the `+2^(n-1)` bias exists.
- Truncation has a **systematic downward bias** (always floors) that accumulates
  over long MAC chains; rounding is unbiased. On the fixed-point ALU, prefer
  rounding.
- Separate error source to keep in mind: quantizing an *input* (e.g.
  `0.7 → 45875` before squaring) drifts the result independently of the
  multiply's rounding mode.

### Solution 1.3 (verified)

```cpp
int32_t q_mul_sat(int32_t a, int32_t b){
    int64_t mul = (int64_t)a * (int64_t)b;             // Q32.32 in 64-bit
    int64_t r   = (mul + (1 << (FRAC-1))) >> FRAC;      // round -> Q16.16, still 64-bit
    if (r > INT32_MAX) r = INT32_MAX;                   // SATURATE the wide value...
    if (r < INT32_MIN) r = INT32_MIN;
    return (int32_t)r;                                  // ...then narrow (now lossless)
}
```

**Range fact first:** a Q16.16 value lives in a signed 32-bit int, so its
representable range is `[INT32_MIN/65536, INT32_MAX/65536] = [-32768, +32768)`.
Anything with magnitude ≥ 32768 cannot be stored — including `40000.0`, whose raw
form `40000×65536 = 2621440000` already exceeds `INT32_MAX`. So overflow is
tested with in-range inputs whose *product* overflows (`200×200 = 40000`).

Verified output:

```
max representable Q16.16 value = INT32_MAX/65536 = 32768.0

256*256   sat=2147483647 (32768.0)   bad_narrow=0            (0.0)
200*200   sat=2147483647 (32768.0)   bad_narrow=-1673527296  (-25536.0)
200*-200  sat=-2147483648(-32768.0)  bad_narrow= 1673527296  ( 25536.0)
1.5*2.0   sat=196608     (3.0)       bad_narrow=196608       (3.0)
```

- `256×256`: true product `65536.0` > max → saturate to `INT32_MAX` (decodes
  `32768.0`). `200×200`: `+INT32_MAX`; `200×-200`: `INT32_MIN` (`-32768.0`).
- **Why clamp on the 64-bit value, not after narrowing:** the raw `(int32_t)`
  cast on an out-of-range `int64_t` wraps modulo `2^32`. `256×256`'s true raw
  `2^32` narrows to **0** — overflow silently becomes *zero*; `200×200` wraps to
  `-25536.0` (wrong sign and magnitude). Narrowing an out-of-range integer is
  implementation-defined/modular and **destroys the clamp-to-max intent**.
  Saturating the wide value guarantees it is in `[INT32_MIN, INT32_MAX]`, so the
  final narrowing cast is lossless. This ordering *is* the kernel.
- In-range products (`1.5×2.0`) are unaffected — saturation is a no-op there.

---

## 2. Branchless / SIMD-friendly C++

**Why branches are expensive on a PE array.** A 2D array of PEs runs in
lockstep — every PE (lane) executes the *same* instruction each cycle on its own
data (SIMD/SIMT). A data-dependent `if` (one whose condition depends on the
per-lane value) breaks that: different lanes want different paths. The hardware
can't run two instructions at once, so it **executes both sides and masks off
the wrong one** (predication) — you pay for both paths — or it *serializes*
lanes. Either way a per-lane branch is pure loss. (On a scalar CPU the cost is
different but related: a mispredicted branch flushes the pipeline.) So the idiom
flips: instead of *choosing* which work to do, you **do all the work and select
the result with a mask**.

**The one trick that powers everything: the sign mask.** An *arithmetic* right
shift of a 32-bit signed int by 31 copies the sign bit into every bit:

```
x <  0   ->  x >> 31 == 0xFFFFFFFF == -1   (all ones)
x >= 0   ->  x >> 31 == 0x00000000 ==  0   (all zeros)
```

An all-ones mask ANDed with a value keeps it; an all-zeros mask kills it. That
single fact gives branchless ReLU, abs, min/max, clamp, and select. The
operators used below:
- `x >> 31` — arithmetic shift (on signed `int32_t`, g++ shifts in the sign bit).
- `&`, `|`, `^`, `~` — bitwise AND / OR / XOR / NOT.
- `-(cond)` — turns a 0/1 boolean into `0` / all-ones (`-1`), i.e. a **mask**.
- `a ^ ((a ^ b) & mask)` — the **select** identity: equals `a` when `mask` is all
  ones, `b` when `mask` is `0` (because `x ^ 0 = x` and `a ^ (a ^ b) = b`).

### Worked example (compiled & verified)

```cpp
#include <cstdint>

int32_t relu_branchless(int32_t x){ return x & ~(x >> 31); }   // max(0,x)
// x>=0: (x>>31)=0, ~0=all-ones, x & all-ones = x
// x<0 : (x>>31)=-1, ~(-1)=0,    x & 0        = 0

int32_t abs_branchless(int32_t x){ int32_t m = x >> 31; return (x ^ m) - m; }
// x>=0: m=0  -> (x^0)-0   = x
// x<0 : m=-1 -> (x^-1)-(-1) = (~x)+1 = -x   (two's-complement negate)

int32_t select(int32_t cond, int32_t a, int32_t b){           // cond?a:b, cond in {0,1}
    int32_t mask = -(cond & 1);                               // 0 or 0xFFFFFFFF
    return b ^ ((a ^ b) & mask);
}

int32_t imin(int32_t a,int32_t b){ return b ^ ((a ^ b) & -(a < b)); }  // a<b ? a : b
int32_t imax(int32_t a,int32_t b){ return a ^ ((a ^ b) & -(a < b)); }  // a<b ? b : a
int32_t clamp(int32_t x,int32_t lo,int32_t hi){ return imax(lo, imin(hi, x)); }
```

Verified output:

```
relu(-5)=0  abs(-5)=5
relu(-1)=0  abs(-1)=1
relu(0)=0   abs(0)=0
relu(1)=1   abs(1)=1
relu(7)=7   abs(7)=7
select(1,10,20)=10  select(0,10,20)=20
clamp(-9,[-3,10])=-3   clamp(-3,[-3,10])=-3   clamp(5,[-3,10])=5   clamp(42,[-3,10])=10
```

**Walk one through.** `relu(-5)`: `-5 >> 31 = -1` (all ones), `~(-1) = 0`,
`-5 & 0 = 0`. `relu(7)`: `7 >> 31 = 0`, `~0 = -1` (all ones), `7 & -1 = 7`. No
branch taken in either case — the same three instructions run for every input,
which is exactly what a PE lane wants.

**Reality check:** you rarely hand-roll `imin`/`imax` — write `x < 0 ? 0 : x` or
`std::min/std::max` and let `-O2` emit a `cmov`/`vpmax` with no branch. The point
is to (1) recognize which ops are branch-free-able and (2) know the mask
identities for the cases the compiler *won't* vectorize (custom saturation,
per-lane conditional accumulate, masked writes).

### Exercises

**2.1 (easy) — `signum`.** Write a branchless `int signum(int32_t x)` returning
`-1, 0, +1` for negative / zero / positive. (Hint: two comparisons, no masks
needed — `(x > 0) - (x < 0)`; explain *why* that works, and what type the
comparisons produce.)

**2.2 (medium) — saturate an accumulator to int8.** After an INT8 matmul you hold
a wide `int32_t acc` and must clamp it to the int8 range `[-128, 127]` before
storing (this is the "requantize saturate" step). Write a **branchless**
`int8_t sat8(int32_t acc)`. Then write `relu_sat8` that fuses ReLU + saturate
(clamp to `[0, 127]`). Test with `-500, -128, 0, 100, 127, 500`.

**2.3 (interview) — one-pass branchless argmax.** Given `const int32_t* v, int n`,
return the **index of the maximum** element (first occurrence on ties), with **no
`if`/`?:` in the loop body** — update the running max *and* the running index
using masks. This is the top-1 reduction a PE array does for classification.
Test with `{3, 1, 4, 1, 5, 9, 2, 6}` (expect index 5) and a tie like
`{7, 2, 7, 1}` (expect index 0). (Hint: `int32_t gt = -(v[i] > best);` gives a
mask; use it to conditionally overwrite both `best` and `best_idx`.)

### Solutions 2.1–2.3 (verified)

```cpp
// 2.1 signum: -1 / 0 / +1, branchless
int signum(int32_t x){ return (x > 0) - (x < 0); }
// (x>0),(x<0) are each int 0/1 and never both 1:
//   +ve -> 1-0=+1 ; -ve -> 0-1=-1 ; 0 -> 0-0=0

// 2.2 saturate a wide accumulator to int8 (requantize clamp)
static int32_t imin(int32_t a,int32_t b){ return b ^ ((a^b) & -(a<b)); } // a<b?a:b
static int32_t imax(int32_t a,int32_t b){ return a ^ ((a^b) & -(a<b)); } // a<b?b:a
int8_t sat8(int32_t acc)     { return (int8_t)imax(-128, imin(127, acc)); } // [-128,127]
int8_t relu_sat8(int32_t acc){ return (int8_t)imax(   0, imin(127, acc)); } // [0,127]
// clamp FIRST (value now provably in range), THEN narrow -> cast is lossless (cf. 1.3)

// 2.3 one-pass branchless argmax (first index on ties)
int argmax(const int32_t* v, int n){
    int32_t best = v[0], best_idx = 0;
    for(int i = 1; i < n; i++){
        int32_t gt = -(v[i] > best);               // all-ones iff STRICTLY greater
        best_idx = (i    & gt) | (best_idx & ~gt); // select i    if gt else keep
        best     = (v[i] & gt) | (best     & ~gt); // select v[i] if gt else keep
    }
    return best_idx;
}
```

Verified output:

```
2.1 signum: -9->-1  -1->-1  0->0  1->1  42->1
2.2 sat8:      -500->-128  -128->-128  0->0  100->100  127->127  500->127
2.2 relu_sat8: -500->0     -128->0     0->0  100->100  127->127  500->127
2.3 argmax {3,1,4,1,5,9,2,6}=5 (want 5) ; {7,2,7,1}=0 (want 0)
```

- **2.1**: comparisons yield `int` 0/1; subtracting them covers all three signs
  with no branch or mask.
- **2.2**: `imin(127,·)` caps the top, `imax(lo,·)` the bottom; `relu_sat8` just
  uses `lo=0`. Clamp-then-narrow keeps the cast lossless.
- **2.3**: the mask is built from `>` (**strict**), so ties never overwrite →
  first index wins. `(a&gt)|(b&~gt)` is the select; no `if`/`?:` in the loop, so
  it maps to a PE-array reduction.
- **Through-line:** build a mask from the comparison, then **select** with it —
  never branch.

---
