"""Lab - build the audit patient: models/messy_export.onnx.

A small CNN classifier (1x3x8x8 image in, 10 scores out) as it might come
out of a sloppy framework->ONNX export path. Your job is NOT in this file -
it's in the "Lab" section of onnx_model_walkthrough.md: audit the graph,
classify every data-movement op, produce a cleaned equivalent, and prove it.

(This builder intentionally reads like exporter output: generic names, no
explanatory comments. Judging the nodes is the exercise.)

Run from the onnx_walkthrough/ folder.
"""
import numpy as np
import onnx
from onnx import TensorProto, helper, numpy_helper

rng = np.random.default_rng(11)

def const(name, arr):
    return numpy_helper.from_array(arr, name=name)

inits = [
    const("w0", (rng.standard_normal((8, 3, 3, 3)) * 0.3).astype(np.float32)),
    const("b0", (rng.standard_normal(8) * 0.1).astype(np.float32)),
    const("w1", (rng.standard_normal((3, 3, 8, 16)) * 0.2).astype(np.float32)),
    const("b1", (rng.standard_normal(16) * 0.1).astype(np.float32)),
    const("w2", (rng.standard_normal((256, 10)) * 0.1).astype(np.float32)),
    const("b2", (rng.standard_normal(10) * 0.1).astype(np.float32)),
    const("s0", np.array([1, 16, 16], np.int64)),
    const("s1", np.array([1, 256], np.int64)),
]

N = helper.make_node
nodes = [
    N("Cast", ["input"], ["x0"], to=TensorProto.FLOAT),
    N("Transpose", ["x0"], ["x1"], perm=[0, 2, 3, 1]),
    N("Transpose", ["x1"], ["x2"], perm=[0, 3, 1, 2]),
    N("Conv", ["x2", "w0", "b0"], ["x3"], kernel_shape=[3, 3],
      auto_pad="SAME_UPPER"),
    N("Identity", ["x3"], ["x4"]),
    N("Relu", ["x4"], ["x5"]),
    N("MaxPool", ["x5"], ["x6"], kernel_shape=[2, 2], strides=[2, 2]),
    N("Transpose", ["w1"], ["x7"], perm=[3, 2, 0, 1]),
    N("Conv", ["x6", "x7", "b1"], ["x8"], kernel_shape=[3, 3],
      auto_pad="SAME_UPPER"),
    N("Relu", ["x8"], ["x9"]),
    N("Transpose", ["x9"], ["x10"], perm=[0, 2, 3, 1]),
    N("Reshape", ["x10", "s0"], ["x11"]),
    N("Reshape", ["x11", "s1"], ["x12"]),
    N("MatMul", ["x12", "w2"], ["x13"]),
    N("Add", ["x13", "b2"], ["x14"]),
    N("Identity", ["x14"], ["output"]),
]

graph = helper.make_graph(
    nodes, "messy_export",
    inputs=[helper.make_tensor_value_info(
        "input", TensorProto.FLOAT, [1, 3, 8, 8])],
    outputs=[helper.make_tensor_value_info(
        "output", TensorProto.FLOAT, [1, 10])],
    initializer=inits,
)
model = helper.make_model(graph, opset_imports=[helper.make_opsetid("", 21)])
model.ir_version = 10
onnx.checker.check_model(model)

if __name__ == "__main__":
    onnx.save(model, "models/messy_export.onnx")
    print(f"saved models/messy_export.onnx "
          f"({len(model.graph.node)} nodes, checker passed)")

    import onnxruntime as ort
    sess = ort.InferenceSession("models/messy_export.onnx")
    x = rng.standard_normal((1, 3, 8, 8)).astype(np.float32)
    (out,) = sess.run(None, {"input": x})
    print("runs OK, output shape:", out.shape)
