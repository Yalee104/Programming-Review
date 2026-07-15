"""Step 3 - Load the MNIST-12 model and list every node.

Prints the graph's public API (inputs/outputs), the frozen weight tensors
(initializers), and every node with its op type and named inputs/outputs.
Run from the onnx_walkthrough/ folder.

See section "Step 3" of onnx_model_walkthrough.md for the annotated reading.
"""
import onnx

model = onnx.load("models/mnist-12.onnx")

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
