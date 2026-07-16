"""Step 0.6 - BatchNorm / LayerNorm: "signal conditioning between stages".

See section 0.6 of ../onnx_model_walkthrough.md for the full explanation.
"""
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
