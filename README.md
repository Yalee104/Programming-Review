# Programming-Review

Study summaries for programming languages (C++, Python, CUDA, …) plus an
interactive, mobile-friendly quiz site rendered straight from the markdown.

## Contents

| File | What it is |
|---|---|
| `cpp_study_summary.md` | C++ study summary |
| `python_study_summary.md` | Python study summary |
| `cuda_study_summary.md` | CUDA study summary |
| `index.html` | Site home — pick a language, then Review or Quiz |
| `review.html` | Renders a study summary md in the browser (section jump menu, deep links) |
| `quiz.html` | Interactive quiz — multiple choice & fill-in-the-blank |
| `quizzes/<lang>.js` | Question bank per language (currently: `python.js`) |
| `assets/` | Styles, markdown renderer, quiz engine, language manifest |

## Quiz features

- Multiple-choice and fill-in-the-blank questions, shuffled each run
- Wrong answers show **why**, the **correct answer**, and a direct link to the
  **summary section to review**
- Results screen groups misses by section with review links
- Designed mobile-first — works well on a phone

## Viewing the site

**GitHub Pages (recommended):** Settings → Pages → "Deploy from a branch" →
branch `main`, folder `/ (root)`. The site is then available at
`https://<user>.github.io/Programming-Review/`.

**Locally:** run `python -m http.server` in the repo root and open
`http://localhost:8000/` (the review page fetches the md files, so it needs
HTTP — opening `index.html` from disk won't load summaries).

## Adding a language

1. Add `<lang>_study_summary.md` (sections numbered `## 1. Title`, `## 2. …`).
2. Add an entry in `assets/languages.js`.
3. Optionally add `quizzes/<lang>.js` with a question bank and set
   `quiz: true` in the manifest.
