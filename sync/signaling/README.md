# y-webrtc signaling on Unikraft Cloud

Small WebSocket server (`y-webrtc-signaling`) so browsers can find each other. **No notebook data** is stored.

## Deploy

```sh
cd sync/signaling
cp .env.example .env   # or rely on sync/turn/.env for UKC_TOKEN
chmod +x deploy.sh
SIGNALING_BUILD=1 ./deploy.sh   # first time: build + push image
./deploy.sh                       # later: deploy existing image only
```

`deploy.sh` creates service `snippet-notebook-signaling` with `443:8080/tls+http` (HTTPS/WSS at the edge, Node on port 8080 inside — same pattern as [Unikraft’s node21-websocket example](https://unikraft.com/docs/guides/node21-websocket)).

## Frontend

```env
VITE_SYNC_SIGNALING_URLS=wss://snippet-notebook-signaling-XXXX.fra.unikraft.app
```

Restart Vite after changing env.

## Logs

```sh
source .env  # or ../turn/.env
kraft cloud --metro fra --token "$UKC_TOKEN" instance list
kraft cloud --metro fra --token "$UKC_TOKEN" instance logs <instance-name> -f
```

## Rebuild

```sh
SIGNALING_BUILD=1 ./deploy.sh
```
