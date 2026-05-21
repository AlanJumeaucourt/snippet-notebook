import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import { WebrtcProvider } from "y-webrtc";
import { IndexeddbPersistence } from "y-indexeddb";
import { getSyncConfig } from "./config";
import { deriveRoomName } from "./room";

const YTEXT_FIELD = "document";

function randomPeerColor(): string {
  const hue = Math.floor(Math.random() * 360);
  return `hsl(${hue} 70% 55%)`;
}

export type NotebookCollab = {
  ytext: Y.Text;
  awareness: Awareness;
  undoManager: Y.UndoManager;
};

export class NotebookSyncSession {
  readonly ydoc = new Y.Doc();
  readonly ytext: Y.Text;
  readonly awareness: Awareness;
  readonly undoManager: Y.UndoManager;
  provider: WebrtcProvider | null = null;
  indexeddb: IndexeddbPersistence | null = null;
  private peerCount = 0;

  constructor() {
    this.ytext = this.ydoc.getText(YTEXT_FIELD);
    this.awareness = new Awareness(this.ydoc);
    this.undoManager = new Y.UndoManager(this.ytext);
    this.awareness.setLocalStateField("user", {
      name: `Device ${Math.floor(Math.random() * 900) + 100}`,
      color: randomPeerColor(),
    });
  }

  getCollab(): NotebookCollab {
    return {
      ytext: this.ytext,
      awareness: this.awareness,
      undoManager: this.undoManager,
    };
  }

  getPeers(): number {
    return this.peerCount;
  }

  async start(roomId: string, passphrase: string, seedIfEmpty?: string): Promise<void> {
    const roomName = await deriveRoomName(roomId, passphrase);
    const { signaling, iceServers } = getSyncConfig();

    this.indexeddb = new IndexeddbPersistence(`snippet-sync-${roomName.slice(0, 24)}`, this.ydoc);
    await this.indexeddb.whenSynced;

    if (this.ytext.length === 0 && seedIfEmpty) {
      this.ytext.insert(0, seedIfEmpty);
    }

    this.provider = new WebrtcProvider(roomName, this.ydoc, {
      password: passphrase,
      signaling,
      awareness: this.awareness,
      peerOpts: {
        config: {
          iceServers,
        },
      },
    });

    this.provider.on("peers", ({ webrtcPeers, bcPeers }) => {
      this.peerCount = webrtcPeers.length + bcPeers.length;
    });
    this.provider.connect();
  }

  destroy(): void {
    this.provider?.destroy();
    this.provider = null;
    this.indexeddb?.destroy();
    this.indexeddb = null;
    this.awareness.destroy();
    this.ydoc.destroy();
    this.peerCount = 0;
  }
}
