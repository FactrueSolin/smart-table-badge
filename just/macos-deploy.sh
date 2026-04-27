#!/bin/sh
set -eu

ACTION=${1:-install}
APP_SLUG=${MACOS_SERVICE_SLUG:-smart-table-badge}
LABEL=${MACOS_SERVICE_LABEL:-com.factrue.smart-table-badge}
SCOPE=${MACOS_SERVICE_SCOPE:-system}
PORT=${PORT:-43210}
HOSTNAME=${HOSTNAME:-0.0.0.0}
NODE_ENV=${NODE_ENV:-production}
SKIP_INSTALL=${MACOS_DEPLOY_SKIP_INSTALL:-0}
SKIP_CHECKS=${MACOS_DEPLOY_SKIP_CHECKS:-0}
SKIP_BUILD=${MACOS_DEPLOY_SKIP_BUILD:-0}

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_ROOT=${PROJECT_ROOT:-$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)}
RUN_SCRIPT="$PROJECT_ROOT/just/macos-service-run.sh"

die() {
  echo "error: $*" >&2
  exit 1
}

usage() {
  cat <<EOF
Usage: just/macos-deploy.sh <install|restart|status|logs|uninstall>

Environment overrides:
  MACOS_SERVICE_SCOPE=user|system        default: system
  MACOS_SERVICE_LABEL=<launchd-label>    default: $LABEL
  MACOS_SERVICE_SLUG=<name>              default: $APP_SLUG
  MACOS_SERVICE_USER=<mac-user>          default: current user
  PORT=<port>                            default: 43210
  HOSTNAME=<bind-host>                   default: 0.0.0.0
  NODE_BIN=<absolute-node-path>           default: command -v node
  PNPM_BIN=<absolute-pnpm-path>          default: command -v pnpm
  MACOS_DEPLOY_SKIP_INSTALL=1            skip pnpm install
  MACOS_DEPLOY_SKIP_CHECKS=1             skip typecheck/lint/test
  MACOS_DEPLOY_SKIP_BUILD=1              skip pnpm build
EOF
}

require_macos() {
  [ "$(uname -s)" = "Darwin" ] || die "macOS launchd deployment only works on Darwin hosts"
}

normalize_scope() {
  case "$SCOPE" in
    system|daemon) SCOPE=system ;;
    user|agent) SCOPE=user ;;
    *) die "MACOS_SERVICE_SCOPE must be 'system' or 'user'" ;;
  esac
}

default_service_user() {
  if [ "$(id -u)" -eq 0 ] && [ -n "${SUDO_USER:-}" ] && [ "${SUDO_USER:-}" != "root" ]; then
    printf '%s\n' "$SUDO_USER"
  else
    id -un
  fi
}

SERVICE_USER=${MACOS_SERVICE_USER:-$(default_service_user)}
SERVICE_GROUP=${MACOS_SERVICE_GROUP:-$(id -gn "$SERVICE_USER" 2>/dev/null || printf '%s\n' staff)}

PNPM_BIN=${PNPM_BIN:-$(command -v pnpm || true)}
NODE_BIN=${NODE_BIN:-$(command -v node || true)}
PATH_VALUE=${MACOS_SERVICE_PATH:-/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin}

xml_escape() {
  printf '%s' "$1" | sed \
    -e 's/&/\&amp;/g' \
    -e 's/</\&lt;/g' \
    -e 's/>/\&gt;/g' \
    -e 's/"/\&quot;/g' \
    -e "s/'/\&apos;/g"
}

run_root() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  else
    sudo "$@"
  fi
}

bootstrap_domain() {
  if [ "$SCOPE" = "system" ]; then
    printf '%s\n' system
  else
    printf 'gui/%s\n' "$(id -u)"
  fi
}

service_target() {
  if [ "$SCOPE" = "system" ]; then
    printf 'system/%s\n' "$LABEL"
  else
    printf 'gui/%s/%s\n' "$(id -u)" "$LABEL"
  fi
}

plist_path() {
  if [ "$SCOPE" = "system" ]; then
    printf '/Library/LaunchDaemons/%s.plist\n' "$LABEL"
  else
    printf '%s/Library/LaunchAgents/%s.plist\n' "$HOME" "$LABEL"
  fi
}

log_dir() {
  if [ -n "${MACOS_SERVICE_LOG_DIR:-}" ]; then
    printf '%s\n' "$MACOS_SERVICE_LOG_DIR"
  elif [ "$SCOPE" = "system" ]; then
    printf '/var/log/%s\n' "$APP_SLUG"
  else
    printf '%s/Library/Logs/%s\n' "$HOME" "$APP_SLUG"
  fi
}

stdout_log() {
  printf '%s/%s.out.log\n' "$(log_dir)" "$APP_SLUG"
}

stderr_log() {
  printf '%s/%s.err.log\n' "$(log_dir)" "$APP_SLUG"
}

require_pnpm() {
  [ -n "$PNPM_BIN" ] || die "pnpm was not found. Install pnpm or set PNPM_BIN=/absolute/path/to/pnpm"
}

sync_standalone_assets() {
  cd "$PROJECT_ROOT"

  if [ ! -f ".next/standalone/server.js" ]; then
    return 0
  fi

  mkdir -p ".next/standalone/.next"

  if [ -d "public" ]; then
    rm -rf ".next/standalone/public"
    cp -R "public" ".next/standalone/public"
  fi

  if [ -d ".next/static" ]; then
    rm -rf ".next/standalone/.next/static"
    cp -R ".next/static" ".next/standalone/.next/static"
  fi

  if [ -d "data" ]; then
    rm -rf ".next/standalone/data"
    ln -s "$PROJECT_ROOT/data" ".next/standalone/data"
  fi

  if [ -d "docs" ]; then
    rm -rf ".next/standalone/docs"
    ln -s "$PROJECT_ROOT/docs" ".next/standalone/docs"
  fi
}

prepare_project() {
  require_pnpm
  cd "$PROJECT_ROOT"

  if [ "$SKIP_INSTALL" != "1" ]; then
    "$PNPM_BIN" install --frozen-lockfile
  fi

  if [ "$SKIP_CHECKS" != "1" ]; then
    "$PNPM_BIN" typecheck
    "$PNPM_BIN" lint
    "$PNPM_BIN" test
  fi

  if [ "$SKIP_BUILD" != "1" ]; then
    "$PNPM_BIN" build
  fi

  sync_standalone_assets
}

write_plist() {
  tmp_file=$1
  escaped_label=$(xml_escape "$LABEL")
  escaped_project_root=$(xml_escape "$PROJECT_ROOT")
  escaped_run_script=$(xml_escape "$RUN_SCRIPT")
  escaped_pnpm_bin=$(xml_escape "$PNPM_BIN")
  escaped_node_bin=$(xml_escape "$NODE_BIN")
  escaped_port=$(xml_escape "$PORT")
  escaped_hostname=$(xml_escape "$HOSTNAME")
  escaped_node_env=$(xml_escape "$NODE_ENV")
  escaped_path=$(xml_escape "$PATH_VALUE")
  escaped_stdout=$(xml_escape "$(stdout_log)")
  escaped_stderr=$(xml_escape "$(stderr_log)")
  escaped_user=$(xml_escape "$SERVICE_USER")
  escaped_group=$(xml_escape "$SERVICE_GROUP")

  {
    printf '%s\n' '<?xml version="1.0" encoding="UTF-8"?>'
    printf '%s\n' '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "https://www.apple.com/DTDs/PropertyList-1.0.dtd">'
    printf '%s\n' '<plist version="1.0">'
    printf '%s\n' '<dict>'
    printf '  <key>Label</key><string>%s</string>\n' "$escaped_label"
    if [ "$SCOPE" = "system" ]; then
      printf '  <key>UserName</key><string>%s</string>\n' "$escaped_user"
      printf '  <key>GroupName</key><string>%s</string>\n' "$escaped_group"
    fi
    printf '  <key>WorkingDirectory</key><string>%s</string>\n' "$escaped_project_root"
    printf '%s\n' '  <key>ProgramArguments</key>'
    printf '%s\n' '  <array>'
    printf '    <string>%s</string>\n' "$escaped_run_script"
    printf '%s\n' '  </array>'
    printf '%s\n' '  <key>EnvironmentVariables</key>'
    printf '%s\n' '  <dict>'
    printf '    <key>PROJECT_ROOT</key><string>%s</string>\n' "$escaped_project_root"
    printf '    <key>PNPM_BIN</key><string>%s</string>\n' "$escaped_pnpm_bin"
    printf '    <key>NODE_BIN</key><string>%s</string>\n' "$escaped_node_bin"
    printf '    <key>PORT</key><string>%s</string>\n' "$escaped_port"
    printf '    <key>HOSTNAME</key><string>%s</string>\n' "$escaped_hostname"
    printf '    <key>NODE_ENV</key><string>%s</string>\n' "$escaped_node_env"
    printf '    <key>PATH</key><string>%s</string>\n' "$escaped_path"
    printf '%s\n' '  </dict>'
    printf '%s\n' '  <key>RunAtLoad</key><true/>'
    printf '%s\n' '  <key>KeepAlive</key><true/>'
    printf '%s\n' '  <key>StandardOutPath</key><string>'"$escaped_stdout"'</string>'
    printf '%s\n' '  <key>StandardErrorPath</key><string>'"$escaped_stderr"'</string>'
    printf '%s\n' '</dict>'
    printf '%s\n' '</plist>'
  } > "$tmp_file"
}

prepare_logs() {
  dir=$(log_dir)
  out=$(stdout_log)
  err=$(stderr_log)

  if [ "$SCOPE" = "system" ]; then
    run_root mkdir -p "$dir"
    run_root touch "$out" "$err"
    run_root chown -R "$SERVICE_USER:$SERVICE_GROUP" "$dir"
    run_root chmod 755 "$dir"
  else
    mkdir -p "$dir"
    touch "$out" "$err"
  fi
}

install_plist() {
  target_plist=$(plist_path)
  tmp_file=$(mktemp "/tmp/$LABEL.XXXXXX.plist")
  write_plist "$tmp_file"

  if command -v plutil >/dev/null 2>&1; then
    plutil -lint "$tmp_file" >/dev/null
  fi

  prepare_logs

  if [ "$SCOPE" = "system" ]; then
    run_root launchctl bootout "$(bootstrap_domain)" "$target_plist" >/dev/null 2>&1 || true
    run_root cp "$tmp_file" "$target_plist"
    run_root chown root:wheel "$target_plist"
    run_root chmod 644 "$target_plist"
    run_root launchctl bootstrap "$(bootstrap_domain)" "$target_plist"
    run_root launchctl enable "$(service_target)"
    run_root launchctl kickstart -k "$(service_target)"
  else
    mkdir -p "$(dirname "$target_plist")"
    launchctl bootout "$(bootstrap_domain)" "$target_plist" >/dev/null 2>&1 || true
    cp "$tmp_file" "$target_plist"
    chmod 644 "$target_plist"
    launchctl bootstrap "$(bootstrap_domain)" "$target_plist"
    launchctl enable "$(service_target)"
    launchctl kickstart -k "$(service_target)"
  fi

  rm -f "$tmp_file"
}

install_service() {
  require_macos
  normalize_scope
  [ -x "$RUN_SCRIPT" ] || die "$RUN_SCRIPT must be executable"

  echo "Deploying $LABEL from $PROJECT_ROOT"
  echo "Scope: $SCOPE, user: $SERVICE_USER, port: $PORT"
  prepare_project
  install_plist
  echo "Deployed. Service target: $(service_target)"
  echo "Logs: $(stdout_log) and $(stderr_log)"
}

restart_service() {
  require_macos
  normalize_scope
  if [ "$SCOPE" = "system" ]; then
    run_root launchctl kickstart -k "$(service_target)"
  else
    launchctl kickstart -k "$(service_target)"
  fi
}

status_service() {
  require_macos
  normalize_scope
  echo "Label: $LABEL"
  echo "Scope: $SCOPE"
  echo "Plist: $(plist_path)"
  echo "Target: $(service_target)"
  if [ "$SCOPE" = "system" ]; then
    run_root launchctl print "$(service_target)" | sed -n '1,140p'
  else
    launchctl print "$(service_target)" | sed -n '1,140p'
  fi
}

logs_service() {
  normalize_scope
  out=$(stdout_log)
  err=$(stderr_log)
  if [ "${FOLLOW:-0}" = "1" ]; then
    tail -f "$out" "$err"
  else
    tail -n "${LINES:-120}" "$out" "$err"
  fi
}

uninstall_service() {
  require_macos
  normalize_scope
  target_plist=$(plist_path)

  if [ "$SCOPE" = "system" ]; then
    run_root launchctl bootout "$(bootstrap_domain)" "$target_plist" >/dev/null 2>&1 || true
    run_root rm -f "$target_plist"
  else
    launchctl bootout "$(bootstrap_domain)" "$target_plist" >/dev/null 2>&1 || true
    rm -f "$target_plist"
  fi

  echo "Uninstalled $LABEL from $SCOPE launchd scope."
}

case "$ACTION" in
  install|deploy) install_service ;;
  restart) restart_service ;;
  status) status_service ;;
  logs) logs_service ;;
  uninstall|remove) uninstall_service ;;
  help|-h|--help) usage ;;
  *) usage >&2; exit 64 ;;
esac
