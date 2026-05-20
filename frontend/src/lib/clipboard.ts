/** Fallback when Clipboard API is missing or rejected (common on mobile WebKit). */
function copyViaExecCommand(text: string): boolean {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  ta.style.top = "0";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  ta.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  } finally {
    document.body.removeChild(ta);
  }
  return ok;
}

/**
 * Copy text from a user gesture (button click / tap).
 * Must be invoked synchronously in the event handler — do not await before calling.
 */
export function copyTextToClipboard(text: string, onDone?: (ok: boolean) => void): void {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    navigator.clipboard
      .writeText(text)
      .then(() => onDone?.(true))
      .catch(() => onDone?.(copyViaExecCommand(text)));
    return;
  }
  onDone?.(copyViaExecCommand(text));
}
