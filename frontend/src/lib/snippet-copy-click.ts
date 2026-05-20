const COPIED_MS = 1000;

export type SnippetCopyHandler = (
  fenceStartLine: number,
  source?: HTMLElement,
) => boolean | Promise<boolean>;

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
  void (async () => {
    const copied = await copyHandler?.(fenceStartLine, source);
    if (copied) showSnippetCopyFeedback(source, fenceStartLine);
  })();
}
