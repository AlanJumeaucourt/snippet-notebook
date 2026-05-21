import * as React from "react";
import { NotebookSyncSession, type NotebookCollab } from "~/lib/sync/session";
import {
  clearSyncPassphrase,
  clearSyncRoomId,
  loadSyncPassphrase,
  loadSyncRoomId,
  saveSyncPassphrase,
  saveSyncRoomId,
} from "~/lib/sync/room";

export type SyncStatus = "off" | "connecting" | "on";

export function useNotebookSync(
  getLocalDocument: () => string,
  options?: { enabled?: boolean },
) {
  const enabled = options?.enabled !== false;
  const sessionRef = React.useRef<NotebookSyncSession | null>(null);
  const [status, setStatus] = React.useState<SyncStatus>("off");
  const [roomId, setRoomId] = React.useState(() => loadSyncRoomId() ?? "");
  const [collab, setCollab] = React.useState<NotebookCollab | null>(null);
  const [webrtcConnected, setWebrtcConnected] = React.useState(false);
  const [synced, setSynced] = React.useState(false);
  const [peerCount, setPeerCount] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);

  const refreshPeerCount = React.useCallback(() => {
    const session = sessionRef.current;
    if (!session) {
      setPeerCount(0);
      return;
    }
    setPeerCount(session.getPeers());
  }, []);

  const disconnect = React.useCallback(() => {
    sessionRef.current?.destroy();
    sessionRef.current = null;
    setCollab(null);
    setStatus("off");
    setWebrtcConnected(false);
    setSynced(false);
    setPeerCount(0);
    setError(null);
    clearSyncPassphrase();
  }, []);

  const connect = React.useCallback(
    async (nextRoomId: string, passphrase: string) => {
      const trimmedRoom = nextRoomId.trim();
      if (!trimmedRoom) {
        setError("Enter a room name.");
        return;
      }
      if (!passphrase) {
        setError("Enter a passphrase (encrypts sync; never sent to a datastore).");
        return;
      }

      setError(null);
      setStatus("connecting");
      setRoomId(trimmedRoom);
      saveSyncRoomId(trimmedRoom);
      saveSyncPassphrase(passphrase);

      if (sessionRef.current) {
        sessionRef.current.destroy();
        sessionRef.current = null;
      }

      try {
        const session = new NotebookSyncSession();
        sessionRef.current = session;

        await session.start(trimmedRoom, passphrase, getLocalDocument());

        const provider = session.provider;
        if (!provider) throw new Error("Sync provider failed to start.");

        provider.on("status", ({ connected }: { connected: boolean }) => {
          setWebrtcConnected(connected);
        });
        provider.on("synced", ({ synced: isSynced }: { synced: boolean }) => {
          setSynced(isSynced);
        });
        provider.on("peers", () => refreshPeerCount());

        setWebrtcConnected(provider.connected);
        setSynced(false);
        refreshPeerCount();
        setCollab(session.getCollab());
        setStatus("on");
      } catch (e) {
        sessionRef.current?.destroy();
        sessionRef.current = null;
        setCollab(null);
        setStatus("off");
        setError(e instanceof Error ? e.message : "Could not start sync.");
      }
    },
    [getLocalDocument, refreshPeerCount],
  );

  const autoConnectDone = React.useRef(false);
  React.useEffect(() => {
    if (!enabled || autoConnectDone.current) return;
    autoConnectDone.current = true;
    const savedRoom = loadSyncRoomId();
    const savedPass = loadSyncPassphrase();
    if (!savedRoom || !savedPass) return;
    setRoomId(savedRoom);
    void connect(savedRoom, savedPass);
  }, [connect, enabled]);

  React.useEffect(() => {
    if (status !== "on") return;
    const id = window.setInterval(refreshPeerCount, 2000);
    return () => window.clearInterval(id);
  }, [status, refreshPeerCount]);

  const leave = React.useCallback(() => {
    disconnect();
    clearSyncRoomId();
    setRoomId("");
  }, [disconnect]);

  return {
    status,
    roomId,
    setRoomId,
    collab,
    webrtcConnected,
    synced,
    peerCount,
    error,
    connect,
    disconnect,
    leave,
    active: status === "on" && collab != null,
  };
}
