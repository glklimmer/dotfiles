---
name: testing
description: What tests are worth writing. Load before adding or changing tests in any repo.
---

# Testing

Only write tests that can catch a real bug.

- No tests that restate the implementation: constant mappings, accessors, conversions, derived impls. They only fail when the mirrored code is rewritten.
- Prefer scenario/integration tests that drive real systems through the user-visible flow.
- Unit-test pure logic only where it can genuinely be wrong: formulas, geometry, parsing/encoding, edge cases.
