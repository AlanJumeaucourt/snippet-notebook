#!/bin/sh
set -eu

CONF=/etc/coturn/turnserver.conf
TMP=/tmp/turnserver.conf

TURN_USERNAME="${TURN_USERNAME:-snippet}"
TURN_SECRET="${TURN_SECRET:-change-me}"
TURN_REALM="${TURN_REALM:-snippet-notebook}"
MIN_PORT="${MIN_PORT:-49160}"
MAX_PORT="${MAX_PORT:-49170}"

cp "$CONF" "$TMP"

sed -i "s|^user=snippet:change-me|user=${TURN_USERNAME}:${TURN_SECRET}|" "$TMP"
sed -i "s|^realm=snippet-notebook|realm=${TURN_REALM}|" "$TMP"
sed -i "s|^min-port=49160|min-port=${MIN_PORT}|" "$TMP"
sed -i "s|^max-port=49170|max-port=${MAX_PORT}|" "$TMP"

if [ -n "${TURN_EXTERNAL_IP:-}" ]; then
  if grep -q '^external-ip=' "$TMP"; then
    sed -i "s|^external-ip=.*|external-ip=${TURN_EXTERNAL_IP}|" "$TMP"
  else
    echo "external-ip=${TURN_EXTERNAL_IP}" >>"$TMP"
  fi
elif [ "${DETECT_EXTERNAL_IP:-}" = "yes" ] && command -v detect-external-ip >/dev/null 2>&1; then
  DETECTED="$(detect-external-ip 2>/dev/null || true)"
  if [ -n "$DETECTED" ]; then
    echo "external-ip=${DETECTED}" >>"$TMP"
  fi
fi

exec turnserver -c "$TMP" "$@"
