import * as React from "react";
import type { useNotebookSync } from "~/hooks/useNotebookSync";

type SyncApi = ReturnType<typeof useNotebookSync>;

export function MobileSyncBadge({ sync }: { sync: SyncApi }) {
  if (sync.status === "off") {
    return <span className="text-[10px] text-(--text-muted)">Sync off</span>;
  }
  const live = sync.status === "on" && sync.peerCount > 0;
  return (
    <span
      className={`text-[10px] font-medium ${live ? "text-(--green)" : "text-(--cyan)"}`}
      title={sync.roomId}
    >
      {sync.status === "connecting" ? "Sync…" : live ? `Live (${sync.peerCount})` : "Waiting…"}
    </span>
  );
}

export function SyncPanel({ sync }: { sync: SyncApi }) {
  const [open, setOpen] = React.useState(false);
  const [passphrase, setPassphrase] = React.useState("");
  const [showPass, setShowPass] = React.useState(false);

  const statusLabel =
    sync.status === "connecting"
      ? "Connecting…"
      : sync.status === "on"
        ? sync.peerCount > 0
          ? `Live · ${sync.peerCount} peer${sync.peerCount === 1 ? "" : "s"}`
          : sync.webrtcConnected
            ? "Waiting for peer…"
            : "Signaling…"
        : "Offline";

  const statusColor =
    sync.status === "on" && sync.peerCount > 0
      ? "text-(--green)"
      : sync.status === "on"
        ? "text-(--cyan)"
        : "text-(--text-muted)";

  const onConnect = (e: React.FormEvent) => {
    e.preventDefault();
    void sync.connect(sync.roomId, passphrase);
  };

  return (
    <div className="border-t border-(--border)">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-2 py-2 flex items-center gap-2 text-left hover:bg-(--hover) transition-colors"
        aria-expanded={open}
      >
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${
            sync.status === "on" && sync.peerCount > 0
              ? "bg-(--green) shadow-[0_0_8px_var(--green)]"
              : sync.status === "on"
                ? "bg-(--cyan)"
                : "bg-(--text-muted)"
          }`}
          aria-hidden
        />
        <span className="flex-1 min-w-0">
          <span className="block text-[10px] uppercase tracking-wider text-(--text-muted)">
            Sync
          </span>
          <span className={`block text-xs truncate ${statusColor}`}>{statusLabel}</span>
        </span>
        <span className="text-(--text-muted) text-xs" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
      </button>

      {open && (
        <div className="px-2 pb-2 space-y-2">
          <p className="text-[10px] text-(--text-muted) leading-snug">
            Peer-to-peer via WebRTC. Your notebook is not stored on a sync server — only signaling
            and optional TURN on your infra.
          </p>

          {sync.error && (
            <p className="text-[10px] text-(--danger) leading-snug" role="alert">
              {sync.error}
            </p>
          )}

          {sync.status !== "on" ? (
            <form onSubmit={onConnect} className="space-y-2">
              <label className="block">
                <span className="text-[10px] text-(--text-muted)">Room name</span>
                <input
                  type="text"
                  value={sync.roomId}
                  onChange={(e) => sync.setRoomId(e.target.value)}
                  placeholder="e.g. alan-laptops"
                  autoComplete="off"
                  className="mt-0.5 w-full bg-(--input-bg)/80 border border-(--border) rounded-md px-2 py-1 text-sm outline-none focus:border-(--accent-soft)"
                />
              </label>
              <label className="block">
                <span className="text-[10px] text-(--text-muted)">Passphrase</span>
                <div className="mt-0.5 flex gap-1">
                  <input
                    type={showPass ? "text" : "password"}
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    placeholder="Shared secret (encrypts sync)"
                    autoComplete="off"
                    className="flex-1 min-w-0 bg-(--input-bg)/80 border border-(--border) rounded-md px-2 py-1 text-sm outline-none focus:border-(--accent-soft)"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="shrink-0 px-2 text-[10px] text-(--text-muted) hover:text-(--text) rounded border border-(--border)"
                  >
                    {showPass ? "Hide" : "Show"}
                  </button>
                </div>
              </label>
              <button
                type="submit"
                disabled={sync.status === "connecting"}
                className="w-full py-1.5 text-sm rounded-md bg-(--accent-soft)/15 text-(--accent-soft) hover:bg-(--hover) disabled:opacity-50"
              >
                {sync.status === "connecting" ? "Connecting…" : "Connect"}
              </button>
            </form>
          ) : (
            <div className="space-y-1">
              <p className="text-xs font-mono text-(--text-muted) truncate" title={sync.roomId}>
                Room: {sync.roomId}
              </p>
              <button
                type="button"
                onClick={() => sync.disconnect()}
                className="w-full py-1.5 text-sm rounded-md text-(--text-muted) hover:bg-(--hover) hover:text-(--text)"
              >
                Pause sync
              </button>
              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      "Leave this room and clear saved room on this device? Your local notebook stays.",
                    )
                  ) {
                    sync.leave();
                    setPassphrase("");
                  }
                }}
                className="w-full py-1.5 text-[11px] rounded-md text-(--text-muted) hover:bg-(--hover) hover:text-(--danger)"
              >
                Leave room
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
