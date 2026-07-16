"""Step 9 - Build a single Transformer encoder block as an ONNX model.

The flip side of Steps 3-4: instead of READING a graph, we CONSTRUCT one
with onnx.helper, node by node - same data model (named tensors wire nodes
together, initializers hold the frozen weights), just going the other way.

Single attention head, tiny dimensions so every tensor is printable:
  4 tokens x 8 features, MLP hidden size 32.

Saves models/tiny_attention.onnx, validates it, then runs it with
onnxruntime and prints the attention matrix ("who attends to whom").
Run from the onnx_walkthrough/ folder.

See section "Step 9" of onnx_model_walkthrough.md.
"""
import numpy as np
import onnx
from onnx import TensorProto, helper, numpy_helper

SEQ, DIM, HID = 4, 8, 32          # tokens, features per token, MLP hidden size


def build_block(seq_len=SEQ, dim=DIM, hidden=HID, seed=0):
    """Build one Transformer encoder block; returns an onnx ModelProto."""
    rng = np.random.default_rng(seed)

    def weight(name, *shape):
        # a frozen constant (initializer): small random values stand in for
        # what training would have learned
        w = rng.standard_normal(shape).astype(np.float32) * 0.5
        return numpy_helper.from_array(w, name=name)

    inits = [
        weight("Wq", dim, dim), weight("Wk", dim, dim), weight("Wv", dim, dim),
        weight("Wo", dim, dim),                       # attention output projection
        weight("Wup", dim, hidden), weight("Wdown", hidden, dim),   # the MLP
        numpy_helper.from_array(                       # 1/sqrt(dim) score scaling
            np.float32(1.0 / np.sqrt(dim)), name="scale"),
        numpy_helper.from_array(np.ones(dim, np.float32), name="ln1_gamma"),
        numpy_helper.from_array(np.zeros(dim, np.float32), name="ln1_beta"),
        numpy_helper.from_array(np.ones(dim, np.float32), name="ln2_gamma"),
        numpy_helper.from_array(np.zeros(dim, np.float32), name="ln2_beta"),
    ]

    N = helper.make_node          # shorthand: N(op, inputs, outputs, ...)
    nodes = [
        # --- self-attention ---
        N("MatMul", ["tokens", "Wq"], ["Q"]),          # what each token ASKS for
        N("MatMul", ["tokens", "Wk"], ["K"]),          # what each token OFFERS
        N("MatMul", ["tokens", "Wv"], ["V"]),          # each token's CONTENT
        N("Transpose", ["K"], ["Kt"], perm=[0, 2, 1]), # line K up for the match
        N("MatMul", ["Q", "Kt"], ["scores"]),          # every ask x every offer
        N("Mul", ["scores", "scale"], ["scaled"]),     # keep scores in Softmax's sweet spot
        N("Softmax", ["scaled"], ["attn"], axis=-1),   # scores -> attention budget
        N("MatMul", ["attn", "V"], ["context"]),       # blend content by budget
        N("MatMul", ["context", "Wo"], ["proj"]),      # mix the gathered info
        N("Add", ["proj", "tokens"], ["resid1"]),      # residual: keep the original too
        N("LayerNormalization", ["resid1", "ln1_gamma", "ln1_beta"], ["ln1"]),
        # --- per-token MLP ---
        N("MatMul", ["ln1", "Wup"], ["up"]),           # widen 8 -> 32
        N("Gelu", ["up"], ["act"]),                    # the gate (sec 0.2)
        N("MatMul", ["act", "Wdown"], ["down"]),       # narrow 32 -> 8
        N("Add", ["down", "ln1"], ["resid2"]),         # second residual
        N("LayerNormalization", ["resid2", "ln2_gamma", "ln2_beta"], ["out"]),
    ]

    graph = helper.make_graph(
        nodes, "tiny_attention_block",
        inputs=[helper.make_tensor_value_info(
            "tokens", TensorProto.FLOAT, [1, seq_len, dim])],
        outputs=[helper.make_tensor_value_info(
            "out", TensorProto.FLOAT, [1, seq_len, dim]),
                 helper.make_tensor_value_info(     # expose attn so we can LOOK at it
            "attn", TensorProto.FLOAT, [1, seq_len, seq_len])],
        initializer=inits,
    )
    model = helper.make_model(
        graph, opset_imports=[helper.make_opsetid("", 21)])
    model.ir_version = 10                      # keep loadable by onnxruntime
    onnx.checker.check_model(model)            # validate against the ONNX spec
    return model


if __name__ == "__main__":
    model = build_block()
    onnx.save(model, "models/tiny_attention.onnx")
    print(f"saved models/tiny_attention.onnx "
          f"({len(model.graph.node)} nodes, checker passed)")

    # Run it: 4 random "tokens" in, watch who attends to whom.
    import onnxruntime as ort
    sess = ort.InferenceSession("models/tiny_attention.onnx")
    rng = np.random.default_rng(7)
    tokens = rng.standard_normal((1, SEQ, DIM)).astype(np.float32)
    out, attn = sess.run(None, {"tokens": tokens})

    print("\nattention matrix (row = a token asking, col = a token answering):")
    print(np.round(attn[0], 3))
    print("row sums:", np.round(attn[0].sum(axis=1), 6))   # softmax -> each row sums to 1
    print("output shape:", out.shape)
