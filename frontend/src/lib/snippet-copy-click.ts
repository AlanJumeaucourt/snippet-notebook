import { copyTextToClipboard } from "./clipboard";

const COPIED_MS = 1000;
const TOAST_MS = 4000;
const TOAST_ID = "snippet-copy-unresolved-toast";

/** Resolve snippet text synchronously (must not await — mobile clipboard needs user gesture). */
export type SnippetCopyPayload = { text: string; unresolved: string[] };
export type SnippetCopyHandler = (fenceStartLine: number) => SnippetCopyPayload | null;

let copyHandler: SnippetCopyHandler | null = null;
let toastTimer: number | undefined;

export function setSnippetCopyHandler(handler: SnippetCopyHandler | null) {
  copyHandler = handler;
}

export function formatUnresolvedCopyMessage(names: readonly string[]): string {
  const list = names.join(", ");
  return names.length === 1
    ? `Copied with unset variable: ${list}`
    : `Copied with unset variables: ${list}`;
}

export function showUnresolvedCopyNotice(names: readonly string[]): void {
  if (names.length === 0) return;

  let el = document.getElementById(TOAST_ID);
  if (!el) {
    el = document.createElement("div");
    el.id = TOAST_ID;
    el.setAttribute("role", "status");
    el.className = "snippet-copy-unresolved-toast";
    document.body.appendChild(el);
  }

  el.textContent = formatUnresolvedCopyMessage(names);
  el.hidden = false;
  if (toastTimer != null) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    el!.hidden = true;
  }, TOAST_MS);
}

export function showSnippetCopyFeedback(
  source?: HTMLElement,
  fenceStartLine?: number,
  unresolved?: readonly string[],
): void {
  const btn =
    source instanceof HTMLButtonElement && source.classList.contains("cm-snippet-copy-btn")
      ? source
      : fenceStartLine != null
        ? document.querySelector<HTMLButtonElement>(
            `.cm-snippet-copy-btn[data-fence-line="${fenceStartLine}"]`,
          )
        : null;
  if (!btn) return;

  const prev = btn.textContent;
  const prevTitle = btn.title;
  btn.textContent = "✓";
  btn.disabled = true;
  if (unresolved?.length) {
    btn.classList.add("cm-snippet-copy-btn--warning");
    btn.title = formatUnresolvedCopyMessage(unresolved);
  } else {
    btn.classList.add("cm-snippet-copy-btn--copied");
  }
  window.setTimeout(() => {
    btn.textContent = prev ?? "Copy";
    btn.title = prevTitle;
    btn.classList.remove("cm-snippet-copy-btn--copied", "cm-snippet-copy-btn--warning");
    btn.disabled = false;
  }, COPIED_MS);
}

export function fireSnippetCopy(fenceStartLine: number, source?: HTMLElement): void {
  const payload = copyHandler?.(fenceStartLine);
  if (payload == null) return;
  copyTextToClipboard(payload.text, (ok) => {
    if (!ok) return;
    if (payload.unresolved.length) showUnresolvedCopyNotice(payload.unresolved);
    showSnippetCopyFeedback(source, fenceStartLine, payload.unresolved);
  });
}
