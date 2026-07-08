#!/bin/sh
set -e

if command -v node >/dev/null 2>&1; then
  exec node "$@"
fi

exec /Users/farben/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node "$@"
