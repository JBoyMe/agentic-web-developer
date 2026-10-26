#!/bin/sh
set -eu

# Render (and most bind-mount setups) hand the container a root-owned volume,
# while the app runs as the unprivileged `node` user. Without this the ledger
# cannot create credits.sqlite and the service dies at boot with EACCES.
#
# Only the mount root is chowned, not recursively: everything below it is
# created by the app as `node`, and a recursive chown on a volume holding
# hundreds of generated files would add minutes to every restart.
DATA="${DATA_DIR:-/data}"

if [ "$(id -u)" = "0" ]; then
  mkdir -p "$DATA"
  chown node:node "$DATA" 2>/dev/null || true
  exec su-exec node "$@"
fi

exec "$@"
