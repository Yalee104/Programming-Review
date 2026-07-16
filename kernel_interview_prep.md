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

int32_t abs_branchless(int32_t x){          // |x|
    int32_t m = x >> 31;
    return (x ^ m) - m;
}
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
    int32_t best = v[0];
    int32_t best_idx = 0;
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

## 3. Core ML Kernels From Scratch

Every kernel here is the same atom — the **MAC** (multiply-accumulate) — wrapped
in the Topic 1 (fixed-point requantize) and Topic 2 (branchless saturate) tools.
See `nn_operators_summary.md` §2/§9 for the reference conv2d/`gemm_i8` kernels;
this section builds them up so you can write one cold.

**The INT8 quantization contract.** A real tensor is stored as small integers
plus a scale: `real ≈ scale × (q − zero_point)`. Weights are usually
**symmetric** (`zero_point = 0`, so `real = scale × q`). A matmul then works
entirely on the integers:
```
real_out = Σ_k (sa·a_q)(sw·w_q) = sa·sw · Σ_k a_q·w_q  =  sa·sw · acc_int32
```
- **Accumulate in INT32.** Each `int8×int8` product is ≤ `127×127 = 16129`;
  summing `K` of them needs headroom. INT32 holds ~`2.1e9`, so it won't overflow
  until `K ≳ 130000` worst-case — safe for real layers. This is why the ALU is
  32-bit.
- **Requantize back to INT8.** To store the result you divide by the output
  scale: `out_q = round(acc · M) + out_zp`, where `M = (sa·sw)/so` is a small
  real (< 1). With no FPU you represent `M` as a **fixed-point multiplier**:
  `M ≈ mult · 2^(−shift)`, so `acc·M == (acc·mult) >> shift` (rounded), then
  saturate to int8 (Topic 2 `sat8`).
- **Per-channel.** Each output channel `c` has its own weight scale `sw[c]`, so
  its own `mult[c]` / `shift[c]`. That is all "per-channel dequant" means.

### Worked example — INT8 GEMM with per-channel requantize (verified)

```cpp
static int32_t imin(int32_t a,int32_t b){ return b ^ ((a^b) & -(a<b)); }
static int32_t imax(int32_t a,int32_t b){ return a ^ ((a^b) & -(a<b)); }
static int8_t  sat8(int32_t x){ return (int8_t)imax(-128, imin(127, x)); }

// acc*M with M = mult*2^-shift, rounded, then saturated to int8.
int8_t requant(int32_t acc, int32_t mult, int shift){
    int64_t v = (int64_t)acc * (int64_t)mult;                        // widen
    int32_t r = (int32_t)((v + ((int64_t)1 << (shift-1))) >> shift); // round-shift
    return sat8(r);
}

// A[M][K] x W[K][N] -> INT32 accumulate -> per-output-channel requant -> INT8 C[M][N]
void gemm_i8(const int8_t* A, const int8_t* W, int8_t* C,
             int M, int K, int N, const int32_t* mult, const int* shift){
    for(int m=0;m<M;m++)
      for(int c=0;c<N;c++){
        int32_t acc = 0;
        for(int k=0;k<K;k++)
            acc += (int32_t)A[m*K+k] * (int32_t)W[k*N+c];  // INT8*INT8 -> INT32 MAC
        C[m*N+c] = requant(acc, mult[c], shift[c]);
      }
}
```

Verified output (`A` 2×3, `W` 3×2; ch0 `M=0.75`, ch1 `M=0.25`, shift 16):

```
m=0 c=0 acc= -70  fixed= -52  float=-52.50 (round -53)
m=0 c=1 acc= 270  fixed=  68  float=67.50 (round 68)
m=1 c=0 acc= 138  fixed= 104  float=103.50 (round 104)
m=1 c=1 acc=-203  fixed= -51  float=-50.75 (round -51)
requant(1000, M=0.5) = 127  (500 saturates to 127)
requant(-2000,M=0.5) = -128 (-1000 saturates to -128)
```

- The MAC loop is pure `+= a*b` with **no branches** — exactly what a systolic PE
  array wants.
- **Tie-rounding gotcha** (row 0,0): `acc·M = −52.5`. The `+half then
  arithmetic-shift` scheme rounds ties toward **+∞**, giving `−52`, while
  round-half-away-from-zero gives `−53`. Both are "correct rounding"; they just
  disagree on exact halves. Reference kernels (TFLite etc.) often use
  round-half-to-even — so a **1-LSB mismatch on ties is a classic port bug**
  (revisited in Topic 6). Know which rule your golden reference uses.
- Saturation reuses `sat8`: out-of-int8 results clamp, they don't wrap.

### Exercises

**3.1 (easy) — INT8 dot product + overflow reasoning.** Write
`int32_t dot_i8(const int8_t* a, const int8_t* w, int K)` = `Σ a[k]·w[k]`
accumulated in INT32. Then answer: with both operands in `[−128,127]`, what is
the largest possible single product, and what is the largest `K` for which the
accumulator is guaranteed not to overflow INT32? Test on
`a={1,2,3,4}, w={10,-10,10,-10}` (expect `−20`).

**3.2 (medium) — conv2d as one dot product (im2col).** For a conv with input
`[C_in][H][W]`, kernel `[C_out][C_in][KH][KW]`, VALID padding, stride 1: write
`patch_at(in, C_in,H,W, KH,KW, oy,ox, int8_t* col)` that gathers the
`C_in·KH·KW` input values covering output position `(oy,ox)` into `col`. Then one
output pixel for channel `oc` is just `dot_i8(col, weight[oc], C_in*KH*KW)` from
3.1 — **that identity (conv = im2col + GEMM) is the whole point.** Test on a
`C_in=1, 4×4` image with a `3×3` kernel and check `(oy,ox)=(0,0)` gathers the
top-left 3×3 block.

**3.3 (interview) — non-max suppression (NMS).** Given `N` boxes as
`int16 x1,y1,x2,y2` and `int32` scores, keep the highest-score box, remove every
remaining box whose **IoU** (intersection-over-union) with it exceeds a threshold,
repeat. Write `iou_q16(box a, box b) -> int32` returning IoU in **Q16.16**
(integer intersection and union areas, one `q_div`), and `nms(...)` returning the
kept indices. Watch: empty intersection must give 0 (branchless clamp of
overlap width/height to ≥ 0), and the divide must not divide by zero. Test with
two boxes overlapping ~50% (kept/suppressed depending on threshold) and one
disjoint box (always kept).

*Activations note:* ReLU / clamp / relu6 are the Topic 2 branchless primitives;
GELU and **softmax** need `exp` in fixed-point, which we do properly in Topic 7
(transformer), where softmax stability actually bites.

### Solutions 3.1–3.3 (verified)

```cpp
static int32_t imin(int32_t a,int32_t b){ return b ^ ((a^b) & -(a<b)); }
static int32_t imax(int32_t a,int32_t b){ return a ^ ((a^b) & -(a<b)); }

// 3.1 INT8 dot product, INT32 accumulate
int32_t dot_i8(const int8_t* a, const int8_t* w, int K){
    int32_t acc = 0;
    for(int k=0;k<K;k++) acc += (int32_t)a[k] * (int32_t)w[k];
    return acc;
}

// 3.2 im2col: gather the C_in*KH*KW inputs for output (oy,ox), order [c][ky][kx]
void patch_at(const int8_t* in,int C_in,int H,int W,int KH,int KW,int oy,int ox,int8_t* col){
    int idx=0;
    for(int c=0;c<C_in;c++)
      for(int ky=0;ky<KH;ky++)
        for(int kx=0;kx<KW;kx++)
            col[idx++] = in[c*H*W + (oy+ky)*W + (ox+kx)];
    // one output pixel oc = dot_i8(col, weight[oc], C_in*KH*KW)  -> conv == im2col + GEMM
}

// 3.3 NMS with Q16.16 IoU
struct Box { int16_t x1,y1,x2,y2; };
int32_t area(Box b){ return (int32_t)(b.x2-b.x1) * (int32_t)(b.y2-b.y1); }
int32_t iou_q16(Box a, Box b){
    int32_t ix1 = imax(a.x1, b.x1);               // intersection rectangle
    int32_t iy1 = imax(a.y1, b.y1);
    int32_t ix2 = imin(a.x2, b.x2);
    int32_t iy2 = imin(a.y2, b.y2);
    int32_t iw = imax(0, ix2 - ix1);              // overlap width,  clamped >= 0
    int32_t ih = imax(0, iy2 - iy1);              // overlap height, clamped >= 0
    int32_t inter = iw * ih;
    int32_t uni   = area(a) + area(b) - inter;
    if(uni <= 0) return 0;                         // guard divide-by-zero
    return (int32_t)(((int64_t)inter << 16) / uni);   // IoU in Q16.16
}

int nms(const Box* boxes, const int32_t* score, int N, int32_t thr_q16, int* kept){
    bool removed[64] = {false};
    int nkept = 0;
    for(;;){
        // pick the highest-scoring box still alive
        int best = -1;
        int32_t bs = INT32_MIN;
        for(int i = 0; i < N; i++){
            if(!removed[i] && score[i] > bs){
                bs = score[i];
                best = i;
            }
        }
        if(best < 0) break;
        kept[nkept++] = best;
        removed[best] = true;
        // suppress everything overlapping the winner
        for(int j = 0; j < N; j++){
            if(!removed[j] && iou_q16(boxes[best], boxes[j]) > thr_q16)
                removed[j] = true;
        }
    }
    return nkept;
}
```

Verified output:

```
3.1 dot_i8 = -20 (want -20)
    max |product| = 128*128 = 16384 ; safe K < INT32_MAX/16384 = 131071
3.2 patch(0,0) = [0,1,2,4,5,6,8,9,10]
    conv 2x2 (all-ones 3x3) = 45 54 81 90
3.3 IoU(A,B) q16=21845 (0.3333)  IoU(A,C)=0
    thr=0.3 kept [0 2]   (want 0 2)
    thr=0.5 kept [0 1 2] (want 0 1 2)
```

- **3.1**: the largest-magnitude product is `−128×−128 = 16384` (bigger than
  `127×127`). Worst case all products are `16384`, so the accumulator stays in
  INT32 while `K·16384 ≤ INT32_MAX`, i.e. `K ≤ 131071`. Real conv/FC layers are
  far below that, which is why an INT32 accumulator is enough.
- **3.2**: `patch(0,0)` gathers the top-left 3×3 block `[0,1,2,4,5,6,8,9,10]`;
  the all-ones kernel makes each output the sum of its 3×3 window
  (`45,54,81,90`). The gather turns conv into the **same** `dot_i8` from 3.1 —
  that identity (**conv = im2col + GEMM**) is why accelerators implement one fast
  matmul and lower everything else onto it. Cost: im2col duplicates overlapping
  pixels (`KH·KW×` memory), which is why it is memory-bound (Topic 4).
- **3.3**: `imax(0, ix2−ix1)` makes a non-overlapping box give `iw=0 →
  inter=0 → IoU=0` with no branch; the `uni<=0` guard avoids div-by-zero; IoU is
  one `(inter<<16)/uni` in Q16.16. `IoU(A,B)=0.3333`, so threshold `0.3`
  suppresses B (kept `{0,2}`) but `0.5` keeps it (`{0,1,2}`). The disjoint box C
  is always kept. NMS is the *branchy* counter-example: the greedy pick+suppress
  loop is inherently data-dependent, so it runs on the scalar core, not the PE
  array — knowing **which** kernels belong on the array vs the host is itself an
  interview point (Topic 5).

### 3.4 Conv2d in depth — direct loops and im2col

**What conv computes.** For each output pixel: take a `C_in·KH·KW` window of the
input, multiply element-wise with the kernel, sum. That is **6 nested loops**
(oc → oy → ox → ic → ky → kx); the inner three are a **dot product over the
receptive field**.

Worked example — `3×3` input `1..9`, `2×2` kernel `[[1,2],[3,4]]`, VALID / stride
1 → `2×2` output. Output(0,0) uses window `[[1,2],[4,5]]`:
`1·1 + 2·2 + 4·3 + 5·4 = 37`. Sliding gives `[[37,47],[67,77]]`.

#### (A) Direct — the 6 loops

```cpp
// in [C_in][H][W], weight [C_out][C_in][KH][KW], out [C_out][Ho][Wo], row-major
void conv2d_direct(const int32_t* in, const int32_t* w, int32_t* out,
                   int C_in,int H,int W, int C_out,int KH,int KW){
    int Ho=H-KH+1, Wo=W-KW+1;                     // VALID padding, stride 1
    for(int oc=0; oc<C_out; oc++)
      for(int oy=0; oy<Ho; oy++)
        for(int ox=0; ox<Wo; ox++){
            int32_t acc = 0;
            for(int ic=0; ic<C_in; ic++)
              for(int ky=0; ky<KH; ky++)
                for(int kx=0; kx<KW; kx++)
                    acc += in[ic*H*W + (oy+ky)*W + (ox+kx)]
                         * w [oc*(C_in*KH*KW) + ic*KH*KW + ky*KW + kx];
            out[oc*Ho*Wo + oy*Wo + ox] = acc;
        }
}
```

Index math is row-major flattening: `[ic][iy][ix]` → `ic*(H*W)+iy*W+ix`. Output
`(oy,ox)` reads the window starting at input `(oy,ox)` (stride 1). INT8 variant:
`in`/`w` become `int8_t`, `acc` stays `int32_t`, then `requant()` (see §3 GEMM).

#### (B) im2col — turn conv into GEMM

im2col ("image to column") is a **data rearrangement**: each sliding window is
flattened into one **row** of a matrix `[P=Ho·Wo][K=C_in·KH·KW]`.

```
im2col matrix (each row = one output window, flattened in weight order):
  row 0 (out 0,0): [1,2,4,5]
  row 1 (out 0,1): [2,3,5,6]
  row 2 (out 1,0): [4,5,7,8]
  row 3 (out 1,1): [5,6,8,9]
kernel flattened: [1,2,3,4]
```

Each **row · flattened-kernel = one output pixel** — the same dot product the
direct loops compute. So `col[P×K] @ weightᵀ[K×C_out] = out[P×C_out]` is a
**GEMM**.

```cpp
void im2col(const int32_t* in, int32_t* col, int C_in,int H,int W,int KH,int KW){
    int Ho=H-KH+1, Wo=W-KW+1, K=C_in*KH*KW;
    for(int oy=0; oy<Ho; oy++)
      for(int ox=0; ox<Wo; ox++){
        int p = oy*Wo + ox, t = 0;                // p = row, t = 0..K-1
        for(int ic=0; ic<C_in; ic++)              // SAME order as the weights
          for(int ky=0; ky<KH; ky++)
            for(int kx=0; kx<KW; kx++)
              col[p*K + t++] = in[ic*H*W + (oy+ky)*W + (ox+kx)];
      }
}
// then gemm(col, weight, out, P=Ho*Wo, K=C_in*KH*KW, C_out)  -- the §3 GEMM
```

Verified: direct and im2col agree (`37 47 67 77`), including a multi-channel
check (`C_in=2, C_out=3`).

- **The rule that makes it correct:** im2col must flatten each window in the
  **exact order the weights are stored** (`ic→ky→kx`). Then col-position `t`
  aligns with weight element `t`. Wrong order = silent garbage (classic port bug).
- **Why:** hardware/BLAS has one hyper-optimized GEMM; lowering conv onto it
  (im2col + GEMM) reuses all that tiling/vectorization. "Conv is MatMul wearing a
  sliding-window costume."
- **The cost (→ Topic 4):** the col matrix duplicates each input pixel up to
  `KH·KW×` (a `3×3` conv ≈ 9× the input bytes), which is expensive on a
  memory-bound accelerator. Real hardware often does **implicit im2col** — fuse
  the gather into the matmul's operand loading so `col` is never materialized.

### 3.5 "Are all those loops efficient?" — loop order beats loop count

The naive 6-loop conv is a **correctness baseline, not fast code** — but the fix
is *not* fewer loops. Same math, same MAC count, different loop order:

```cpp
// (B) reordered: ox innermost -> stride-1, dependency-free -> vectorizes
void conv_vectorizable(const float* in,const float* w,float* out,
                       int C_in,int H,int W,int C_out,int KH,int KW){
    int Ho=H-KH+1, Wo=W-KW+1;
    memset(out,0,sizeof(float)*C_out*Ho*Wo);
    for(int oc=0;oc<C_out;oc++)
     for(int ic=0;ic<C_in;ic++)
      for(int ky=0;ky<KH;ky++)
       for(int kx=0;kx<KW;kx++){
         float wv = w[oc*C_in*KH*KW+ic*KH*KW+ky*KW+kx];   // broadcast, invariant over ox
         for(int oy=0;oy<Ho;oy++){
           const float* irow = in + ic*H*W + (oy+ky)*W + kx;
           float* orow = out + oc*Ho*Wo + oy*Wo;
           for(int ox=0;ox<Wo;ox++) orow[ox] += irow[ox]*wv;  // stride-1 in & out
         }
       }
}
```

Measured (`C_in=C_out=64, 64×64, 3×3` = 141.7M MACs, identical output, `diff=0`):

```
                            -O2        -O3 -march=native
  naive (reduction inner)   125.47 ms   178.20 ms
  reordered (ox inner)        78.25 ms    17.37 ms   <- ~10x, same math
```

- **Can't loop your way out of the arithmetic:** conv needs
  `C_out·Ho·Wo·C_in·KH·KW` MACs; both versions do all of them. Loop *count* is the
  wrong metric — **bytes moved per MAC** (arithmetic intensity) is the right one
  (Topic 4 roofline).
- **Why B wins:** its inner loop is stride-1 and dependency-free → the compiler
  emits SIMD; the naive inner loop is a serial reduction with strided access. Plus
  contiguous access (full cache lines, prefetch) and weight reuse (`wv` broadcast).
- **`-O3` doesn't fix bad structure:** the naive form was *slower* at `-O3` than
  `-O2` (178 vs 125). Speed came from writing a vectorizable loop shape, then
  letting `-O3 -march=native` exploit it.
- **Efficiency toolkit (all still loops):** loop reorder (shown) · tiling/blocking
  (Topic 4) · im2col + tuned GEMM (§3.4) · SIMD intrinsics · Winograd/FFT
  (*algorithmically* fewer MACs, changes numerics).
- **On the PE array:** the loops are a *specification*; the compiler maps them to
  dataflow — which dim is spatially unrolled across PEs, which stays **stationary**
  (weight- vs output-stationary), and how tiles stream `DDR→L2→LRM`. "How many
  loops" → "**what dataflow, how many bytes per MAC**" (Topic 4).
- **Order to optimize in:** correct naive first → (1) memory access & reuse →
  (2) enable vectorization/parallelism → (3) tile for the memory hierarchy.

---

## 4. Tiling & Data Reuse (the roofline)

**The memory hierarchy.** `DDR/LPDDR` (GBs, slow, ~50 GB/s) → on-chip `L2` (KBs–MBs,
fast) → per-PE `LRM`/registers (tiny, fastest). Every level up is ~10× faster and
~10× smaller. A MAC is nearly free; **fetching its operands from DDR is the
cost**. So the game is: load a byte once into fast memory and **reuse** it for as
many MACs as possible before evicting it.

**Tiling** = partition the loops so the working set of each block fits in fast
memory and is reused there. Same MACs, far less DDR traffic.

**Roofline** puts a number on it. Define **arithmetic intensity**
`AI = ops / bytes_moved`. Attainable throughput is
`min(peak_compute, AI × bandwidth)`. The crossover — the **ridge point** —
is `AI = peak/bandwidth`:
- `AI < ridge` → **memory-bound** (you're waiting on DDR; adding compute won't help).
- `AI > ridge` → **compute-bound** (the array is saturated).
Tiling **raises AI** (more reuse per loaded byte), sliding you right, up the ramp,
toward compute-bound.

### Worked example — tiled matmul + the roofline math (verified)

```cpp
// tiled ikj: block by T so A/B/C tiles stay hot in cache and get reused
void mm_tiled(const float* A, const float* B, float* C, int N, int T){
    memset(C, 0, sizeof(float)*N*N);
    for(int ii = 0; ii < N; ii += T)                 // tile over rows of C
      for(int kk = 0; kk < N; kk += T)               // tile over the shared K dim
        for(int jj = 0; jj < N; jj += T){            // tile over cols of C
            int iM = min(ii+T, N);
            int kM = min(kk+T, N);
            int jM = min(jj+T, N);
            for(int i = ii; i < iM; i++)
              for(int k = kk; k < kM; k++){
                  float a = A[i*N + k];
                  const float* Br = B + k*N;
                  float* Cr = C + i*N;
                  for(int j = jj; j < jM; j++)
                      Cr[j] += a * Br[j];            // stride-1 inner -> vectorizes
              }
        }
}
```

Measured, `N=1024`, identical output (`diff=0`):

```
  naive ijk       7029.5 ms    0.31 GFLOP/s   <- B column-walk: cache-hostile
  reorder ikj      181.3 ms   11.84 GFLOP/s   <- stream+vectorize: 39x
  tiled T=64       159.3 ms   13.48 GFLOP/s   <- + reuse: further 1.14x
```

Roofline arithmetic for matmul (verified by calc):

```
matmul N=1024 = 2.15 GFLOP
  AI perfect-reuse = 170.7 FLOP/byte   (read A,B + write C once -> compute-bound)
  AI naive no-reuse=   0.25 FLOP/byte  (re-read a row+col per output -> memory-bound)

accelerator: peak 10 TOPS, BW 50 GB/s  ->  ridge AI = 200 ops/byte
  GEMM 256x256x256 (tiled)    AI=170.67  MEMORY   85.3% of peak
  ReLU 1M int8 (elementwise)  AI=  0.50  MEMORY    0.2% of peak
  batch-1 FC 2048x2048        AI=  2.00  MEMORY    1.0% of peak
```

- **Naive matmul AI is ~0.25** (re-reads a full row of A and column of B per
  output); tiling drives effective AI toward the `N/6 ≈ 170` reuse ceiling. That
  is the entire point of tiling: **raise AI**.
- **Why the *measured* tiling gain is only 1.14×:** a CPU has *automatic* caches +
  a hardware prefetcher, so `ikj` already reuses well. On the target accelerator
  the on-chip buffer is a **software-managed scratchpad with no automatic cache** —
  you must *explicitly* DMA tiles into L2/LRM, so **tiling is mandatory**, not a
  1.14× bonus. Get it wrong and every access hits DDR.
- **Most inference is memory-bound** (ReLU 0.2%, batch-1 FC 1.0% of peak) — matches
  the ONNX walkthrough's "every attention row is memory-bound at batch 1." Big
  well-tiled GEMMs are the exception that approaches peak.

**DMA & double-buffering (prefetch).** Even with tiling you stall if compute waits
for the next tile's DMA. Fix: **ping-pong buffers** — while the PE array computes
on tile in buffer `A`, DMA the *next* tile into buffer `B`, then swap. Memory
latency hides behind compute.

```cpp
// double-buffered tile stream (schematic)
dma_start(buf[0], tile[0]);
for (int t=0; t<num_tiles; ++t){
    dma_wait(buf[t&1]);                       // this tile has arrived
    if (t+1<num_tiles) dma_start(buf[(t+1)&1], tile[t+1]); // prefetch next
    compute(buf[t&1]);                         // overlaps with the DMA above
}
```

### Exercises

**4.1 (easy) — roofline classification.** Accelerator: peak `20 TOPS`, bandwidth
`80 GB/s`. (a) What is the ridge-point AI? (b) An elementwise `add` of two INT8
tensors (read 2 bytes, write 1, per 1 op) — AI and bound? (c) A well-tiled INT8
GEMM with AI `256` op/byte — bound, and at roughly what % of peak?

**4.2 (medium) — tile-size budget + reuse factor.** On-chip L2 is `256 KB`. For a
float GEMM you must hold three `T×T` tiles (A, B, C) simultaneously. (a) Largest
`T` (power-of-two) that fits? (b) With that tile, how many MACs happen per float
loaded from DDR (the reuse factor ≈ `T`)? (c) If you switch to INT8 (1 byte), how
does the max `T` change?

**4.3 (interview) — tiled + double-buffered INT8 GEMM.** Write `gemm_tiled_i8`:
INT8 `A[M×K] · W[K×N]` → INT32 accumulate → `requant` (from §3) → INT8 `C[M×N]`,
blocked by `TM×TN×TK`, with the accumulator tile kept in registers/LRM across the
`K`-tiles (so C is written once). Then sketch (comments are fine) where the
ping-pong DMA of the next `A`/`W` tile overlaps the compute. Explain which operand
is "stationary" in your loop order and why.

### Solutions 4.1–4.3 (verified)

**4.1 — roofline classification.** Ridge = `peak/BW = 20e12 / 80e9 = 250 op/byte`.
- (b) INT8 `add`: 2 reads + 1 write = **3 bytes per op**, `AI = 1/3 ≈ 0.33`. Far
  below 250 → **memory-bound**; attainable `≈ 0.33 × 80 GB/s = 26.7 GOPS ≈ 0.13%`
  of peak.
- (c) GEMM `AI = 256 > 250` → **compute-bound**, running at ≈ peak (~100%, 20 TOPS).

**4.2 — tile budget + reuse.** L2 = `262144 B`; hold three `T×T` tiles.
- (a) float (4 B): `3·T²·4 ≤ 262144 → T² ≤ 21845 → T ≤ 147.8` → **T = 128**
  (largest power of two).
- (b) reuse factor ≈ **`T` = 128 MACs per DDR-loaded element** (each loaded tile
  element feeds `T` MACs before eviction) — that is how tiling lifts AI.
- (c) INT8 (1 B): `3·T²·1 ≤ 262144 → T ≤ 295.6` → **T = 256** — smaller elements
  let the tile roughly **double**, doubling reuse.

**4.3 — tiled + double-buffered INT8 GEMM (output-stationary), verified vs
reference:**

```cpp
void gemm_tiled_i8(const int8_t* A, const int8_t* W, int8_t* C, int M, int K, int N,
                   const int32_t* mult, const int* shift, int TM, int TN, int TK){
    const int MAXT = 64;
    int32_t acc[MAXT*MAXT];                          // the output tile, kept in LRM

    for(int i0 = 0; i0 < M; i0 += TM)
      for(int j0 = 0; j0 < N; j0 += TN){
          int tm = (i0+TM < M ? TM : M-i0);          // clamp tile at the edges
          int tn = (j0+TN < N ? TN : N-j0);

          // zero the accumulator tile
          for(int ii = 0; ii < tm; ii++)
            for(int jj = 0; jj < tn; jj++)
                acc[ii*TN + jj] = 0;

          // accumulate over all K-tiles WITHOUT writing C (output-stationary)
          for(int k0 = 0; k0 < K; k0 += TK){
              int tk = (k0+TK < K ? TK : K-k0);
              // dma_start(next A/W tile); dma_wait(current);  <-- ping-pong prefetch
              for(int ii = 0; ii < tm; ii++)
                for(int kk = 0; kk < tk; kk++){
                    int8_t a = A[(i0+ii)*K + (k0+kk)];
                    for(int jj = 0; jj < tn; jj++)
                        acc[ii*TN + jj] += (int32_t)a * (int32_t)W[(k0+kk)*N + (j0+jj)];
                }
          }

          // requantize and write the C tile exactly once
          for(int ii = 0; ii < tm; ii++)
            for(int jj = 0; jj < tn; jj++)
                C[(i0+ii)*N + (j0+jj)] = requant(acc[ii*TN + jj], mult[j0+jj], shift[j0+jj]);
      }
}
// tiled INT8 GEMM matches reference: YES
```

- **Stationary operand = the output tile `acc` (C).** It stays resident in
  registers/LRM across *all* `K`-tiles, so partial sums are never spilled to
  memory and C is requantized/written exactly once — **output-stationary**
  dataflow. (Weight-stationary would instead pin a `W` tile and stream A/C.)
- **Prefetch point:** issue the DMA for the *next* `k0` tile of A/W right after
  `dma_wait` on the current one, so the transfer overlaps the MAC loop below it.

### 4.4 Memory layout — Array-of-Structs vs Struct-of-Arrays

**Same data, two layouts.** For an RGB image:
```cpp
// AoS: one struct per pixel, laid out R,G,B,R,G,B,...
struct RGB { uint8_t r, g, b; };
std::vector<RGB> aos(N);

// SoA: one contiguous array per channel, laid out RRR..GGG..BBB..
uint8_t R[N], G[N], B[N];
```
When a kernel processes **one channel at a time** (very common), AoS forces a
**strided** walk — reading `r` skips over `g,b`, so each 64-byte cache line
delivers only ~1/3 useful bytes and SIMD can't pack contiguous lanes. SoA makes
that channel **contiguous**: full cache lines, clean vectorization.

Measured — per-channel 3×3 box blur of a 1024×1024 image (identical output):
```
AoS  2.40 ms
SoA  1.00 ms     <- 2.4x, just from layout
```
- Use **AoS** when you touch all fields of an element together (whole-pixel ops).
- Use **SoA** when you sweep one field across many elements (per-channel conv,
  reductions, anything you want to vectorize) — the accelerator case.
- Same "bytes moved per *useful* byte" idea as the roofline: AoS drags 2 unwanted
  channels through cache for every wanted one.

### 4.5 Reuse vs recompute — a complete 2D box-blur example

A box blur is a convolution with an all-ones `KH×KW` kernel. The **dumb** way
re-adds the whole window for every output pixel. The **smart** (separable) way
splits the 2D window into a vertical pass then a horizontal pass, so each vertical
partial sum is computed **once and reused** by the horizontal outputs that overlap
it. Below is the complete, runnable implementation for a `4×4` input and a `2×2`
window (VALID padding, stride 1 → `3×3` output). It counts binary additions so the
reuse is visible.

```cpp
#include <cstdio>

// Output size: Ho = H-KH+1, Wo = W-KW+1. We compute the window SUM (divide by
// KH*KW for the average). Both functions must produce identical output.

// -------- DUMB: for every output pixel, re-add the whole KH x KW window --------
long blur_dumb(const int* in, int H, int W, int KH, int KW, int* out){
    int Ho = H - KH + 1;
    int Wo = W - KW + 1;
    long adds = 0;
    for(int oy = 0; oy < Ho; oy++){
        for(int ox = 0; ox < Wo; ox++){
            int s = in[oy*W + ox];                 // seed with first element (no add)
            for(int ky = 0; ky < KH; ky++){
                for(int kx = 0; kx < KW; kx++){
                    if(ky == 0 && kx == 0) continue;   // already seeded
                    s += in[(oy+ky)*W + (ox+kx)];      // re-add every window element
                    adds++;
                }
            }
            out[oy*Wo + ox] = s;
        }
    }
    return adds;
}

// -------- SMART (separable): reduce each column over KH first (vertical partial
// sums), then reduce each row of those over KW. Each vertical partial sum is
// computed ONCE and reused by the KW overlapping horizontal outputs. --------
long blur_separable(const int* in, int H, int W, int KH, int KW,
                    int* vsum, int* out){          // vsum: scratch, size Ho*W
    int Ho = H - KH + 1;
    int Wo = W - KW + 1;
    long adds = 0;
    // Pass 1 (vertical): vsum[r][c] = sum of in[r..r+KH-1][c]
    for(int r = 0; r < Ho; r++){
        for(int c = 0; c < W; c++){
            int s = in[r*W + c];                   // seed
            for(int ky = 1; ky < KH; ky++){
                s += in[(r+ky)*W + c];
                adds++;
            }
            vsum[r*W + c] = s;
        }
    }
    // Pass 2 (horizontal): out[r][c] = sum of vsum[r][c..c+KW-1]
    for(int r = 0; r < Ho; r++){
        for(int c = 0; c < Wo; c++){
            int s = vsum[r*W + c];                  // seed (reuses a vertical partial sum)
            for(int kx = 1; kx < KW; kx++){
                s += vsum[r*W + (c+kx)];
                adds++;
            }
            out[r*Wo + c] = s;
        }
    }
    return adds;
}

int main(){
    const int H = 4, W = 4, KH = 2, KW = 2;
    const int Ho = H-KH+1, Wo = W-KW+1;
    int in[H*W];
    for(int i = 0; i < H*W; i++) in[i] = i + 1;     // 1..16

    int out_dumb[Ho*Wo], out_sep[Ho*Wo], vsum[Ho*W];
    long a_dumb = blur_dumb(in, H, W, KH, KW, out_dumb);
    long a_sep  = blur_separable(in, H, W, KH, KW, vsum, out_sep);

    int bad = 0;
    for(int i = 0; i < Ho*Wo; i++) if(out_dumb[i] != out_sep[i]) bad++;
    printf("identical: %s   adds: dumb=%ld separable=%ld\n", bad==0?"YES":"NO", a_dumb, a_sep);
    return 0;
}
```

Verified output:

```
input 4x4:                vertical partial sums vsum[3x4]:     output 3x3 (2x2 sum):
  1   2   3   4              6   8  10  12                       dumb:      14 18 22 30 34 38 46 50 54
  5   6   7   8             14  16  18  20                       separable: 14 18 22 30 34 38 46 50 54
  9  10  11  12             22  24  26  28
 13  14  15  16

identical: YES   adds: dumb=27 separable=21
```

- **Where the reuse is:** `vsum[0][1] = in[0][1]+in[1][1] = 8` is computed **once**
  but feeds *two* outputs — `out[0][0]=vsum[0][0]+vsum[0][1]=6+8=14` and
  `out[0][1]=vsum[0][1]+vsum[0][2]=8+10=18`. The dumb version recomputes that
  column pair for each. Hence `27 → 21` adds even on this tiny case.
- **It scales hard:** dumb does `KH·KW−1` adds per output; separable does
  `(KH−1)+(KW−1)`. For `3×3`: 8 vs 4; for `7×7`: 48 vs 12 — the gap grows with the
  window. This is why separable filters are a standard optimization.

**Pushing reuse further — the 1D sliding sum.** Within one pass you can also reuse
the *overlap between adjacent windows*: keep a running sum and only add the
entering sample / subtract the leaving one — `O(1)` per output regardless of window
size.

```cpp
// 1D running sum: reuses the previous window's result
int32_t s = 0;
for(int k = 0; k < 2*R+1; k++)            // prime the window once
    s += in[k];
out[R] = s;
for(int i = R+1; i < N-R; i++){
    s += in[i+R] - in[i-R-1];             // + entering sample, - leaving sample
    out[i] = s;
}
```

Measured against the recompute version — `N=2,000,000`, window `1001`:
```
dumb   88.82 ms
smart   1.62 ms     <- ~55x
```
**Honest nuance (also measured):** at a *small* window (`W=101`) the dumb loop was
actually a touch faster — each output is independent so the compiler **vectorizes**
it, while the running sum has a loop-carried dependency that cannot vectorize. The
reuse win only dominates once the window is large enough that `O(W)` outweighs the
SIMD speedup. Algorithmic reuse and hardware vectorization can pull in opposite
directions — **measure**.

---

## 5. Operator Mapping

An ONNX model is a **graph** of operators. The toolchain matches each op to a
library kernel that runs on the PE array. Two things break that: an op the
library **doesn't support**, and adjacent ops that each round-trip to DDR when
they could share one pass. Operator mapping is the craft of (a) **decomposing**
an op into primitives the array can run, (b) **fusing** ops to cut memory
traffic, and (c) **partitioning** the graph around anything that can't map.

**The primitive vocabulary.** Almost every op is a composition of a handful of
shapes the array (or host) executes well:

| primitive | what it is | examples |
|-----------|-----------|----------|
| **elementwise / map** | 1 output per input, no cross-talk | ReLU, add, mul, clamp, HardSwish |
| **reduction** | collapse an axis | sum, max, mean → softmax denom, LayerNorm mean, pooling |
| **contraction (MAC)** | multiply-accumulate over a shared dim | MatMul, Conv, attention |
| **gather / scatter** | data-dependent addressing, no arithmetic | embedding lookup, im2col, indexing |
| **broadcast** | replicate along a dim | bias add, scale |

If an op decomposes into these, it maps. If it needs something **outside** the set
— data-dependent control flow, **sorting**, dynamic shapes — it maps poorly and
belongs on the host scalar core or as a custom kernel (NMS from §3.3 is the
example).

### Worked example A — decomposing an "exotic" op (HardSwish, verified)

`HardSwish(x) = x · clamp(x+3, 0, 6) / 6` is not one library primitive, but it
**decomposes** into ones we already have — all elementwise, so they fuse into a
single pass:

```cpp
int32_t hardswish_q(int32_t x){                // Q16.16
    int32_t t = x + to_q(3.0);                 // primitive: add (broadcast const)
    t = imax(0, imin(to_q(6.0), t));           // primitive: clamp  = min then max
    int32_t xt = q_mul(x, t);                  // primitive: multiply
    return q_mul(xt, to_q(1.0/6.0));           // primitive: scale by 1/6
}
```
```
hardswish(-4.0) fixed=+0.0000  float=-0.0000
hardswish(-2.0) fixed=-0.3333  float=-0.3333
hardswish(+1.0) fixed=+0.6667  float=+0.6667
hardswish(+3.0) fixed=+3.0001  float=+3.0000     // +0.0001 = Q16.16 rounding of 1/6
hardswish(+4.0) fixed=+4.0001  float=+4.0000
```
The mapping recipe: **read the op's math, express it as add / clamp / mul /
reduce, and check each piece is a supported primitive.** If yes, you have a
kernel.

### Worked example B — fusion (verified, measured)

The tail after every Linear/Conv — `y = requantize(ReLU(x + bias))` — is three
elementwise ops. **Unfused**, each is a separate pass that reads and writes the
whole tensor to DDR. **Fused**, the intermediate never leaves a register:

```cpp
// UNFUSED: 3 passes, 3 tensor round-trips to memory
for(int i=0;i<N;i++) t[i]  = x[i] + bias;      // read x, write t
for(int i=0;i<N;i++) t[i]  = relu(t[i]);       // read t, write t
for(int i=0;i<N;i++) y1[i] = rq(t[i], scale);  // read t, write y

// FUSED: 1 pass, 1 round-trip
for(int i=0;i<N;i++){
    int32_t v = x[i] + bias;
    v = relu(v);
    y2[i] = rq(v, scale);
}
```
```
elementwise chain on 16M int32 (64 MB):   unfused 28.95 ms   fused 11.99 ms   (~2.4x, identical)
```
- These tails are **memory-bound** (Topic 4), so cutting memory passes ~3→1
  directly cuts time. Fusion is the #1 practical mapping optimization.
- The same idea inside a MAC op: fuse **Conv + Bias + ReLU + Requantize** by
  keeping the INT32 accumulator in registers, adding bias, applying ReLU, and
  requantizing to INT8 *before* the single write — instead of writing INT32,
  re-reading it, etc. One write instead of several.

### Partitioning around an unsupported op

When one op in the graph can't map (say a custom **sort**/TopK, or NMS), you
**cut** the graph: run the supported subgraphs on the array, hand the tensor to
the host scalar core for the unsupported op, then hand back. Each accelerator↔host
crossing is a **DDR round-trip + sync**, so the goals are: keep as much as
possible on the array, make the fewest cuts, and cluster consecutive supported ops
into one subgraph.

```
Conv → ReLU → [Custom Sort] → Gather → Conv        (→ = tensor edge)
└──── array subgraph 1 ────┘   host    └─ array subgraph 2 ─┘
                                cut          cut
```
Options, best first: (1) **support the op** (write a custom array kernel if it
fits the primitives); (2) if it's inherently branchy/serial, run it on the host
and minimize the handoff; (3) sometimes **replace/approximate** it with something
that *does* map (e.g., swap an exotic activation for a clampable one) if accuracy
allows.

### Exercises

**5.1 (easy) — decompose HardSigmoid.** `HardSigmoid(x) = clamp(0.2·x + 0.5, 0, 1)`.
Write `hardsigmoid_q` in Q16.16 as a fused chain of primitives (scale, add,
clamp). Name each primitive. Test `x = -4, -1, 0, 1, 4` and check against the float
formula.

**5.2 (medium) — map Softmax onto primitives.** Write down (and code) the primitive
sequence for `softmax(v)` over a length-`n` vector: which steps are **reductions**,
which are **elementwise**, and which is the awkward one for a fixed-point ALU?
Implement it in float first (`max`-shift for stability → `exp` → `sum` → divide),
then say how you'd realize `exp` with no FPU (hint: lookup table or polynomial on a
reduced range). Which two steps could you fuse?

**5.3 (interview) — partition a graph.** You are given this subgraph:
`Conv → Add(bias) → HardSwish → TopK(k=100) → Gather → Conv`. The accelerator
supports Conv/Add/HardSwish/Gather but **not** TopK (a data-dependent partial
sort). (a) Draw the partition: which ops form array subgraphs, where does the host
run? (b) How many accelerator↔host crossings, and what does each cost? (c) Which
adjacent ops would you **fuse** within each array subgraph, and why? (d) The first
Conv output is large; TopK keeps only 100 rows — does that change *where* you'd
prefer to cut to reduce DDR traffic?

### Solutions 5.1–5.3 (verified)

**5.1 — HardSigmoid = clamp(0.2·x + 0.5, 0, 1).** Primitives: **scale** → **add** →
**clamp**.

```cpp
int32_t hardsigmoid_q(int32_t x){
    int32_t t = q_mul(x, to_q(0.2));           // primitive: scale
    t = t + to_q(0.5);                         // primitive: add (broadcast const)
    return imax(0, imin(ONE, t));              // primitive: clamp to [0,1]
}
```
```
x=-4.0 fixed=0.0000  x=-1.0 fixed=0.3000  x=0.0 fixed=0.5000  x=1.0 fixed=0.7000  x=4.0 fixed=1.0000
```
(matches the float formula exactly at these points).

**5.2 — Softmax.** `softmax(v)_i = e^(v_i − m) / Σ_j e^(v_j − m)`, `m = max(v)`.
Primitive breakdown:
- `m = max(v)` — **reduction**.
- `v_i − m` and `e^(·)` — **elementwise** (the `−m` shift keeps `exp`'s argument
  ≤ 0, so it can't overflow — numerical stability).
- `Σ e^(·)` — **reduction**.
- `/ sum` — **elementwise** (broadcast the scalar denominator).

```cpp
void softmax_f(const double* v, int n, double* out){
    double m = v[0];
    for(int j=1;j<n;j++) if(v[j] > m) m = v[j];        // reduction: max
    double s = 0;
    for(int j=0;j<n;j++){ out[j] = std::exp(v[j]-m); s += out[j]; } // elementwise + reduction
    for(int j=0;j<n;j++) out[j] /= s;                  // elementwise divide
}
// softmax([2,1,0.1,3]) = 0.2361 0.0869 0.0353 0.6418   (verified)
```

**The awkward step is `exp` — no FPU has it.** Realize it in fixed-point via
`e^x = 2^(x·log2 e)`: split the exponent into an integer part (a **shift**) and a
fractional part in `[0,1)` (a small **polynomial** or LUT). For softmax's range
`x ≤ 0`:

```cpp
int32_t exp_q(int32_t x){                      // Q16.16, x <= 0
    int32_t y = q_mul(x, to_q(1.4426950409));  // y = x*log2(e)
    int32_t i = y >> FRAC;                      // floor -> integer part (<= 0)
    int32_t f = y - (i << FRAC);                // frac in [0,1)
    int32_t p = to_q(0.0555);                   // 2^f ~= Horner(1, .6931, .2402, .0555)
    p = q_mul(p, f) + to_q(0.2402);
    p = q_mul(p, f) + to_q(0.6931);
    p = q_mul(p, f) + ONE;                       // p = 2^f
    int sh = -i;
    return (sh >= 31) ? 0 : (p >> sh);           // 2^i * 2^f (shift for the integer part)
}
// exp(-1.0) fixed=0.36761 vs std::exp 0.36788 ; exp(-2.0) 0.13533 vs 0.13534  (~1e-3, verified)
```
**Fusible steps:** the `−m` subtract and the `exp` sweep the same data, so fuse
them into one pass; the final divide fuses with whatever consumes the output.

**5.3 — Partition `Conv → Add → HardSwish → TopK(k=100) → Gather → Conv`** (TopK
unsupported).
- **(a)** `[Conv → Add → HardSwish]` = **array subgraph 1** → **host: TopK** →
  `[Gather → Conv]` = **array subgraph 2**. Two cuts (array→host after HardSwish,
  host→array after TopK).
- **(b)** 2 crossings. Each is a **DDR round-trip + sync**, and the array sits
  **idle** while the host runs the serial TopK — the handoff latency, not the TopK
  math, usually dominates.
- **(c)** In subgraph 1 fuse `Conv + Add(bias) + HardSwish` (accumulator in
  registers, add bias, apply HardSwish, write **once**). In subgraph 2 fuse the
  `Gather` into the following `Conv`'s operand load (gather straight into im2col) so
  the gathered tensor is never separately materialized.
- **(d) Yes — cut where the tensor is smallest.** TopK only needs the **scores** to
  select and returns **100 indices**. Send just the scores to the host (small),
  receive 100 indices back (tiny), and keep the **large** feature tensor resident
  on-chip for the Gather to index. Shipping the whole large tensor host-and-back
  would move orders of magnitude more DDR. **Cross only what the unsupported op
  actually needs.**

---

## 6. Debugging a Port

A ported layer fails in one of two ways: **numerically wrong** or **too slow**.
Both have a methodical recipe — don't guess, read the signal.

### Numerically wrong — golden diff → bisect → read the signature

1. **Golden reference.** Run the original (float ONNX / PyTorch) and dump the
   expected output. Diff against your kernel: `max |err|`, and *where* it occurs.
2. **Bisect the pipeline.** Dump intermediate tensors and compare layer by layer
   to localize *which* op first diverges. Halve the search each time.
3. **Read the error signature** — the *shape* of the error names the bug:

| signature | likely bug |
|-----------|-----------|
| constant offset everywhere | bias / **zero-point** dropped or wrong |
| error grows with magnitude | wrong **Q-scale / shift** (scale mismatch) |
| scattered **±1 LSB** | **rounding** mode (truncation vs round, tie handling) |
| occasional **huge/negative** values | **overflow / missing saturation** (wrap) |
| output shuffled or garbage | **layout / indexing** (im2col order, transpose, strides) |
| only **edges** wrong | **padding / stride / bounds** off-by-one |
| unsigned looks negative | **signed vs unsigned** (int8 vs uint8, zero-point) |

4. **Shrink the input.** Reproduce on a `1×1` / identity-kernel case you can
   compute by hand — the smallest failing input localizes the bug fastest.

### Worked example — two planted bugs, found by signature (verified)

A ported `requant` that (bug 1) **truncates** instead of rounding and (bug 2)
**drops saturation** (raw narrowing cast). Diff against the golden `requant_ref`:

```
acc   ref   bug   err   note
  13     7     6    -1   <-- 1 LSB: rounding      (exact 6.5)
  27    14    13    -1   <-- 1 LSB: rounding      (exact 13.5)
  41    21    20    -1   <-- 1 LSB: rounding      (exact 20.5)
 260   127  -126  -253   <-- huge: overflow/wrap  (exact 130.0)
  -7    -3    -4    -1   <-- 1 LSB: rounding
```

The signature reads straight off: the pervasive **−1** on `.5` inputs ⇒ missing
rounding bias; the single **−253** (127 vs −126) ⇒ `130` overflowed int8 and
**wrapped** because saturation was dropped. Fix = add `+2^(shift−1)` before the
shift, and route the narrow through `sat8`. Re-diff → zero error. (These are the
two bugs from Topics 1 and 3 — they are *the* most common fixed-point port bugs.)

### Too slow — measure, don't guess

1. **Roofline first (Topic 4):** compute the op's arithmetic intensity, measure
   achieved GB/s and GOPS. Is it memory- or compute-bound? That decides the fix.
2. **If memory-bound:** check access pattern (strided? → reorder loops / SoA),
   tiling (working set fit L2? → block), fusion (extra passes? → fuse),
   double-buffering (stalls on DMA? → prefetch).
3. **If compute-bound but below peak:** did it **vectorize**? (check the asm / use
   `-O3 -march=native` / restructure the inner loop). Are the PEs kept busy, or is
   the array under-utilized by a bad dataflow?
4. **Sanity-check against theory:** `MACs / peak_MAC_rate` is your compute floor;
   `bytes / bandwidth` is your memory floor. If you're far above both, something is
   serialized (a hidden dependency, a scalar tail, a host handoff).

### Exercises

**6.1 (easy) — name the bug from the signature.** For each, give the most likely
cause and a one-line confirmation test: (a) every output is exactly `+5` vs
reference; (b) outputs are correct in the interior but wrong in the last row and
last column; (c) output values look randomly permuted but the *set* of values is
about right; (d) error is tiny for small activations but grows for large ones.

**6.2 (medium) — find the bug.** This im2col-based conv gives garbage. Find and fix
it (one line):
```cpp
// input [C_in][H][W], weight stored [C_out][C_in][KH][KW]
for(int ic=0; ic<C_in; ic++)
  for(int kx=0; kx<KW; kx++)          // <-- note the loop order
    for(int ky=0; ky<KH; ky++)
      col[t++] = in[ic*H*W + (oy+ky)*W + (ox+kx)];
// then out = dot(col, weight[oc], C_in*KH*KW)
```
(Hint: §3.4's "the rule that makes it correct.")

**6.3 (interview) — diagnose "too slow".** Your INT8 `3×3` conv on a big feature
map runs at **4% of peak**. Peak `10 TOPS`, DDR `50 GB/s`. The inner loop reads the
weight from DDR every MAC and writes each output the moment it's computed. (a) Is it
memory- or compute-bound — how do you tell in one measurement? (b) Name three
concrete changes (from Topics 2–5) and which bottleneck each attacks. (c) After
fixing, what roughly caps your achievable speedup, and why?

### Solutions 6.1–6.3 (verified where code)

**6.1 — signature → bug.**
- (a) constant `+5` everywhere → a **bias / zero-point** added (or the wrong
  constant). Confirm: subtract 5 → error vanishes; audit the bias/`zero_point` term.
- (b) interior right, **last row & column wrong** → **padding / bounds off-by-one**
  at the edge. Confirm: shrink to a case with no border, or hand-check the boundary
  index (`oy+ky`, `ox+kx` running past `H`/`W`).
- (c) values **permuted** but the set is right → **layout / indexing** (transpose,
  wrong stride, im2col order). Confirm: feed an asymmetric input where position
  matters and watch where each value lands.
- (d) error **grows with magnitude** → **wrong Q-scale / shift** (a multiplicative
  error). Confirm: plot err vs value — a straight line whose slope is the
  scale ratio; check `mult`/`shift`.

**6.2 — the bug (verified).** The loops flatten in order `ic → kx → ky`, but the
weights are stored `ic → ky → kx`. So each `KH×KW` window is **transposed** before
the dot product. Fix = swap the two inner loops back to `ky` then `kx`:

```cpp
for(int ic=0; ic<C_in; ic++)
  for(int ky=0; ky<KH; ky++)      // ky before kx -> matches weight storage
    for(int kx=0; kx<KW; kx++)
      col[t++] = in[ic*H*W + (oy+ky)*W + (ox+kx)];
```
```
weights   : 10 20 30 40
col (bug) : 1 3 2 4  -> dot=290      // transposed window
col (fix) : 1 2 3 4  -> dot=300      // correct
```

**6.3 — "too slow" at 4% of peak.**
- (a) **One measurement:** time the kernel; compute bytes moved and MACs done. If
  `bytes/time ≈ 50 GB/s` (peak BW) it's **memory-bound**; if `MACs/time ≈ 10 TOPS`
  it's compute-bound. Reading the weight from DDR *every MAC* means enormous
  traffic and near-zero reuse → **memory-bound** here.
- (b) Three fixes: **tile + keep weights in LRM** and reuse across outputs (attacks
  memory — raises AI); **output-stationary accumulation**, writing each result once
  instead of streaming partials (attacks memory — fewer writes); **fuse
  bias+ReLU+requant** into the accumulate and **reorder the inner loop to
  vectorize** (attacks compute/access). Double-buffer the tile DMA to hide latency.
- (c) After fixing, the **roofline caps you**: once reuse makes AI high the conv
  becomes **compute-bound**, so you're capped near peak MAC rate — limited by PE
  array **utilization** (edge/tail effects, the requant tail) rather than DDR.

---

## 7. LLM / Transformer Deep-Dive (the kernel angle)

The ONNX walkthrough built one encoder block with random weights. Here is the same
machinery as **kernels**, in execution order, with the pieces that actually matter
for an LLM: multi-head, causal masking, embeddings/positional, and the KV-cache
decode loop. Everything reuses earlier topics — attention is literally **two GEMMs
with a softmax between them**.

**A decoder block, end to end:**
```
token ids ──Gather──> embeddings ──+ positional──> x
  for each block:
     x ──LayerNorm──> ──[Wq,Wk,Wv GEMMs]──> Q,K,V
     Q,K,V ──split into H heads──> per-head causal attention ──concat──> ──Wo GEMM──> a
     x = x + a                                  (residual)
     x = x + MLP(LayerNorm(x))                  (MLP = 2 GEMMs + activation)
  x ──final LayerNorm──> ──Wlm GEMM──> logits
```
Kernel inventory: **GEMM** (every projection + MLP — Topic 3), **softmax** (Topic
5, `exp` in fixed-point), **LayerNorm** (two reductions + elementwise — Topic 5),
**Gather** (embeddings), **elementwise add** (residual). No new primitive — a
transformer is a *schedule* of the kernels you already have.

### 7.1 Worked example — single-head causal attention (verified)

Scaled dot-product attention: `scores = Q·Kᵀ/√d`, causal-mask, `softmax` per row,
then `·V`. The causal mask — "position `i` may only attend to `j ≤ i`" — is just
the **loop bound** `j <= i` (a lane-position predicate, no `-inf` fill needed):

```cpp
void attention_causal(const float* Q,const float* K,const float* V,int L,int d,float* out){
    float scale = 1.0f/std::sqrt((float)d);
    std::vector<float> p(L);
    for(int i=0;i<L;i++){                                  // each query position
        float m = -1e30f;
        for(int j=0;j<=i;j++){                             // CAUSAL: only keys j<=i
            float s=0;
            for(int k=0;k<d;k++) s += Q[i*d+k]*K[j*d+k];   // Q.Kᵀ  (GEMM row)
            p[j] = s*scale;
            if(p[j] > m) m = p[j];
        }
        float sum=0;
        for(int j=0;j<=i;j++){ p[j] = std::exp(p[j]-m); sum += p[j]; }  // stable softmax
        for(int j=0;j<=i;j++) p[j] /= sum;
        for(int k=0;k<d;k++){                              // P.V  (second GEMM)
            float acc=0;
            for(int j=0;j<=i;j++) acc += p[j]*V[j*d+k];
            out[i*d+k] = acc;
        }
    }
}
```

Verified attention weights (`L=4, d=2`) — note the **lower-triangular** shape (each
row sums to 1 over only the allowed keys):
```
i=0: 1.000 0.000 0.000 0.000
i=1: 0.451 0.549 0.000 0.000
i=2: 0.290 0.396 0.314 0.000
i=3: 0.209 0.319 0.232 0.239
```
- **Fixed-point mapping:** `Q·Kᵀ` and `P·V` are INT8 GEMMs (Topic 3); the `1/√d`
  scale folds into the requantize multiplier; `exp` uses `exp_q` (Topic 5).
- **On the array:** the causal mask is a per-lane position compare (branchless
  predicate); softmax is a max-reduce, exp, sum-reduce, divide across the row.

### 7.2 Multi-head — split, attend, concat

Multi-head splits the `d`-dim into `H` heads of size `dh = d/H`; each head runs the
same attention on its own slice, then the outputs concatenate back to `d`. It's a
**reshape**, not new math:

```cpp
// x is [L][d]; view head h as columns [h*dh, (h+1)*dh). Run attention per head.
for(int h=0; h<H; h++){
    // gather this head's Q,K,V slices (stride d, offset h*dh), each [L][dh]
    // attention_causal(Qh, Kh, Vh, L, dh, out_h);
    // write out_h back into columns [h*dh, (h+1)*dh) of the [L][d] output
}
// then one Wo GEMM mixes the concatenated heads.
```
Why: each head learns a different relation (syntax, coreference, …) on a cheaper
`dh`-dim subspace. Cost is the same as one `d`-dim attention — `H` heads of size
`d/H` — but more expressive.

### 7.3 KV-cache decode — the LLM runtime pattern (verified)

Generation has two phases. **Prefill:** run full causal attention over the prompt
once (the `O(L²)` triangle above). **Decode:** produce tokens one at a time — but
recomputing all past rows every step would be `O(L²)` *per token*. Instead **cache
K and V**: each new token computes one query, appends its `k,v` to the cache, and
attends over `cache[0..t]`:

```cpp
void decode_step(const float* q,const float* Kc,const float* Vc,int t,int d,float* out){
    float scale = 1.0f/std::sqrt((float)d);
    std::vector<float> p(t+1);
    float m=-1e30f;
    for(int j=0;j<=t;j++){ float s=0; for(int k=0;k<d;k++) s+=q[k]*Kc[j*d+k]; p[j]=s*scale; if(p[j]>m)m=p[j]; }
    float sum=0; for(int j=0;j<=t;j++){ p[j]=std::exp(p[j]-m); sum+=p[j]; }
    for(int j=0;j<=t;j++) p[j]/=sum;
    for(int k=0;k<d;k++){ float acc=0; for(int j=0;j<=t;j++) acc+=p[j]*Vc[j*d+k]; out[k]=acc; }
}
// append token t's k,v to the cache, then decode_step over cache[0..t].
```
Verified: decoding token-by-token with the cache reproduces the full-attention
output **exactly** (`max diff = 0`). The cache turns per-step cost from `O(L²)` into
`O(L)`.

### 7.4 The seq² story and why decode is memory-bound

- **Prefill** attention scores are `L×L` → compute and memory grow as **`O(L²)`**.
  The weight-projection GEMMs grow only linearly in `L`, so at long context the
  `Q·Kᵀ`/`P·V` (data×data) matmuls dominate. This is what **FlashAttention**
  (never materialize the `L×L` matrix — tile and stream), **KV-caching**, and
  **sliding-window** attention all attack.
- **Decode** is **memory-bound**: each new token does only `O(L·d)` MACs but must
  **read the entire KV cache** (`O(L·d)` bytes) — arithmetic intensity ~1, far
  below the roofline ridge. So LLM decode throughput is set by **memory bandwidth**
  reading the cache, not by the MAC array — exactly the "batch-1 is memory-bound"
  finding from Topics 4 and the ONNX walkthrough. Batching many sequences and
  quantizing the KV cache to INT8 are the standard fixes (more MACs per cache byte
  loaded → higher AI).

### Exercises

**7.1 (easy) — read the triangle.** In the verified weights above, row `i=2` is
`0.290 0.396 0.314 0`. (a) Why is the 4th entry 0? (b) Why do the first three sum to
1? (c) If this were **non-causal** (encoder) attention, what would change in the
loop?

**7.2 (medium) — multi-head split.** Given `attention_causal` and `x` as `[L][d]`
with `H` heads (`dh=d/H`), write the loop that (i) extracts head `h`'s `Q,K,V`
slices (columns `[h*dh, (h+1)*dh)`, row stride `d`), (ii) calls `attention_causal`
per head, and (iii) writes each head's `[L][dh]` output back into the right columns
of the `[L][d]` result. Test that `H=1` reproduces plain single-head attention.

**7.3 (interview) — KV-cache cost + INT8 cache.** For decode at position `t` with
model dim `d`: (a) how many MACs and how many cache **bytes read** per token (fp16
vs int8 cache)? (b) Compute the arithmetic intensity and argue memory- vs
compute-bound. (c) Why does **batching** sequences raise the AI, and what's the
catch? (d) One numerical risk of an INT8 KV cache and how you'd mitigate it.

---
