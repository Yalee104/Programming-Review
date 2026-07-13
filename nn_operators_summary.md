# Neural-Network Operators — Study Summary

A companion to the animated **Neural-Net Operators** page. Each operator below has a
plain-language explanation, the math, a **complete, verified C++ program** (compiled and
run with `g++ 13` before it was written here — the numbers in the `// ...` comments are the
real program output, not guesses), a short Python reference, and a note on how it maps onto
**Quadric's Chimera GPNPU**.

Every kernel is written in the same efficient style, so read section 1 first — it explains the
five ideas (branch-free control flow, the in-bounds mask, index clamping, quantized
`int8→int32` MACs, and requantize) that then recur in every operator.

---

## 1. The Quadric / Chimera coding style (read this first)

**What Chimera is.** Quadric's Chimera is a *general-purpose NPU* (GPNPU): a single programmable
core that runs matrix, vector, and scalar work in **one instruction stream** across a wide grid of
processing elements (PEs) — 64 to 1024 of them. There is no separate CPU/DSP/NPU to hand work
between; you write the whole operator in C++ and the LLVM-based compiler maps it onto the PE grid.
One 64-bit instruction advances **every lane** at once (this is what "2D SIMD" means here).

Because one instruction drives all lanes together, the code you write should have these five
properties. They show up in every operator that follows.

**(a) No data-dependent branches.** A per-element `if` would make different lanes want to do
different things — but there is one shared instruction stream, so divergence is expensive/unnatural.
Instead of branching we compute *both* possibilities and **select** with arithmetic. The simplest
example is ReLU: instead of `if (x < 0) x = 0;` we write `x = max(x, 0)`. Quadric's own compiler
patents are literally about "branchless select" and "store predication" for exactly this reason.

**(b) The in-bounds mask (for padding / boundaries).** Convolutions read neighbors that can fall off
the edge of the image. Rather than `if (0 <= iy < H && 0 <= ix < W)`, we build a **mask** — an
integer that is `1` when in bounds and `0` when not — and multiply the tap by it. Off-edge taps
contribute `0` without any branch. The mask uses one unsigned-comparison trick:

```cpp
// (unsigned)c < (unsigned)n  is 1 exactly when 0 <= c < n.
// If c is negative, casting to unsigned wraps it to a huge number, so the
// single comparison rejects it — one compare handles BOTH c >= 0 and c < n.
static inline int in_bounds(int c, int n) { return (unsigned)c < (unsigned)n; }
```

**(c) Clamp the read index with min/max.** Even when a tap is masked to `0`, the array read still
happens, so its index must be legal (no out-of-bounds memory access). We force the index into range
with the branch-free `std::min(std::max(i, 0), n-1)`. The *value* is then zeroed by the mask; the
clamp only keeps the *load* safe.

**(d) Quantized `int8 × int8 → int32`.** Chimera's fast path is integer: 8-bit activations and
weights multiply-accumulate into a 32-bit integer (`int32`), which is wide enough that thousands of
products never overflow. This is 2–4× the throughput of floating point.

**(e) Requantize.** After the `int32` accumulate we must get back to `int8` for the next layer.
Rather than divide (slow), we multiply by a **fixed-point multiplier** and right-shift, with rounding
and saturation:

```cpp
// acc(int32) -> int8:  y = round(acc * mul / 2^shift), clamped to [-128,127]
int64_t r = ((int64_t)acc * mul + (1 << (shift - 1))) >> shift;   // *mul, round
r = std::max<int64_t>(-128, std::min<int64_t>(127, r));           // saturate
```

The `+ (1 << (shift-1))` before the shift is the rounding term (it adds "half" so the shift rounds to
nearest instead of truncating). `mul` and `shift` together encode the real-number scale factor
`mul / 2^shift`.

> Throughout, "On Chimera" notes point out where each idea becomes a PE-grid concept: the mask is a
> **lane-position predicate**, the MAC loop is a **systolic accumulate**, and fused operators stay in
> **one instruction stream** with no accelerator hand-off.

---

## 2. Convolution (2D Conv)

**What it is.** A convolution slides a small weight grid (the *kernel*, e.g. 3×3) across the input
image. At each stop it multiplies the overlapping input patch element-by-element with the kernel and
sums the products — a **MAC** (multiply-accumulate) — to produce one output pixel. Stacking many such
filters is how a CNN learns to detect edges, then textures, then shapes.

**"Same" padding** means the output is the same height/width as the input; to make the kernel fit at
the borders we pretend there is a ring of zeros around the image. That border handling is where the
branch-free **mask** (section 1b) and **index clamp** (1c) earn their keep.

```cpp
#include <cstdint>
#include <cstdio>
#include <algorithm>   // std::min, std::max

static inline int in_bounds(int c, int n) { return (unsigned)c < (unsigned)n; }

// int8 input * int8 weight -> int32 accumulate, then requantize to int8.
void conv2d_same_i8(const int8_t* in, int H, int W,
                    const int8_t* ker, int K,    // K x K weights
                    int32_t* acc_out,            // H*W raw int32 MAC sums
                    int8_t* out,                 // H*W requantized int8
                    int32_t mul, int shift) {
    int pad = K / 2;
    for (int oy = 0; oy < H; ++oy)
      for (int ox = 0; ox < W; ++ox) {
        int32_t acc = 0;
        for (int ky = 0; ky < K; ++ky)
          for (int kx = 0; kx < K; ++kx) {
            int iy = oy + ky - pad, ix = ox + kx - pad;
            int m   = in_bounds(iy, H) & in_bounds(ix, W);      // 1/0 mask
            int iyc = std::min(std::max(iy, 0), H - 1);         // safe index
            int ixc = std::min(std::max(ix, 0), W - 1);
            acc += (int32_t)ker[ky * K + kx] * in[iyc * W + ixc] * m;  // masked MAC
          }
        acc_out[oy * W + ox] = acc;
        int64_t r = ((int64_t)acc * mul + (1 << (shift - 1))) >> shift;
        out[oy * W + ox] = (int8_t)std::max<int64_t>(-128, std::min<int64_t>(127, r));
      }
}

int main() {
    int8_t in[16]  = { 1,2,3,4, 5,6,7,8, 9,10,11,12, 13,14,15,16 };
    int8_t ker[9]  = { 1,1,1, 1,1,1, 1,1,1 };     // 3x3 box filter (all ones)
    int32_t acc[16]; int8_t out[16];
    conv2d_same_i8(in, 4, 4, ker, 3, acc, out, /*mul=*/1, /*shift=*/1);   // ~ /2

    for (int y = 0; y < 4; ++y) { for (int x = 0; x < 4; ++x) printf("%4d", acc[y*4+x]); printf("\n"); }
    for (int y = 0; y < 4; ++y) { for (int x = 0; x < 4; ++x) printf("%4d", (int)out[y*4+x]); printf("\n"); }
    return 0;
}
// int32 MAC map (box sum, zero-padded):
//   14  24  30  22
//   33  54  63  45
//   57  90  99  69
//   46  72  78  54
// requantized int8 (acc*1 >>1, rounded):
//    7  12  15  11
//   17  27  32  23
//   29  45  50  35
//   23  36  39  27
```

Check one value by hand: the center-ish output at row 1, col 1 sums the 3×3 patch
`1+2+3 + 5+6+7 + 9+10+11 = 54`, matching the map. The top-left corner only has 4 valid neighbors
(the rest are masked zeros): `1+2+5+6 = 14`. Requantizing 54 with `mul=1, shift=1` gives
`(54 + 1) >> 1 = 27`.

**On Chimera:** the mask `m` is a lane-position predicate, and the whole thing is one fused
data-parallel loop over the output tile. No `if` per tap means all PE lanes stay in lockstep.

---

## 3. ReLU

**What it is.** The Rectified Linear Unit is the simplest and most common activation: it keeps
positive values and zeros out negatives, `relu(x) = max(x, 0)`. Written as `max`, it is completely
branch-free — the canonical example of section 1a.

```cpp
#include <cstdint>
#include <cstdio>
#include <algorithm>   // std::max

// No `if` — every SIMD lane runs the identical MAX instruction.
void relu_f32(const float* in, float* out, int n) {
    for (int i = 0; i < n; ++i) out[i] = std::max(in[i], 0.0f);   // relu(x) = max(x, 0)
}

// Quantized int8: activations carry a "zero-point" (the integer standing for 0.0),
// so ReLU just clamps at that zero-point.
void relu_i8(const int8_t* in, int8_t* out, int n, int8_t zero_point) {
    for (int i = 0; i < n; ++i) out[i] = std::max(in[i], zero_point);
}

int main() {
    float x[6] = {-2.0f, -0.5f, 0.0f, 0.5f, 2.0f, 3.5f}, y[6];
    relu_f32(x, y, 6);
    printf("relu_f32: "); for (float v : y) printf("%.1f ", v); printf("\n");

    int8_t xq[6] = {-40, -10, 0, 10, 40, 70}, yq[6];
    relu_i8(xq, yq, 6, 0);
    printf("relu_i8:  "); for (int8_t v : yq) printf("%d ", (int)v); printf("\n");
    return 0;
}
// relu_f32: 0.0 0.0 0.0 0.5 2.0 3.5
// relu_i8:  0 0 0 10 40 70
```

Python reference:

```python
def relu(xs):
    return [max(x, 0.0) for x in xs]
# relu([-2, -0.5, 0, 0.5, 2, 3.5]) -> [0.0, 0.0, 0.0, 0.5, 2.0, 3.5]
```

**On Chimera:** one fused loop; `max()` lowers to a vector MAX / conditional-move across the PE
grid — never a data-dependent branch.

---

## 4. GELU

**What it is.** The Gaussian Error Linear Unit is the smooth activation used by GPT and BERT. Where
ReLU has a hard corner at 0, GELU curves gently and lets a little negative signal through, which
trains better in transformers. The common **tanh approximation** is:

```
gelu(x) = 0.5 * x * (1 + tanh( sqrt(2/pi) * (x + 0.044715 * x^3) ))
```

It is pure arithmetic — no branches. `tanh` is a uniform vector op applied to every lane.

```cpp
#include <cstdio>
#include <cmath>       // std::tanh

void gelu_f32(const float* in, float* out, int n) {
    const float k = 0.7978845608f;               // sqrt(2/pi)
    for (int i = 0; i < n; ++i) {
        float x = in[i];
        float inner = k * (x + 0.044715f * x * x * x);
        out[i] = 0.5f * x * (1.0f + std::tanh(inner));
    }
}

int main() {
    float x[7] = {-3.0f, -1.0f, -0.5f, 0.0f, 0.5f, 1.0f, 3.0f}, y[7];
    gelu_f32(x, y, 7);
    printf("gelu: "); for (float v : y) printf("%.4f ", v); printf("\n");
    return 0;
}
// gelu: -0.0036 -0.1588 -0.1543 0.0000 0.3457 0.8412 2.9964
```

Notice `gelu(-1) = -0.1588`: unlike ReLU (which would give 0), GELU passes a small negative value.
Python reference:

```python
import math
def gelu(xs):
    k = math.sqrt(2/math.pi)
    return [0.5*x*(1 + math.tanh(k*(x + 0.044715*x**3))) for x in xs]
# gelu([-3,-1,-0.5,0,0.5,1,3]) -> -0.0036 -0.1588 -0.1543 0.0 0.3457 0.8412 2.9964
```

**On Chimera:** fuses into the MAC/ALU pipeline; `tanh`/`exp` come from the math library
(polynomial or lookup-table) and run identically on every lane.

---

## 5. Sigmoid

**What it is.** Sigmoid squashes any real number into the open interval (0, 1):
`sigmoid(x) = 1 / (1 + e^-x)`. It is used for gates (LSTM/GRU) and binary-probability outputs. Note
it **saturates**: far from 0 the curve flattens toward 0 or 1, so gradients there are tiny (the
"vanishing gradient" reason transformers prefer GELU/ReLU internally).

```cpp
#include <cstdio>
#include <cmath>       // std::exp

void sigmoid_f32(const float* in, float* out, int n) {
    for (int i = 0; i < n; ++i) out[i] = 1.0f / (1.0f + std::exp(-in[i]));
}

int main() {
    float x[7] = {-4.0f, -2.0f, -1.0f, 0.0f, 1.0f, 2.0f, 4.0f}, y[7];
    sigmoid_f32(x, y, 7);
    printf("sigmoid: "); for (float v : y) printf("%.4f ", v); printf("\n");
    return 0;
}
// sigmoid: 0.0180 0.1192 0.2689 0.5000 0.7311 0.8808 0.9820
```

`sigmoid(0) = 0.5` exactly (the center), and the values are symmetric about it:
`sigmoid(-1) + sigmoid(1) = 0.2689 + 0.7311 = 1.0`. Python reference:

```python
import math
def sigmoid(xs):
    return [1/(1 + math.exp(-x)) for x in xs]
# sigmoid([-4,-2,-1,0,1,2,4]) -> 0.018 0.1192 0.2689 0.5 0.7311 0.8808 0.982
```

**On Chimera:** one fused loop; `exp()` from the math library runs across all lanes uniformly, no
branching.

---

## 6. Softmax

**What it is.** Softmax turns a vector of raw scores (**logits**) into a **probability
distribution** — every output in (0, 1), all summing to 1:

```
softmax(x)_i = e^(x_i - m) / sum_j e^(x_j - m),   where m = max(x)
```

**Why subtract the max `m`?** `e^x` overflows fast (`e^100` is astronomically large). Subtracting the
largest logit first keeps every exponent `<= 0`, so `e^(...)` stays in `(0, 1]` — numerically safe.
It does not change the result: the factor `e^-m` appears in both numerator and denominator and
cancels. The `max` and the `sum` are **reductions** (combine a whole vector into one number); both
are branch-free (`max()` and `+=`).

```cpp
#include <cstdio>
#include <cmath>       // std::exp
#include <algorithm>   // std::max

void softmax_f32(const float* in, float* out, int n) {
    float m = in[0];
    for (int i = 1; i < n; ++i) m = std::max(m, in[i]);              // reduce: max
    float sum = 0.0f;
    for (int i = 0; i < n; ++i) { out[i] = std::exp(in[i] - m); sum += out[i]; }
    float inv = 1.0f / sum;
    for (int i = 0; i < n; ++i) out[i] *= inv;                       // normalize
}

int main() {
    float x[4] = {2.0f, 1.0f, 0.1f, 3.0f}, y[4];
    softmax_f32(x, y, 4);
    float s = 0.0f;
    printf("softmax: "); for (float v : y) { printf("%.4f ", v); s += v; }
    printf("(sum=%.4f)\n", s);
    return 0;
}
// softmax: 0.2361 0.0869 0.0353 0.6418  (sum=1.0000)
```

The biggest logit (3.0) gets the biggest probability (0.6418), the smallest (0.1) the smallest
(0.0353), and they sum to exactly 1. Python reference:

```python
import math
def softmax(xs):
    m = max(xs)
    e = [math.exp(x - m) for x in xs]
    s = sum(e)
    return [v/s for v in e]
# softmax([2,1,0.1,3]) -> 0.2361 0.0869 0.0353 0.6418
```

**On Chimera:** max-reduce over the tile, `exp` across all lanes, sum-reduce, then a vector multiply
by `1/sum`. In attention a causal mask is folded in as a lane-position predicate *before* the max
(set masked scores to −∞), never as a branch.

---

## 7. Depthwise-Separable Convolution

**What it is.** A full 3×3 convolution both filters *spatially* and mixes *channels* at once, which
is expensive. Depthwise-separable convolution factorizes that into two cheap steps:

1. **Depthwise:** each input channel is convolved by its *own* K×K filter — spatial filtering with
   **no channel mixing**. Channels in = channels out.
2. **Pointwise (1×1 conv):** a 1×1 kernel mixes the channels at each pixel to produce the output
   channels.

Together they approximate a full conv at a fraction of the parameters and MACs — the core trick
behind MobileNet. Both stages reuse the same branch-free clamped-index kernel from section 2.

```cpp
#include <cstdio>
#include <algorithm>   // std::min, std::max

static inline int inb(int c, int n) { return (unsigned)c < (unsigned)n; }

// Stage 1 — depthwise: C channels in/out, one 3x3 filter each (no mixing).
void depthwise3x3(const float* in, int C, int H, int W, const float* w, float* out) {
    for (int c = 0; c < C; ++c)
      for (int oy = 0; oy < H; ++oy)
        for (int ox = 0; ox < W; ++ox) {
            float acc = 0.0f;
            for (int ky = 0; ky < 3; ++ky)
              for (int kx = 0; kx < 3; ++kx) {
                  int iy = oy+ky-1, ix = ox+kx-1;
                  int m = inb(iy,H) & inb(ix,W);
                  int iyc = std::min(std::max(iy,0),H-1), ixc = std::min(std::max(ix,0),W-1);
                  acc += w[(c*3+ky)*3+kx] * in[(c*H+iyc)*W+ixc] * m;   // masked MAC
              }
            out[(c*H+oy)*W+ox] = acc;
        }
}

// Stage 2 — pointwise 1x1: mix Cin channels -> Cout channels per pixel.
void pointwise(const float* in, int Cin, int H, int W, const float* w, int Cout, float* out) {
    for (int oc = 0; oc < Cout; ++oc)
      for (int p = 0; p < H*W; ++p) {
          float acc = 0.0f;
          for (int ic = 0; ic < Cin; ++ic) acc += w[oc*Cin+ic] * in[ic*H*W + p];  // 1x1 MAC
          out[oc*H*W + p] = acc;
      }
}

int main() {
    const int Cin = 3, H = 2, W = 2, Cout = 2, K = 3;
    float in[12]  = { 1,2,3,4,  1,1,1,1,  2,2,2,2 };   // ch0=1..4, ch1=1s, ch2=2s
    float dw[27]  = { 1,1,1,1,1,1,1,1,1,  0,0,0,0,1,0,0,0,0,  1,1,1,1,1,1,1,1,1 };
    float pw[6]   = { 1,0,0,   0,1,1 };                // out0=ch0 ; out1=ch1+ch2
    float mid[12], out[8];

    depthwise3x3(in, Cin, H, W, dw, mid);
    pointwise(mid, Cin, H, W, pw, Cout, out);

    printf("depthwise ch0: %.0f %.0f %.0f %.0f\n", mid[0],mid[1],mid[2],mid[3]);
    printf("pointwise ch0: %.0f %.0f %.0f %.0f\n", out[0],out[1],out[2],out[3]);
    printf("pointwise ch1: %.0f %.0f %.0f %.0f\n", out[4],out[5],out[6],out[7]);
    int full = K*K*Cin*Cout, sep = K*K*Cin + Cin*Cout;
    printf("params full=%d dw-sep=%d (%.2fx fewer)\n", full, sep, (double)full/sep);
    return 0;
}
// depthwise ch0: 10 10 10 10
// pointwise ch0: 10 10 10 10
// pointwise ch1: 9 9 9 9
// params full=54 dw-sep=33 (1.64x fewer)
```

On this tiny 2×2 example the all-ones depthwise filter turns each channel-0 pixel into the box sum
`1+2+3+4 = 10`; `out1 = ch1 + ch2 = 1 + 8 = 9` (ch2's all-ones filter over four 2's = 8). The saving
here is 1.64×; for real layers (many channels) it is typically **8–9×**, because the ratio is
`1 / (1/Cout + 1/K²)`.

**On Chimera:** the two stages fuse into back-to-back data-parallel loops in one instruction stream —
no accelerator hand-off between the spatial and the channel-mixing step.

---

## 8. BatchNorm / LayerNorm

**What they are.** Both rescale activations to mean 0, variance 1, then apply a learned scale `γ` and
shift `β`:

```
y = gamma * (x - mean) / sqrt(var + eps) + beta
```

They differ *only in which axis they average over*:

- **BatchNorm** computes mean/var **per channel, across the batch**. At inference it uses the running
  statistics learned during training, so the whole thing collapses to a single **fused
  multiply-add** per channel: `scale = γ/√(var+eps)`, `bias = β − mean·scale`, then `y = x·scale +
  bias`. Common in CNNs.
- **LayerNorm** computes mean/var **per token, across the features**. It needs no batch statistics,
  so it works at batch size 1 and with variable-length sequences — which is why **transformers** use
  it. The mean and variance are branch-free reductions over the feature vector.

```cpp
#include <cstdio>
#include <cmath>       // std::sqrt

// BatchNorm (inference): per channel, folds to one FMA over the tile.
void batchnorm_infer(const float* x, int C, int HW, const float* mean, const float* var,
                     const float* g_, const float* b_, float eps, float* y) {
    for (int c = 0; c < C; ++c) {
        float scale = g_[c] / std::sqrt(var[c] + eps);
        float bias  = b_[c] - mean[c] * scale;
        for (int i = 0; i < HW; ++i) y[c*HW + i] = x[c*HW + i] * scale + bias;   // fused FMA
    }
}

// LayerNorm: per token (row), reduce over the FEATURE dim.
void layernorm(const float* x, int rows, int D, const float* g_, const float* b_,
               float eps, float* y) {
    for (int r = 0; r < rows; ++r) {
        const float* xr = x + r*D;
        float mean = 0.0f; for (int i = 0; i < D; ++i) mean += xr[i]; mean /= D;
        float var  = 0.0f; for (int i = 0; i < D; ++i) { float d = xr[i]-mean; var += d*d; } var /= D;
        float inv  = 1.0f / std::sqrt(var + eps);
        for (int i = 0; i < D; ++i) y[r*D + i] = (xr[i]-mean)*inv * g_[i] + b_[i];
    }
}

int main() {
    float x[6] = {1,2,3,  10,20,30};                       // 2 channels x 3 pixels
    float mean[2]={2,20}, var[2]={1,100}, g[2]={1,1}, b[2]={0,0}, y[6];
    batchnorm_infer(x, 2, 3, mean, var, g, b, 1e-5f, y);
    printf("batchnorm ch0: %.3f %.3f %.3f\n", y[0],y[1],y[2]);
    printf("batchnorm ch1: %.3f %.3f %.3f\n", y[3],y[4],y[5]);

    float t[4] = {1,2,3,4}, gl[4]={1,1,1,1}, bl[4]={0,0,0,0}, yl[4];
    layernorm(t, 1, 4, gl, bl, 1e-5f, yl);
    printf("layernorm:     %.4f %.4f %.4f %.4f\n", yl[0],yl[1],yl[2],yl[3]);
    return 0;
}
// batchnorm ch0: -1.000 0.000 1.000
// batchnorm ch1: -1.000 0.000 1.000
// layernorm:     -1.3416 -0.4472 0.4472 1.3416
```

Both channels normalize to the same `-1, 0, 1` even though channel 1's values are 10× larger — that
is the point of normalization. LayerNorm on `[1,2,3,4]` (mean 2.5, std ≈ 1.118) gives the symmetric
`±1.3416, ±0.4472`. Python reference for LayerNorm:

```python
import math
def layernorm(x, eps=1e-5):
    mean = sum(x)/len(x)
    var  = sum((v-mean)**2 for v in x)/len(x)
    inv  = 1/math.sqrt(var + eps)
    return [(v-mean)*inv for v in x]
# layernorm([1,2,3,4]) -> -1.3416 -0.4472 0.4472 1.3416
```

**On Chimera:** precompute BatchNorm's `scale`/`bias` once, then it is a single branch-free FMA per
element — cheap enough to **fuse** onto the end of the preceding conv's MAC loop (conv → BN → ReLU in
one pass). LayerNorm's mean/var are lane reductions.

---

## 9. MatMul / GEMM

**What it is.** GEMM (GEneral Matrix Multiply), `C[M×N] = A[M×K] · B[K×N]`, is the workhorse of neural
nets. A fully-connected layer *is* a GEMM (`y = x·W`), and **every transformer projection** — the Q,
K, and V projections, the attention-output projection, and both feed-forward (MLP) layers — is a
GEMM. Each output `C[i][j]` is the dot product of row `i` of A with column `j` of B, and that inner
loop is a pure MAC chain with **no branches** — exactly what a systolic MAC array wants.

```cpp
#include <cstdint>
#include <cstdio>
#include <algorithm>

void gemm_i8(const int8_t* A, const int8_t* B, int M, int K, int N,
             int32_t* C32, int8_t* C8, int32_t mul, int shift) {
    for (int i = 0; i < M; ++i)
      for (int j = 0; j < N; ++j) {
          int32_t acc = 0;
          for (int k = 0; k < K; ++k) acc += (int32_t)A[i*K + k] * (int32_t)B[k*N + j];  // MAC
          C32[i*N + j] = acc;
          int64_t r = ((int64_t)acc * mul + (1 << (shift-1))) >> shift;
          C8[i*N + j] = (int8_t)std::max<int64_t>(-128, std::min<int64_t>(127, r));       // requantize
      }
}

int main() {
    int8_t A[6] = { 1,2,3, 4,5,6 };          // 2x3
    int8_t B[6] = { 7,8, 9,10, 11,12 };      // 3x2
    int32_t C32[4]; int8_t C8[4];
    gemm_i8(A, B, 2, 3, 2, C32, C8, /*mul=*/1, /*shift=*/2);   // ~ /4
    printf("C int32 = [%d %d ; %d %d]\n", C32[0],C32[1],C32[2],C32[3]);
    printf("C int8  = [%d %d ; %d %d]\n", (int)C8[0],(int)C8[1],(int)C8[2],(int)C8[3]);
    return 0;
}
// C int32 = [58 64 ; 139 154]
// C int8  = [15 16 ; 35 39]
```

By hand, `C[0][0]` = row0·col0 = `1·7 + 2·9 + 3·11 = 7 + 18 + 33 = 58`. Requantizing with
`mul=1, shift=2` gives `(58 + 2) >> 2 = 15`.

**On Chimera:** A stays resident in the PE array while B streams in; each PE holds one `C[i][j]`
accumulator and one 64-bit instruction advances every lane's MAC together — the systolic dataflow the
2D grid is built for.

---

## 10. Attention (Q·Kᵀ → softmax → ·V)

**What it is.** Scaled dot-product attention is the heart of a transformer. Every token produces a
**Query**, a **Key**, and a **Value** (each a GEMM projection of the input — section 9). Then:

```
scores = Q · Kᵀ / sqrt(d)     (L×L: how much each token attends to each other token)
P      = softmax(scores)      (row-wise, so each token's weights sum to 1)
output = P · V                (L×d: each token's attended mix of Values)
```

So attention is literally **two GEMMs with a softmax in between** — it reuses everything above. The
`1/sqrt(d)` scaling keeps the dot products from growing with the feature dimension `d` (which would
push softmax into its saturated, tiny-gradient region).

```cpp
#include <cstdio>
#include <cmath>
#include <algorithm>

static void softmax_row(float* r, int n) {
    float m = r[0]; for (int i = 1; i < n; ++i) m = std::max(m, r[i]);
    float s = 0.0f; for (int i = 0; i < n; ++i) { r[i] = std::exp(r[i]-m); s += r[i]; }
    for (int i = 0; i < n; ++i) r[i] /= s;
}

void attention(const float* Q, const float* K, const float* V, int L, int d, float* out) {
    float scale = 1.0f / std::sqrt((float)d);
    for (int i = 0; i < L; ++i) {
        float p[16];
        for (int j = 0; j < L; ++j) {                       // scores row i = Q_i · Kᵀ
            float dot = 0.0f;
            for (int k = 0; k < d; ++k) dot += Q[i*d+k] * K[j*d+k];
            p[j] = dot * scale;
        }
        softmax_row(p, L);                                  // attention weights
        for (int k = 0; k < d; ++k) {                       // out row i = P_i · V
            float acc = 0.0f;
            for (int j = 0; j < L; ++j) acc += p[j] * V[j*d+k];
            out[i*d+k] = acc;
        }
    }
}

int main() {
    const int L = 3, d = 2;
    float Q[6] = { 1,0, 0,1, 1,1 };
    float K[6] = { 1,0, 0,1, 1,1 };
    float V[6] = { 10,0, 0,10, 5,5 };
    float out[6];
    attention(Q, K, V, L, d, out);
    for (int i = 0; i < L; ++i) printf("attn out row %d: %.3f %.3f\n", i, out[i*d], out[i*d+1]);
    return 0;
}
// attn out row 0: 6.017 3.983
// attn out row 1: 3.983 6.017
// attn out row 2: 5.000 5.000
```

Token 0's Query `[1,0]` matches Key 0 most strongly, so its output leans toward Value 0 `[10,0]` —
hence `[6.017, 3.983]`. Token 2's Query `[1,1]` matches all keys equally, so it gets the balanced mix
`[5, 5]`.

**On Chimera:** `Q·Kᵀ` and `P·V` are systolic GEMMs; the softmax (max-reduce, exp, sum-reduce,
divide) is branch-free vector work fused in the same instruction stream. A causal mask (so a token
only attends to earlier tokens) is applied as a lane-position predicate before the softmax max —
never a branch.

---

## 11. Summary — the through-line

Every operator above is one fused, data-parallel loop with **no data-dependent branches**:

- **Activations** (ReLU, GELU, Sigmoid) are element-wise math; ReLU's `max` is the purest branch-free
  select.
- **Softmax** and **normalization** add branch-free **reductions** (max, sum, mean, variance).
- **Conv**, **depthwise-separable conv**, **GEMM**, and **attention** are all **MAC** loops; padding
  and masking are handled by an in-bounds mask + index clamp, and integer paths accumulate
  `int8×int8→int32` then **requantize**.
- Because it is all one instruction stream on one core, operators **fuse** (conv → BN → ReLU;
  Q·Kᵀ → softmax → ·V), which is exactly the Chimera GPNPU pitch: run the whole model in C++ on a
  single processor, no accelerator hand-off.
