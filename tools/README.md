# Tools

Helper scripts for working on Toolkitty. None of them is part of the plugin; nothing here ships to users.
Run them from the repository root. Python scripts need Python 3.10 or later; pass `-X utf8` on Windows.

| Script | What it does | How to run it |
|---|---|---|
| `run_tests.sh` | Runs the suite, or some test files, on a clean copy of the working tree with the Claude Code binary you name. Never touches the plugin folder or the installed copy. | `bash tools/run_tests.sh --cli <claude> [--api theme\|ui] [name ...]` |
| `check_i18n.py` | Checks every localized literal for the ten languages: missing languages, empty texts, placeholder mismatches. | `python -X utf8 tools/check_i18n.py hooks` |
| `extract_i18n.py` | Writes every localized string into review tables, one folder per language, plus the `index.json` that `apply_i18n.py` needs. | `python -X utf8 tools/extract_i18n.py hooks <out folder> [rows per chunk]` |
| `apply_i18n.py` | Applies reviewer fixes (`fixes-NN.jsonl`) to the sources and refuses a fix whose placeholders differ from the English text. Lines move after an apply, so extract again before the next round. | `python -X utf8 tools/apply_i18n.py hooks <out>/index.json <fixes.jsonl> [...]` |
| `gen_register.py` | Regenerates `hooks/register.tsx` from the handlers the feature files export. Run it after adding a feature or a handler. | `python -X utf8 tools/gen_register.py hooks` |
| `gen_readme_table.py` | Rebuilds the feature table of a README from `hooks/features/index.ts`. | `python -X utf8 tools/gen_readme_table.py [README path]` |
| `build_readme.py` | Builds `README.md` from `docs/drafts/README.md` and the install section of `docs/LAUNCH-PLAN.md`. | `python -X utf8 tools/build_readme.py` |
| `make_assets.py` | Regenerates the brand assets from `assets/icon-1024.png` (needs Pillow). See `docs/BRAND-ASSETS.md`. | `python -X utf8 tools/make_assets.py .` |

## Testing against two engines

Claude Code 2.1.319 moved the backdrop API from `ui.backdrop` to `theme.set` / `theme.clear`. The plugin
speaks both (`hooks/backdrop.ts`), and the suite is run against both before a release:

```bash
bash tools/run_tests.sh --cli <claude 2.1.319 or later>
```

```bash
bash tools/run_tests.sh --cli <claude 2.1.317> --api ui
```

`--api ui` flips `BACKDROP_API` in the copy's `tests/engine.ts`; the file in the repository stays `'theme'`.
Run one suite at a time.
