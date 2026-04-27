#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_ROOT=${PROJECT_ROOT:-$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)}

cd "$PROJECT_ROOT"

PATH=${PATH:-/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin}
export PATH

load_env_file() {
  [ -f "$1" ] || return 0

  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      ''|'#'*) continue ;;
      export\ *) line=${line#export } ;;
    esac

    key=${line%%=*}
    [ "$key" != "$line" ] || continue

    value=${line#*=}
    key=$(printf '%s' "$key" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    value=$(printf '%s' "$value" | sed 's/\r$//')

    case "$key" in
      ''|[0-9]*|*[!A-Za-z0-9_]*)
        echo "Skipping invalid environment key '$key' from $1" >&2
        continue
        ;;
    esac

    case "$value" in
      \"*\")
        value=${value#\"}
        value=${value%\"}
        ;;
      \'*\')
        value=${value#\'}
        value=${value%\'}
        ;;
    esac

    export "$key=$value"
  done < "$1"
}

load_env_file "$PROJECT_ROOT/.env"
load_env_file "$PROJECT_ROOT/.env.local"
load_env_file "$PROJECT_ROOT/.env.production"
load_env_file "$PROJECT_ROOT/.env.production.local"

NODE_ENV=${NODE_ENV:-production}
SERVICE_HOST=${MACOS_SERVICE_HOST:-0.0.0.0}
HOSTNAME=$SERVICE_HOST
PORT=${PORT:-43210}
export NODE_ENV HOSTNAME PORT MACOS_SERVICE_HOST

PNPM_BIN=${PNPM_BIN:-}
if [ -z "$PNPM_BIN" ]; then
  PNPM_BIN=$(command -v pnpm || true)
fi

NODE_BIN=${NODE_BIN:-}
if [ -z "$NODE_BIN" ]; then
  NODE_BIN=$(command -v node || true)
fi

if [ ! -d "$PROJECT_ROOT/.next" ]; then
  echo "Missing .next build output in $PROJECT_ROOT. Run just deploy-macos first." >&2
  exit 1
fi

if [ -f "$PROJECT_ROOT/.next/standalone/server.js" ]; then
  if [ -z "$NODE_BIN" ]; then
    echo "node was not found. Set NODE_BIN in the launchd plist or install Node.js on this host." >&2
    exit 127
  fi

  exec "$NODE_BIN" "$PROJECT_ROOT/.next/standalone/server.js"
fi

if [ -z "$PNPM_BIN" ]; then
  echo "pnpm was not found. Set PNPM_BIN in the launchd plist or install pnpm on this host." >&2
  exit 127
fi

exec "$PNPM_BIN" start
