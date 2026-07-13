/* Neural-Network Operators — animated, interactive review.
 * Dependency-free vanilla JS. Each operator has a canvas animation plus the
 * VERIFIED C++ kernel (compiled + run before it was pasted here) written in a
 * branch-free, SIMD-friendly style that reflects Quadric's Chimera GPNPU. */
(function () {
  "use strict";

  /* ---------- theme-aware palette (reads the shared CSS variables) ---------- */
  var PAL = {};
  function readPalette() {
    var cs = getComputedStyle(document.documentElement);
    function v(n, f) { return (cs.getPropertyValue(n) || f).trim(); }
    PAL = {
      ink: v("--text", "#1a2230"),
      muted: v("--muted", "#5b6675"),
      accent: v("--accent", "#2563eb"),
      accentSoft: v("--accent-soft", "#dbe7ff"),
      good: v("--good", "#15803d"),
      bad: v("--bad", "#b91c1c"),
      border: v("--border", "#d9dee6"),
      panel: v("--surface", "#ffffff"),
      grid: v("--code-bg", "#0f172a"),
      gold: "#d19a00"
    };
  }
  readPalette();
  if (window.matchMedia) {
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    (mq.addEventListener ? mq.addEventListener.bind(mq, "change") : mq.addListener.bind(mq))(function () {
      readPalette(); redrawAll();
    });
  }

  /* ---------- small canvas drawing helpers (logical CSS pixels) ---------- */
  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  // A grid of cells. `hot` = {set:Set of "r,c", color} highlights; `vals` optional.
  function drawGrid(g, x0, y0, cell, rows, cols, vals, hi) {
    g.font = "600 12px ui-monospace, Menlo, Consolas, monospace";
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var x = x0 + c * cell, y = y0 + r * cell;
        var key = r + "," + c;
        var fill = PAL.panel, stroke = PAL.border, tc = PAL.ink, lw = 1;
        if (hi && hi[key]) { fill = hi[key].fill; stroke = hi[key].stroke; tc = hi[key].text || PAL.ink; lw = 2; }
        g.fillStyle = fill; g.strokeStyle = stroke; g.lineWidth = lw;
        roundRect(g, x + 1, y + 1, cell - 2, cell - 2, 4);
        g.fill(); g.stroke();
        if (vals) {
          var val = vals[r * cols + c];
          if (val !== undefined && val !== null) {
            g.fillStyle = tc;
            g.fillText(String(val), x + cell / 2, y + cell / 2 + 0.5);
          }
        }
      }
    }
  }
  function text(g, s, x, y, color, size, align) {
    g.font = (size || 12) + "px -apple-system, Segoe UI, Roboto, sans-serif";
    g.fillStyle = color || PAL.muted;
    g.textAlign = align || "left";
    g.textBaseline = "middle";
    g.fillText(s, x, y);
  }
  function arrow(g, x1, y1, x2, y2, color) {
    g.strokeStyle = color || PAL.muted; g.fillStyle = color || PAL.muted; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    var a = Math.atan2(y2 - y1, x2 - x1);
    g.beginPath();
    g.moveTo(x2, y2);
    g.lineTo(x2 - 8 * Math.cos(a - 0.4), y2 - 8 * Math.sin(a - 0.4));
    g.lineTo(x2 - 8 * Math.cos(a + 0.4), y2 - 8 * Math.sin(a + 0.4));
    g.closePath(); g.fill();
  }
  function fmt(n) {
    if (Math.abs(n - Math.round(n)) < 1e-6) return String(Math.round(n));
    return n.toFixed(2);
  }

  /* ================= operator definitions ================= */
  // Each: {id, name, blurb, cpp, py?, note, cycle, draw(g,W,H,frame)->captionString}

  var OPERATORS = [];

  /* ---- 1. Conv2D ---- */
  (function () {
    var IN = []; for (var i = 0; i < 25; i++) IN.push(i + 1);      // 5x5 = 1..25
    function boxSum(or_, oc) {                                     // 3x3 valid
      var s = 0;
      for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) s += IN[(or_ + r) * 5 + (oc + c)];
      return s;
    }
    OPERATORS.push({
      id: "conv2d",
      name: "1. Convolution (2D Conv)",
      blurb: "A small weight kernel slides across the image; at each stop it multiplies the overlapping input patch element-by-element and sums (a MAC — multiply-accumulate) to make one output pixel. This is how CNNs detect edges, textures, and shapes.",
      states: 9, holdMs: 680,
      draw: function (g, W, H, state) {
        var pos = state;                            // 0..8 output position
        var or_ = Math.floor(pos / 3), oc = pos % 3;
        var cell = 30, inX = 12, inY = 44;
        // input grid with receptive field highlighted
        var hi = {};
        for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++)
          hi[(or_ + r) + "," + (oc + c)] = { fill: PAL.accentSoft, stroke: PAL.accent };
        drawGrid(g, inX, inY, cell, 5, 5, IN, hi);
        text(g, "input 5×5", inX, inY - 12, PAL.muted, 12);
        // output grid
        var outX = inX + 5 * cell + 46, outY = inY + cell;
        var vals = [];
        for (var p = 0; p < 9; p++) vals.push(p <= pos ? boxSum(Math.floor(p / 3), p % 3) : "");
        var ohi = {}; ohi[or_ + "," + oc] = { fill: PAL.good, stroke: PAL.good, text: "#fff" };
        drawGrid(g, outX, outY, cell, 3, 3, vals, ohi);
        text(g, "output 3×3", outX, outY - 12, PAL.muted, 12);
        arrow(g, inX + 5 * cell + 6, inY + 2.5 * cell, outX - 8, outY + 1.5 * cell, PAL.accent);
        text(g, "3×3 kernel", inX + 5 * cell + 2, inY + 2.5 * cell - 14, PAL.accent, 11);
        return "pos (" + or_ + "," + oc + "):  Σ input⊙kernel = " + boxSum(or_, oc) +
               "   (box filter = all-ones weights)";
      },
      cpp:
"// 2D conv, \"same\" padding, int8·int8 -> int32, then requantize to int8.\n" +
"// Branch-free padding: build an in-bounds MASK, CLAMP the read index with\n" +
"// min/max, then MULTIPLY the tap by the mask so every lane runs the same MAC.\n" +
"static inline int in_bounds(int c, int n){ return (unsigned)c < (unsigned)n; }\n" +
"\n" +
"void conv2d_same_i8(const int8_t* in, int H, int W,\n" +
"                    const int8_t* ker, int K,\n" +
"                    int8_t* out, int32_t mul, int shift){\n" +
"    int pad = K/2;\n" +
"    for (int oy = 0; oy < H; ++oy)\n" +
"      for (int ox = 0; ox < W; ++ox){\n" +
"        int32_t acc = 0;\n" +
"        for (int ky = 0; ky < K; ++ky)\n" +
"          for (int kx = 0; kx < K; ++kx){\n" +
"            int iy = oy+ky-pad, ix = ox+kx-pad;\n" +
"            int m  = in_bounds(iy,H) & in_bounds(ix,W);   // 1/0 mask\n" +
"            int iyc = std::min(std::max(iy,0),H-1);        // safe index\n" +
"            int ixc = std::min(std::max(ix,0),W-1);\n" +
"            acc += (int32_t)ker[ky*K+kx] * in[iyc*W+ixc] * m;  // masked MAC\n" +
"          }\n" +
"        int64_t r = ((int64_t)acc*mul + (1<<(shift-1))) >> shift;\n" +
"        out[oy*W+ox] = (int8_t)std::max<int64_t>(-128,std::min<int64_t>(127,r));\n" +
"      }\n" +
"}\n" +
"// 3x3 box filter on 4x4 (1..16), mul=1 shift=1:\n" +
"//   int32 MACs:  14 24 30 22 / 33 54 63 45 / 57 90 99 69 / 46 72 78 54\n" +
"//   requant i8:   7 12 15 11 / 17 27 32 23 / 29 45 50 35 / 23 36 39 27",
      note: "On Chimera the mask is a lane-position predicate and the whole thing is one fused data-parallel loop over the output tile — no `if` per tap, so all PE lanes stay in lockstep."
    });
  })();

  /* ---- activation curve helper ---- */
  function activationCard(id, name, blurb, fn, yrange, cpp, py, note, extra) {
    return {
      id: id, name: name, blurb: blurb, states: 60, holdMs: 55,
      cpp: cpp, py: py, note: note,
      draw: function (g, W, H, state) {
        var bx = 40, by = 16, bw = Math.min(W - 60, 420), bh = H - 48;
        var x0 = -4, x1 = 4, y0 = yrange[0], y1 = yrange[1];
        function px(x) { return bx + (x - x0) / (x1 - x0) * bw; }
        function py(y) { return by + bh - (y - y0) / (y1 - y0) * bh; }
        // axes
        g.strokeStyle = PAL.border; g.lineWidth = 1;
        g.beginPath(); g.moveTo(px(x0), py(0)); g.lineTo(px(x1), py(0)); g.stroke();  // x
        g.beginPath(); g.moveTo(px(0), py(y0)); g.lineTo(px(0), py(y1)); g.stroke();  // y
        text(g, "0", px(0) - 10, py(0) + 12, PAL.muted, 11);
        text(g, fmt(y1), px(0) - 14, py(y1) + 6, PAL.muted, 10, "right");
        if (extra) extra(g, px, py, x0, x1);
        // curve
        g.strokeStyle = PAL.accent; g.lineWidth = 2.5; g.beginPath();
        for (var i = 0; i <= 120; i++) {
          var x = x0 + (x1 - x0) * i / 120, y = fn(x);
          if (i === 0) g.moveTo(px(x), py(y)); else g.lineTo(px(x), py(y));
        }
        g.stroke();
        // sweeping dot
        var t = state / 60;
        var xd = x0 + (x1 - x0) * t, yd = fn(xd);
        g.strokeStyle = PAL.muted; g.lineWidth = 1; g.setLineDash([3, 3]);
        g.beginPath(); g.moveTo(px(xd), py(0)); g.lineTo(px(xd), py(yd)); g.stroke();
        g.beginPath(); g.moveTo(px(0), py(yd)); g.lineTo(px(xd), py(yd)); g.stroke();
        g.setLineDash([]);
        g.fillStyle = PAL.good; g.beginPath(); g.arc(px(xd), py(yd), 5, 0, 7); g.fill();
        return "x = " + fmt(xd) + "   →   " + name.replace(/^\d+\.\s*/, "").split(" ")[0].toLowerCase() +
               "(x) = " + fmt(yd);
      }
    };
  }

  /* ---- 2. ReLU ---- */
  OPERATORS.push(activationCard(
    "relu", "2. ReLU",
    "The simplest activation: keep positives, zero out negatives — relu(x)=max(x,0). Cheap and the default for CNNs. Written as max(), it has no branch at all.",
    function (x) { return Math.max(x, 0); }, [-0.5, 4],
"// Branch-free ReLU over a tile — no `if`, so every SIMD lane runs the same op.\n" +
"void relu_f32(const float* in, float* out, int n){\n" +
"    for (int i = 0; i < n; ++i)\n" +
"        out[i] = std::max(in[i], 0.0f);          // relu(x) = max(x, 0)\n" +
"}\n" +
"// Quantized int8 variant clamps at the zero-point:\n" +
"//   out[i] = std::max(in[i], zero_point);\n" +
"// relu_f32({-2,-0.5,0,0.5,2,3.5}) -> 0.0 0.0 0.0 0.5 2.0 3.5",
    "def relu(xs):\n    return [max(x, 0.0) for x in xs]\n# relu([-2,-0.5,0,0.5,2,3.5]) -> [0.0, 0.0, 0.0, 0.5, 2.0, 3.5]",
    "On Chimera: one fused loop; max() lowers to a vector MAX / conditional-move across the PE grid — never a data-dependent branch."
  ));

  /* ---- 3. GELU ---- */
  OPERATORS.push(activationCard(
    "gelu", "3. GELU",
    "The smooth activation used by GPT/BERT. Unlike ReLU's hard corner, GELU curves gently and lets a little negative signal through, which trains better in transformers.",
    function (x) { var k = 0.7978845608; return 0.5 * x * (1 + Math.tanh(k * (x + 0.044715 * x * x * x))); },
    [-0.5, 4],
"// GELU (tanh approximation), the GPT/BERT activation. Pure arithmetic -> no\n" +
"// branches; tanh is a uniform vector op applied across all lanes.\n" +
"void gelu_f32(const float* in, float* out, int n){\n" +
"    const float k = 0.7978845608f;               // sqrt(2/pi)\n" +
"    for (int i = 0; i < n; ++i){\n" +
"        float x = in[i];\n" +
"        float inner = k * (x + 0.044715f*x*x*x);\n" +
"        out[i] = 0.5f * x * (1.0f + std::tanh(inner));\n" +
"    }\n" +
"}\n" +
"// gelu({-3,-1,-0.5,0,0.5,1,3}) ->\n" +
"//   -0.0036 -0.1588 -0.1543 0.0000 0.3457 0.8412 2.9964",
    "import math\ndef gelu(xs):\n    k = math.sqrt(2/math.pi)\n    return [0.5*x*(1+math.tanh(k*(x+0.044715*x**3))) for x in xs]\n# gelu([...]) -> -0.0036 -0.1588 -0.1543 0.0 0.3457 0.8412 2.9964",
    "On Chimera: fuses into the MAC/ALU pipeline; the tanh/exp come from the math library (polynomial or LUT) and run identically on every lane.",
    function (g, px, py) { // dashed ReLU for comparison
      g.strokeStyle = PAL.muted; g.lineWidth = 1.5; g.setLineDash([5, 4]); g.beginPath();
      for (var i = 0; i <= 60; i++) { var x = -4 + 8 * i / 60, y = Math.max(x, 0); if (i === 0) g.moveTo(px(x), py(y)); else g.lineTo(px(x), py(y)); }
      g.stroke(); g.setLineDash([]);
      text(g, "ReLU (dashed)", px(1.2), py(3.4), PAL.muted, 10);
    }
  ));

  /* ---- 4. Sigmoid ---- */
  OPERATORS.push(activationCard(
    "sigmoid", "4. Sigmoid",
    "Squashes any real number into (0,1): sigmoid(x)=1/(1+e^-x). Used for gates (LSTM/GRU) and binary-probability outputs. Note it saturates flat at both ends.",
    function (x) { return 1 / (1 + Math.exp(-x)); }, [0, 1],
"// Sigmoid squashes any real into (0,1): 1/(1+e^-x). Branch-free; exp is a\n" +
"// uniform vector op. Used for gates and binary-probability outputs.\n" +
"void sigmoid_f32(const float* in, float* out, int n){\n" +
"    for (int i = 0; i < n; ++i)\n" +
"        out[i] = 1.0f / (1.0f + std::exp(-in[i]));\n" +
"}\n" +
"// sigmoid({-4,-2,-1,0,1,2,4}) ->\n" +
"//   0.0180 0.1192 0.2689 0.5000 0.7311 0.8808 0.9820",
    "import math\ndef sigmoid(xs):\n    return [1/(1+math.exp(-x)) for x in xs]\n# sigmoid([-4,-2,-1,0,1,2,4]) -> 0.018 0.1192 0.2689 0.5 0.7311 0.8808 0.982",
    "On Chimera: one fused loop; exp() from the math lib runs across all lanes uniformly, no branching."
  ));

  /* ---- 5. Softmax ---- */
  (function () {
    var LOG = [2.0, 1.0, 0.1, 3.0];
    var m = Math.max.apply(null, LOG);
    var EXP = LOG.map(function (v) { return Math.exp(v - m); });
    var S = EXP.reduce(function (a, b) { return a + b; }, 0);
    var PROB = EXP.map(function (v) { return v / S; });
    OPERATORS.push({
      id: "softmax", name: "5. Softmax",
      blurb: "Turns a vector of raw scores (logits) into a probability distribution — every value in (0,1), all summing to 1. Three stages: subtract the max (for numerical stability), exponentiate, then normalize by the sum.",
      states: 3, holdMs: 1200,
      draw: function (g, W, H, state) {
        var stage = state;                          // 0 logits, 1 exp, 2 normalized
        var data = stage === 0 ? LOG : stage === 1 ? EXP : PROB;
        var labels = ["logits x", "exp(x − max)", "probabilities (Σ=1)"];
        var n = 4, bw = 46, gap = 22, x0 = 40, base = H - 34;
        var maxv = stage === 2 ? 1 : Math.max.apply(null, data.map(Math.abs));
        var scale = (H - 70) / (maxv || 1);
        for (var i = 0; i < n; i++) {
          var x = x0 + i * (bw + gap);
          var h = Math.abs(data[i]) * scale;
          var up = data[i] >= 0;
          g.fillStyle = stage === 2 ? PAL.good : (up ? PAL.accent : PAL.bad);
          var y = up ? base - h : base;
          roundRect(g, x, y, bw, Math.max(h, 2), 4); g.fill();
          g.fillStyle = PAL.ink;
          text(g, fmt(data[i]), x + bw / 2, (up ? y - 10 : base + h + 10), PAL.ink, 12, "center");
          text(g, "x" + i, x + bw / 2, base + 16, PAL.muted, 11, "center");
        }
        g.strokeStyle = PAL.border; g.beginPath(); g.moveTo(x0 - 8, base); g.lineTo(x0 + n * (bw + gap), base); g.stroke();
        text(g, "stage " + (stage + 1) + "/3 — " + labels[stage], x0, 16, PAL.accent, 13);
        if (stage === 2) return "probabilities: " + PROB.map(fmt).join(", ") + "  (sum = 1.0000)";
        if (stage === 1) return "exponentiate each (max=" + fmt(m) + " subtracted first), sum = " + fmt(S);
        return "raw logits — can be any real number, positive or negative";
      },
      cpp:
"// Softmax: logits -> probability distribution (each in (0,1), summing to 1).\n" +
"//   softmax(x)_i = e^(x_i - m) / Σ_j e^(x_j - m),   m = max(x)\n" +
"// Subtracting m is the stability trick (prevents overflow; cancels out).\n" +
"// max and sum are branch-free REDUCTIONS.\n" +
"void softmax_f32(const float* in, float* out, int n){\n" +
"    float m = in[0];\n" +
"    for (int i = 1; i < n; ++i) m = std::max(m, in[i]);       // reduce: max\n" +
"    float sum = 0.0f;\n" +
"    for (int i = 0; i < n; ++i){ out[i] = std::exp(in[i]-m); sum += out[i]; }\n" +
"    float inv = 1.0f / sum;\n" +
"    for (int i = 0; i < n; ++i) out[i] *= inv;                // normalize\n" +
"}\n" +
"// softmax({2,1,0.1,3}) -> 0.2361 0.0869 0.0353 0.6418  (sum=1.0000)",
      py: "import math\ndef softmax(xs):\n    m = max(xs)\n    e = [math.exp(x-m) for x in xs]\n    s = sum(e)\n    return [v/s for v in e]\n# softmax([2,1,0.1,3]) -> 0.2361 0.0869 0.0353 0.6418",
      note: "On Chimera: max-reduce over the tile, exp across all lanes, sum-reduce, then a vector multiply by 1/sum. In attention a causal mask is folded in as a lane-position predicate before the max."
    });
  })();

  /* ---- 6. Depthwise-separable conv ---- */
  OPERATORS.push({
    id: "dwsep", name: "6. Depthwise-Separable Conv",
    blurb: "Factorizes a full conv into two cheap steps: DEPTHWISE filters each channel spatially on its own (no mixing), then POINTWISE (1×1) mixes channels. Same modeling power at a fraction of the parameters — the trick behind MobileNet.",
    states: 2, holdMs: 1500,
    draw: function (g, W, H, state) {
      var stage = state;
      var cell = 26, y0 = 40;
      // three input channels (left)
      var chColors = [PAL.accent, PAL.good, PAL.gold];
      for (var c = 0; c < 3; c++) {
        var x = 16, y = y0 + c * (2 * cell + 10);
        var hi = {};
        if (stage === 0) { hi["0,0"] = { fill: chColors[c], stroke: chColors[c], text: "#fff" }; }
        drawGrid(g, x, y, cell, 2, 2, null, hi);
        g.fillStyle = chColors[c]; g.beginPath(); g.arc(x - 6, y + cell, 3, 0, 7); g.fill();
      }
      text(g, "3 channels", 16, y0 - 14, PAL.muted, 12);
      text(g, stage === 0 ? "① depthwise: each channel × its own 3×3" : "② pointwise: 1×1 mixes channels",
           16, H - 14, stage === 0 ? PAL.accent : PAL.good, 13);
      // middle: depthwise result (same 3 channels)
      var mx = 150;
      for (var c2 = 0; c2 < 3; c2++) {
        var my = y0 + c2 * (2 * cell + 10);
        drawGrid(g, mx, my, cell, 2, 2, null, null);
        if (stage >= 0) arrow(g, 16 + 2 * cell + 4, my + cell, mx - 6, my + cell, chColors[c2]);
      }
      // right: 2 output channels after pointwise
      var ox = 270;
      for (var o = 0; o < 2; o++) {
        var oy = y0 + 6 + o * (2 * cell + 20);
        var ohi = stage === 1 ? { "0,0": { fill: PAL.accent, stroke: PAL.accent, text: "#fff" } } : null;
        drawGrid(g, ox, oy, cell, 2, 2, null, ohi);
        if (stage === 1) for (var k = 0; k < 3; k++) arrow(g, mx + 2 * cell + 4, y0 + k * (2 * cell + 10) + cell, ox - 6, oy + cell, PAL.muted);
      }
      if (W > 340) text(g, "2 out ch", ox, y0 - 14, PAL.muted, 12);
      return "full 3×3 conv (3→2 ch): 54 weights   ·   depthwise-separable: 33 weights   (1.64× fewer — bigger nets save 8–9×)";
    },
    cpp:
"// Stage 1 — depthwise: Cin channels in/out, one 3x3 filter each (no mixing).\n" +
"void depthwise3x3(const float* in,int C,int H,int W,const float* w,float* out){\n" +
"    for (int c=0;c<C;++c) for(int oy=0;oy<H;++oy) for(int ox=0;ox<W;++ox){\n" +
"        float acc=0;\n" +
"        for(int ky=0;ky<3;++ky) for(int kx=0;kx<3;++kx){\n" +
"            int iy=oy+ky-1, ix=ox+kx-1;\n" +
"            int m=((unsigned)iy<(unsigned)H)&((unsigned)ix<(unsigned)W);\n" +
"            int iyc=std::min(std::max(iy,0),H-1), ixc=std::min(std::max(ix,0),W-1);\n" +
"            acc += w[(c*3+ky)*3+kx]*in[(c*H+iyc)*W+ixc]*m;   // masked MAC\n" +
"        }\n" +
"        out[(c*H+oy)*W+ox]=acc;\n" +
"    }\n" +
"}\n" +
"// Stage 2 — pointwise 1x1: mix Cin channels -> Cout channels per pixel.\n" +
"void pointwise(const float* in,int Cin,int H,int W,const float* w,int Cout,float* out){\n" +
"    for(int oc=0;oc<Cout;++oc) for(int p=0;p<H*W;++p){\n" +
"        float acc=0;\n" +
"        for(int ic=0;ic<Cin;++ic) acc += w[oc*Cin+ic]*in[ic*H*W+p];  // 1x1 MAC\n" +
"        out[oc*H*W+p]=acc;\n" +
"    }\n" +
"}\n" +
"// params: full 3x3 (3->2) = 3*3*3*2 = 54 ;  dw-sep = 3*3*3 + 3*2 = 33  (1.64x)",
    note: "Both stages are the same branch-free clamped-index kernel as Conv2D. On Chimera they fuse into back-to-back data-parallel loops in one instruction stream — no accelerator hand-off between the spatial and the channel-mixing step."
  });

  /* ---- 7. BatchNorm / LayerNorm ---- */
  OPERATORS.push({
    id: "norm", name: "7. BatchNorm / LayerNorm",
    blurb: "Both rescale activations to mean 0, variance 1, then apply a learned scale+shift — they differ only in WHICH axis they average over. BatchNorm reduces down a channel across the batch (CNNs); LayerNorm reduces across the features of one token (transformers, works at batch size 1).",
    states: 2, holdMs: 1900,
    draw: function (g, W, H, state) {
      var isLN = state === 1;
      var rows = 3, cols = 4, cell = 34, x0 = 60, y0 = 42;
      var hi = {};
      if (!isLN) {   // BatchNorm: per channel, reduce ACROSS the batch (a row)
        for (var c = 0; c < cols; c++) hi["1," + c] = { fill: PAL.accentSoft, stroke: PAL.accent };
      } else {       // LayerNorm: per token, reduce ACROSS features (a column)
        for (var r = 0; r < rows; r++) hi[r + ",1"] = { fill: PAL.good, stroke: PAL.good, text: PAL.ink };
      }
      drawGrid(g, x0, y0, cell, rows, cols, null, hi);
      text(g, "batch / tokens →", x0, y0 - 16, PAL.muted, 11);
      g.save(); g.translate(x0 - 18, y0 + rows * cell / 2); g.rotate(-Math.PI / 2);
      text(g, "channels / features", 0, 0, PAL.muted, 11, "center"); g.restore();
      if (!isLN) arrow(g, x0 + 4, y0 + 1.5 * cell, x0 + cols * cell - 4, y0 + 1.5 * cell, PAL.accent);
      else arrow(g, x0 + 1.5 * cell, y0 + 4, x0 + 1.5 * cell, y0 + rows * cell - 4, PAL.good);
      var col2 = isLN ? PAL.good : PAL.accent;
      text(g, isLN ? "LayerNorm — reduce ACROSS features (one token at a time)"
                   : "BatchNorm — reduce ACROSS the batch (one channel at a time)",
           x0, H - 30, col2, 13);
      text(g, "y = γ·(x − μ)/√(σ²+ε) + β", x0, H - 12, PAL.muted, 12);
      return isLN
        ? "LayerNorm([1,2,3,4]) → -1.3416 -0.4472 0.4472 1.3416   (each token normalized on its own)"
        : "BatchNorm folds to one FMA per channel: scale=γ/√(σ²+ε), bias=β−μ·scale → y = x·scale + bias  (μ=2,σ²=1 → −1,0,1)";
    },
    cpp:
"// BatchNorm (inference): per channel, running mean/var fold into ONE affine\n" +
"// map -> a single fused multiply-add.  scale=γ/√(var+ε),  bias=β−mean·scale.\n" +
"void batchnorm_infer(const float* x,int C,int HW,const float* mean,\n" +
"        const float* var,const float* g_,const float* b_,float eps,float* y){\n" +
"    for(int c=0;c<C;++c){\n" +
"        float scale = g_[c] / std::sqrt(var[c]+eps);\n" +
"        float bias  = b_[c] - mean[c]*scale;\n" +
"        for(int i=0;i<HW;++i) y[c*HW+i] = x[c*HW+i]*scale + bias;  // fused FMA\n" +
"    }\n" +
"}\n" +
"// LayerNorm: per token, reduce over the FEATURE dim (mean/var are reductions).\n" +
"void layernorm(const float* x,int rows,int D,const float* g_,\n" +
"               const float* b_,float eps,float* y){\n" +
"    for(int r=0;r<rows;++r){\n" +
"        const float* xr = x + r*D;\n" +
"        float mean=0; for(int i=0;i<D;++i) mean+=xr[i]; mean/=D;\n" +
"        float var=0;  for(int i=0;i<D;++i){float d=xr[i]-mean; var+=d*d;} var/=D;\n" +
"        float inv = 1.0f/std::sqrt(var+eps);\n" +
"        for(int i=0;i<D;++i) y[r*D+i] = (xr[i]-mean)*inv*g_[i] + b_[i];\n" +
"    }\n" +
"}\n" +
"// batchnorm ch{1,2,3}(μ=2,σ²=1) -> -1 0 1 ;  layernorm([1,2,3,4]) ->\n" +
"//   -1.3416 -0.4472 0.4472 1.3416",
    py: "import math\ndef layernorm(x, eps=1e-5):\n    mean = sum(x)/len(x)\n    var  = sum((v-mean)**2 for v in x)/len(x)\n    inv  = 1/math.sqrt(var+eps)\n    return [(v-mean)*inv for v in x]\n# layernorm([1,2,3,4]) -> -1.3416 -0.4472 0.4472 1.3416",
    note: "On Chimera: precompute BatchNorm's scale/bias once, then it's a single branch-free FMA per element — cheap enough to FUSE onto the end of the preceding conv's MAC loop (conv→BN→ReLU in one pass). LayerNorm's mean/var are lane reductions."
  });

  /* ---- 8. MatMul / GEMM ---- */
  (function () {
    var A = [[1, 2, 3], [4, 5, 6]];      // 2x3
    var B = [[7, 8], [9, 10], [11, 12]]; // 3x2
    function dot(i, j, upto) { var s = 0; for (var k = 0; k <= upto; k++) s += A[i][k] * B[k][j]; return s; }
    OPERATORS.push({
      id: "gemm", name: "8. MatMul / GEMM",
      blurb: "Matrix multiply C = A·B is the workhorse of neural nets. A fully-connected layer is y = x·W; every transformer projection (Q, K, V, the attention output, and both MLP layers) is a GEMM. Each output C[i][j] is a dot product of a row of A with a column of B.",
      states: 6, holdMs: 720,
      draw: function (g, W, H, state) {
        var step = state;                          // 6 outputs (2x3 . 3x2)
        var oi = Math.floor(step / 2), oj = step % 2;
        var cell = 30, ax = 20, ay = 60, bx = 200, by = 14, cx = 200, cy = 92;
        // A with row oi highlighted
        var ahi = {}; for (var k = 0; k < 3; k++) ahi[oi + "," + k] = { fill: PAL.accentSoft, stroke: PAL.accent };
        drawGrid(g, ax, ay, cell, 2, 3, [1, 2, 3, 4, 5, 6], ahi);
        text(g, "A (2×3)", ax, ay - 12, PAL.muted, 12);
        // B with col oj highlighted
        var bhi = {}; for (var k2 = 0; k2 < 3; k2++) bhi[k2 + "," + oj] = { fill: PAL.good + "", stroke: PAL.good, text: PAL.ink };
        drawGrid(g, bx, by, cell, 3, 2, [7, 8, 9, 10, 11, 12], bhi);
        text(g, "B (3×2)", bx, by - 2, PAL.muted, 12);
        // C fills in
        var cvals = [];
        for (var p = 0; p < 6; p++) { var pi = Math.floor(p / 2), pj = p % 2; cvals.push(p <= step ? dot(pi, pj, 2) : ""); }
        var chi = {}; chi[oi + "," + oj] = { fill: PAL.accent, stroke: PAL.accent, text: "#fff" };
        drawGrid(g, cx, cy, cell, 2, 2, cvals, chi);
        text(g, "C = A·B (2×2)", cx, cy - 12, PAL.muted, 12);
        return "C[" + oi + "][" + oj + "] = A row" + oi + " · B col" + oj + " = " +
               A[oi].map(function (a, k) { return a + "×" + B[k][oj]; }).join(" + ") + " = " + dot(oi, oj, 2);
      },
      cpp:
"// GEMM: C[MxN] = A[MxK]·B[KxN].  int8·int8 -> int32 accumulate, then\n" +
"// requantize. The inner K-loop is a pure MAC chain with NO branches —\n" +
"// exactly what a systolic MAC array wants.\n" +
"void gemm_i8(const int8_t* A,const int8_t* B,int M,int K,int N,\n" +
"             int8_t* C,int32_t mul,int shift){\n" +
"    for(int i=0;i<M;++i) for(int j=0;j<N;++j){\n" +
"        int32_t acc=0;\n" +
"        for(int k=0;k<K;++k) acc += (int32_t)A[i*K+k]*B[k*N+j];   // MAC\n" +
"        int64_t r = ((int64_t)acc*mul + (1<<(shift-1))) >> shift;\n" +
"        C[i*N+j] = (int8_t)std::max<int64_t>(-128,std::min<int64_t>(127,r));\n" +
"    }\n" +
"}\n" +
"// A=[[1,2,3],[4,5,6]] · B=[[7,8],[9,10],[11,12]] ->\n" +
"//   C int32 = [58 64 ; 139 154] ;  requant >>2 = [15 16 ; 35 39]",
      note: "On Chimera: A stays resident in the PE array while B streams in; each PE holds one C[i][j] accumulator and one 64-bit instruction advances every lane's MAC together — the systolic dataflow the 2D grid is built for."
    });
  })();

  /* ---- 9. Attention (capstone) ---- */
  (function () {
    var Q = [[1, 0], [0, 1], [1, 1]], K = [[1, 0], [0, 1], [1, 1]], V = [[10, 0], [0, 10], [5, 5]];
    var L = 3, d = 2, scale = 1 / Math.sqrt(d);
    var P = []; // softmax rows
    for (var i = 0; i < L; i++) {
      var s = []; for (var j = 0; j < L; j++) { var dp = 0; for (var k = 0; k < d; k++) dp += Q[i][k] * K[j][k]; s.push(dp * scale); }
      var m = Math.max.apply(null, s); var e = s.map(function (v) { return Math.exp(v - m); }); var sm = e.reduce(function (a, b) { return a + b; }); P.push(e.map(function (v) { return v / sm; }));
    }
    var OUT = [];
    for (var i2 = 0; i2 < L; i2++) { var o = []; for (var k2 = 0; k2 < d; k2++) { var a = 0; for (var j2 = 0; j2 < L; j2++) a += P[i2][j2] * V[j2][k2]; o.push(a); } OUT.push(o); }
    OPERATORS.push({
      id: "attention", name: "8b. Attention (Q·Kᵀ → softmax → ·V)",
      blurb: "The heart of a transformer. Each token's Query is dotted with every Key to score relevance (Q·Kᵀ), softmax turns those scores into weights that sum to 1, and the output is the weighted mix of Values. It's two GEMMs with a softmax in between — reusing everything above.",
      states: 3, holdMs: 1500,
      draw: function (g, W, H, state) {
        var stage = state;
        var cell = 34, x0 = 40, y0 = 50;
        var titles = ["① scores = Q·Kᵀ / √d", "② P = softmax(scores)  (rows sum to 1)", "③ output = P · V"];
        text(g, titles[stage], x0, 20, PAL.accent, 13);
        if (stage === 0) {
          var sc = [];
          for (var i = 0; i < L; i++) for (var j = 0; j < L; j++) { var dp = 0; for (var k = 0; k < d; k++) dp += Q[i][k] * K[j][k]; sc.push(fmt(dp * scale)); }
          drawGrid(g, x0, y0, cell, 3, 3, sc, null);
          text(g, "L×L relevance scores (row = query, col = key)", x0, y0 + 3 * cell + 20, PAL.muted, 12);
          return "each score = one Query·Key dot product, scaled by 1/√d = " + fmt(scale);
        } else if (stage === 1) {
          var pv = []; for (var i3 = 0; i3 < L; i3++) for (var j3 = 0; j3 < L; j3++) pv.push(fmt(P[i3][j3]));
          var hi = {}; for (var rr = 0; rr < L; rr++) for (var c = 0; c < L; c++) hi[rr + "," + c] = { fill: PAL.good, stroke: PAL.good, text: PAL.ink };
          drawGrid(g, x0, y0, cell, 3, 3, pv, hi);
          text(g, "each row softmax-normalized → attention weights", x0, y0 + 3 * cell + 20, PAL.muted, 12);
          return "row 0 weights sum to 1: " + P[0].map(fmt).join(" + ") + " = 1.0";
        } else {
          var ov = []; for (var i4 = 0; i4 < L; i4++) for (var k4 = 0; k4 < d; k4++) ov.push(fmt(OUT[i4][k4]));
          drawGrid(g, x0, y0, cell, 3, 2, ov, { "0,0": { fill: PAL.accent, stroke: PAL.accent, text: "#fff" } });
          text(g, "L×d output — each token's attended value mix", x0, y0 + 3 * cell + 20, PAL.muted, 12);
          return "output = weights · V → rows [6.017, 3.983], [3.983, 6.017], [5, 5]";
        }
      },
      cpp:
"// Scaled dot-product attention = TWO GEMMs with a softmax between them.\n" +
"//   scores = Q·Kᵀ / √d   ->   P = softmax(scores)   ->   out = P·V\n" +
"static void softmax_row(float* r,int n){\n" +
"    float m=r[0]; for(int i=1;i<n;++i) m=std::max(m,r[i]);\n" +
"    float s=0; for(int i=0;i<n;++i){ r[i]=std::exp(r[i]-m); s+=r[i]; }\n" +
"    for(int i=0;i<n;++i) r[i]/=s;\n" +
"}\n" +
"void attention(const float* Q,const float* K,const float* V,\n" +
"               int L,int d,float* out){\n" +
"    float scale = 1.0f/std::sqrt((float)d);\n" +
"    for(int i=0;i<L;++i){\n" +
"        float p[16];\n" +
"        for(int j=0;j<L;++j){ float dp=0;\n" +
"            for(int k=0;k<d;++k) dp+=Q[i*d+k]*K[j*d+k]; p[j]=dp*scale; }  // Q·Kᵀ\n" +
"        softmax_row(p,L);\n" +
"        for(int k=0;k<d;++k){ float a=0;\n" +
"            for(int j=0;j<L;++j) a+=p[j]*V[j*d+k]; out[i*d+k]=a; }        // P·V\n" +
"    }\n" +
"}\n" +
"// Q=K=[[1,0],[0,1],[1,1]], V=[[10,0],[0,10],[5,5]] ->\n" +
"//   out rows: [6.017 3.983] [3.983 6.017] [5.000 5.000]",
      note: "On Chimera: Q·Kᵀ and P·V are systolic GEMMs; the softmax (max-reduce, exp, sum-reduce, divide) is branch-free vector work fused in the same instruction stream. A causal mask is applied as a lane-position predicate before the softmax max — never a branch."
    });
  })();

  window.OPERATORS = OPERATORS;

  /* ================= animation engine ================= */
  var canvases = [];   // {op, canvas, ctx, cap, frame, playing, dpr, cssW, cssH}
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function setupCanvas(entry) {
    var cvs = entry.canvas, ctx = entry.ctx;
    var cssW = cvs.clientWidth || 340, cssH = 220;
    var dpr = window.devicePixelRatio || 1;
    cvs.width = Math.round(cssW * dpr);
    cvs.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    entry.cssW = cssW; entry.cssH = cssH;
  }
  function drawEntry(entry) {
    var ctx = entry.ctx;
    ctx.clearRect(0, 0, entry.cssW, entry.cssH);
    var cap = entry.op.draw(ctx, entry.cssW, entry.cssH, entry.state) || "";
    if (entry.cap) entry.cap.textContent = cap;
  }
  function redrawAll() { canvases.forEach(function (e) { drawEntry(e); }); }

  // Each operator advances one STATE at a time; autoplay holds each state for
  // op.holdMs so it stays readable, and Step always jumps to the next state.
  function tick(now) {
    canvases.forEach(function (e) {
      if (!e.playing) return;
      if (!e.lastAdv) e.lastAdv = now;
      if (now - e.lastAdv >= e.op.holdMs) {
        e.lastAdv = now;
        e.state = (e.state + 1) % e.op.states;
        drawEntry(e);
      }
    });
    requestAnimationFrame(tick);
  }

  function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  function build() {
    var host = document.getElementById("op-list");
    var toc = document.getElementById("op-toc");
    OPERATORS.forEach(function (op) {
      // TOC chip
      var a = document.createElement("a");
      a.className = "op-toc-link"; a.href = "#op-" + op.id; a.textContent = op.name;
      toc.appendChild(a);

      var sec = document.createElement("section");
      sec.className = "op-card"; sec.id = "op-" + op.id;

      var h = document.createElement("h2"); h.className = "op-title"; h.textContent = op.name;
      var blurb = document.createElement("p"); blurb.className = "op-blurb"; blurb.textContent = op.blurb;
      sec.appendChild(h); sec.appendChild(blurb);

      // canvas + controls
      var wrap = document.createElement("div"); wrap.className = "op-canvas-wrap";
      var cvs = document.createElement("canvas"); cvs.className = "op-canvas";
      wrap.appendChild(cvs);
      var cap = document.createElement("div"); cap.className = "op-caption";
      var ctrls = document.createElement("div"); ctrls.className = "op-controls";
      var play = document.createElement("button"); play.className = "op-btn"; play.textContent = reduced ? "▶ Play" : "⏸ Pause";
      var step = document.createElement("button"); step.className = "op-btn"; step.textContent = "⏭ Step";
      var reset = document.createElement("button"); reset.className = "op-btn"; reset.textContent = "↺ Reset";
      ctrls.appendChild(play); ctrls.appendChild(step); ctrls.appendChild(reset);
      sec.appendChild(wrap); sec.appendChild(cap); sec.appendChild(ctrls);

      // code
      var codeLbl = document.createElement("div"); codeLbl.className = "op-code-label"; codeLbl.textContent = "C++ (branch-free, SIMD-friendly — verified with g++)";
      var pre = document.createElement("pre"); pre.className = "op-code";
      var code = document.createElement("code"); code.innerHTML = esc(op.cpp); pre.appendChild(code);
      sec.appendChild(codeLbl); sec.appendChild(pre);

      if (op.py) {
        var det = document.createElement("details"); det.className = "op-py";
        var sum = document.createElement("summary"); sum.textContent = "Python reference";
        var ppre = document.createElement("pre"); ppre.className = "op-code";
        var pcode = document.createElement("code"); pcode.innerHTML = esc(op.py); ppre.appendChild(pcode);
        det.appendChild(sum); det.appendChild(ppre); sec.appendChild(det);
      }

      var note = document.createElement("div"); note.className = "op-note";
      note.innerHTML = "<span class='op-note-lbl'>How Chimera runs it</span>" + esc(op.note);
      sec.appendChild(note);

      host.appendChild(sec);

      var entry = { op: op, canvas: cvs, ctx: cvs.getContext("2d"), cap: cap, state: 0, lastAdv: 0, playing: !reduced };
      canvases.push(entry);
      setupCanvas(entry); drawEntry(entry);

      play.addEventListener("click", function () {
        entry.playing = !entry.playing; entry.lastAdv = 0;
        play.textContent = entry.playing ? "⏸ Pause" : "▶ Play";
      });
      step.addEventListener("click", function () {
        entry.playing = false; play.textContent = "▶ Play";
        entry.state = (entry.state + 1) % entry.op.states; drawEntry(entry);
      });
      reset.addEventListener("click", function () {
        entry.playing = false; play.textContent = "▶ Play";
        entry.state = 0; drawEntry(entry);
      });
    });

    var rt;
    window.addEventListener("resize", function () {
      clearTimeout(rt);
      rt = setTimeout(function () { canvases.forEach(function (e) { setupCanvas(e); drawEntry(e); }); }, 150);
    });
    requestAnimationFrame(tick);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
})();
