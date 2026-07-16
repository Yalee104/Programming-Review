"""Lab 2 - build the audit patient: models/messy_branches.onnx.

A small branchy CNN classifier (1x3x16x16 image in, 10 scores out) as a
sloppy export pipeline might emit it. Your job is in the "Lab 2" section of
onnx_model_walkthrough.md: audit every Slice / Concat / Pad / Squeeze /
Unsqueeze, classify each, produce a cleaned equivalent, and prove it.

(Names are intentionally generic, exporter-style. Judging is the exercise.
Do not read lab2_answer_clean.py first.)

Run from the onnx_walkthrough/ folder.
"""
import numpy as np
import onnx
from onnx import TensorProto, helper, numpy_helper

rng = np.random.default_rng(23)

def const(name, arr):
    return numpy_helper.from_array(arr, name=name)

def i64(name, vals):
    return const(name, np.array(vals, np.int64))

inits = [
    const("w0", (rng.standard_normal((16, 3, 3, 3)) * 0.25).astype(np.float32)),
    const("b0", (rng.standard_normal(16) * 0.1).astype(np.float32)),
    const("w1", (rng.standard_normal((8, 8, 3, 3)) * 0.25).astype(np.float32)),
    const("b1", (rng.standard_normal(8) * 0.1).astype(np.float32)),
    const("w2", (rng.standard_normal((8, 8, 1, 1)) * 0.25).astype(np.float32)),
    const("b2", (rng.standard_normal(8) * 0.1).astype(np.float32)),
    const("w3", (rng.standard_normal((16, 16, 3, 3)) * 0.25).astype(np.float32)),
    const("b3", (rng.standard_normal(16) * 0.1).astype(np.float32)),
    const("w4", (rng.standard_normal((16, 10)) * 0.2).astype(np.float32)),
    const("b4", (rng.standard_normal(10) * 0.1).astype(np.float32)),
    i64("c0", [0, 0, 0, 0, 0, 0, 0, 0]),
    i64("c1", [0]), i64("c2", [8]), i64("c3", [16]), i64("c4", [1]),
    i64("c5", [4]),
    i64("c6", [1, 16]),
]

N = helper.make_node
nodes = [
    N("Pad", ["input", "c0"], ["x0"]),
    N("Conv", ["x0", "w0", "b0"], ["x1"], kernel_shape=[3, 3],
      auto_pad="SAME_UPPER"),
    N("Relu", ["x1"], ["x2"]),
    N("Slice", ["x2", "c1", "c2", "c4"], ["x3"]),
    N("Slice", ["x2", "c2", "c3", "c4"], ["x4"]),
    N("Concat", ["x3", "x4"], ["x5"], axis=1),
    N("MaxPool", ["x5"], ["x6"], kernel_shape=[2, 2], strides=[2, 2]),
    N("Slice", ["x6", "c1", "c2", "c4"], ["x7"]),
    N("Slice", ["x6", "c2", "c3", "c4"], ["x8"]),
    N("Conv", ["x7", "w1", "b1"], ["x9"], kernel_shape=[3, 3],
      auto_pad="SAME_UPPER"),
    N("Relu", ["x9"], ["x10"]),
    N("Conv", ["x8", "w2", "b2"], ["x11"], kernel_shape=[1, 1]),
    N("Relu", ["x11"], ["x12"]),
    N("Concat", ["x10", "x12"], ["x13"], axis=1),
    N("Unsqueeze", ["x13", "c5"], ["x14"]),
    N("Squeeze", ["x14", "c5"], ["x15"]),
    N("Slice", ["x15", "c2", "c3", "c4"], ["x16"]),
    N("Slice", ["x15", "c1", "c2", "c4"], ["x17"]),
    N("Concat", ["x16", "x17"], ["x18"], axis=1),
    N("Conv", ["x18", "w3", "b3"], ["x19"], kernel_shape=[3, 3],
      auto_pad="SAME_UPPER"),
    N("Relu", ["x19"], ["x20"]),
    N("GlobalAveragePool", ["x20"], ["x21"]),
    N("Slice", ["x21", "c1", "c3", "c4"], ["x22"]),
    N("Reshape", ["x22", "c6"], ["x23"]),
    N("Concat", ["x23"], ["x24"], axis=1),
    N("MatMul", ["x24", "w4"], ["x25"]),
    N("Add", ["x25", "b4"], ["output"]),
]

graph = helper.make_graph(
    nodes, "messy_branches",
    inputs=[helper.make_tensor_value_info(
        "input", TensorProto.FLOAT, [1, 3, 16, 16])],
    outputs=[helper.make_tensor_value_info(
        "output", TensorProto.FLOAT, [1, 10])],
    initializer=inits,
)
model = helper.make_model(graph, opset_imports=[helper.make_opsetid("", 21)])
model.ir_version = 10
onnx.checker.check_model(model)

if __name__ == "__main__":
    onnx.save(model, "models/messy_branches.onnx")
    print(f"saved models/messy_branches.onnx "
          f"({len(model.graph.node)} nodes, checker passed)")

    import onnxruntime as ort
    sess = ort.InferenceSession("models/messy_branches.onnx")
    x = rng.standard_normal((1, 3, 16, 16)).astype(np.float32)
    (out,) = sess.run(None, {"input": x})
    print("runs OK, output shape:", out.shape)
