# ONNX Model Walkthrough — Layer by Layer (Quadric FDE Prep)

This file is a self-contained, multi-session exercise: pick a small ONNX model
and analyze it the way a systems analyst analyzes an unfamiliar codebase —
treating every operator as a **software component with an input/output spec**.

No formal math. Every operator is explained *functionally*: what it does,
what its contract is, and why the network needs it.

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

**Next: Step 1** — pick a small real CNN (a MNIST-class model with ~8-10
nodes) and start dissecting it with actual tools.
