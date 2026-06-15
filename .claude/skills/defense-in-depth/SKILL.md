---
name: defense-in-depth
description: Validate at every layer boundary. Use when data crosses a trust boundary — user input, HTTP body, DB row, MCP tool call, or parsed file — and whenever a gate catches an unsafe assumption.
---

# Defense in depth

Validate data at EVERY layer it passes through, not only the outermost one. A single-layer check leaves inner layers open when the outer is bypassed or the shape is wrong.

The boundaries in vow:

- HTTP (`/__vow/*`): validate the body before any DB write.
- MCP: validate tool-call args before any file or DB effect.
- DB: validate identifiers before interpolation (a raw slug in SQL is identifier-injection).
- Emitter: validate spec fields before emitting (an undefined in an HTML attribute is a bug).
- Parse: use a type predicate, not `as` — the gate flags the cast.

The fix is always AT the boundary (validate before use), not at the caller. A type hole is fixed with a real predicate at its source; the gate confirms it is gone.
