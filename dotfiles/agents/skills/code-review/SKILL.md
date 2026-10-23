---
name: code-review
description: "Four-lens review of a change: security, performance, correctness, maintainability. Use for a security, performance, or correctness pass."
---

# Code review

Review the change the caller names: a diff, a PR, or files. Nothing named: the working tree; when it is clean, `git diff main...HEAD`. Ask only when the target is unclear. Read the diff and the code it touches, including callers of changed functions. An empty diff ends the review.

Report only. Touch no file.

## Lenses

- **Security:** injection, XSS, CSRF, auth and permission gaps, secrets in code, unsafe deserialization, path traversal, SSRF.
- **Performance:** N+1 queries, unbounded queries or loops, quadratic work on big input, missing index, resource leaks.
- **Correctness:** empty, zero, null and last-item cases, overflow, races, error handling, off-by-one, a caller broken by the change.
- **Maintainability:** a name that lies, one function with several jobs, near-copies, risky behavior with no test.

## Output

One section per lens. Skip an empty lens.

Number every finding across all sections. Each finding: `path:line`, the problem in one sentence, and the smallest fix. Give a concrete case or drop the finding. No style taste, no "consider".

Close with `Verdict: ship.` or `Verdict: fix <numbers> first.`
