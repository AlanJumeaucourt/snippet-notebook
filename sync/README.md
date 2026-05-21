# Snippet Notebook — P2P sync

Realtime sync uses **Yjs** over **WebRTC** (`y-webrtc`). Your markdown never lands on a sync database — only:

1. **Signaling** — small WebSocket service to exchange connection metadata (SDP/ICE).
2. **TURN** (optional but recommended) — relays encrypted packets when direct P2P fails; does not store the notebook.

The browser app encrypts the room with the **passphrase** (`y-webrtc` `password` option).

## Deploy signaling

```sh
cd sync/signaling
bun install   # or npm install
PORT=4444 bun run start
```

Point the frontend at it (`frontend/.env.local`):

```env
VITE_SYNC_SIGNALING_URLS=wss://signaling.your-domain:4444
```

Put TLS in front (Caddy/nginx) for production `wss://`.

## Deploy TURN on Unikraft Cloud (recommended)

```sh
cd sync/turn
cp .env.example .env   # UKC_TOKEN, TURN_SECRET, UKC_METRO=fra
./deploy.sh
```

See [`sync/turn/README.md`](turn/README.md) for UDP IP requirements, logs, and rebuild (`TURN_BUILD=1`).

After deploy, point the frontend at the service FQDN (TCP/TLS path):

```env
VITE_SYNC_TURN_URLS=turn:snippet-notebook-turn-uc3glm0u.fra.unikraft.app:3478?transport=tcp
VITE_SYNC_TURN_USERNAME=snippet
VITE_SYNC_TURN_CREDENTIAL=YOUR_LONG_SECRET
```

For **UDP relay**, set `TURN_UDP_PUBLIC_IP` in `sync/turn/.env` (dedicated IP from Unikraft) and run `./create-udp-service.sh`.

## Usage

1. Open the app on laptop A → sidebar **Sync** → room name + passphrase → **Connect**.
2. Same room + passphrase on laptop B.
3. Status shows **Live · N peers** when WebRTC is up. Edits sync in realtime; each device also keeps an IndexedDB copy of the room doc.

**Pause sync** disconnects WebRTC but keeps the room id. **Leave room** clears saved room on this device.

Passphrase is kept in `sessionStorage` for reload in the same tab only.

## Security notes

- Choose a strong passphrase; it keys encryption on the wire.
- Room name is hashed before joining the WebRTC room (passphrase is not sent to signaling as plain room id).
- Sync still contains secrets (`vars` values) — treat the passphrase like a vault password.
