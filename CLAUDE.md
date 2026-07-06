# Instructions for This Learning Folder

This folder is used for ongoing C++ / Python / AI-ML / CUDA learning sessions.
Aaron asks questions, Claude answers with explanations, and summaries are kept
in topic-specific markdown files for quick review.

## Rules

1. **Always include a runnable example for every concept explained** — never
   describe a language/library feature in the abstract only. Every rule,
   operator, keyword, or pattern must be shown in actual code.

2. **Every example must show usage AND output**, not just a definition.
   A class/function definition alone is not enough — show it being called
   with real inputs and the real result (e.g. `times3(7); // 21`), similar to
   the `Multiplier` functor example. Prefer verified, compiler-checked output
   in comments over guessed output.

3. **Verify examples actually run before writing them into a summary file.**
   For C++: compile and execute with g++ in the sandbox before adding code to
   a summary md. For Python: actually run it. Don't hand-write "expected"
   output without checking — confirm it matches real compiler/interpreter
   output.

4. **Summary files, one per topic:**
   - C++ → `cpp_study_summary.md`
   - Python → separate md file (create if it doesn't exist)
   - AI/ML → separate md file
   - CUDA → separate md file
   Keep topics in separate files so none of them get too cluttered.

5. Append new sections to the relevant existing file rather than starting
   over — keep numbering sequential within each file.
