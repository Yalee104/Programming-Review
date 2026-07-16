"""Step 0.4 - Pooling (MaxPool / GlobalAveragePool): "shrink the map, keep the signal".

See section 0.4 of ../onnx_model_walkthrough.md for the full explanation.
"""
import numpy as np

# A 4x4 feature map (output of some Conv layer).
fmap = np.array([[1, 3, 2, 0],
                 [5, 6, 1, 2],
                 [0, 2, 4, 8],
                 [3, 1, 7, 5]], dtype=float)

# MaxPool 2x2, stride 2: split into 2x2 blocks, keep the strongest value
# from each block. 4x4 -> 2x2.
pooled = np.zeros((2, 2))
for i in range(2):
    for j in range(2):
        pooled[i, j] = fmap[2*i:2*i+2, 2*j:2*j+2].max()

print(pooled)
# [[6. 2.]
#  [3. 8.]]

# GlobalAveragePool: average the WHOLE map down to a single number.
print(fmap.mean())
# 3.125
