import type { EditorView } from "@codemirror/view";
import { findAnchorLine } from "~/lib/fold-persistence";
import { getFirstVisibleLineFromView } from "~/lib/editor";

const STORAGE_KEY = "snippet-notebook-scroll";
const MAX_RESTORE_ATTEMPTS = 24;

export type SavedScroll = {
  scrollTop: number;
  /** 0-indexed, same as `getFirstVisibleLineFromView`. */
  firstVisibleLine: number;
  anchorText: string;
};

export type SaveScrollOptions = {
  /** Skip write when scrollTop is 0 (avoids Strict Mode unmount wiping a saved position). */
  skipIfZero?: boolean;
};

export function loadSavedScroll(): SavedScroll | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed == null ||
      typeof parsed !== "object" ||
      typeof (parsed as SavedScroll).scrollTop !== "number" ||
      typeof (parsed as SavedScroll).firstVisibleLine !== "number" ||
      typeof (parsed as SavedScroll).anchorText !== "string"
    ) {
      return null;
    }
    return parsed as SavedScroll;
  } catch {
    return null;
  }
}

export function saveScroll(view: EditorView, options?: SaveScrollOptions): void {
  if (typeof window === "undefined") return;
  const scrollTop = view.scrollDOM.scrollTop;
  if (options?.skipIfZero && scrollTop === 0) return;

  const firstVisibleLine = getFirstVisibleLineFromView(view);
  const lineNo = Math.min(Math.max(1, firstVisibleLine + 1), view.state.doc.lines);
  const anchorText = view.state.doc.line(lineNo).text;
  const saved: SavedScroll = {
    scrollTop,
    firstVisibleLine,
    anchorText,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
}

export function clearSavedScroll(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function focusEditorWithoutScroll(view: EditorView): void {
  view.contentDOM.focus({ preventScroll: true });
}

function scrollTopForSaved(view: EditorView, saved: SavedScroll): number | null {
  const { doc } = view.state;
  const client = view.scrollDOM.clientHeight;
  if (client === 0) return null;

  const maxScroll = Math.max(0, view.scrollDOM.scrollHeight - client);
  const anchorLine = findAnchorLine(doc, {
    anchorLine: saved.firstVisibleLine + 1,
    anchorText: saved.anchorText,
    endLine: saved.firstVisibleLine + 1,
  });

  if (anchorLine != null) {
    try {
      const block = view.lineBlockAt(doc.line(anchorLine).from);
      return Math.min(Math.max(0, block.top), maxScroll);
    } catch {
      /* layout not ready */
    }
  }

  return Math.min(Math.max(0, saved.scrollTop), maxScroll);
}

/** Restore scroll after layout (folds, line blocks). Calls `onComplete` when done. */
export function restoreSavedScroll(view: EditorView, onComplete?: () => void): void {
  const saved = loadSavedScroll();
  if (!saved || saved.scrollTop <= 0) {
    onComplete?.();
    return;
  }

  let attempts = 0;
  let lastApplied = -1;

  const tick = () => {
    if (!view.dom.isConnected) return;

    const next = scrollTopForSaved(view, saved);
    if (next != null) {
      view.scrollDOM.scrollTop = next;
      lastApplied = next;
    }

    attempts++;
    const client = view.scrollDOM.clientHeight;
    const maxScroll = Math.max(0, view.scrollDOM.scrollHeight - client);
    const ready = client > 0 && maxScroll >= saved.scrollTop - 4;

    if (attempts < MAX_RESTORE_ATTEMPTS && !ready) {
      requestAnimationFrame(tick);
      return;
    }

    if (next == null && lastApplied < 0 && attempts < MAX_RESTORE_ATTEMPTS) {
      requestAnimationFrame(tick);
      return;
    }

    onComplete?.();
  };

  requestAnimationFrame(tick);
}
