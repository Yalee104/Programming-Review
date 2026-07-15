"""Lab ANSWER KEY - do not read before finishing your own audit!

Builds two models from the patient's own frozen weights:

  models/clean_correct.onnx - the intended cleanup: all seven value-
      preserving artifacts removed, the load-bearing Transpose KEPT.
      Must be bit-exact vs the patient (lab_compare diff 0.0).

  models/clean_naive.onnx - the over-eager cleanup that also deletes the
      Transpose before the flatten. Runs fine, shapes check out - and the
      outputs are wrong. This is the trap.

Run from the onnx_walkthrough/ folder (after lab_build_messy.py).
"""
import numpy as np
import onnx
from onnx import TensorProto, helper, numpy_helper

# Pull the frozen constants OUT of the messy artifact - the professional
# move: clean the file you were given, don't rebuild from source you may
# not have.
messy = onnx.load("models/messy_export.onnx")
W = {i.name: numpy_helper.to_array(i) for i in messy.graph.initializer}

# Fold node [7] offline: the conv2 weight was stored HWIO [3,3,8,16]; the
# graph transposed it to OIHW [16,8,3,3] at runtime. Do it once, here.
w1_oihw = W["w1"].transpose(3, 2, 0, 1).copy()

def const(name, arr):
    return numpy_helper.from_array(arr, name=name)

def build(keep_layout_transpose):
    inits = [
        const("w0", W["w0"]), const("b0", W["b0"]),
        const("w1_oihw", w1_oihw), const("b1", W["b1"]),
        const("w2", W["w2"]), const("b2", W["b2"]),
        const("flat", np.array([1, 256], np.int64)),
    ]
    N = helper.make_node
    nodes = [
        N("Conv", ["input", "w0", "b0"], ["c1"], kernel_shape=[3, 3],
          auto_pad="SAME_UPPER"),
        N("Relu", ["c1"], ["r1"]),
        N("MaxPool", ["r1"], ["p1"], kernel_shape=[2, 2], strides=[2, 2]),
        N("Conv", ["p1", "w1_oihw", "b1"], ["c2"], kernel_shape=[3, 3],
          auto_pad="SAME_UPPER"),
        N("Relu", ["c2"], ["r2"]),
    ]
    if keep_layout_transpose:
        # The classifier weight w2 expects features flattened in NHWC
        # order (channel-last) - this Transpose IS the model.
        nodes.append(N("Transpose", ["r2"], ["nhwc"], perm=[0, 2, 3, 1]))
        nodes.append(N("Reshape", ["nhwc", "flat"], ["flat_out"]))
    else:
        nodes.append(N("Reshape", ["r2", "flat"], ["flat_out"]))
    nodes += [
        N("MatMul", ["flat_out", "w2"], ["logits_raw"]),
        N("Add", ["logits_raw", "b2"], ["output"]),
    ]
    graph = helper.make_graph(
        nodes, "cleaned",
        inputs=[helper.make_tensor_value_info(
            "input", TensorProto.FLOAT, [1, 3, 8, 8])],
        outputs=[helper.make_tensor_value_info(
            "output", TensorProto.FLOAT, [1, 10])],
        initializer=inits,
    )
    model = helper.make_model(
        graph, opset_imports=[helper.make_opsetid("", 21)])
    model.ir_version = 10
    onnx.checker.check_model(model)
    return model

if __name__ == "__main__":
    correct = build(keep_layout_transpose=True)
    onnx.save(correct, "models/clean_correct.onnx")
    naive = build(keep_layout_transpose=False)
    onnx.save(naive, "models/clean_naive.onnx")
    print(f"clean_correct: {len(correct.graph.node)} nodes "
          f"(patient had {len(messy.graph.node)})")
    print(f"clean_naive:   {len(naive.graph.node)} nodes")
    print("now prove it:  python lab_compare.py models/messy_export.onnx "
          "models/clean_correct.onnx")
    print("and the trap:  python lab_compare.py models/messy_export.onnx "
          "models/clean_naive.onnx")
