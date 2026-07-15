"""Step 5 - Per-layer spec table: shapes and parameter counts for every node.

Generic: point it at any ONNX model with static shapes. For each node it
prints the operator, data input shape -> output shape, and how many learned
parameters (stored float weights) the node owns. Run from the
onnx_walkthrough/ folder.

See section "Step 5" of onnx_model_walkthrough.md for the annotated table.
"""
import onnx
from onnx import TensorProto

model = onnx.load("models/mnist-12.onnx")
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
