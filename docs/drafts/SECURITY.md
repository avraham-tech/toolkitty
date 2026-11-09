# Security policy

<!-- DRAFT for the repository root (2026-11-09). Replace <repo>. -->

## Reporting a vulnerability

Please report security issues privately, not in a public issue:

- GitHub: **Security → Report a vulnerability** on https://github.com/avraham-tech/<repo>
  (private advisory; GitHub notifies the maintainer).
- If that is not available to you, open an issue titled "security contact request" with no details, and
  the maintainer will reply with a private channel.

You will get an acknowledgement within a few days. Toolkitty is maintained by one person in spare time, so
a fix may take longer than at a company; you will be told when it ships and credited in the release notes
unless you prefer not to be.

## What counts

- A guard (dangerous commands, secret protection, pasted-secret scan, blast radius, merge gate, scope
  guard, injection tripwire) that can be bypassed by an input it was designed to catch.
- Secret values, paths or prompt text reaching a share card, receipt, export or post text despite the
  redaction layer.
- Any network call not listed in the README's "What leaves your machine" section.
- Data written outside Claude Code's plugin store, the project's `.claude/toolkitty.json`, the exports
  folder or `~/.claude/toolkitty-*` folders.

Not vulnerabilities: a dangerous command that does not match any rule (the guards are pattern rules, not
a sandbox; a proposal for a new rule is a feature request), and behaviour of Claude Code itself.

## Supported versions

The latest release on the main branch. Older tags receive no fixes.

## What Toolkitty can do on your machine

It runs inside Claude Code with the same permissions as Claude Code: it can read and write files in the
project, run processes the features describe (git, formatters, linters, tests), show panes and toasts,
and make the network calls listed in the README. It cannot elevate those permissions. The code is plain
TypeScript under `hooks/`; `claude plugin validate .` lists the events and APIs it uses.
