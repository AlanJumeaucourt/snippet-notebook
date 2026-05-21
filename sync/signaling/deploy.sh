#!/usr/bin/env bash
# Build (optional) and deploy y-webrtc signaling on Unikraft Cloud.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
elif [[ -f ../turn/.env ]]; then
  set -a
  # shellcheck disable=SC1091
  source ../turn/.env
  set +a
fi

: "${UKC_TOKEN:?Set UKC_TOKEN in sync/signaling/.env or sync/turn/.env}"

: "${SIGNALING_SERVICE_NAME:=snippet-notebook-signaling}"
: "${SIGNALING_IMAGE:=alanjumeaucourt/snippet-signaling:latest}"
: "${SIGNALING_IMAGE_BUILD:=alanjumeaucourt/snippet-signaling}"

UKC_METRO="${UKC_METRO:-fra}"
if [[ "$UKC_METRO" == fra0 ]]; then
  UKC_METRO=fra
fi

export UKC_TOKEN UKC_METRO

KRAFT=(kraft cloud --metro "$UKC_METRO" --token "$UKC_TOKEN")

# TLS at edge; plain HTTP + WebSocket upgrade inside on 8080 (Unikraft node examples).
EXTERNAL_PORT="${SIGNALING_EXTERNAL_PORT:-443}"
INTERNAL_PORT="${SIGNALING_PORT:-8080}"
PORT_MAP="${EXTERNAL_PORT}:${INTERNAL_PORT}/tls+http"

echo "==> Ensure persistent service: $SIGNALING_SERVICE_NAME ($PORT_MAP)"
if ! "${KRAFT[@]}" service get "$SIGNALING_SERVICE_NAME" >/dev/null 2>&1; then
  "${KRAFT[@]}" service create -n "$SIGNALING_SERVICE_NAME" "$PORT_MAP"
else
  EXISTING="$("${KRAFT[@]}" service get "$SIGNALING_SERVICE_NAME" -o json | sed -n 's/.*"services":"\([^"]*\)".*/\1/p' | head -1)"
  if [[ "$EXISTING" != *"$PORT_MAP"* ]]; then
    echo "    Warning: service exists with mappings ($EXISTING), expected ($PORT_MAP)."
    echo "    Delete and recreate the service in the console if deploy fails."
  fi
fi

BUILD="${SIGNALING_BUILD:-0}"
IMAGE="$SIGNALING_IMAGE"

if [[ "$BUILD" == 1 ]]; then
  echo "==> Build and push image (context: $ROOT)"
  (cd "$ROOT" && "${KRAFT[@]}" deploy -i "$SIGNALING_IMAGE_BUILD" -M 512M --no-start .)
fi

echo "==> Deploy instance (image: $IMAGE)"
( cd /tmp && "${KRAFT[@]}" instance create -S \
  -g "$SIGNALING_SERVICE_NAME" \
  -M 512M \
  -V 1 \
  --restart always \
  -e "PORT=${INTERNAL_PORT}" \
  "$IMAGE" )

echo ""
echo "==> Service"
"${KRAFT[@]}" service get "$SIGNALING_SERVICE_NAME" -o table

FQDN="$("${KRAFT[@]}" service get "$SIGNALING_SERVICE_NAME" -o json \
  | sed -n 's/.*"fqdn":"\([^"]*\)".*/\1/p' | head -1)"
if [[ -n "$FQDN" ]]; then
  echo ""
  echo "Frontend (.env.local):"
  if [[ "$EXTERNAL_PORT" == 443 ]]; then
    echo "VITE_SYNC_SIGNALING_URLS=wss://${FQDN}"
  else
    echo "VITE_SYNC_SIGNALING_URLS=wss://${FQDN}:${EXTERNAL_PORT}"
  fi
fi
