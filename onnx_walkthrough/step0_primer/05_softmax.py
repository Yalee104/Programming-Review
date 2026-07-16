"""Step 0.5 - Softmax: "turn scores into a ranking that sums to 1".

See section 0.5 of ../onnx_model_walkthrough.md for the full explanation.
"""
import numpy as np

# Raw scores ("logits") for 4 classes, e.g. [cat, dog, bird, fish].
scores = np.array([2.0, 1.0, 0.1, -1.0])

# Softmax: exponentiate, then divide by the total so everything sums to 1.
# (Subtracting the max first is a standard trick to avoid huge exp values;
#  it does not change the result.)
e = np.exp(scores - scores.max())
probs = e / e.sum()

print(np.round(probs, 3))   # [0.638 0.235 0.095 0.032]
print(probs.sum())          # 1.0
