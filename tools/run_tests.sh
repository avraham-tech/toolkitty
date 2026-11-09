#!/usr/bin/env bash
# Runs the test suite, or some of its files, on a clean copy of the working tree.
#
#   tools/run_tests.sh [--cli <claude>] [--api theme|ui] [--log <file>] [name ...]
#
#   --cli   the Claude Code binary to test with (default: `claude` on PATH)
#   --api   the backdrop API of that binary: theme (2.1.319 and later, the default) or
#           ui (up to 2.1.317); it sets BACKDROP_API in the copy's tests/engine.ts
#   --log   where the full output goes (default: a file in the copy's parent folder)
#   name    test files to run, without the .test.tsx ending (default: all of them)
#
# The copy lives in a fresh temp folder with its own empty CLAUDE_CONFIG_DIR, so the run
# never touches the plugin folder, the installed copy, or your settings. Run one suite at
# a time: two at once make the timing-sensitive tests flaky.
set -euo pipefail

CLI="claude"
API="theme"
LOG=""
NAMES=()
while [ $# -gt 0 ]; do
  case "$1" in
    --cli) CLI="$2"; shift 2 ;;
    --api) API="$2"; shift 2 ;;
    --log) LOG="$2"; shift 2 ;;
    -h|--help) sed -n '2,15p' "$0"; exit 0 ;;
    *) NAMES+=("$1"); shift ;;
  esac
done
case "$API" in theme|ui) ;; *) echo "--api takes theme or ui" >&2; exit 2 ;; esac

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"
COPY="$WORK/toolkitty"
mkdir -p "$COPY" "$WORK/config"

# Tracked and new files of the folders the plugin and its tests need; ignored files stay behind.
(cd "$ROOT" && git ls-files -co --exclude-standard -- .claude-plugin hooks tests types themes sounds assets tsconfig.json) |
  while IFS= read -r file; do
    mkdir -p "$COPY/$(dirname "$file")"
    cp "$ROOT/$file" "$COPY/$file"
  done

if [ "${#NAMES[@]}" -gt 0 ]; then
  for file in "$COPY"/tests/*.test.tsx; do
    keep=0
    for name in "${NAMES[@]}"; do
      [ "$(basename "$file")" = "$name.test.tsx" ] && keep=1
    done
    [ "$keep" = 1 ] || rm "$file"
  done
fi

if [ "$API" = "ui" ]; then
  sed -i "s/^export const BACKDROP_API: 'theme' | 'ui' = 'theme'$/export const BACKDROP_API: 'theme' | 'ui' = 'ui'/" "$COPY/tests/engine.ts"
  grep -q "= 'ui'$" "$COPY/tests/engine.ts" || { echo "could not set BACKDROP_API in tests/engine.ts" >&2; exit 2; }
fi

[ -n "$LOG" ] || LOG="$WORK/tests.log"
echo "engine: $("$CLI" --version)  api: $API  copy: $COPY"
status=0
(cd "$COPY" && CLAUDE_CONFIG_DIR="$WORK/config" "$CLI" plugin test .) >"$LOG" 2>&1 || status=$?
grep -E '^\(fail\)' -A3 "$LOG" | cut -c1-300 | head -60 || true
tail -n 4 "$LOG"
echo "log: $LOG"
exit "$status"
