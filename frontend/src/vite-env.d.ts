/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SYNC_SIGNALING_URLS?: string;
  readonly VITE_SYNC_STUN_URLS?: string;
  readonly VITE_SYNC_TURN_URLS?: string;
  readonly VITE_SYNC_TURN_USERNAME?: string;
  readonly VITE_SYNC_TURN_CREDENTIAL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.md?raw" {
  const content: string;
  export default content;
}
