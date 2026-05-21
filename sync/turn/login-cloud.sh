#!/usr/bin/env bash
# Store Kraft Cloud credentials for kraft CLI (api.cloud.unikraft.io).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi
: "${UKC_TOKEN:?Set UKC_TOKEN in sync/turn/.env}"
PASS="$(printf '%s' "$UKC_TOKEN" | base64 -d | cut -d: -f2-)"
kraft login -t "$PASS" -u 'robot$alanjumeaucourt.users.kraftcloud' api.cloud.unikraft.io
echo "Logged in. Use: kraft cloud --metro fra instance list"
