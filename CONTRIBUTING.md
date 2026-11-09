# Contributing

Thanks for helping. Toolkitty is maintained by one person in spare time, so small, focused changes are easiest to review.

## Before you open a pull request

- Open an issue first for anything bigger than a fix, so we can agree on the direction.
- Run the tests from the plugin root:

  ```bash
  claude plugin test .
  ```

  All tests should pass before and after your change.
- Add or update a test next to the code you changed (see `tests/`).

## Conventions

- Features live in `hooks/features/`, one file per feature, and are listed in `hooks/features/index.ts`. Follow the structure of an existing feature of the same kind.
- Every user-visible string needs English plus the other UI languages; English is the reference.
- No new network calls without listing them in the README section "What leaves your machine". Guards are pattern rules and must not be described as a sandbox.
- Plain TypeScript, no new runtime dependencies.

## Reporting security issues

Do not open a public issue. See [SECURITY.md](SECURITY.md).
