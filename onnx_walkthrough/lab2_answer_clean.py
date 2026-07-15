"""Lab 2 ANSWER KEY - do not read before finishing your own audit!

Builds three models from the patient's own frozen weights:

  models/clean2_conservative.onnx - all junk removed, the channel-SWAPPING
      Slice+Slice+Concat trio KEPT (it is load-bearing). Must be bit-exact.

  models/clean2_advanced.onnx - the swap trio removed AND compensated by
      permuting the input-channel axis of the next Conv's weight offline
      (folding the layout change into the constant). Mathematically
      identical; may differ from bit-exact by float re-association - the
      script prints the measured difference.

  models/clean2_naive.onnx - the swap trio removed with NO compensation.
      Runs fine, shapes pass, outputs are wrong. The trap, again.

Run from the onnx_walkthrough/ folder (after lab2_build_messy.py).
"""
import numpy as np
import onnx
from onnx import TensorProto, helper, numpy_helper

messy = onnx.load("models/messy_branches.onnx")
W = {i.name: numpy_helper.to_array(i) for i in messy.graph.initializer}

# The swap trio reorders channels [0..15] -> [8..15, 0..7] before Conv(w3).
# To consume the UNswapped tensor instead, permute w3's input-channel axis
# by that same (self-inverse) permutation, once, offline.
perm = list(range(8, 16)) + list(range(0, 8))
w3_folded = W["w3"][:, perm, :, :].copy()

def const(name, arr):
    return numpy_helper.from_array(arr, name=name)

def build(variant):
    """variant: 'conservative' | 'advanced' | 'naive'"""
    inits = [
        const("w0", W["w0"]), const("b0", W["b0"]),
        const("w1", W["w1"]), const("b1", W["b1"]),
        const("w2", W["w2"]), const("b2", W["b2"]),
        const("w3", w3_folded if variant == "advanced" else W["w3"]),
        const("b3", W["b3"]),
        const("w4", W["w4"]), const("b4", W["b4"]),
        const("z", np.array([0], np.int64)),
        const("eight", np.array([8], np.int64)),
        const("sixteen", np.array([16], np.int64)),
        const("ax1", np.array([1], np.int64)),
        const("flat", np.array([1, 16], np.int64)),
    ]
    N = helper.make_node
    nodes = [
        N("Conv", ["input", "w0", "b0"], ["stem"], kernel_shape=[3, 3],
          auto_pad="SAME_UPPER"),
        N("Relu", ["stem"], ["stem_r"]),
        N("MaxPool", ["stem_r"], ["pool"], kernel_shape=[2, 2],
          strides=[2, 2]),
        # The load-bearing split: each branch reads a DIFFERENT half.
        N("Slice", ["pool", "z", "eight", "ax1"], ["lo"]),
        N("Slice", ["pool", "eight", "sixteen", "ax1"], ["hi"]),
        N("Conv", ["lo", "w1", "b1"], ["a"], kernel_shape=[3, 3],
          auto_pad="SAME_UPPER"),
        N("Relu", ["a"], ["a_r"]),
        N("Conv", ["hi", "w2", "b2"], ["b"], kernel_shape=[1, 1]),
        N("Relu", ["b"], ["b_r"]),
        # The load-bearing merge. For 'advanced'/'naive' it feeds the head
        # Conv directly ('advanced' compensates inside w3; 'naive'
        # just... doesn't).
        N("Concat", ["a_r", "b_r"],
          ["merged" if variant == "conservative" else "head_in"], axis=1),
    ]
    if variant == "conservative":
        # Keep the channel swap exactly as the patient computes it.
        nodes += [
            N("Slice", ["merged", "eight", "sixteen", "ax1"], ["swap_hi"]),
            N("Slice", ["merged", "z", "eight", "ax1"], ["swap_lo"]),
            N("Concat", ["swap_hi", "swap_lo"], ["head_in"], axis=1),
        ]
    nodes += [
        N("Conv", ["head_in", "w3", "b3"], ["head"], kernel_shape=[3, 3],
          auto_pad="SAME_UPPER"),
        N("Relu", ["head"], ["head_r"]),
        N("GlobalAveragePool", ["head_r"], ["gap"]),
        N("Reshape", ["gap", "flat"], ["feats"]),
        N("MatMul", ["feats", "w4"], ["logits"]),
        N("Add", ["logits", "b4"], ["output"]),
    ]
    graph = helper.make_graph(
        nodes, f"clean2_{variant}",
        inputs=[helper.make_tensor_value_info(
            "input", TensorProto.FLOAT, [1, 3, 16, 16])],
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
    for variant in ("conservative", "advanced", "naive"):
        m = build(variant)
        onnx.save(m, f"models/clean2_{variant}.onnx")
        print(f"clean2_{variant}: {len(m.graph.node)} nodes "
              f"(patient had {len(messy.graph.node)})")
    print("now prove it, e.g.:")
    print("  python lab_compare.py models/messy_branches.onnx "
          "models/clean2_conservative.onnx")
