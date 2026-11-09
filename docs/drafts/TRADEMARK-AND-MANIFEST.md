# Trademark notice and manifest additions (drafts, 2026-11-09)

Not legal advice. A trademark search for "Toolkitty" (USPTO TESS, EUIPO, and the Israeli registry) before
the first public post is a cheap owner task; the notice below is the common open-source form.

## Lines to append to LICENSE (after the MIT text)

```text
---
Trademark notice

"Toolkitty", the Toolkitty cat mascot and the Toolkitty logo are trademarks of
Avraham Shemesh. The MIT license above covers the software only. It does not
grant permission to use the name, the mascot or the logo to identify a modified
version, a fork or a different product. Forks are welcome under their own name
and artwork. Factual references ("built on Toolkitty", "a fork of Toolkitty")
are fine.
```

## Line already in the README draft

> MIT, see LICENSE. The Toolkitty name, the cat mascot and the logo are trademarks of Avraham Shemesh and
> are not covered by the MIT license; forks are welcome under a different name and mascot.

## `.claude-plugin/plugin.json` fields to fill before publishing

```json
{
  "name": "toolkitty",
  "version": "0.1.0",
  "description": "Toolkitty: your coding companion for Claude Code. 91 switchable features: monitor, optimize, protect, verify, and a tiny cat.",
  "author": { "name": "Avraham Shemesh", "url": "https://github.com/avraham-tech" },
  "homepage": "https://github.com/avraham-tech/<repo>",
  "repository": "https://github.com/avraham-tech/<repo>",
  "documentationUrl": "https://github.com/avraham-tech/<repo>#readme",
  "supportUrl": "https://github.com/avraham-tech/<repo>/issues",
  "privacyPolicyUrl": "https://github.com/avraham-tech/<repo>#what-leaves-your-machine",
  "license": "MIT",
  "types": "./types/index.d.ts",
  "icon": "./.claude-plugin/icon.png"
}
```

`documentationUrl`, `supportUrl` and `privacyPolicyUrl` are the optional directory fields documented at
code.claude.com/docs/en/plugins/manifest-reference. The current file has `homepage` pointing at the
profile and `repository` at `OWNER/REPO`.

## `.claude-plugin/marketplace.json` (does not exist yet)

```json
{
  "name": "avraham-tech",
  "owner": { "name": "Avraham Shemesh", "url": "https://github.com/avraham-tech" },
  "metadata": { "description": "Plugins by Avraham Shemesh" },
  "plugins": [
    {
      "name": "toolkitty",
      "source": "./",
      "description": "Your coding companion for Claude Code: 91 switchable features to monitor, optimize, protect and verify, with a tiny cat.",
      "author": { "name": "Avraham Shemesh" },
      "license": "MIT"
    }
  ]
}
```

The top-level `name` is what follows `@` in `toolkitty@avraham-tech`; the entry `name` must equal the
plugin.json name. Validate with `claude plugin validate .` from the plugin root.

## Share-card and post-text install line

`hooks/sharing.ts` exports `INSTALL_CMD = 'claude plugin install toolkitty'`, which is not a documented
working command. Replace with either the GitHub URL or
`claude plugin install toolkitty --marketplace avraham-tech/<repo>` (the documented one-liner). The
banner's terminal line (`scratchpad/make_assets.py` in the builder session) needs the same change, or
the consultation's "Get Toolkitty → GitHub" text.
