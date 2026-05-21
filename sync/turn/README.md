# Coturn on Unikraft Cloud

WebRTC TURN relay for Snippet Notebook sync. **No notebook data** is stored on this VM.

## Prerequisites

- [`kraft`](https://unikraft.org/docs/cli) CLI logged in or `UKC_TOKEN` in `.env`
- Copy `.env.example` → `.env` and set `TURN_SECRET`, `UKC_TOKEN`
- Metro **`fra`** (not `fra0`)

## Deploy

```sh
cd sync/turn
cp .env.example .env   # if needed
chmod +x deploy.sh create-udp-service.sh
./deploy.sh
```

Rebuild image from Dockerfile:

```sh
TURN_BUILD=1 ./deploy.sh
```

`deploy.sh` will:

1. Create persistent service `snippet-notebook-turn` with TCP port `3478` and relay ports `49160–49170` (TLS handler — Kraft Cloud’s TCP mode)
2. Deploy `alanjumeaucourt/snippet-turn:latest` with your credentials
3. Print suggested `VITE_SYNC_TURN_*` lines for `frontend/.env.local`

## UDP (recommended for WebRTC)

Unikraft Cloud UDP requires a **dedicated public IP** on your account (`TURN_UDP_PUBLIC_IP`), not only the `*.unikraft.app` hostname.

1. Get the IP from Unikraft (support / console `users.json` addresses).
2. Set `TURN_UDP_PUBLIC_IP=` in `.env`
3. Run `./create-udp-service.sh` or add UDP mappings in the console/API
4. Point the frontend at:

```env
VITE_SYNC_TURN_URLS=turn:YOUR_UDP_IP:3478?transport=udp,turn:YOUR_UDP_IP:3478?transport=tcp
```

## Logs

```sh
source .env
kraft cloud --metro fra --token "$UKC_TOKEN" instance list
kraft cloud --metro fra --token "$UKC_TOKEN" instance logs <instance-name> -f
```

## Security

- Rotate `UKC_TOKEN` if it was exposed in chat or logs
- Use a long `TURN_SECRET`; match `frontend` `VITE_SYNC_TURN_CREDENTIAL`
