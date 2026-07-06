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
    desc: "Core syntax and techniques from the C++ study summary.",
    md: "cpp_study_summary.md",
    quiz: false,
  },
  {
    id: "cuda",
    name: "CUDA",
    desc: "Kernels, thread hierarchy, memory spaces, shared memory, reductions.",
    md: "cuda_study_summary.md",
    quiz: false,
  },
];

window.getLanguage = function (id) {
  return window.LANGUAGES.find(function (l) { return l.id === id; }) || null;
};
