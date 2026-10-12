---
name: testing
description: What tests are worth writing. Load before adding or changing tests in any repo.
---

# Testing

Only write tests that can catch a real bug.

- No tests that restate the implementation: constant mappings, accessors, conversions, derived impls. They only fail when the mirrored code is rewritten.
- Pin exact values only when they are the spec (a rule, a formula, an API contract), not ones the code happens to produce today, like timings, coordinates, markup or tuning constants.
- Prefer scenario/integration tests that drive real systems through the user-visible flow.
- Unit-test pure logic only where it can genuinely be wrong: formulas, geometry, parsing/encoding, edge cases.
- A test for a bug fix must fail without the fix; check that.
- No vacuous passes: assert a lookup succeeded before unwrapping it or returning early.
