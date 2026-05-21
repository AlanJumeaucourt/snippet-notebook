#!/usr/bin/env bash
# Add UDP port mappings to the TURN service (requires dedicated UDP IP on your account).
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
: "${TURN_UDP_PUBLIC_IP:?Set TURN_UDP_PUBLIC_IP in .env (dedicated UDP IP from Unikraft)}"

UKC_METRO="${UKC_METRO:-fra}"
[[ "$UKC_METRO" == fra0 ]] && UKC_METRO=fra

export UKC_TOKEN UKC_METRO

echo "UDP services on Kraft Cloud must include your assigned public IP."
echo "Service: $TURN_SERVICE_NAME  IP: $TURN_UDP_PUBLIC_IP  metro: $UKC_METRO"
echo ""
echo "If kraft cloud service create does not support UDP yet, open the Kraft Cloud"
echo "console or API (POST /services) with protocol=udp and ip=$TURN_UDP_PUBLIC_IP"
echo "for ports 3478 and 49160-49170 (destination same ports on the instance)."
echo ""
echo "Contact Unikraft support to enable UDP addresses on your account if missing."

# Attempt REST API when curl can reach the control plane.
API="${UKC_API_ENDPOINT:-https://api.cloud.unikraft.io}"
USER="${UKC_API_USER:-robot\$alanjumeaucourt.users.kraftcloud}"
PASS="${UKC_API_PASSWORD:-}"

if [[ -z "$PASS" && -n "${UKC_TOKEN:-}" ]]; then
  PASS="$(printf '%s' "$UKC_TOKEN" | base64 -d | cut -d: -f2-)"
fi

build_services_json() {
  local ports=("$@")
  local first=1
  printf '{"services":['
  for spec in "${ports[@]}"; do
    local ext="${spec%%:*}"
    local rest="${spec#*:}"
    local dest="${rest%%/*}"
    [[ $first -eq 0 ]] && printf ','
    first=0
    printf '{"port":%s,"destination_port":%s,"protocol":"udp","ip":"%s"}' \
      "$ext" "$dest" "$TURN_UDP_PUBLIC_IP"
  done
  printf ']}'
}

PORTS=(3478:3478)
for p in $(seq 49160 49170); do
  PORTS+=("${p}:${p}")
done

BODY="$(build_services_json "${PORTS[@]}")"

if command -v curl >/dev/null 2>&1; then
  echo "Trying PATCH $API/v1/services/$TURN_SERVICE_NAME ..."
  if curl -fsS -X PATCH \
    -u "${USER}:${PASS}" \
    -H "Content-Type: application/json" \
    -d "$BODY" \
    "$API/v1/services/${TURN_SERVICE_NAME}?metro=${UKC_METRO}" 2>/dev/null; then
    echo ""
    echo "UDP mappings updated."
    exit 0
  fi
  echo "API call failed (network or UDP not enabled on account). Configure UDP manually."
fi

exit 1
