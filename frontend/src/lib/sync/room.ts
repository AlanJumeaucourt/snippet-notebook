const ROOM_STORAGE_KEY = "snippet-notebook-sync-room";
const PASS_SESSION_KEY = "snippet-notebook-sync-pass";

/** Opaque WebRTC room name — not the human-readable room id. */
export async function deriveRoomName(roomId: string, passphrase: string): Promise<string> {
  const payload = new TextEncoder().encode(`${roomId.trim()}\n${passphrase}`);
  const hash = await crypto.subtle.digest("SHA-256", payload);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function saveSyncRoomId(roomId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ROOM_STORAGE_KEY, roomId.trim());
}

export function loadSyncRoomId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ROOM_STORAGE_KEY);
}

export function clearSyncRoomId(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ROOM_STORAGE_KEY);
}

export function saveSyncPassphrase(passphrase: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(PASS_SESSION_KEY, passphrase);
}

export function loadSyncPassphrase(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(PASS_SESSION_KEY);
}

export function clearSyncPassphrase(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(PASS_SESSION_KEY);
}
