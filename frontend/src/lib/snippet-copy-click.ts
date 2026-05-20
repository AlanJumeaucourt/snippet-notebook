import { copyTextToClipboard } from "./clipboard";

const COPIED_MS = 1000;

/** Resolve snippet text synchronously (must not await — mobile clipboard needs user gesture). */
export type SnippetCopyHandler = (fenceStartLine: number) => string | null;

let copyHandler: SnippetCopyHandler | null = null;

export function setSnippetCopyHandler(handler: SnippetCopyHandler | null) {
  copyHandler = handler;
}

export function showSnippetCopyFeedback(source?: HTMLElement, fenceStartLine?: number): void {
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
  btn.textContent = "✓";
  btn.classList.add("cm-snippet-copy-btn--copied");
  btn.disabled = true;
  window.setTimeout(() => {
    btn.textContent = prev ?? "Copy";
    btn.classList.remove("cm-snippet-copy-btn--copied");
    btn.disabled = false;
  }, COPIED_MS);
}

export function fireSnippetCopy(fenceStartLine: number, source?: HTMLElement): void {
  const text = copyHandler?.(fenceStartLine);
  if (text == null) return;
  copyTextToClipboard(text, (ok) => {
    if (ok) showSnippetCopyFeedback(source, fenceStartLine);
  });
}
