export type SyncConfig = {
  signaling: string[];
  iceServers: RTCIceServer[];
};

function splitUrls(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Client sync settings from Vite env (see frontend/.env.example). */
export function getSyncConfig(): SyncConfig {
  const signaling = splitUrls(import.meta.env.VITE_SYNC_SIGNALING_URLS);
  const stunUrls = splitUrls(
    import.meta.env.VITE_SYNC_STUN_URLS ?? "stun:stun.l.google.com:19302",
  );
  const turnUrls = splitUrls(import.meta.env.VITE_SYNC_TURN_URLS);
  const turnUser = import.meta.env.VITE_SYNC_TURN_USERNAME?.trim() ?? "";
  const turnCred = import.meta.env.VITE_SYNC_TURN_CREDENTIAL?.trim() ?? "";

  const iceServers: RTCIceServer[] = [];
  if (stunUrls.length > 0) {
    iceServers.push({ urls: stunUrls.length === 1 ? stunUrls[0]! : stunUrls });
  }
  if (turnUrls.length > 0) {
    iceServers.push({
      urls: turnUrls.length === 1 ? turnUrls[0]! : turnUrls,
      ...(turnUser ? { username: turnUser } : {}),
      ...(turnCred ? { credential: turnCred } : {}),
    });
  }

  return {
    signaling: signaling.length > 0 ? signaling : ["wss://localhost:4444"],
    iceServers,
  };
}

export function isSyncConfigured(): boolean {
  return getSyncConfig().signaling.length > 0;
}
