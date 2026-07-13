// Manifest of available languages. Add an entry here when a new
// study-summary md (and optionally a quiz in quizzes/<id>.js) is added.
window.LANGUAGES = [
  {
    id: "python",
    name: "Python",
    desc: "Dynamic typing, comprehensions, generators, closures, decorators, dunders, GIL & more.",
    md: "python_study_summary.md",
    quiz: true,
  },
  {
    id: "cpp",
    name: "C++",
    desc: "Conversions, rvalues, move semantics, smart pointers, const, operators, vtables, variants, threads & more.",
    md: "cpp_study_summary.md",
    quiz: true,
  },
  {
    id: "cuda",
    name: "CUDA",
    desc: "Kernels, thread hierarchy, index math, memory spaces, shared memory, reductions, unified memory.",
    md: "cuda_study_summary.md",
    quiz: true,
  },
  {
    id: "nnops",
    name: "Neural-Net Operators",
    desc: "Conv2D, ReLU/GELU/Sigmoid, Softmax, depthwise-separable conv, BatchNorm/LayerNorm, GEMM & attention — animated, with branch-free SIMD C++ in Quadric's Chimera style.",
    md: "nn_operators_summary.md",
    quiz: false,
    interactive: "operators.html",
  },
];

window.getLanguage = function (id) {
  return window.LANGUAGES.find(function (l) { return l.id === id; }) || null;
};
