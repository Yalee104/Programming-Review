# ONNX / Operator Walkthrough

A self-contained, layer-by-layer study of a small ONNX model, treating every
neural-network operator like a software component with an input/output spec.
The full write-up (explanations, annotated outputs, roadmap of all steps)
lives in **[`onnx_model_walkthrough.md`](onnx_model_walkthrough.md)** — this
README only covers environment setup and how to run the example scripts.

## Folder layout

```
onnx_walkthrough/
├── README.md                     <- you are here (setup + how to run)
├── requirements.txt              <- everything pip needs to install
├── onnx_model_walkthrough.md     <- the actual study material
├── models/
│   ├── mnist-12.onnx             <- the CNN under dissection (26 KB)
│   └── tiny_attention.onnx       <- one Transformer block, built by step9 (4 KB)
├── step0_primer/                 <- one runnable script per operator family
│   ├── 01_matmul_linear.py       <- section 0.1  MatMul / Linear / Gemm
│   ├── 02_activations.py         <- section 0.2  ReLU / SiLU / GELU
│   ├── 03_convolution.py         <- section 0.3  Conv
│   ├── 04_pooling.py             <- section 0.4  MaxPool / GlobalAveragePool
│   ├── 05_softmax.py             <- section 0.5  Softmax
│   ├── 06_normalization.py       <- section 0.6  BatchNorm / LayerNorm
│   └── 07_data_movement.py       <- section 0.7  Reshape / Transpose / Concat / Slice
├── step3_list_nodes.py           <- Step 3: list every node in the graph
├── step4_shape_inference.py      <- Step 4: infer tensor shapes on every edge
├── step4_run_model.py            <- Step 4.5: execute the model with onnxruntime
├── step5_spec_table.py           <- Step 5: per-layer spec table with parameter counts
├── step6_cost_model.py           <- Step 6: MACs vs bytes moved per node (bottleneck analysis)
├── step9_build_attention.py      <- Step 9: build a Transformer block with onnx.helper, run it
└── step9_seq_scaling.py          <- Step 9.3: attention MACs vs sequence length (the seq² story)
```

The step3–step6 scripts take an **optional model path** argument (default:
`models/mnist-12.onnx`) — e.g. `python step6_cost_model.py models/tiny_attention.onnx`,
or point them at any ONNX model with static shapes.

Every script is the exact code shown in the corresponding section of the
markdown, with the verified output in comments — the markdown adds the
explanation *around* the code, the scripts are for running and tinkering.

## Setup (one time)

From inside this `onnx_walkthrough/` folder:

```bash
# 1. Create a virtual environment (an isolated Python package sandbox
#    living in the .venv/ subfolder — keeps this project's packages
#    separate from your system Python).
python3 -m venv .venv

# 2. Activate it (do this in every new terminal session before working):
source .venv/bin/activate          # Linux / macOS
# .venv\Scripts\activate           # Windows (cmd / PowerShell)

# 3. Install everything:
pip install -r requirements.txt
```

What gets installed and why:

| Package | Role |
|---|---|
| `numpy` | Tensors for the Step 0 primer scripts |
| `onnx` | Load / inspect / shape-infer `.onnx` graphs in Python |
| `onnxruntime` | Actually execute ONNX models (CPU) |
| `netron` | Graph visualizer — `netron models/mnist-12.onnx` opens it in your browser |

Your prompt shows `(.venv)` when the environment is active; `deactivate`
leaves it.

## Running the examples

Run everything **from this folder** (the MNIST scripts use the relative path
`models/mnist-12.onnx`):

```bash
python step0_primer/01_matmul_linear.py    # ...through 07_data_movement.py
python step3_list_nodes.py
python step4_shape_inference.py
python step4_run_model.py
python step5_spec_table.py
python step6_cost_model.py
python step9_build_attention.py     # writes models/tiny_attention.onnx, prints the attention matrix
python step9_seq_scaling.py
python step4_shape_inference.py models/tiny_attention.onnx   # any step3-6 tool, on the new model
```

Expected output for each script is in its comments and, with full
annotation, in the matching section of `onnx_model_walkthrough.md`.

## The model

`models/mnist-12.onnx` (26 KB, committed in this repo) is MNIST-12 from the
official ONNX Model Zoo: 28×28 grayscale digit in, 10 class scores out,
12 nodes total. To re-download it:

```bash
curl -L -o models/mnist-12.onnx "https://media.githubusercontent.com/media/onnx/models/main/validated/vision/classification/mnist/model/mnist-12.onnx"
```

⚠️ Use exactly that `media.githubusercontent.com` URL — the normal GitHub
"raw" URL returns a 130-byte Git-LFS pointer file instead of the model
(details in the markdown, Step 1).

## Visualizing the graph

Either of:

- **No install:** open <https://netron.app> in a browser and drop
  `models/mnist-12.onnx` onto the page.
- **Local:** `netron models/mnist-12.onnx` (with the venv active) — starts a
  local server and opens the graph in your browser. Click any node to see
  its attributes and weight shapes.
