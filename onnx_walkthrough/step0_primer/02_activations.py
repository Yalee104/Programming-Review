"""Step 0.2 - Activation functions (ReLU / SiLU / GELU): "the decision gates".

See section 0.2 of ../onnx_model_walkthrough.md for the full explanation.
"""
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
