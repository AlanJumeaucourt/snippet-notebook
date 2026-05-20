import type { PlaceholderHit } from "./snippet-vars";

export type PlaceholderClickPayload = {
  name: string;
  blockStartLine?: number;
  from: number;
  to: number;
};

export type PlaceholderClickHandler = (payload: PlaceholderClickPayload, event: MouseEvent) => void;

let clickHandler: PlaceholderClickHandler | null = null;

export function setPlaceholderClickHandler(handler: PlaceholderClickHandler | null) {
  clickHandler = handler;
}

export function firePlaceholderClick(hit: PlaceholderHit, event: MouseEvent): void {
  clickHandler?.(
    {
      name: hit.name,
      blockStartLine: hit.blockStartLine,
      from: hit.from,
      to: hit.to,
    },
    event,
  );
}
