#!/bin/sh
set -eu
BALANCE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
BALANCE_NODE=${NODE_BIN:-}
if [ -z "$BALANCE_NODE" ]; then
  BALANCE_NODE=$(command -v node || true)
fi
if [ -z "$BALANCE_NODE" ]; then
  BALANCE_BUNDLED_NODE="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
  if [ -x "$BALANCE_BUNDLED_NODE" ]; then
    BALANCE_NODE=$BALANCE_BUNDLED_NODE
  else
    printf '%s\n' 'Для запуска нужен Node.js 20+. Укажите путь через NODE_BIN или установите Node.js.' >&2
    exit 1
  fi
fi
exec "$BALANCE_NODE" "$BALANCE_DIR/scripts/serve.mjs"
