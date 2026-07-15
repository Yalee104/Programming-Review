"""Lab tool - prove (or disprove) that two ONNX models are equivalent.

Usage:  python lab_compare.py <model_a.onnx> <model_b.onnx>

Runs both models on the same batch of seeded random inputs and reports the
maximum absolute difference between their outputs. For a pure graph-hygiene
cleanup (removing no-ops, folding constants) the difference must be EXACTLY
0.0 - the cleaned graph performs the identical arithmetic in the identical
order. Any nonzero difference means the "cleanup" changed the math.

Run from the onnx_walkthrough/ folder.
"""
import sys

import numpy as np
import onnxruntime as ort

path_a, path_b = sys.argv[1], sys.argv[2]
sess_a = ort.InferenceSession(path_a)
sess_b = ort.InferenceSession(path_b)

# Same seeded inputs for both, shaped from each model's own declared input.
rng = np.random.default_rng(123)
batch = [rng.standard_normal(
             [d if isinstance(d, int) else 1
              for d in sess_a.get_inputs()[0].shape]).astype(np.float32)
         for _ in range(8)]

worst = 0.0
for x in batch:
    (out_a,) = sess_a.run(None, {sess_a.get_inputs()[0].name: x})[:1]
    (out_b,) = sess_b.run(None, {sess_b.get_inputs()[0].name: x})[:1]
    if out_a.shape != out_b.shape:
        print(f"SHAPE MISMATCH: {out_a.shape} vs {out_b.shape}")
        sys.exit(1)
    worst = max(worst, float(np.abs(out_a - out_b).max()))

print(f"{path_a}  vs  {path_b}")
print(f"outputs {out_a.shape}, {len(batch)} random inputs, "
      f"max abs difference: {worst}")
print("VERDICT:", "equivalent (bit-exact)" if worst == 0.0
      else "NOT equivalent - the models compute different things")
