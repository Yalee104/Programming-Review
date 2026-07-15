# ONNX Model Walkthrough — Layer by Layer (Quadric FDE Prep)

This file is a self-contained, multi-session exercise: pick a small ONNX model
and analyze it the way a systems analyst analyzes an unfamiliar codebase —
treating every operator as a **software component with an input/output spec**.

No formal math. Every operator is explained *functionally*: what it does,
what its contract is, and why the network needs it.

Every runnable example in this document also exists as a standalone script
in this folder (`step0_primer/*.py`, `step3_*.py`, `step4_*.py`) — see
[`README.md`](README.md) for the folder layout, the Python
virtual-environment setup, and how to run them. The scripts are the exact
code shown here; this document adds the explanation around the code.

**Roadmap** (each step gets its own section as we go):

| Step | What we do |
|------|------------|
| 0 | Plain-language primer on the core operators *(this section)* |
| 1 | Pick a small CNN model as the first exercise |
| 2 | Install the tools to load / inspect / visualize ONNX |
| 3 | Load the model, list every node (op type, inputs, outputs) |
| 4 | Run shape inference → real tensor dimensions per layer |
| 5 | Build a per-layer spec table |
| 6 | Reason about compute-bound vs memory-bound per layer |
| 7 | Identify the layers that dominate runtime |
| 8 | Write "porting notes" as if briefing a colleague |
| 9 | (Stretch) repeat with an attention/MatMul-heavy model |

---

## Step 0 — Plain-Language Operator Primer

### 0.0 First, the two words everything else is built on

**Tensor.** Just a multi-dimensional array — nothing more mysterious than
that. A vector is a 1-D tensor, a matrix is a 2-D tensor, an image batch is
usually a 4-D tensor. Shapes are written as tuples:

- `(3,)` — a list of 3 numbers
- `(3, 2)` — a 3×2 grid of numbers
- `(1, 3, 224, 224)` — the classic image-input shape, read as
  **N**=1 image in the batch, **C**=3 channels (red/green/blue),
  **H**=224 pixels tall, **W**=224 pixels wide. This ordering is called
  **NCHW** and you'll see it constantly in ONNX.

**Parameters (a.k.a. weights).** Numbers *inside* a layer that were tuned
during training and are **frozen constants at inference time**. From your
systems-analysis point of view this is the key simplification: when porting
a model to hardware, every layer is a *pure function* — fixed constants
baked in, tensor in, tensor out, no hidden state, no side effects. The whole
network is a dataflow pipeline of such functions, and the ONNX file is
literally that pipeline serialized as a graph.

Some operators carry parameters (Conv, MatMul, the Norm layers); others are
parameter-free plumbing (ReLU, Softmax, Reshape, Pooling). That distinction
matters a lot later: parameters have to be *stored on and streamed through
the chip*, so "how many parameters does this layer have" is a hardware
question, not just a training question.

All examples below use NumPy only (`pip install numpy`) — no ML framework
needed. Two bits of NumPy syntax used throughout, explained up front:

- `np.array([...])` builds a tensor from a Python list; `.shape` reports its
  shape as a tuple.
- `@` is Python's built-in matrix-multiplication operator: `x @ W`
  multiplies `x` by `W` (you'll see exactly what that means in 0.1).

Every output shown in comments below was produced by actually running the
snippet — you can copy any block into a file and run it as-is.

---

### 0.1 MatMul / Linear / Gemm — "every input votes on every output"

**What it is.** The single most important operator in all of deep learning.
A Linear layer (ONNX calls the common form `Gemm`, or plain `MatMul` when
there's no bias) takes a list of input numbers ("features") and produces a
new list of output numbers, where **every output is a weighted blend of ALL
the inputs**.

Think of it as a *committee vote*: each output feature asks every input
feature "how much do you contribute to me?", and the weight matrix stores
all those learned answers. An output like "this looks dog-like" might be
built as *a lot of* input-feature-7, *minus some of* input-feature-2, *plus
a little* input-feature-12 — the weights encode exactly that recipe, and
training is what discovered the recipe.

**Component spec:**

| | |
|---|---|
| Input | tensor `(N, in_features)` — N samples, each with `in_features` numbers |
| Parameters | weight matrix `(in_features, out_features)` + optional bias `(out_features,)` |
| Output | tensor `(N, out_features)` |
| Learned? | **Yes** — the weights ARE the layer |

Note what the shape contract says: the layer's whole job is converting a
vector of one length into a vector of another length, with every element of
the output depending on every element of the input.

**Why networks need it.** It's the general-purpose "combine evidence" step.
Whenever a network needs to go from *features* to *decisions* (e.g. from
512 abstract image features to 10 class scores), that's a Linear layer.
Transformers/LLMs are almost nothing *but* stacks of these.

**Runnable example** — 3 input features → 2 output features:

```python
import numpy as np

# One input sample with 3 features
x = np.array([1.0, 2.0, 3.0])             # shape (3,)

# Learned parameters: weight matrix W and bias vector b.
# 3 input features -> 2 output features, so W has shape (3, 2).
W = np.array([[ 0.5, -1.0],
              [ 1.0,  0.0],
              [-0.5,  2.0]])              # shape (3, 2)
b = np.array([0.1, 0.2])                  # shape (2,)

# Linear layer: every input feature contributes to every output feature.
# '@' is Python's matrix-multiplication operator.
y = x @ W + b

print(y)          # [1.1 5.2]
print(y.shape)    # (2,)
```

Where did `1.1` come from? Walk one output through by hand — output #0 uses
the **first column** of `W` as its recipe:
`1.0×0.5 + 2.0×1.0 + 3.0×(-0.5) = 1.0`, plus bias `0.1` → `1.1`.
Output #1 uses the second column: `1.0×(-1.0) + 2.0×0.0 + 3.0×2.0 = 5.0`,
plus `0.2` → `5.2`. That multiply-then-add-everything pattern (a
"multiply-accumulate", or **MAC**) is the atomic unit of neural-network
compute — AI accelerators like Quadric's are, at heart, machines for doing
enormous numbers of MACs per second.

**Hardware note.** A big MatMul does a LOT of arithmetic per byte of data it
touches (each weight gets reused across the batch, each input gets reused
across all outputs) — this is the classic **compute-bound** operator, the
one accelerators are built to chew through. More on this in Step 6.

---

### 0.2 Activation functions (ReLU / SiLU / GELU) — "the decision gates"

**What they are.** Tiny per-element functions applied to every number in a
tensor independently. No parameters, no shape change — value in, value out.
`ReLU` is the bluntest one: *if the value is negative, replace it with 0;
otherwise leave it alone*. That's the entire operator.

**Why networks need them — this is the important part.** MatMul and Conv
are both *linear* operations, and stacking linear operations is pointless:
two Linear layers back-to-back can always be collapsed into one equivalent
Linear layer (fold the two weight matrices together — you'd get identical
outputs with one layer). So a 50-layer network without activations has
exactly the same expressive power as a 1-layer network.

The activation is the small **nonlinear** step wedged between layers that
breaks this collapse. Functionally it acts like a gate or threshold: "this
feature didn't fire strongly enough → zero it out." That thresholding is
what lets stacked layers build *genuinely new* concepts level by level
(edges → textures → parts → objects) instead of just re-blending the same
linear soup.

The three you'll actually meet:

- **ReLU** — hard cutoff at zero. Cheap, everywhere in CNNs.
- **SiLU** (a.k.a. Swish) — same idea, but the cutoff is a smooth "dimmer
  switch" instead of a hard snap; slightly negative values leak through a
  little. Used in modern CNNs/YOLO-family models.
- **GELU** — another smooth variant, nearly identical in behavior to SiLU;
  the default in Transformers (BERT, GPT, ViT).

**Component spec:**

| | |
|---|---|
| Input | tensor, any shape |
| Parameters | **none** |
| Output | tensor, **exactly the same shape** |
| Learned? | No — pure elementwise function |

**Runnable example** — same 5 inputs through all three:

```python
import numpy as np

x = np.array([-3.0, -1.0, 0.0, 1.0, 3.0])

# ReLU: negatives -> 0, positives pass through unchanged.
relu = np.maximum(0.0, x)

# SiLU: like ReLU but with a smooth "dimmer" instead of a hard cutoff.
sigmoid = 1.0 / (1.0 + np.exp(-x))       # smooth 0..1 gate
silu = x * sigmoid

# GELU (tanh approximation, the one most frameworks use).
gelu = 0.5 * x * (1.0 + np.tanh(np.sqrt(2.0 / np.pi) * (x + 0.044715 * x**3)))

print("x:   ", x)                  # x:    [-3. -1.  0.  1.  3.]
print("ReLU:", relu)               # ReLU: [0. 0. 0. 1. 3.]
print("SiLU:", np.round(silu, 3))  # SiLU: [-0.142 -0.269  0.     0.731  2.858]
print("GELU:", np.round(gelu, 3))  # GELU: [-0.004 -0.159  0.     0.841  2.996]
```

Read the columns: at `x = -3` ReLU outputs a flat `0` while SiLU/GELU let a
faint `-0.142` / `-0.004` through; at `x = +3` all three pass the value
almost untouched. Same functional role, different smoothness at the gate.

**Hardware note.** Activations do almost no arithmetic but must touch every
byte of the tensor — a textbook **memory-bound** op. On real accelerators
they're usually *fused* into the preceding Conv/MatMul (applied on the way
out of the compute unit) so the tensor never takes an extra round-trip
through memory. When you see Conv→ReLU in a graph, expect the hardware to
execute it as one node.

---

### 0.3 Convolution (Conv) — "a small pattern detector on a sliding window"

**What it is.** The workhorse of image networks. A Conv layer owns a set of
small **filters** (also called **kernels**) — e.g. 3×3 grids of learned
weights. Each filter is a tiny pattern detector. The layer *slides* the
filter across the image, and at every position asks: "how strongly does the
patch under my window match my pattern?" The answers, laid out spatially,
form the output — called a **feature map**: bright where the pattern was
found, near-zero where it wasn't.

Analogy: a rubber stamp that, instead of printing, *measures similarity* —
you press it at every position on the page and write down one match-score
per position.

**Why Conv instead of Linear for images?** Two structural reasons a systems
analyst will appreciate:

1. **Locality** — a pixel's meaning depends on its neighbors, not on a pixel
   in the far corner. Conv encodes that assumption; Linear (which connects
   everything to everything) would waste parameters learning it.
2. **Reuse** — an "edge" looks the same at the top-left and bottom-right, so
   one 3×3 filter (9 weights) is reused across the whole image. A Linear
   layer on a 224×224 RGB image would need ~150K weights *per output
   feature*; a Conv filter needs 27. Same detector, ~5000× fewer parameters.

**Channels — the part that trips everyone up at first.** A Conv layer has
many filters, and **each filter produces its own output feature map**. Those
stacked maps are the output *channels*. So `Conv(in=3, out=64, kernel=3×3)`
means: 64 independent pattern detectors, each looking at all 3 input
channels through a 3×3 window, producing a 64-channel output. Input RGB is
"3 channels of color"; after this layer the tensor is "64 channels of
*pattern-match evidence*" (channel 12 might be "vertical edge here",
channel 40 "green-to-brown transition here"). As you go deeper, channels
stop meaning color entirely and become abstract feature scores.

**Component spec:**

| | |
|---|---|
| Input | `(N, C_in, H, W)` |
| Parameters | filters `(C_out, C_in, kH, kW)` + optional bias `(C_out,)` |
| Output | `(N, C_out, H_out, W_out)` — H/W shrink a bit, or stay equal with padding; a `stride` of 2 halves them |
| Learned? | **Yes** — the filters |

(`padding` = add a border of zeros so the window can center on edge pixels;
`stride` = slide the window 2 pixels at a time instead of 1, downsampling
the output.)

**Runnable example** — one 2×2 edge-detector filter over a 4×4 image:

```python
import numpy as np

# A tiny 4x4 grayscale "image": dark (0) on the left, bright (9) on the right.
image = np.array([[0, 0, 9, 9],
                  [0, 0, 9, 9],
                  [0, 0, 9, 9],
                  [0, 0, 9, 9]], dtype=float)

# One 2x2 filter (kernel). This particular pattern means:
# "respond strongly where the right side is brighter than the left side"
# -- i.e. a vertical-edge detector.
kernel = np.array([[-1, 1],
                   [-1, 1]], dtype=float)

# Slide the kernel over every 2x2 patch of the image.
# At each position: multiply patch and kernel elementwise, sum -> one number.
out = np.zeros((3, 3))
for i in range(3):
    for j in range(3):
        patch = image[i:i+2, j:j+2]
        out[i, j] = np.sum(patch * kernel)

print(out)
# [[ 0. 18.  0.]
#  [ 0. 18.  0.]
#  [ 0. 18.  0.]]
```

Read the output map: `0` where the window saw uniform dark (left column) or
uniform bright (right column) — no edge, no response. `18` in the middle
column, where the window straddled the dark→bright boundary. The output
literally *lights up where the pattern lives*. A real first Conv layer is
exactly this, times 64 filters, times 3 input channels — the filters just
have weirder, learned patterns instead of our hand-written one.

Notice the inner operation is again multiply-elementwise-then-sum — the
same MAC pattern as MatMul. That's why one accelerator architecture serves
both: Conv is MatMul wearing a sliding-window costume (compilers routinely
lower Conv *to* matrix multiply, a transform called im2col).

**Hardware note.** Conv is usually where a CNN spends most of its compute —
tons of MACs, high weight reuse → **compute-bound**, and the op accelerators
optimize hardest. Early layers (big H×W, few channels) push huge activation
tensors around; deep layers (tiny H×W, many channels) are almost pure
arithmetic — same op type, different bottleneck. Step 6 makes this concrete.

---

### 0.4 Pooling (MaxPool / AveragePool / GlobalAveragePool) — "shrink the map, keep the signal"

**What it is.** A downsampler with zero parameters. Cut the feature map into
small blocks (typically 2×2) and keep **one number per block**: the maximum
(MaxPool — "did the feature fire anywhere in this block?") or the average
(AveragePool — "how strongly did it fire on average?"). A 2×2 pool with
stride 2 halves height and width → the tensor shrinks to a quarter of its
size. Channels are never mixed; each channel is pooled independently.

**Why networks need it.**

1. **Cost control.** Halving H and W makes every subsequent layer ~4× cheaper.
   CNNs pool repeatedly so deeper layers work on small, information-dense maps.
2. **Shift tolerance.** After MaxPool, "edge at pixel 14" and "edge at pixel
   15" produce the same output — the network stops caring about exact pixel
   positions, which is what you want for "is there a cat" questions.
3. **Zooming out.** Each pooling stage makes one output pixel correspond to a
   larger region of the original image, letting deeper filters detect bigger
   structures (eyes → faces) with the same small 3×3 window.

**GlobalAveragePool** is the extreme case: average each channel's *entire*
map down to a single number. `(N, 512, 7, 7)` → `(N, 512, 1, 1)`. You'll
find it at the end of nearly every classifier CNN — it converts "512 maps of
where features are" into "512 scores of how present each feature is",
which is exactly the flat vector the final Linear layer wants.

**Component spec:**

| | |
|---|---|
| Input | `(N, C, H, W)` |
| Parameters | **none** — only settings (window size, stride) |
| Output | `(N, C, H_out, W_out)` — spatially smaller, same C |
| Learned? | No |

**Runnable example:**

```python
import numpy as np

# A 4x4 feature map (output of some Conv layer).
fmap = np.array([[1, 3, 2, 0],
                 [5, 6, 1, 2],
                 [0, 2, 4, 8],
                 [3, 1, 7, 5]], dtype=float)

# MaxPool 2x2, stride 2: split into 2x2 blocks, keep the strongest value
# from each block. 4x4 -> 2x2.
pooled = np.zeros((2, 2))
for i in range(2):
    for j in range(2):
        pooled[i, j] = fmap[2*i:2*i+2, 2*j:2*j+2].max()

print(pooled)
# [[6. 2.]
#  [3. 8.]]

# GlobalAveragePool: average the WHOLE map down to a single number.
print(fmap.mean())
# 3.125
```

Check one block by hand: the top-left 2×2 block is `[1, 3, 5, 6]` → max is
`6`, which is the top-left entry of the result. Sixteen numbers in, four
out — 75% of the data discarded, strongest evidence kept.

**Hardware note.** Like activations: trivial arithmetic (a compare or an
add per element), every byte touched once → **memory-bound**. Its real
performance contribution is indirect — everything *after* it gets cheaper.

---

### 0.5 Softmax — "turn scores into a ranking that sums to 1"

**What it is.** The final Linear layer of a classifier emits raw scores
("**logits**") — e.g. `[2.0, 1.0, 0.1, -1.0]` for cat/dog/bird/fish.
Useful for picking a winner, but the numbers themselves are on an arbitrary
scale. Softmax converts them into values that behave like probabilities:
each between 0 and 1, all summing to exactly 1, order preserved.

Functionally: **an exaggerating normalizer**. It doesn't just rescale — it
deliberately amplifies gaps, rewarding the leaders disproportionately
(that's the "soft-MAX": a smooth version of "winner takes all").

**Why networks need it.** Downstream consumers need calibrated confidence,
not raw scores. "cat: 2.0" is uninterpretable; "cat: 64%" supports real
decisions ("auto-accept above 90%, flag for review below"). Inside
Transformers, Softmax plays a second role: turning attention scores into
"how should I split my attention budget across these words" — a
sums-to-one budget allocation. Same op, same contract.

**Component spec:**

| | |
|---|---|
| Input | tensor, any shape + an `axis` setting (which dimension holds the competing scores) |
| Parameters | **none** |
| Output | same shape; along `axis`: all values in (0, 1), summing to 1 |
| Learned? | No |

**Runnable example:**

```python
import numpy as np

# Raw scores ("logits") for 4 classes, e.g. [cat, dog, bird, fish].
scores = np.array([2.0, 1.0, 0.1, -1.0])

# Softmax: exponentiate, then divide by the total so everything sums to 1.
# (Subtracting the max first is a standard trick to avoid huge exp values;
#  it does not change the result.)
e = np.exp(scores - scores.max())
probs = e / e.sum()

print(np.round(probs, 3))   # [0.638 0.235 0.095 0.032]
print(probs.sum())          # 1.0
```

Note the exaggeration: cat's raw score was 2× dog's (`2.0` vs `1.0`), but
its probability is ~2.7× (`0.638` vs `0.235`). Gaps get amplified.

**Hardware note.** Cheap in a CNN (runs once, on ~1000 numbers) — ignore
it there. In Transformers it runs inside *every* attention layer on large
score matrices, and its structure (a max, then a sum, across the whole row
before any output can be produced) makes it awkward to parallelize and
fuse. One of the classic pain points when porting attention models — we'll
hit it in Step 9.

---

### 0.6 BatchNorm / LayerNorm — "signal conditioning between stages"

**What they are.** Think analog electronics: chain amplifier stages naively
and the signal drifts and clips. Networks in training have the same failure
mode — each layer's output can drift large or tiny, and layers downstream
choke on badly-scaled input. A normalization layer is a **re-centering and
re-scaling stage**: shift the values so their average is 0, scale them so
their spread is 1, then apply a small learned per-channel scale (`gamma`)
and shift (`beta`) so the layer can settle on its own preferred range.

BatchNorm vs LayerNorm differ only in *which group of numbers* gets
normalized together: **BatchNorm** (CNNs) normalizes each channel using
statistics collected during training; **LayerNorm** (Transformers) computes
statistics from the current sample's own features, on the fly, at inference.

**Why networks need them.** Almost entirely a *training* aid — without
normalization, deep stacks train slowly or not at all. At inference they
just apply their frozen constants. Their real interest for *porting* is the
next paragraph.

**The porting-relevant fact: BatchNorm folds away.** At inference,
BatchNorm's stats are frozen constants, so the whole layer collapses to
"multiply each channel by one constant, add another" — and that pair can be
**merged into the weights of the preceding Conv** offline. Every serious
deployment toolchain does this automatically. Practical consequences:
the Conv→BN→ReLU you see in the training-framework picture of a model
usually appears in the optimized graph as a single fused Conv, and a
BatchNorm *surviving* in an inference graph is a hint the export path was
sloppy. LayerNorm, whose stats depend on the live input, **cannot** be
folded — it stays a real runtime op, one reason Transformers port less
cleanly than CNNs.

**Component spec:**

| | |
|---|---|
| Input | `(N, C, H, W)` for BatchNorm / `(..., features)` for LayerNorm |
| Parameters | per-channel scale `gamma` + shift `beta` (plus frozen stats for BatchNorm) |
| Output | **same shape**, values re-centered and re-scaled |
| Learned? | Yes, but tiny (2 numbers per channel) |

**Runnable example** — the conditioning step on four drifted values:

```python
import numpy as np

# Values coming out of some layer: drifted far from zero, badly scaled.
x = np.array([120.0, 130.0, 110.0, 140.0])
print("before: mean =", x.mean(), " std =", round(x.std(), 3))
# before: mean = 125.0  std = 11.18

# Normalize: shift so the mean is 0, scale so the spread (std) is 1.
x_norm = (x - x.mean()) / x.std()
print("after: ", np.round(x_norm, 3))
# after:  [-0.447  0.447 -1.342  1.342]

# The learned part: scale (gamma) and shift (beta) let the layer pick
# its own preferred output range instead of being stuck at exactly 0/1.
gamma, beta = 2.0, 0.5
y = gamma * x_norm + beta
print("scaled:", np.round(y, 3))
# scaled: [-0.394  1.394 -2.183  3.183]
```

The *relationships* between values survive (140 is still the largest, 110
still the smallest, same spacing) — only the center and scale changed.
The information is intact; the numeric range is now healthy.

**Hardware note.** BatchNorm: effectively free (folded into Conv). LayerNorm:
a real runtime op — small arithmetic but it must scan all features to get
the mean/spread *before* producing any output, a synchronization point that
resists fusion. Same story as Softmax: cheap on paper, awkward in silicon.

---

### 0.7 Reshape / Transpose / Concat / Slice — "plumbing: no math, real cost"

**What they are.** Pure data-movement operators. Zero parameters, zero
arithmetic on values — they only rearrange, glue, or cut tensors. In
codebase terms these are the adapters and marshalling glue between
components, not business logic:

- **Reshape** — reinterpret the same numbers under a new shape
  (`(2, 3)` → `(6,)`). The classic use: **Flatten** before a Linear layer —
  Conv thinks in `(N, C, H, W)`, Linear wants flat `(N, features)`, so a
  Reshape sits between them in virtually every classifier CNN.
- **Transpose** — reorder the axes (`(N, H, W, C)` → `(N, C, H, W)`).
  Typically appears when two components disagree on layout convention.
- **Concat** — glue tensors along an axis. This is how *branches merge*:
  multi-scale features side by side (YOLO necks are full of these).
- **Slice** — cut out a sub-block along an axis; how one branch takes only
  part of a tensor.

**Why networks need them.** They don't transform information — they satisfy
*interface contracts* between real layers, exactly like format-adapter code
between two modules with different APIs.

**Component spec:**

| | |
|---|---|
| Input | tensor(s) |
| Parameters | **none** (only settings: target shape, axis order, axis) |
| Output | same values, different shape / order / grouping |
| Learned? | No |

**Runnable example** — all four on tiny tensors:

```python
import numpy as np

t = np.arange(6)                # [0 1 2 3 4 5], shape (6,)

# Reshape: same 6 values, new shape. Nothing is recomputed or reordered.
r = t.reshape(2, 3)
print(r)
# [[0 1 2]
#  [3 4 5]]

# Transpose: swap the axes. Now the element ORDER really changes.
print(r.T)
# [[0 3]
#  [1 4]
#  [2 5]]
print(r.T.shape)
# (3, 2)

# Concat: glue two tensors together along a chosen axis.
a = np.array([[1, 2],
              [3, 4]])
b = np.array([[5, 6],
              [7, 8]])
print(np.concatenate([a, b], axis=0))   # stack vertically   -> shape (4, 2)
# [[1 2]
#  [3 4]
#  [5 6]
#  [7 8]]
print(np.concatenate([a, b], axis=1))   # stack side by side -> shape (2, 4)
# [[1 2 5 6]
#  [3 4 7 8]]

# Slice: cut out a sub-block. Here: every row, column 0 only.
print(a[:, 0])
# [1 3]
```

One distinction worth internalizing: **Reshape is (usually) free** — the
bytes already sit in the right order in memory, only the shape label
changes. **Transpose is not free** — element order genuinely changes, so
every byte must physically move to a new address.

**Hardware note — the punchline for the Quadric job.** These ops do *zero*
useful arithmetic yet consume real memory bandwidth, and on accelerators
whose on-chip layout differs from the graph's assumed layout, a stray
Transpose can force a full round-trip through memory between two otherwise
fusable compute layers. When a ported model runs slower than expected, the
compute layers are rarely the surprise — the graph being littered with
layout-shuffling plumbing (often inserted by a sloppy framework→ONNX
export, not by the model's author) very often is. Cleaning that up is
bread-and-butter Field-Engineering work.

---

### 0.8 Cheat sheet

| Operator | Learned params? | Shape effect | Functional role | HW tendency |
|---|---|---|---|---|
| MatMul / Gemm | **yes** (big) | `(N, in)` → `(N, out)` | combine all features into new features / decisions | compute-bound |
| ReLU / SiLU / GELU | no | unchanged | nonlinear gate; stops layers collapsing into one | memory-bound, fuses into prior op |
| Conv | **yes** (big) | `(N,C,H,W)` → `(N,C',H',W')` | sliding local pattern detectors, weights reused everywhere | compute-bound (usually) |
| MaxPool / AvgPool | no | H, W shrink | downsample; keep strongest evidence; shift tolerance | memory-bound |
| Softmax | no | unchanged | scores → sums-to-1 confidence / attention budget | cheap in CNNs; sync point in attention |
| BatchNorm | tiny | unchanged | training-time signal conditioning | **free** — folds into Conv at inference |
| LayerNorm | tiny | unchanged | same, per-sample (Transformers) | real runtime op, resists fusion |
| Reshape/Transpose/Concat/Slice | no | shape/order only | interface adapters between layers | pure memory traffic; Transpose is the costly one |

The mental model to carry into Step 1: a network is a dataflow pipeline
alternating between **heavy compute components** (Conv, MatMul — where the
parameters and the MACs live) and **light glue** (activations, pooling,
norm, plumbing) that conditions, gates, reshapes, and routes the signal
between them. Reading an ONNX graph is reading that pipeline.

---

## Step 1 — The model: MNIST-12 from the ONNX Model Zoo

**The pick:** `mnist-12.onnx` from the official ONNX Model Zoo
(`github.com/onnx/models`). It reads a **28×28 grayscale image of a
handwritten digit** and outputs **10 scores**, one per digit 0–9 — the
"hello world" task of computer vision, so all attention can go to the
*graph*, not the application.

**Why it's the right first dissection target:**

1. **The whole graph fits in your head** — exactly 12 nodes (verified
   below). A ResNet has ~120, a YOLO ~300; this one you can hold complete.
2. **It's a Step 0 reunion, with nothing new.** The graph contains Conv,
   ReLU, MaxPool, Reshape, MatMul and Add — almost every operator family
   from the primer and not one operator we haven't covered.
3. **It's the canonical CNN shape** you'll meet scaled-up everywhere:
   [Conv → ReLU → Pool] repeated, then flatten, then a Linear classifier.
   ResNet, MobileNet etc. are this same skeleton with more floors.
4. **Static input shape** (exactly 1×1×28×28, no "dynamic batch" wildcards),
   so Step 4's shape inference produces clean concrete numbers everywhere.
5. **Tiny** — 26 KB. The file is committed in this folder at
   `models/mnist-12.onnx`, so everything below is reproducible offline.

To re-download it yourself:

```bash
curl -L -o models/mnist-12.onnx "https://media.githubusercontent.com/media/onnx/models/main/validated/vision/classification/mnist/model/mnist-12.onnx"
```

⚠️ **Git-LFS gotcha** (classic time-waster): the "normal" GitHub raw URL
(`github.com/onnx/models/raw/main/...`) returns a **130-byte text file**,
not the model — the Model Zoo stores models in Git LFS, and the raw URL
serves the LFS *pointer*. If `onnx.load` ever fails with a parse error on a
suspiciously tiny file, you downloaded a pointer. The
`media.githubusercontent.com/media/...` form above fetches the real bytes.

---

## Step 2 — Tools to install

One line, three packages:

```bash
pip install onnx onnxruntime netron
```

(Recommended: install into a Python virtual environment instead of your
system Python — [`README.md`](README.md) in this folder has the exact
`venv` setup commands, and `requirements.txt` pins everything, so
`pip install -r requirements.txt` covers all of it, NumPy included.)

| Package | What it is | Role in this exercise |
|---|---|---|
| `onnx` | The format's official Python library: load a `.onnx` file into Python objects, walk the graph, run checkers and shape inference | Steps 3–5: all our inspection code |
| `onnxruntime` | Microsoft's engine that actually *executes* ONNX models on CPU/GPU | Step 4: run the model for real and cross-check what static analysis predicted |
| `netron` | Graph **visualizer** — the tool everyone in this industry has open all day. `netron models/mnist-12.onnx` starts a local server and renders the graph in your browser; click any node to see its attributes and weight shapes | Visual companion to Steps 3–4 |

Zero-install alternative for Netron: open **https://netron.app** in a
browser and drop the `.onnx` file onto the page — same viewer, nothing to
install. Recommended first stop: look at the picture of the graph *before*
reading it with code, the same way you'd skim a repo's folder structure
before reading source.

Versions used to verify everything below (any recent versions are fine):
Python 3.11, `onnx` 1.22.0, `onnxruntime` 1.27.0, `numpy` 2.4.6.
All snippets assume you run them **from this `onnx_walkthrough/` folder**
(so the relative path `models/mnist-12.onnx` resolves).

---

## Step 3 — Load the model and list every node

### 3.1 The ONNX data model, in codebase terms

Before reading the listing, here's the "schema" of an ONNX file. A `.onnx`
file is a **protobuf** (a binary serialization format, like JSON but typed
and compact) containing one `ModelProto`, whose interesting part is
`model.graph`. Four fields matter:

| Field | What it holds | Codebase analogy |
|---|---|---|
| `graph.input` / `graph.output` | Named, typed tensors the graph consumes/produces | the module's **public API** |
| `graph.node` | The list of operator instances, in execution order | the **components** |
| `graph.initializer` | The frozen weight tensors shipped inside the file | **constants** compiled into the binary |
| edges | There is no edge list! | see below |

**How wiring works — the one non-obvious part.** Every tensor that flows
through the graph has a **string name**. Each node simply lists the *names*
it reads (`node.input`) and the *names* it writes (`node.output`). If node A
outputs `"ReLU32_Output_0"` and node B lists `"ReLU32_Output_0"` as an
input, they're connected — that's the entire wiring mechanism, name
matching, like variables passed between function calls. (Each name is
written by exactly one node, so the graph is a clean dataflow — no
reassignment, no cycles.) A `node.input` name can refer either to another
node's output *or* to an initializer — that's how a Conv node receives its
weights: they're just another named input.

### 3.2 The listing code

```python
import sys

import onnx

# Model path can be passed as an argument; defaults to the MNIST model.
MODEL_PATH = sys.argv[1] if len(sys.argv) > 1 else "models/mnist-12.onnx"
model = onnx.load(MODEL_PATH)

# The model's public API: its named inputs and outputs.
print("== Graph inputs ==")
for inp in model.graph.input:
    print(" ", inp.name)
print("== Graph outputs ==")
for out in model.graph.output:
    print(" ", out.name)

# The frozen constants (weights) shipped inside the file.
print("== Initializers (weights) ==")
for init in model.graph.initializer:
    print(f"  {init.name}: shape {list(init.dims)}")

# Every node: operator type, then its named inputs -> outputs.
print("== Nodes ==")
for i, node in enumerate(model.graph.node):
    print(f"  [{i}] {node.op_type}")
    print(f"      in : {list(node.input)}")
    print(f"      out: {list(node.output)}")
```

Verified output, in full:

```text
== Graph inputs ==
  Input3
== Graph outputs ==
  Plus214_Output_0
== Initializers (weights) ==
  Parameter193: shape [16, 4, 4, 10]
  Parameter87: shape [16, 8, 5, 5]
  Parameter5: shape [8, 1, 5, 5]
  Parameter6: shape [8, 1, 1]
  Parameter88: shape [16, 1, 1]
  Pooling160_Output_0_reshape0_shape: shape [2]
  Parameter193_reshape1_shape: shape [2]
  Parameter194: shape [1, 10]
== Nodes ==
  [0] Conv
      in : ['Input3', 'Parameter5']
      out: ['Convolution28_Output_0']
  [1] Add
      in : ['Convolution28_Output_0', 'Parameter6']
      out: ['Plus30_Output_0']
  [2] Relu
      in : ['Plus30_Output_0']
      out: ['ReLU32_Output_0']
  [3] MaxPool
      in : ['ReLU32_Output_0']
      out: ['Pooling66_Output_0']
  [4] Conv
      in : ['Pooling66_Output_0', 'Parameter87']
      out: ['Convolution110_Output_0']
  [5] Add
      in : ['Convolution110_Output_0', 'Parameter88']
      out: ['Plus112_Output_0']
  [6] Relu
      in : ['Plus112_Output_0']
      out: ['ReLU114_Output_0']
  [7] MaxPool
      in : ['ReLU114_Output_0']
      out: ['Pooling160_Output_0']
  [8] Reshape
      in : ['Pooling160_Output_0', 'Pooling160_Output_0_reshape0_shape']
      out: ['Pooling160_Output_0_reshape0']
  [9] Reshape
      in : ['Parameter193', 'Parameter193_reshape1_shape']
      out: ['Parameter193_reshape1']
  [10] MatMul
      in : ['Pooling160_Output_0_reshape0', 'Parameter193_reshape1']
      out: ['Times212_Output_0']
  [11] Add
      in : ['Times212_Output_0', 'Parameter194']
      out: ['Plus214_Output_0']
```

### 3.3 Reading the listing — annotated

The 12 nodes are really **four functional blocks**:

```text
Block A (nodes 0-3):  Conv -> Add -> Relu -> MaxPool     feature extraction, round 1
Block B (nodes 4-7):  Conv -> Add -> Relu -> MaxPool     feature extraction, round 2
Block C (nodes 8-9):  Reshape, Reshape                   plumbing (flatten for the classifier)
Block D (nodes 10-11): MatMul -> Add                     the Linear classifier
```

Everything here maps straight back to Step 0 — Conv is §0.3, Relu §0.2,
MaxPool §0.4, Reshape §0.7, MatMul+Add is exactly the `x @ W + b` from §0.1
split into two nodes.

Observations a systems analyst should make on this listing (this is the
skill the job actually needs — reading export *noise* off a graph):

- **Conv followed by a separate `Add` is an unfused bias.** In §0.1/§0.3 the
  bias lived inside the layer; ONNX's Conv op supports a bias input
  directly, yet this exporter emitted Conv-then-Add as two nodes. Harmless
  semantically, but it's two graph nodes where one would do — precisely the
  kind of pattern an accelerator compiler fuses away (or a field engineer
  cleans up).
- **Node [9] reshapes a *weight*, every single run.** `Parameter193` is a
  frozen constant, so reshaping it could have been done once, offline, when
  the file was created. Instead the graph does it at inference time. Again:
  exporter sloppiness, again the kind of thing deployment tools
  constant-fold away.
- **The names (`Plus214`, `Times212`...) are fossils** from the framework
  that trained this model (Microsoft's CNTK) — names carry provenance, like
  generated code carrying its generator's naming style. You never need to
  *parse* names; the `op_type` field is the truth.
- **Where's Softmax?** The graph ends at the raw scores ("logits"). Many
  deployed classifiers do this deliberately — the consumer only needs
  `argmax` (which digit won), so the sums-to-1 normalization (§0.5) is left
  out of the graph. Lesson: the ONNX graph is not always the whole
  *conceptual* model — check what pre/post-processing lives outside the file.

What the listing does **not** show is any actual tensor dimensions — we know
`Pooling66_Output_0` connects node 3 to node 4, but not its shape. That's
Step 4.

---

## Step 4 — Shape inference: real dimensions on every edge

### 4.1 What shape inference is

The `.onnx` file stores shapes only for the graph inputs, outputs, and
weights — intermediate tensor shapes are *not* stored. **Shape inference**
is a static-analysis pass that derives them: exactly like type inference in
a compiler. Every operator has a shape contract (Step 0 was largely a
catalog of those contracts — "Conv with SAME padding keeps H×W", "MaxPool
2×2/2 halves H and W"...), so the pass starts from the declared input shape
and pushes it through node by node. No model execution, no weights read —
pure contract propagation. `onnx.shape_inference.infer_shapes(model)`
returns a copy of the model with a `value_info` entry (name + inferred
shape) added for every intermediate tensor.

### 4.2 The code

```python
import sys

import onnx

# Model path can be passed as an argument; defaults to the MNIST model.
MODEL_PATH = sys.argv[1] if len(sys.argv) > 1 else "models/mnist-12.onnx"
model = onnx.load(MODEL_PATH)

# Static analysis pass: propagate shapes through every node's contract.
inferred = onnx.shape_inference.infer_shapes(model)

# Collect every known tensor shape into one dictionary: name -> shape.
shapes = {}

def dims_of(tensor_type):
    return [d.dim_value if d.HasField("dim_value") else "?"
            for d in tensor_type.shape.dim]

for vi in (list(inferred.graph.input) + list(inferred.graph.value_info)
           + list(inferred.graph.output)):
    shapes[vi.name] = dims_of(vi.type.tensor_type)
for init in inferred.graph.initializer:          # weights have shapes too
    shapes[init.name] = list(init.dims)

# Now print the pipeline: every node with real dimensions on every edge.
for i, node in enumerate(inferred.graph.node):
    ins = ", ".join(f"{shapes.get(n, '?')}" for n in node.input)
    outs = ", ".join(f"{shapes.get(n, '?')}" for n in node.output)
    print(f"[{i:2}] {node.op_type:8} {ins}  ->  {outs}")
```

(One syntax note: a protobuf dimension can hold either a concrete number
(`dim_value`) or a symbolic name like `"batch"` for models with flexible
batch size — `HasField` checks which; this model is fully concrete, so
`dims_of` never actually hits the `"?"` branch here.)

Verified output:

```text
[ 0] Conv     [1, 1, 28, 28], [8, 1, 5, 5]  ->  [1, 8, 28, 28]
[ 1] Add      [1, 8, 28, 28], [8, 1, 1]  ->  [1, 8, 28, 28]
[ 2] Relu     [1, 8, 28, 28]  ->  [1, 8, 28, 28]
[ 3] MaxPool  [1, 8, 28, 28]  ->  [1, 8, 14, 14]
[ 4] Conv     [1, 8, 14, 14], [16, 8, 5, 5]  ->  [1, 16, 14, 14]
[ 5] Add      [1, 16, 14, 14], [16, 1, 1]  ->  [1, 16, 14, 14]
[ 6] Relu     [1, 16, 14, 14]  ->  [1, 16, 14, 14]
[ 7] MaxPool  [1, 16, 14, 14]  ->  [1, 16, 4, 4]
[ 8] Reshape  [1, 16, 4, 4], [2]  ->  [1, 256]
[ 9] Reshape  [16, 4, 4, 10], [2]  ->  [256, 10]
[10] MatMul   [1, 256], [256, 10]  ->  [1, 10]
[11] Add      [1, 10], [1, 10]  ->  [1, 10]
```

### 4.3 The image's journey, narrated

Follow one 28×28 digit photo through the pipeline (shapes are NCHW, §0.0;
Conv/MaxPool settings below were read from the nodes' attributes):

- **`[1, 1, 28, 28]` — input.** One image, one channel (grayscale), 28×28.
- **[0] Conv → `[1, 8, 28, 28]`.** Weight shape `[8, 1, 5, 5]` decodes per
  §0.3's spec as: **8 filters**, each looking at **1** input channel through
  a **5×5** window. Channels: 1 → 8 — the image becomes 8 maps of
  pattern-match evidence. H×W stayed 28×28 because this Conv uses SAME
  padding (§0.3: zero-border so the window can center on edge pixels).
- **[1] Add → same shape.** The unfused bias. Its shape `[8, 1, 1]` is one
  number per channel; adding `[8,1,1]` to `[1,8,28,28]` works via
  **broadcasting** — the standard tensor rule that a size-1 axis is
  automatically stretched to match, so each channel's single bias value is
  applied to all 28×28 positions of that channel.
- **[2] Relu → same shape.** Per-element gate (§0.2), shapes never change.
- **[3] MaxPool → `[1, 8, 14, 14]`.** Window 2×2, stride 2 (§0.4): H and W
  halve, channels untouched. The tensor is now ¼ the size.
- **[4] Conv → `[1, 16, 14, 14]`.** Weights `[16, 8, 5, 5]`: 16 filters,
  each reading **all 8** incoming channels. 8 evidence-maps in, 16
  higher-level evidence-maps out — round 2 of feature extraction, exactly
  the "edges → parts" stacking §0.3 promised.
- **[5][6] Add, Relu → same shape.** Bias (broadcast again), gate.
- **[7] MaxPool → `[1, 16, 4, 4]`.** This one is window 3×3, stride 3:
  14×14 → 4×4. Aggressive shrink before the classifier.
- **[8] Reshape → `[1, 256]`.** The flatten (§0.7): 16 channels × 4 × 4 =
  256 numbers, same bytes, new shape label — free. This is the bridge from
  Conv-land (`N,C,H,W`) to Linear-land (`N, features`).
- **[9] Reshape (the weight) → `[256, 10]`.** The oddity from Step 3.3: the
  classifier's weights were saved as `[16, 4, 4, 10]` and get flattened to
  `[256, 10]` *at runtime* on every inference. Constant-foldable noise.
- **[10] MatMul → `[1, 10]`.** §0.1 verbatim: `(1, 256) @ (256, 10) = (1,
  10)`. All 256 features vote on each of the 10 digit classes; 2,560
  weights = 2,560 learned "how much does feature i suggest digit j" recipes.
- **[11] Add → `[1, 10]` — the output.** Final bias. Ten raw scores, one per
  digit; the consumer takes the argmax (no Softmax in-graph, see Step 3.3).

Worth noticing the *asymmetry of scale*: the tensor spends most of the
pipeline as a few thousand values (28×28×8 ≈ 6.3K at its peak) and exits as
10 — while the parameters concentrate the opposite way (Conv1: 200 weights,
Conv2: 3,200, classifier: 2,560). Step 5 turns exactly this into a
per-layer table, and Step 6 turns it into performance reasoning.

### 4.4 What the classifier weight is, and where `Parameter193` comes from

Nodes [10]+[11] are the whole classifier, and they are just one equation
(§0.1):

```text
scores = features @ W + b
```

- `features` — the `1×256` numbers the conv stack produced (node [8]'s output).
- `W` — the **weight matrix**, shape `[256, 10]`. *This is `Parameter193`.*
- `b` — the bias, one number per class (`Parameter194`).
- `scores` — `1×10`, one number per digit; the biggest one wins.

**Why the weight is `256×10` — the shape is forced, not chosen.** You don't
get to pick this shape freely. Two facts pin it down completely: 256 features
come *in*, and you need 10 scores going *out* (one per digit — that `10` is
the only real design decision, "I want to recognize 10 digits"). The matmul
rule is that the inner dimensions must match and cancel, leaving the outer
two:

```text
[1 × 256] @ [256 × 10]  ->  [1 × 10]
     └───────┘   the 256s must match and cancel
 └─┘            └──┘       the outer 1 and 10 survive
```

The only matrix that bridges `256 → 10` this way is `256×10`. Any other
shape either refuses to multiply outright (its inner dimension doesn't
match the incoming 256), or multiplies fine but yields the wrong number of
outputs:

```python
import numpy as np

features = np.zeros((1, 256))          # 256 features for one image

W_right = np.zeros((256, 10))          # the ONLY shape that takes 256 in -> 10 out
print("features @ W[256,10] ->", (features @ W_right).shape, " (10 class scores)")

for bad in [(10, 256), (256, 256), (128, 10)]:
    try:
        out = (features @ np.zeros(bad)).shape
        print(f"features @ W{bad}  -> {out}  (multiplies, but NOT 10 scores!)")
    except ValueError as e:
        print(f"features @ W{bad}  -> ERROR: {str(e).split(':')[0]}")
```

Verified output:

```text
features @ W[256,10] -> (1, 10)  (10 class scores)
features @ W(10, 256)  -> ERROR: matmul
features @ W(256, 256)  -> (1, 256)  (multiplies, but NOT 10 scores!)
features @ W(128, 10)  -> ERROR: matmul
```

(Note the `(256, 256)` case: shape checks alone don't guarantee the *right*
answer — it produces 256 "scores" for a 10-class problem without a single
error. Wrong-but-runnable is the dangerous failure mode, same lesson as the
flatten-ordering contract in §4.6.)

Note the `256` is *inherited* (it's whatever the conv stack happened to
emit — `16 channels × 4 × 4`) while the `10` is *chosen*. Change the conv
architecture and the `256` changes with it; the `10` stays put.

**Where do those 2,560 numbers come from? Training.** Nobody writes a weight
matrix by hand. It starts as random noise and is *learned* from labeled
examples: run the equation, measure how wrong the scores are against the
answer key, and nudge every number in `W` a little in the direction that
reduces the mistakes (gradient descent). Repeat thousands of times. Here is
that happening on a tiny 3-class stand-in (2 features → 3 classes, so `W` is
`[2, 3]` — same story as `[256, 10]`, just small enough to print):

```python
import numpy as np
rng = np.random.default_rng(42)

# Same equation as MNIST-12 nodes [10]+[11]:  scores = features @ W + b
# 3 classes of 2-D points (overlapping blobs), small lr so we can WATCH it learn.
centers = np.array([[1.2, 1.2], [-1.2, 1.2], [0.0, -1.2]])
N = 150
X = np.repeat(centers, N, axis=0) + rng.standard_normal((3*N, 2))*0.9
y = np.repeat([0, 1, 2], N)                 # the answer key (true labels)

W = rng.standard_normal((2, 3)) * 0.01      # weight matrix: [n_features=2, n_classes=3]
b = np.zeros(3)

def accuracy(W, b):
    return ((X @ W + b).argmax(1) == y).mean()

print("W right after random init:\n", W.round(3))
print(f"accuracy with random W: {accuracy(W,b):.1%}   (3 classes -> chance is 33%)\n")

lr = 0.05
Y = np.eye(3)[y]                            # one-hot labels
for step in range(600):
    scores = X @ W + b
    p = np.exp(scores - scores.max(1, keepdims=True)); p /= p.sum(1, keepdims=True)
    grad = p - Y                            # how wrong we are, per class
    W -= lr * (X.T @ grad) / len(X)         # push W to reduce the wrongness
    b -= lr * grad.mean(0)
    if step in (0, 5, 50, 200, 599):
        print(f"  step {step:3}: accuracy {accuracy(W,b):.1%}")

print("\nW after training:\n", W.round(2))
print("\nEach COLUMN of W is one class's 'wish list' over the 2 features:")
for j in range(3):
    print(f"  class {j} column {W[:,j].round(2)}  vs its true center {centers[j]}")
```

Verified output:

```text
W right after random init:
 [[ 0.004  0.001 -0.001]
 [ 0.016 -0.006  0.021]]
accuracy with random W: 20.7%   (3 classes -> chance is 33%)

  step   0: accuracy 80.0%
  step   5: accuracy 88.9%
  step  50: accuracy 89.8%
  step 200: accuracy 90.2%
  step 599: accuracy 90.2%

W after training:
 [[ 1.26 -1.41  0.16]
 [ 0.88  1.1  -1.95]]

Each COLUMN of W is one class's 'wish list' over the 2 features:
  class 0 column [1.26 0.88]  vs its true center [1.2 1.2]
  class 1 column [-1.41  1.1 ]  vs its true center [-1.2  1.2]
  class 2 column [ 0.16 -1.95]  vs its true center [ 0.  -1.2]
```

Two things to read off that output:

- **Random `W` is useless** (20.7%, worse than the 33% chance line); the
  *trained* `W` works (90.2% — capped only because the blobs overlap). The
  weight matrix is the entire difference between guessing and classifying.
- **The learned columns are interpretable.** Each class's column ended up
  pointing toward that class's true location in feature space — nobody
  supplied those directions; training *discovered* them from the labeled
  data. Read `W[:, j]` (column `j`) as "what class `j` looks like, expressed
  in the features." For MNIST, `Parameter193[:, 3]` is literally "what a
  handwritten 3 looks like" in terms of the 256 conv features.

So `Parameter193` is exactly this `W`, scaled up (`[256, 10]`, 2,560 numbers)
and pre-trained: Microsoft ran a loop like the one above over ~60,000 labeled
digit images — training the two Conv filter banks *and* this classifier matrix
together — then **froze** the final numbers and saved them into the `.onnx`
file as a constant. At inference no learning happens; those frozen numbers
just get multiplied against your image's features. (And the
`[16,4,4,10]`-vs-`[256,10]` wrinkle from §3.3 is only about how that frozen
matrix is *stored* — §4.6 below tells that story in full.)

### 4.5 Cross-check: run the model for real

Static analysis says the output should be `[1, 10]`. Trust but verify — run
the actual pipeline with onnxruntime on a dummy input:

```python
import numpy as np
import onnxruntime as ort

# Start an inference session: onnxruntime compiles the graph for the CPU.
sess = ort.InferenceSession("models/mnist-12.onnx")

# A dummy "image": all zeros, in exactly the shape the graph input declares.
x = np.zeros((1, 1, 28, 28), dtype=np.float32)

# Run the whole pipeline. None = "give me every declared graph output".
outputs = sess.run(None, {"Input3": x})

print(outputs[0].shape)
# (1, 10)
print(np.round(outputs[0], 2))
# [[-0.04  0.01  0.07  0.03 -0.13  0.14 -0.06 -0.05  0.08 -0.05]]
```

Shape matches the inferred `[1, 10]` — static analysis and runtime agree.
(The scores are near-zero garbage because the input is a blank image; even
so, the biases leak through and the model weakly "votes" for digit 5 —
`0.14` is the max. Feed it real digit pixels and these become confident.)

Also do the visual pass now: open `models/mnist-12.onnx` in
**https://netron.app** — you'll see exactly the 12-node chain from Step 3,
with the shapes from this step on the edges, and clicking any node shows
the attributes we read programmatically (kernel_shape, strides, pads...).

### 4.6 FAQ — why does node [9] reshape a *weight*, and where does `[16, 4, 4, 10]` come from?

**Start from what the layer IS.** Nodes [10]+[11] are a **fully connected
layer** (a.k.a. Linear/Dense — §0.1) with `in_features = 256` and
`out_features = 10`. The 10 is the design decision — we want 10 digit
classes out. The 256 is inherited — it's however many features the conv
stack happens to emit. And a fully connected layer is just the equation:

```text
scores = x @ W + b
```

During training, `x` is `1×256` and the required result is `1×10` — so by
the matmul rule (inner dimensions must match and cancel: `[1×256] @
[256×10] → [1×10]`, see the demo in §4.4), **`W` is naturally `256×10`.
Nothing else fits.** That `256×10` matrix — 2,560 trained numbers, one per
(feature, digit) pair — is what `Parameter193` holds. So far, no mystery:
every fully connected layer everywhere works exactly like this.

**Then why is it stored as `[16, 4, 4, 10]`?** Pure labeling. The 256
inputs to this layer aren't an anonymous flat list — each one is really
"channel c at position (y, x)" of the `[1, 16, 4, 4]` tensor coming off the
last pool (16 × 4 × 4 = 256). The training framework (CNTK) let the dense
layer consume that tensor *without an explicit flatten in the model
definition*, so it kept `W`'s rows addressed by their original coordinates:
`[16, 4, 4, 10]` = "the weight connecting (channel, y, x) to digit d."
**Same 2,560 numbers, same layer** — just addressed with 4-D coordinates
instead of flat row indices, like the same bytes viewed through a different
struct definition.

**And why a Reshape node at runtime?** ONNX's `MatMul` only speaks 2-D
matrices, so at export time the weight had to become `[256, 10]`. The
exporter had two options: flatten the constant **once, offline**, and store
`[256, 10]` in the file (the right thing — a constant's flattened form is
also a constant), or emit a Reshape node that flattens it **at runtime,
every inference**. This exporter did the lazy second thing. Deployment
tools (onnx-simplifier, onnxruntime's graph optimizer) recognize "Reshape
of a constant," compute it once, and delete the node — constant folding.

The subtle part worth internalizing: **the two Reshapes must agree on
ordering.** Node [8] flattens the data channel-then-row-then-column; node
[9] flattens the weight's first three axes in the *same* order, so row *i*
of the matrix meets exactly the feature that landed at position *i* of the
flattened data. If they disagreed, every shape check would still pass, the
model would run without error — and output garbage, feature 37 multiplied
by feature 122's recipe. Reshape/Transpose carry invisible *ordering
contracts* that no type system checks: this is the NCHW-vs-NHWC porting
failure mode in miniature, and exactly what the layout-audit lab later in
this file's roadmap is about.

---

## Step 5 — The per-layer spec table

Time to condense Steps 3–4 into the artifact you'd actually produce on the
job: one table, every layer, its contract and its cost of ownership.

**Counting parameters — one new idea.** A tensor's element count is just the
product of its dimensions: the `[8, 1, 5, 5]` Conv weight stores
8 × 1 × 5 × 5 = 200 numbers. And in this graph, *learned* parameters are
exactly the **float** initializers — the int64 initializers (the `[2]`-shaped
target-shape inputs of the Reshape nodes) are settings, not learned values.
That type distinction is the whole counting rule.

`step5_spec_table.py` implements it — and it's fully generic, so you can
point it at any ONNX model with static shapes:

```python
import sys

import onnx
from onnx import TensorProto

# Model path can be passed as an argument; defaults to the MNIST model.
MODEL_PATH = sys.argv[1] if len(sys.argv) > 1 else "models/mnist-12.onnx"
model = onnx.load(MODEL_PATH)
inferred = onnx.shape_inference.infer_shapes(model)

# name -> shape, for every tensor we know about (same as step 4).
shapes = {}
def dims_of(tensor_type):
    return [d.dim_value if d.HasField("dim_value") else "?"
            for d in tensor_type.shape.dim]
for vi in (list(inferred.graph.input) + list(inferred.graph.value_info)
           + list(inferred.graph.output)):
    shapes[vi.name] = dims_of(vi.type.tensor_type)

# Initializers = the constants baked into the file. Learned parameters are
# the FLOAT ones (weights/biases); int64 constants are just settings
# (e.g. the target-shape inputs of Reshape nodes), not learned values.
init_elems = {}          # name -> element count, float initializers only
for init in inferred.graph.initializer:
    shapes[init.name] = list(init.dims)
    if init.data_type == TensorProto.FLOAT:
        n = 1
        for d in init.dims:
            n *= d
        init_elems[init.name] = n

total = 0
print(f"{'#':>2}  {'op':8} {'data in':>15} {'-> out':>12} {'params':>7}")
for i, node in enumerate(inferred.graph.node):
    # Split the node's inputs: tensors flowing through the graph vs
    # constants it owns (weights, settings).
    data_ins = [n for n in node.input if n not in init_elems
                and shapes.get(n) is not None and n not in
                {init.name for init in inferred.graph.initializer}]
    params = sum(init_elems.get(n, 0) for n in node.input)
    total += params
    din = str(shapes.get(data_ins[0])) if data_ins else "(const)"
    dout = str(shapes.get(node.output[0], "?"))
    print(f"{i:>2}  {node.op_type:8} {din:>15} {dout:>12} {params:>7,}")

print(f"\nTotal learned parameters: {total:,}")
print(f"As float32 (4 bytes each): {total * 4 / 1024:.1f} KB")
```

Verified output:

```text
 #  op               data in       -> out  params
 0  Conv      [1, 1, 28, 28] [1, 8, 28, 28]     200
 1  Add       [1, 8, 28, 28] [1, 8, 28, 28]       8
 2  Relu      [1, 8, 28, 28] [1, 8, 28, 28]       0
 3  MaxPool   [1, 8, 28, 28] [1, 8, 14, 14]       0
 4  Conv      [1, 8, 14, 14] [1, 16, 14, 14]   3,200
 5  Add      [1, 16, 14, 14] [1, 16, 14, 14]      16
 6  Relu     [1, 16, 14, 14] [1, 16, 14, 14]       0
 7  MaxPool  [1, 16, 14, 14] [1, 16, 4, 4]       0
 8  Reshape    [1, 16, 4, 4]     [1, 256]       0
 9  Reshape          (const)    [256, 10]   2,560
10  MatMul          [1, 256]      [1, 10]       0
11  Add              [1, 10]      [1, 10]      10

Total learned parameters: 5,994
As float32 (4 bytes each): 23.4 KB
```

The full spec table — the script's numbers plus the functional notes
(this is the Step 5 deliverable):

| # | Op | In → Out | Params | Why this layer exists |
|---|---|---|---|---|
| 0 | Conv | `1,1,28,28` → `1,8,28,28` | 200 | 8 pattern detectors (5×5) over the raw image (§0.3) |
| 1 | Add | same | 8 | Conv 0's bias, unfused (one constant per channel) |
| 2 | Relu | same | 0 | gate: keep only positive pattern evidence (§0.2) |
| 3 | MaxPool | → `1,8,14,14` | 0 | halve the map, keep strongest evidence (§0.4) |
| 4 | Conv | → `1,16,14,14` | 3,200 | 16 detectors over all 8 evidence maps — patterns *of* patterns |
| 5 | Add | same | 16 | Conv 4's bias, unfused |
| 6 | Relu | same | 0 | gate again |
| 7 | MaxPool | → `1,16,4,4` | 0 | 3×3/3 shrink to a tiny 4×4 summary |
| 8 | Reshape | → `1,256` | 0 | flatten: bridge to Linear-land (§0.7) |
| 9 | Reshape | const → `256,10` | 2,560 | flattens the *classifier weight* at runtime (§4.6 — export artifact) |
| 10 | MatMul | → `1,10` | 0 | all 256 features vote on 10 digits (§0.1) |
| 11 | Add | → `1,10` | 10 | classifier bias → final scores |

Three things to read off it:

- **An attribution quirk that proves you understand the graph:** MatMul
  shows 0 params and Reshape [9] shows 2,560 — because the script credits
  parameters to whichever node *consumes the constant*, and thanks to the
  export artifact from §4.6, that's the Reshape, not the MatMul.
  Conceptually those 2,560 belong to the classifier. Tools that report
  per-layer stats have exactly this kind of quirk; knowing *why* the number
  landed on the "wrong" row is the difference between reading a report and
  understanding it.
- **Cross-check against reality:** 5,994 params × 4 bytes ≈ 23.4 KB, and the
  file is 26 KB — weights account for ~90% of it, remainder is graph
  structure. When those two numbers *don't* roughly agree, something is off
  (duplicated weights, external data files, quantization) — a 10-second
  sanity check worth making a habit.
- **Where the parameters live:** Conv 4 (3,216 with bias) + classifier
  (2,570) ≈ 96% of all parameters; the entire first block owns just 208.
  Parameter storage concentrates *late* in CNNs — remember from Step 4.3
  that activation size concentrates *early*. Both halves of that asymmetry
  become performance-relevant next.

---

## Step 6 — Compute-bound or memory-bound?

### 6.1 The idea, in plain terms

Every layer has **two costs**, paid simultaneously:

1. **Arithmetic** — the MACs (§0.1) it performs: the useful work.
2. **Traffic** — the bytes it must move: read its input tensor, read its
   weights, write its output tensor.

Any chip has a fixed budget for each: its ALUs can do at most X MACs per
second, and its memory system can deliver at most Y bytes per second. Both
run in parallel — so a layer is limited by **whichever budget it exhausts
first**. Exhaust the arithmetic budget → *compute-bound* (the memory system
idles; this is where accelerators shine). Exhaust the byte budget →
*memory-bound* (the expensive ALUs starve, waiting for data; a bigger
"faster" chip won't help at all).

Which way a layer falls depends on its **MACs-per-byte ratio** ("arithmetic
intensity"): how much work does the chip *get to do* per byte it *has to
fetch*? Lots of MACs per byte → the data is reused heavily once loaded →
compute-bound. Few MACs per byte → the chip is basically a data pump →
memory-bound. Where the crossover sits is a property of the *chip* (its
MAC-rate divided by its byte-rate), not of the model — the verdicts below
use teaching thresholds (≥10 compute-bound, <1 memory-bound), and on a real
engagement you'd plug in the target chip's actual ratio.

### 6.2 The cost model

`step6_cost_model.py` (also generic) computes both costs per node. MAC
counting needs only two rules, both direct from the Step 0 contracts:

- **Conv**: every output element was produced by sliding a filter to one
  position = one MAC per weight in the filter. So: output elements ×
  filter size (for Conv 0: 6,272 outputs × 25-weight filters).
- **MatMul**: every output element is a dot product over the shared
  dimension K = one MAC per pair. So: output elements × K.
- Everything else (Add, Relu, MaxPool, Reshape): ~0 MACs — they touch every
  byte but compute almost nothing.

```python
import sys

import onnx

# Model path can be passed as an argument; defaults to the MNIST model.
MODEL_PATH = sys.argv[1] if len(sys.argv) > 1 else "models/mnist-12.onnx"
model = onnx.load(MODEL_PATH)
inferred = onnx.shape_inference.infer_shapes(model)

shapes = {}
def dims_of(tensor_type):
    return [d.dim_value if d.HasField("dim_value") else "?"
            for d in tensor_type.shape.dim]
for vi in (list(inferred.graph.input) + list(inferred.graph.value_info)
           + list(inferred.graph.output)):
    shapes[vi.name] = dims_of(vi.type.tensor_type)
for init in inferred.graph.initializer:
    shapes[init.name] = list(init.dims)

def elems(name):
    s = shapes.get(name)
    if not s:
        return 0
    n = 1
    for d in s:
        n *= d
    return n

def macs_of(node):
    if node.op_type == "Conv":
        # one MAC per (output element x weight in the filter that made it):
        # filter size = in_channels_per_group * kH * kW  (weight dims [1:])
        w = shapes[node.input[1]]
        filter_elems = 1
        for d in w[1:]:
            filter_elems *= d
        return elems(node.output[0]) * filter_elems
    if node.op_type in ("MatMul", "Gemm"):
        # every output element is a dot product over the shared dimension K
        k = shapes[node.input[0]][-1]
        return elems(node.output[0]) * k
    return 0        # elementwise / pooling / plumbing: no MACs

print(f"{'#':>2}  {'op':8} {'MACs':>9} {'KB moved':>9} {'MACs/byte':>10}  verdict")
total_macs = 0
for i, node in enumerate(inferred.graph.node):
    macs = macs_of(node)
    total_macs += macs
    bytes_moved = 4 * (sum(elems(n) for n in node.input) + elems(node.output[0]))
    intensity = macs / bytes_moved if bytes_moved else 0.0
    verdict = ("compute-bound" if intensity >= 10
               else "borderline" if intensity >= 1
               else "memory-bound")
    print(f"{i:>2}  {node.op_type:8} {macs:>9,} {bytes_moved/1024:>9.1f} "
          f"{intensity:>10.2f}  {verdict}")

print(f"\nTotal MACs: {total_macs:,}")
for i, node in enumerate(inferred.graph.node):
    m = macs_of(node)
    if m:
        print(f"  node [{i}] {node.op_type}: {m:,} MACs = "
              f"{100 * m / total_macs:.1f}% of all compute")
```

Verified output:

```text
 #  op            MACs  KB moved  MACs/byte  verdict
 0  Conv       156,800      28.3       5.40  borderline
 1  Add              0      49.0       0.00  memory-bound
 2  Relu             0      49.0       0.00  memory-bound
 3  MaxPool          0      30.6       0.00  memory-bound
 4  Conv       627,200      30.9      19.84  compute-bound
 5  Add              0      24.6       0.00  memory-bound
 6  Relu             0      24.5       0.00  memory-bound
 7  MaxPool          0      13.2       0.00  memory-bound
 8  Reshape          0       2.0       0.00  memory-bound
 9  Reshape          0      20.0       0.00  memory-bound
10  MatMul       2,560      11.0       0.23  memory-bound
11  Add              0       0.1       0.00  memory-bound

Total MACs: 786,560
  node [0] Conv: 156,800 MACs = 19.9% of all compute
  node [4] Conv: 627,200 MACs = 79.7% of all compute
  node [10] MatMul: 2,560 MACs = 0.3% of all compute
```

### 6.3 Reading the table — five observations that generalize

1. **Conv 4 at 19.84 MACs/byte is the accelerator's dream.** It moves about
   the same 30 KB as Conv 0 but does 4× the arithmetic on it — the loaded
   data gets reused intensely. This is the kind of layer AI chips were
   built for.
2. **Same op type, different bottleneck.** Conv 0 manages only 5.40 —
   because with a single input channel its filters are tiny (25 weights),
   so each fetched byte supports little work. *Early convolutions are
   structurally less intense than deep ones.* You cannot classify "Conv" as
   compute-bound as a category; you have to look at the shapes. That's why
   the spec table comes before the verdict.
3. **The MatMul twist — batch size is destiny.** §0.1 called MatMul the
   classic compute-bound op *because weights get reused across the batch*.
   Here batch = 1, so each of the 2,560 weight bytes is fetched, used for
   exactly one MAC, and discarded: 0.23 MACs/byte, firmly memory-bound.
   Scale this observation up and you get the defining problem of LLM
   inference: generating one token at a time is batch-1 MatMul after
   batch-1 MatMul — enormous models held memory-bound. Same physics as
   this 10-class digit classifier.
4. **The zero-MAC rows are why fusion matters.** Add [1] and Relu [2] each
   move ~49 KB — more bytes than either Conv! — for literally zero useful
   arithmetic. Executed as separate steps, they'd *each* cost a full
   round-trip of the tensor through memory. Fused into Conv 0's output path
   (bias-add and clamp applied as each result exits the ALU), they cost
   approximately nothing. An accelerator compiler's fusion pass turns rows
   0–2 into one node; on this graph it eliminates most of the traffic.
5. **The two Reshapes aren't equal.** Node [8] is metadata-only (§0.7 —
   same bytes, new shape label: ~free). Node [9] pointlessly moves 20 KB of
   frozen weights *every inference* (§4.6). The table quantifies exactly
   what constant folding buys you.

---

## Step 7 — Which layers dominate runtime?

The ranking falls straight out of Step 6:

| Rank | Node | Share of all MACs | Why |
|---|---|---|---|
| 1 | Conv 4 | **79.7%** | 16 filters × 8 input channels = 128 channel pairs, 25-weight window each. The channel-pair product is the multiplier that explodes. |
| 2 | Conv 0 | **19.9%** | 4× the spatial positions of Conv 4 (28² vs 14²), but only 8 channel pairs — the channel effect beats the spatial effect. |
| 3 | MatMul 10 | 0.3% | 2,560 MACs. Owns 43% of the parameters but contributes noise-level compute — parameters ≠ compute. |

Everything else: zero MACs; relevant only through memory traffic.

**Why the deep Conv wins, structurally:** Conv cost = output positions ×
output channels × input channels × window size. Going deeper, pooling
shrinks positions by 4× per stage, but channel *pairs* grow — here 8 → 128,
a 16× jump that dwarfs the 4× spatial saving. This is the standard CNN
pattern: **compute concentrates in the middle-to-deep convolutions**, where
maps are still moderately sized but channels have multiplied. On a ResNet
the same analysis points at the stage-2/3 blocks; the tooling you just
built finds them.

**Honest caveats — what the MAC ranking does NOT say:**

- On a model this small (0.8 MMACs — a modern phone chip does this in well
  under a millisecond), per-layer *launch overhead* and the memory-bound
  rows in practice dominate wall-clock time. MAC ranking identifies where
  compute lives; on tiny models, compute isn't what you wait for.
- The bytes column tells a complementary story: rows 1–3 (unfused
  bias/gate/pool) collectively move more data than both convolutions
  combined. If the target hardware *didn't* fuse them, the "cheap" ops
  would be the actual bottleneck. Always read both columns.

**The triage recipe** you'd apply to any customer model: rank layers by
MACs to find the compute hotspots → check each hotspot's MACs/byte against
the chip's ratio to see if it can actually run at compute speed → then scan
the zero-MAC rows for unfused/unfolded traffic that fusion or offline
folding should eliminate.

---

## Step 8 — Porting notes: your turn to write

The final step of the exercise is yours. A **porting brief** is the ~half-page
a field engineer writes after first contact with a customer model — for a
colleague who hasn't opened the file and needs to know what porting it will
involve. Everything you need is in Steps 3–7. Structure it in six parts:

1. **What it is** — one sentence: task, input contract, output contract.
2. **Topology** — the blocks in order, in words (not a node dump).
3. **Parameters** — how many, roughly where they live, storage size.
4. **Compute** — where the MACs concentrate; total scale.
5. **Bottleneck character** — which parts are compute-bound vs
   memory-bound, and what that implies on an accelerator.
6. **Cleanup & risks** — export artifacts to fold/fuse, anything missing
   from the graph the integration must supply, layout/ordering contracts
   to respect.

Write it in plain English, ~15–20 lines, as if briefing a colleague — then
bring it back here. I'll review it against the data (and only then will we
polish a final version into this file as the Step 8 deliverable). Resist
the urge to re-read Steps 5–7 while writing; write from what stuck, then
check. The gaps you find are the parts worth re-reading.

**After that: Step 9** (attention/Transformer model) and the layout-audit
lab from the roadmap.

---

## Step 9 — The attention model: one Transformer block

*(Step 8 — your porting brief — stays open; we're jumping ahead by request.)*

The CNN pass is done; now the other half of the modern-model world:
**attention**, the operator family behind Transformers (BERT, GPT, ViT,
LLMs). Plan: understand the mechanism functionally (§9.0), *build* a
minimal attention model as ONNX (§9.1), dissect it with the exact tools
from Steps 3–6 (§9.2), and pull out what changes for hardware (§9.3).

### 9.0 What attention is — the §0-style primer

**The problem it solves.** Every operator so far has *fixed routing*: a
Conv always mixes each pixel with the same neighbors; a Linear always mixes
features by the same frozen recipe. Language breaks that: in "the chip
overheated because **it** was underclocked", the meaning of *it* depends on
another word — and *which* word varies from sentence to sentence. You need
an operator whose routing is **computed from the data itself, per input**:
"decide at runtime which other tokens matter to me, and pull information
from those."

**The mechanism: a soft dictionary lookup.** Each token (a word/word-piece,
represented as a feature vector — here 8 numbers) derives three things from
itself, each via a plain §0.1 Linear projection:

- **Q (query)** — what I'm *asking for* ("I'm a pronoun; looking for a noun")
- **K (key)** — what I *offer* ("I'm a noun, subject of the sentence")
- **V (value)** — my actual *content*, the information worth taking

Then, with S tokens:

1. **Scores:** every token's ask is compared against every token's offer —
   one MatMul producing an **S×S table**: entry (i, j) = "how relevant is
   token j to token i". Note what's new: *both* sides of this MatMul are
   data. In the whole MNIST model, one side of every MatMul/Conv was a
   frozen weight — here the network multiplies *activations by activations*.
2. **Scale + Softmax, per row:** §0.5's second job. Each row of raw scores
   becomes a sums-to-1 **attention budget** — "token i spends 60% of its
   attention on token 3, 25% on token 0, ...". (The scale — dividing by a
   constant based on the feature count — just keeps scores in Softmax's
   responsive range so one token doesn't grab ~100% by numeric accident.)
3. **Context:** a second data×data MatMul blends the V rows using those
   budgets — token i receives a weighted mix of the *content* of the tokens
   it attended to. Result: back to `[S, D]`, one updated vector per token.

**After the lookup, two glue ideas you haven't met yet:**

- **Residual connection** — an `Add` that mixes the block's *input* back
  into its output. Functionally: attention computes a **correction**, not a
  replacement; the original token rides through on a bypass wire and the
  block adds what it learned. (This is also why very deep stacks stay
  trainable: information can always flow through the bypass.)
- Then **LayerNorm** (§0.6 — the live-stats one that *doesn't* fold away)
  re-conditions the signal.

**Then a per-token MLP:** Linear up (8 → 32) → GELU (§0.2) → Linear down
(32 → 8), plus its own residual + LayerNorm. Functionally: attention
*gathers* information across tokens; the MLP *processes* what each token
gathered, independently. Attention is the only place tokens talk to each
other — everything else in a Transformer is per-token.

**Component spec — the whole block:**

| | |
|---|---|
| Input | `[batch, S tokens, D features]` |
| Parameters | 4 projection matrices `D×D`, 2 MLP matrices `D×H`, `H×D`, 2 LayerNorm scale/shift pairs |
| Output | **exactly the same shape** `[batch, S, D]` |
| Learned? | Yes — all the projections |

Same shape out as in → blocks stack like Lego. A real Transformer is this
block repeated N times (bert-tiny: 2, BERT-base: 12, big LLMs: ~100) with
an embedding layer in front and a task head at the end. Understand one
block, you understand the whole tower. (Real blocks also use
**multi-head** attention: run 8–16 *small* independent lookups in parallel
and concatenate — same mechanism, split for diversity of "what to look
for". One head keeps our graph readable.)

### 9.1 Build it instead of downloading it

Why build: real "small" transformers export to 100–600 nodes of repetitive,
noisy graph — the *unit that repeats* is one block, and a hand-built block
is ~16 clean nodes, a few KB (committable), with attention as the only new
thing. Bonus: you learn the *writing* direction of the ONNX data model from
Step 3.1 — `helper.make_node(op, input_names, output_names)` writes one
line of the wiring table; `make_graph` declares the public API (inputs/
outputs) and the frozen constants (initializers); `checker.check_model`
validates against the spec. Reading and writing the same structure.

The builder (this is `step9_build_attention.py`; weights are seeded random
stand-ins for training — the *mechanism* doesn't care):

```python
import numpy as np
import onnx
from onnx import TensorProto, helper, numpy_helper

SEQ, DIM, HID = 4, 8, 32          # tokens, features per token, MLP hidden size


def build_block(seq_len=SEQ, dim=DIM, hidden=HID, seed=0):
    """Build one Transformer encoder block; returns an onnx ModelProto."""
    rng = np.random.default_rng(seed)

    def weight(name, *shape):
        # a frozen constant (initializer): small random values stand in for
        # what training would have learned
        w = rng.standard_normal(shape).astype(np.float32) * 0.5
        return numpy_helper.from_array(w, name=name)

    inits = [
        weight("Wq", dim, dim), weight("Wk", dim, dim), weight("Wv", dim, dim),
        weight("Wo", dim, dim),                       # attention output projection
        weight("Wup", dim, hidden), weight("Wdown", hidden, dim),   # the MLP
        numpy_helper.from_array(                       # 1/sqrt(dim) score scaling
            np.float32(1.0 / np.sqrt(dim)), name="scale"),
        numpy_helper.from_array(np.ones(dim, np.float32), name="ln1_gamma"),
        numpy_helper.from_array(np.zeros(dim, np.float32), name="ln1_beta"),
        numpy_helper.from_array(np.ones(dim, np.float32), name="ln2_gamma"),
        numpy_helper.from_array(np.zeros(dim, np.float32), name="ln2_beta"),
    ]

    N = helper.make_node          # shorthand: N(op, inputs, outputs, ...)
    nodes = [
        # --- self-attention ---
        N("MatMul", ["tokens", "Wq"], ["Q"]),          # what each token ASKS for
        N("MatMul", ["tokens", "Wk"], ["K"]),          # what each token OFFERS
        N("MatMul", ["tokens", "Wv"], ["V"]),          # each token's CONTENT
        N("Transpose", ["K"], ["Kt"], perm=[0, 2, 1]), # line K up for the match
        N("MatMul", ["Q", "Kt"], ["scores"]),          # every ask x every offer
        N("Mul", ["scores", "scale"], ["scaled"]),     # keep scores in Softmax's sweet spot
        N("Softmax", ["scaled"], ["attn"], axis=-1),   # scores -> attention budget
        N("MatMul", ["attn", "V"], ["context"]),       # blend content by budget
        N("MatMul", ["context", "Wo"], ["proj"]),      # mix the gathered info
        N("Add", ["proj", "tokens"], ["resid1"]),      # residual: keep the original too
        N("LayerNormalization", ["resid1", "ln1_gamma", "ln1_beta"], ["ln1"]),
        # --- per-token MLP ---
        N("MatMul", ["ln1", "Wup"], ["up"]),           # widen 8 -> 32
        N("Gelu", ["up"], ["act"]),                    # the gate (sec 0.2)
        N("MatMul", ["act", "Wdown"], ["down"]),       # narrow 32 -> 8
        N("Add", ["down", "ln1"], ["resid2"]),         # second residual
        N("LayerNormalization", ["resid2", "ln2_gamma", "ln2_beta"], ["out"]),
    ]

    graph = helper.make_graph(
        nodes, "tiny_attention_block",
        inputs=[helper.make_tensor_value_info(
            "tokens", TensorProto.FLOAT, [1, seq_len, dim])],
        outputs=[helper.make_tensor_value_info(
            "out", TensorProto.FLOAT, [1, seq_len, dim]),
                 helper.make_tensor_value_info(     # expose attn so we can LOOK at it
            "attn", TensorProto.FLOAT, [1, seq_len, seq_len])],
        initializer=inits,
    )
    model = helper.make_model(
        graph, opset_imports=[helper.make_opsetid("", 21)])
    model.ir_version = 10                      # keep loadable by onnxruntime
    onnx.checker.check_model(model)            # validate against the ONNX spec
    return model


if __name__ == "__main__":
    model = build_block()
    onnx.save(model, "models/tiny_attention.onnx")
    print(f"saved models/tiny_attention.onnx "
          f"({len(model.graph.node)} nodes, checker passed)")

    # Run it: 4 random "tokens" in, watch who attends to whom.
    import onnxruntime as ort
    sess = ort.InferenceSession("models/tiny_attention.onnx")
    rng = np.random.default_rng(7)
    tokens = rng.standard_normal((1, SEQ, DIM)).astype(np.float32)
    out, attn = sess.run(None, {"tokens": tokens})

    print("\nattention matrix (row = a token asking, col = a token answering):")
    print(np.round(attn[0], 3))
    print("row sums:", np.round(attn[0].sum(axis=1), 6))   # softmax -> each row sums to 1
    print("output shape:", out.shape)
```

Verified output:

```text
saved models/tiny_attention.onnx (16 nodes, checker passed)

attention matrix (row = a token asking, col = a token answering):
[[0.082 0.16  0.323 0.435]
 [0.182 0.213 0.301 0.303]
 [0.028 0.052 0.177 0.742]
 [0.154 0.256 0.162 0.429]]
row sums: [1. 1. 1. 1.]
output shape: (1, 4, 8)
```

That 4×4 matrix *is* attention, visible: row 2 (third token) spends 74.2%
of its budget on token 3 and nearly ignores tokens 0–1; row 1 spreads its
budget almost evenly. Every row sums to exactly 1 — §0.5's contract. With
trained weights these budgets would be *meaningful* (pronouns attending to
their nouns); with our random stand-ins they're arbitrary — but the
machinery is identical, and it's the machinery we're porting.

### 9.2 Dissect it — with the tools you already have

The Steps 3–6 scripts took one tiny upgrade: an optional model path
(`sys.argv[1]`, still defaulting to MNIST — the code blocks above reflect
it). That's the payoff of writing *generic* graph tools: point them at a
model family they've never seen —

```bash
python step4_shape_inference.py models/tiny_attention.onnx
python step5_spec_table.py     models/tiny_attention.onnx
python step6_cost_model.py     models/tiny_attention.onnx
```

— and they just work. Shape inference (verified output):

```text
[ 0] MatMul   [1, 4, 8], [8, 8]  ->  [1, 4, 8]
[ 1] MatMul   [1, 4, 8], [8, 8]  ->  [1, 4, 8]
[ 2] MatMul   [1, 4, 8], [8, 8]  ->  [1, 4, 8]
[ 3] Transpose [1, 4, 8]  ->  [1, 8, 4]
[ 4] MatMul   [1, 4, 8], [1, 8, 4]  ->  [1, 4, 4]
[ 5] Mul      [1, 4, 4], []  ->  [1, 4, 4]
[ 6] Softmax  [1, 4, 4]  ->  [1, 4, 4]
[ 7] MatMul   [1, 4, 4], [1, 4, 8]  ->  [1, 4, 8]
[ 8] MatMul   [1, 4, 8], [8, 8]  ->  [1, 4, 8]
[ 9] Add      [1, 4, 8], [1, 4, 8]  ->  [1, 4, 8]
[10] LayerNormalization [1, 4, 8], [8], [8]  ->  [1, 4, 8]
[11] MatMul   [1, 4, 8], [8, 32]  ->  [1, 4, 32]
[12] Gelu     [1, 4, 32]  ->  [1, 4, 32]
[13] MatMul   [1, 4, 32], [32, 8]  ->  [1, 4, 8]
[14] Add      [1, 4, 8], [1, 4, 8]  ->  [1, 4, 8]
[15] LayerNormalization [1, 4, 8], [8], [8]  ->  [1, 4, 8]
```

The shape journey to internalize: `[1,4,8]` tokens → three parallel
`[1,4,8]` projections → K transposed to `[1,8,4]` → **scores `[1,4,4]`** —
the tensor stops being "tokens × features" and becomes "tokens × tokens",
the relationship table — → Softmax keeps it `[1,4,4]` → context returns to
`[1,4,8]` — back to "tokens × features", now context-enriched — and the
block exits at exactly its entry shape. Also note nodes [4] and [7] in the
listing: both MatMul inputs are `[1,...]` *data* tensors, not `[8,8]`-style
weights — the data×data signature of attention, visible right in the shapes.

Spec table (verified output):

```text
 #  op               data in       -> out  params
 0  MatMul         [1, 4, 8]    [1, 4, 8]      64
 1  MatMul         [1, 4, 8]    [1, 4, 8]      64
 2  MatMul         [1, 4, 8]    [1, 4, 8]      64
 3  Transpose       [1, 4, 8]    [1, 8, 4]       0
 4  MatMul         [1, 4, 8]    [1, 4, 4]       0
 5  Mul            [1, 4, 4]    [1, 4, 4]       1
 6  Softmax        [1, 4, 4]    [1, 4, 4]       0
 7  MatMul         [1, 4, 4]    [1, 4, 8]       0
 8  MatMul         [1, 4, 8]    [1, 4, 8]      64
 9  Add            [1, 4, 8]    [1, 4, 8]       0
10  LayerNormalization       [1, 4, 8]    [1, 4, 8]      16
11  MatMul         [1, 4, 8]   [1, 4, 32]     256
12  Gelu          [1, 4, 32]   [1, 4, 32]       0
13  MatMul        [1, 4, 32]    [1, 4, 8]     256
14  Add            [1, 4, 8]    [1, 4, 8]       0
15  LayerNormalization       [1, 4, 8]    [1, 4, 8]      16

Total learned parameters: 801
As float32 (4 bytes each): 3.1 KB
```

Reading it: the two *biggest* parameter holders are the MLP matrices (256
each) — true of real Transformers too, where the MLP typically holds ~2/3
of each block's parameters. The attention MatMuls [4] and [7] hold **zero**
parameters — they multiply data by data. And one tool quirk to catch: node
[5] "owns 1 parameter" — that's the scale constant, a float initializer, so
our "float = learned" heuristic misfires. It's a setting, not a weight.
Heuristics have edge cases; know your tool's.

Cost model (verified output):

```text
 #  op            MACs  KB moved  MACs/byte  verdict
 0  MatMul         256       0.5       0.50  memory-bound
 1  MatMul         256       0.5       0.50  memory-bound
 2  MatMul         256       0.5       0.50  memory-bound
 3  Transpose         0       0.2       0.00  memory-bound
 4  MatMul         128       0.3       0.40  memory-bound
 5  Mul              0       0.1       0.00  memory-bound
 6  Softmax          0       0.1       0.00  memory-bound
 7  MatMul         128       0.3       0.40  memory-bound
 8  MatMul         256       0.5       0.50  memory-bound
 9  Add              0       0.4       0.00  memory-bound
10  LayerNormalization         0       0.3       0.00  memory-bound
11  MatMul       1,024       1.6       0.62  memory-bound
12  Gelu             0       1.0       0.00  memory-bound
13  MatMul       1,024       1.6       0.62  memory-bound
14  Add              0       0.4       0.00  memory-bound
15  LayerNormalization         0       0.3       0.00  memory-bound

Total MACs: 3,328
  node [0] MatMul: 256 MACs = 7.7% of all compute
  node [1] MatMul: 256 MACs = 7.7% of all compute
  node [2] MatMul: 256 MACs = 7.7% of all compute
  node [4] MatMul: 128 MACs = 3.8% of all compute
  node [7] MatMul: 128 MACs = 3.8% of all compute
  node [8] MatMul: 256 MACs = 7.7% of all compute
  node [11] MatMul: 1,024 MACs = 30.8% of all compute
  node [13] MatMul: 1,024 MACs = 30.8% of all compute
```

**Look at the verdict column: every single row is memory-bound.** Not one
layer above 0.62 MACs/byte. On the CNN, batch-1 memory-boundness was a
footnote about one MatMul (§6.3, point 3); on a Transformer at batch 1 it
is *the entire model* — every weight byte fetched, used once, discarded.
This is the defining hardware fact of LLM-style inference, reproduced
faithfully by a 3 KB toy.

### 9.3 The seq² story — what changes when sequences grow

This graph has **two kinds of MatMul**, and they scale differently with
token count S:

- **Weight MatMuls** (Q/K/V/output projections, MLP — nodes 0-2, 8, 11,
  13): one side is a frozen matrix. Twice the tokens → twice the rows
  pushed through → cost grows **linearly** with S.
- **Data×data MatMuls** (scores [4], context [7]): *both* sides grow with
  S — the scores output is the S×S table itself. Twice the tokens → four
  times the cost. **Quadratic.**

`step9_seq_scaling.py` rebuilds the same block at increasing S and splits
the MACs into those two buckets:

```python
import onnx

from step9_build_attention import build_block

# The two MatMuls whose BOTH inputs are data (not weights): their cost
# depends on the token count twice.
ATTENTION_MATMULS = {"scores", "context"}

def elems(shapes, name):
    n = 1
    for d in shapes.get(name, []):
        n *= d
    return n

print(f"{'tokens':>7} {'linear MACs':>12} {'attention MACs':>15} {'attention share':>16}")
for seq in (4, 64, 512, 4096):
    model = build_block(seq_len=seq)
    inferred = onnx.shape_inference.infer_shapes(model)
    shapes = {}
    for vi in (list(inferred.graph.input) + list(inferred.graph.value_info)
               + list(inferred.graph.output)):
        shapes[vi.name] = [d.dim_value for d in vi.type.tensor_type.shape.dim]
    for init in inferred.graph.initializer:
        shapes[init.name] = list(init.dims)

    linear = attention = 0
    for node in inferred.graph.node:
        if node.op_type != "MatMul":
            continue
        k = shapes[node.input[0]][-1]              # shared dimension
        macs = elems(shapes, node.output[0]) * k
        if node.output[0] in ATTENTION_MATMULS:
            attention += macs
        else:
            linear += macs
    total = linear + attention
    print(f"{seq:>7} {linear:>12,} {attention:>15,} {attention/total:>15.1%}")
```

Verified output:

```text
 tokens  linear MACs  attention MACs  attention share
      4        3,072             256            7.7%
     64       49,152          65,536           57.1%
    512      393,216       4,194,304           91.4%
   4096    3,145,728     268,435,456           98.8%
```

At 4 tokens attention is rounding error; at 512 (a paragraph) it's 91% of
all compute; at 4096 (a modest LLM context window) it's ~99% — and the S×S
attention matrix itself is 16.7 million values *per head, per layer* that
must be produced, softmaxed, and consumed. Double the context, quadruple
the attention cost. This one table explains why long-context inference is
expensive and why so much engineering (FlashAttention-style kernels, KV
caching, sliding windows) attacks exactly this corner of the graph.

Two more porting-relevant contrasts with the CNN:

- **The mid-graph sync points now sit between the heaviest ops.** Softmax
  [6] sits exactly between the two biggest data×data MatMuls, and each of
  its rows needs a max and a sum over the *whole row* before emitting
  anything (§0.5); LayerNorm does the same over each token's features and
  — unlike BatchNorm — cannot be folded away (§0.6). At S=4 that's
  trivia; at S=4096 the naive version means materializing the 16.7M-value
  score matrix to memory, scanning it, and reading it back. Fusing
  MatMul→Softmax→MatMul into one kernel that never materializes the matrix
  is precisely what FlashAttention does — and "can your compiler fuse
  through the softmax" is a real accelerator-evaluation question.
- **This Transpose is load-bearing.** Node [3] reorders K so the match-up
  MatMul lines up asks against offers — remove it and the model is wrong.
  Contrast MNIST's node [9] Reshape (pure export noise, removable). Same
  op family, opposite verdicts: you classify plumbing by *function*, never
  by pattern-matching the op name. (The upcoming layout-audit lab is
  exactly this skill, adversarially.)

### 9.4 Coda — go look at a real one

Open a real pretrained Transformer in <https://netron.app>: search Hugging
Face for **`all-MiniLM-L6-v2`** (a popular small sentence-embedding model)
and grab `onnx/model.onnx` (~90 MB) from its Files tab — or any "bert-tiny"
ONNX export. What to expect, now that you can read it:

- an **embedding front-end** (Gather nodes: token IDs → vectors) we didn't
  cover — it's a table lookup, no MACs;
- then **the §9.1 block, six times in a row** — you'll recognize
  Q/K/V MatMuls, the Transpose, Softmax, the residual Adds, LayerNorms and
  the MLP pair, wrapped in export noise (extra Reshapes/Casts/split-up
  attention heads) that you now know how to see through;
- shape inference and the cost scripts work on it unchanged — try
  `python step6_cost_model.py <path-to-downloaded-model>` and find the
  seq² MatMuls in a 600-node graph.

**Remaining from the roadmap:** Step 8 (your porting brief — now you can
write it for either model, or both) and the layout-shuffling audit lab
below.

---

## Lab — the layout-shuffling audit

### L.1 Mission briefing

A customer ports their CNN to your accelerator and reports it running far
slower than the benchmark numbers promised. The compute layers profile
fine. You open the ONNX file and find what you always find: the graph is
littered with data-movement ops that the original model's author never
wrote — souvenirs of a sloppy framework→ONNX export path.

Your patient is `models/messy_export.onnx` (committed in this repo; a small
CNN, `1×3×8×8` image in, 10 scores out). It was manufactured for this
exercise by `lab_build_messy.py` — build it yourself if you want a fresh
copy. **Do not read `lab_answer_clean.py`** — the filename says why.

Your deliverables, exactly as on a real engagement:

1. **The audit** — for every data-movement / suspicious op in the graph, a
   verdict: *removable* (and why), *foldable offline* (and why), or
   *load-bearing* (and why it must stay). The worksheet is in L.4.
2. **A cleaned graph** that keeps only what must run at inference.
3. **Proof of equivalence.** The ground rule of graph hygiene: a cleanup
   only counts if the cleaned model's outputs are **exactly identical** —
   max difference 0.0, not "close". You're removing no-ops and folding
   constants, not re-training; the arithmetic must be untouched.

Fair warning, because it's the whole point: **at least one op in there
looks exactly like the junk but is load-bearing.** Delete it and the model
still runs, all shapes check out, and every answer is silently wrong.
Classify by *function*, never by op name.

### L.2 The patient's chart

Your Steps 3–4 tools, pointed at the patient (verified output — this is
your audit evidence):

```bash
python lab_build_messy.py            # writes models/messy_export.onnx
python step3_list_nodes.py     models/messy_export.onnx
python step4_shape_inference.py models/messy_export.onnx
```

The node listing (abridged to ops and wiring — run step3 yourself for the
full form):

```text
== Initializers (weights) ==
  w0: shape [8, 3, 3, 3]
  b0: shape [8]
  w1: shape [3, 3, 8, 16]
  b1: shape [16]
  w2: shape [256, 10]
  b2: shape [10]
  s0: shape [3]
  s1: shape [2]
```

Shape inference:

```text
[ 0] Cast     [1, 3, 8, 8]  ->  [1, 3, 8, 8]
[ 1] Transpose [1, 3, 8, 8]  ->  [1, 8, 8, 3]
[ 2] Transpose [1, 8, 8, 3]  ->  [1, 3, 8, 8]
[ 3] Conv     [1, 3, 8, 8], [8, 3, 3, 3], [8]  ->  [1, 8, 8, 8]
[ 4] Identity [1, 8, 8, 8]  ->  [1, 8, 8, 8]
[ 5] Relu     [1, 8, 8, 8]  ->  [1, 8, 8, 8]
[ 6] MaxPool  [1, 8, 8, 8]  ->  [1, 8, 4, 4]
[ 7] Transpose [3, 3, 8, 16]  ->  [16, 8, 3, 3]
[ 8] Conv     [1, 8, 4, 4], [16, 8, 3, 3], [16]  ->  [1, 16, 4, 4]
[ 9] Relu     [1, 16, 4, 4]  ->  [1, 16, 4, 4]
[10] Transpose [1, 16, 4, 4]  ->  [1, 4, 4, 16]
[11] Reshape  [1, 4, 4, 16], [3]  ->  [1, 16, 16]
[12] Reshape  [1, 16, 16], [2]  ->  [1, 256]
[13] MatMul   [1, 256], [256, 10]  ->  [1, 10]
[14] Add      [1, 10], [10]  ->  [1, 10]
[15] Identity [1, 10]  ->  [1, 10]
```

Two ONNX ops you haven't formally met, both trivial:

- **Cast** — convert element type (float→int8, etc.). Look at what THIS
  one converts from and to (step3 shows the attribute; shape inference
  already tells you both sides are float).
- **Identity** — output = input, verbatim. It exists for graph-plumbing
  reasons inside frameworks and should essentially never survive an export.

### L.3 Method and tools

The audit checklist for each data-movement/no-op candidate:

1. **Is it a no-op by type?** (Identity always; Cast when src type = dst type.)
2. **Does it cancel against a neighbor?** (Two Transposes back-to-back whose
   permutations undo each other; a Reshape immediately re-reshaped.)
3. **Is its input a frozen constant?** Then it can run *once, offline*
   (constant folding) — it doesn't belong in the inference graph. (You've
   seen this before: MNIST node [9], §4.6.)
4. **Does it change the ORDER of values feeding a Reshape/MatMul?** Then
   removing it changes *which weight meets which feature* — it may be
   load-bearing even though it "does no math" (§4.6's ordering contract).
   Suspect every Transpose between the last Conv and a flatten.

When reasoning isn't enough — experiment. The equivalence harness
(`lab_compare.py`) runs two models on the same seeded inputs and reports
the max output difference:

```python
import sys

import numpy as np
import onnxruntime as ort

path_a, path_b = sys.argv[1], sys.argv[2]
sess_a = ort.InferenceSession(path_a)
sess_b = ort.InferenceSession(path_b)

# Same seeded inputs for both, shaped from each model's own declared input.
rng = np.random.default_rng(123)
batch = [rng.standard_normal(
             [d if isinstance(d, int) else 1
              for d in sess_a.get_inputs()[0].shape]).astype(np.float32)
         for _ in range(8)]

worst = 0.0
for x in batch:
    (out_a,) = sess_a.run(None, {sess_a.get_inputs()[0].name: x})[:1]
    (out_b,) = sess_b.run(None, {sess_b.get_inputs()[0].name: x})[:1]
    if out_a.shape != out_b.shape:
        print(f"SHAPE MISMATCH: {out_a.shape} vs {out_b.shape}")
        sys.exit(1)
    worst = max(worst, float(np.abs(out_a - out_b).max()))

print(f"{path_a}  vs  {path_b}")
print(f"outputs {out_a.shape}, {len(batch)} random inputs, "
      f"max abs difference: {worst}")
print("VERDICT:", "equivalent (bit-exact)" if worst == 0.0
      else "NOT equivalent - the models compute different things")
```

Sanity check on the harness itself (a model must equal itself):

```bash
python lab_compare.py models/messy_export.onnx models/messy_export.onnx
# ...max abs difference: 0.0 -> equivalent (bit-exact)
```

To build cleaned candidates, use the §9.1 technique (`helper.make_node` /
`make_graph`) — extract the patient's weights with
`numpy_helper.to_array(initializer)` so your cleaned model uses the *same*
frozen constants.

### L.4 The worksheet

Nine candidates. Fill in the verdict column (removable / fold offline /
load-bearing — and one sentence of *why*) before opening L.5:

| Node | Op | Evidence from the chart | Your verdict |
|---|---|---|---|
| 0 | Cast | float → float, shape unchanged | |
| 1 | Transpose | `[1,3,8,8] → [1,8,8,3]` | |
| 2 | Transpose | `[1,8,8,3] → [1,3,8,8]` | |
| 4 | Identity | between Conv and Relu | |
| 7 | Transpose | input is initializer `w1 [3,3,8,16]` | |
| 10 | Transpose | `[1,16,4,4] → [1,4,4,16]`, feeds the flatten | |
| 11 | Reshape | `→ [1,16,16]`, feeds another Reshape | |
| 12 | Reshape | `→ [1,256]`, feeds the MatMul | |
| 15 | Identity | last node before the output | |

Then: build your cleaned model, run `lab_compare.py` against the patient,
and only call it done at **max abs difference: 0.0**.

### L.5 Answer key

<details>
<summary><b>Spoilers — open only after your own audit</b></summary>

**Verdicts:**

| Node | Verdict | Why |
|---|---|---|
| 0 Cast | **remove** | float→float: converts a type to itself. Pure no-op. |
| 1 Transpose | **remove** | NCHW→NHWC immediately undone by node 2: the pair cancels. Two full tensor copies for nothing — the classic layout-thrash signature. |
| 2 Transpose | **remove** | other half of the canceling pair. |
| 4 Identity | **remove** | no-op; its only cost is breaking Conv→Relu adjacency, i.e. blocking fusion (§6.3, point 4). |
| 7 Transpose | **fold offline** | its input `w1` is a frozen constant stored in TensorFlow-style HWIO layout `[3,3,8,16]`; the graph converts it to OIHW `[16,8,3,3]` at runtime, every inference. Do the transpose once, save the result — MNIST node [9] all over again, Transpose flavor. |
| 10 Transpose | **LOAD-BEARING — keep** | this is the trap. It reorders the features from channel-first to channel-last *before* the flatten, and the classifier weight `w2 [256,10]` was defined against that NHWC flatten order. Remove it: everything still runs, shapes all check out, outputs are silently garbage (§4.6's ordering contract, weaponized). |
| 11 Reshape | **remove** | first half of a Reshape→Reshape chain; only the final `[1,256]` matters. |
| 12 Reshape | **keep** | the real flatten feeding the MatMul. |
| 15 Identity | **remove** | trailing no-op. |

**The cleaned graph** (`lab_answer_clean.py` builds it from the patient's
own extracted weights — the professional move: clean the artifact you were
given): Conv → Relu → MaxPool → Conv(w1 pre-transposed) → Relu →
**Transpose** → Reshape → MatMul → Add. Nine nodes, down from sixteen.

**Proof** (verified output):

```text
models/messy_export.onnx  vs  models/clean_correct.onnx
outputs (1, 10), 8 random inputs, max abs difference: 0.0
VERDICT: equivalent (bit-exact)
```

**And the trap, sprung on purpose** — the same cleanup but with node 10
also deleted (`clean_naive.onnx`). It runs. Shapes pass. And:

```text
models/messy_export.onnx  vs  models/clean_naive.onnx
outputs (1, 10), 8 random inputs, max abs difference: 10.828176498413086
VERDICT: NOT equivalent - the models compute different things
```

No error anywhere — only the equivalence harness catches it. This is why
"prove 0.0" is a deliverable, not a nicety.

**What the cleanup bought** (step6_cost_model on both): identical 34,816
MACs, but bytes moved per inference drop **52.9 KB → 33.3 KB (−37%)** —
and Conv→Relu are adjacent again, so a fusing compiler gets its shot. On
this toy that's microseconds; on a real NHWC-exported detection model with
transpose pairs around *every* Conv, this exact audit is routinely the
single biggest performance fix.

**Cross-check with the industry tool** — `onnx-simplifier` (in
requirements.txt):

```bash
python -m onnxsim models/messy_export.onnx models/messy_simplified.onnx
python lab_compare.py models/messy_export.onnx models/messy_simplified.onnx
```

Verified: it produces 8 nodes — Conv, Relu, MaxPool, Conv, Relu,
**Transpose**, Reshape, Gemm — bit-exact (0.0). Read its result like a
review of your audit: it removed the same seven artifacts, folded the same
weight transpose, **kept node 10** (a correct tool and a correct audit
agree on the trap), and went one step further than we did: fused
MatMul+Add into a single `Gemm` node — §0.1's "full form" op. When your
manual audit and onnxsim disagree, one of you is wrong; find out which
before shipping.

</details>

---

**Still open:** Step 8 — your porting brief. You now have three models to
choose from.
