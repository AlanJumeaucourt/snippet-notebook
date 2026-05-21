#!/usr/bin/env bash
# Build (optional) and deploy coturn on Unikraft Cloud.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

: "${UKC_TOKEN:?Set UKC_TOKEN in sync/turn/.env}"
: "${TURN_SERVICE_NAME:=snippet-notebook-turn}"
: "${TURN_USERNAME:=snippet}"
: "${TURN_SECRET:?Set TURN_SECRET in sync/turn/.env}"
: "${TURN_REALM:=snippet-notebook}"

UKC_METRO="${UKC_METRO:-fra}"
# fra0 is invalid on current Kraft Cloud; metro list uses fra, dal, sin, ...
if [[ "$UKC_METRO" == fra0 ]]; then
  UKC_METRO=fra
fi

export UKC_TOKEN UKC_METRO

KRAFT=(kraft cloud --metro "$UKC_METRO" --token "$UKC_TOKEN")

RELAY_PORTS=()
for p in $(seq 49160 49170); do
  RELAY_PORTS+=("${p}:${p}/tls")
done

echo "==> Ensure persistent service: $TURN_SERVICE_NAME"
if ! "${KRAFT[@]}" service get "$TURN_SERVICE_NAME" >/dev/null 2>&1; then
  "${KRAFT[@]}" service create -n "$TURN_SERVICE_NAME" 3478:3478/tls "${RELAY_PORTS[@]}"
else
  echo "    Service already exists (skipping create)."
fi

TURN_EXTERNAL_IP="${TURN_UDP_PUBLIC_IP:-}"
if [[ -z "$TURN_EXTERNAL_IP" ]]; then
  TURN_EXTERNAL_IP="$("${KRAFT[@]}" metro list -o json 2>/dev/null \
    | python3 -c "import json,sys,os; m=os.environ.get('UKC_METRO','fra');
data=json.load(sys.stdin);
print(next((x['ipv4'] for x in data if x['code']==m), ''))" 2>/dev/null || true)"
  if [[ -n "$TURN_EXTERNAL_IP" ]]; then
    echo "==> Using metro IPv4 as TURN_EXTERNAL_IP: $TURN_EXTERNAL_IP (set TURN_UDP_PUBLIC_IP for dedicated UDP)"
  fi
fi

IMAGE="${TURN_IMAGE:-alanjumeaucourt/snippet-turn:latest}"
BUILD="${TURN_BUILD:-0}"

if [[ "$BUILD" == 1 ]]; then
  echo "==> Build and push image from Kraftfile (context: $ROOT)"
  (cd "$ROOT" && "${KRAFT[@]}" deploy -i alanjumeaucourt/snippet-turn:latest -M 512M --no-start .)
  IMAGE="alanjumeaucourt/snippet-turn:latest"
fi

echo "==> Deploy instance (image: $IMAGE)"
ENV_ARGS=(
  -e "TURN_USERNAME=${TURN_USERNAME}"
  -e "TURN_SECRET=${TURN_SECRET}"
  -e "TURN_REALM=${TURN_REALM}"
)
if [[ -n "$TURN_EXTERNAL_IP" ]]; then
  ENV_ARGS+=(-e "TURN_EXTERNAL_IP=${TURN_EXTERNAL_IP}")
fi

# Deploy from a neutral cwd so Kraftfile in this directory is not picked up as context.
( cd /tmp && "${KRAFT[@]}" instance create -S \
  -g "$TURN_SERVICE_NAME" \
  -M 512M \
  -V 1 \
  --restart always \
  "${ENV_ARGS[@]}" \
  "$IMAGE" )

echo ""
echo "==> Service"
"${KRAFT[@]}" service get "$TURN_SERVICE_NAME" -o table

echo ""
echo "Frontend (.env.local) — TCP/TLS path via *.unikraft.app:"
FQDN="$("${KRAFT[@]}" service get "$TURN_SERVICE_NAME" -o json | sed -n 's/.*"fqdn":"\([^"]*\)".*/\1/p' | head -1)"
if [[ -n "$FQDN" ]]; then
  cat <<EOF
VITE_SYNC_TURN_URLS=turn:${FQDN}:3478?transport=tcp
VITE_SYNC_TURN_USERNAME=${TURN_USERNAME}
VITE_SYNC_TURN_CREDENTIAL=${TURN_SECRET}
EOF
fi
echo ""
echo "For UDP relay, set TURN_UDP_PUBLIC_IP in .env and run: ./create-udp-service.sh"
