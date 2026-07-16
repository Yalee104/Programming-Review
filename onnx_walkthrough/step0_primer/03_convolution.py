"""Step 0.3 - Convolution: "a small pattern detector on a sliding window".

See section 0.3 of ../onnx_model_walkthrough.md for the full explanation.
"""
import numpy as np

# A tiny 4x4 grayscale "image": dark (0) on the left, bright (9) on the right.
image = np.array([[0, 0, 9, 9],
                  [0, 0, 9, 9],
                  [0, 0, 9, 9],
                  [0, 0, 9, 9]], dtype=float)

# One 2x2 filter (kernel). This particular pattern means:
# "respond strongly where the right side is brighter than the left side"
# -- i.e. a vertical-edge detector.
kernel = np.array([[-1, 1],
                   [-1, 1]], dtype=float)

# Slide the kernel over every 2x2 patch of the image.
# At each position: multiply patch and kernel elementwise, sum -> one number.
out = np.zeros((3, 3))
for i in range(3):
    for j in range(3):
        patch = image[i:i+2, j:j+2]
        out[i, j] = np.sum(patch * kernel)

print(out)
# [[ 0. 18.  0.]
#  [ 0. 18.  0.]
#  [ 0. 18.  0.]]
