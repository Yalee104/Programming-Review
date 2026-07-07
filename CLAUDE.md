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

6. **Examples must be COMPLETE and self-contained — never skip
   initialization.** Every variable or object used in a usage snippet must
   first be created in that same snippet: show `Multiplier times3{3};`
   before calling `times3(7)`, `Widget w; Widget* wp = &w;` before
   `(w.*mfp)()` / `(wp->*mfp)()`, etc. A reader should be able to copy the
   example and run it without inventing any missing declarations. When
   verifying (rule 3), compile/run the FULL snippet exactly as written, not
   a mentally completed version — if it only compiles because you silently
   added a declaration in the sandbox, the summary is incomplete.

7. **Explain comprehensively — never assume the reader already knows a
   concept, operator, or piece of syntax.** Introduce each new thing before
   using it, and build up step by step from the ground:
   - First say WHAT it is in plain language (e.g. "a *view* is a
     lightweight, non-owning, lazy object over another range").
   - Then explain any unfamiliar SYNTAX explicitly — especially operators
     and symbols used in a non-obvious way. Don't drop `nums | views::filter(...)`
     on the reader; explain that `|` here feeds the left range into the right
     adaptor, and that `R | views::filter(p)` is exactly `views::filter(R, p)`.
   - Then show it in the SMALLEST possible form (a single stage/one feature),
     and only after that build up to the combined/chained/advanced form.
   - For multi-step pipelines or transformations, show the intermediate
     result at EACH step (what the value is after stage 1, stage 2, …), not
     just the final answer.
   If a reader would have to already understand something to follow the
   example, that something must be explained first. When in doubt, over-explain.
