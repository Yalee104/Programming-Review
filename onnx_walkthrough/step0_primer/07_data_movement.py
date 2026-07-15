"""Step 0.7 - Reshape / Transpose / Concat / Slice: "plumbing: no math, real cost".

See section 0.7 of ../onnx_model_walkthrough.md for the full explanation.
"""
import numpy as np

t = np.arange(6)                # [0 1 2 3 4 5], shape (6,)

# Reshape: same 6 values, new shape. Nothing is recomputed or reordered.
r = t.reshape(2, 3)
print(r)
# [[0 1 2]
#  [3 4 5]]

# Transpose: swap the axes. Now the element ORDER really changes.
print(r.T)
# [[0 3]
#  [1 4]
#  [2 5]]
print(r.T.shape)
# (3, 2)

# Concat: glue two tensors together along a chosen axis.
a = np.array([[1, 2],
              [3, 4]])
b = np.array([[5, 6],
              [7, 8]])
print(np.concatenate([a, b], axis=0))   # stack vertically   -> shape (4, 2)
# [[1 2]
#  [3 4]
#  [5 6]
#  [7 8]]
print(np.concatenate([a, b], axis=1))   # stack side by side -> shape (2, 4)
# [[1 2 5 6]
#  [3 4 7 8]]

# Slice: cut out a sub-block. Here: every row, column 0 only.
print(a[:, 0])
# [1 3]
