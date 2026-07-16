"""Step 9.3 - How attention cost scales with sequence length.

Rebuilds the same Transformer block for longer and longer token sequences
and splits the MACs into two buckets:
  - "linear" MACs: the weight MatMuls (Q/K/V/output projections + MLP),
    which grow proportionally with tokens
  - "attention" MACs: the two data*data MatMuls (scores, context), which
    grow with tokens x tokens
Run from the onnx_walkthrough/ folder.

See section "Step 9.3" of onnx_model_walkthrough.md.
"""
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
