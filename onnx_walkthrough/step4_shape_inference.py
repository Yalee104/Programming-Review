"""Step 4 - Shape inference: real tensor dimensions on every edge.

Static analysis pass (like type inference in a compiler): propagates the
declared input shape through every node's shape contract, then prints the
whole pipeline with concrete dimensions. Run from the onnx_walkthrough/ folder.

See section "Step 4" of onnx_model_walkthrough.md for the narrated journey.
"""
import onnx

model = onnx.load("models/mnist-12.onnx")

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
