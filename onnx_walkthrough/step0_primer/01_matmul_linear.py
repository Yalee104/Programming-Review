"""Step 0.1 - MatMul / Linear / Gemm: "every input votes on every output".

See section 0.1 of ../onnx_model_walkthrough.md for the full explanation.
"""
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
