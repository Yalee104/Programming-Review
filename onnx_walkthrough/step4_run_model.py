"""Step 4 (cross-check) - Actually run MNIST-12 with onnxruntime.

Confirms the output shape that static shape inference predicted, by
executing the real pipeline on a dummy input. Run from the
onnx_walkthrough/ folder.

See section "Step 4.5" of onnx_model_walkthrough.md.
"""
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
