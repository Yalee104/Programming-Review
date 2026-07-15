"""Step 6 - Cost model: MACs vs bytes moved, per node.

For every node, estimates the two costs that decide hardware performance:
  - MACs: multiply-accumulate operations (the useful arithmetic)
  - bytes moved: input tensors + weights + output tensor (float32 assumed;
    the few int64 shape constants are negligible)
and their ratio, MACs per byte ("arithmetic intensity"): how much work the
chip gets to do per byte it has to fetch. High ratio -> compute-bound,
low ratio -> memory-bound. Run from the onnx_walkthrough/ folder.

See section "Step 6" of onnx_model_walkthrough.md for the annotated table.
"""
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
