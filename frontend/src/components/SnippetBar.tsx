import * as React from "react";
import type { CodeBlockAnchor } from "~/lib/document";
import { extractVariableNames } from "~/lib/variables";
import { resolvedSnippet } from "~/lib/snippet-vars";

/** Expanded resolved preview (Ctrl/Cmd+click snippet). Inline **→ copy** is on each fence. */
export function SnippetBar({
  document,
  block,
  panelAnchor,
  onClose,
}: {
  document: string;
  block: CodeBlockAnchor;
  panelAnchor: { top: number; left: number } | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = React.useState(false);
  const names = extractVariableNames(block.content);
  if (names.length === 0) return null;

  const resolved = resolvedSnippet(document, block);

  const copy = async () => {
    await navigator.clipboard.writeText(resolved);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1000);
  };

  const panelTop = panelAnchor ? panelAnchor.top : undefined;
  const panelLeft = panelAnchor ? Math.max(8, panelAnchor.left) : 8;

  return (
    <div
      className="absolute z-15 flex flex-col max-h-[min(38vh,14rem)] rounded-md border border-(--border) bg-(--panel)/95 shadow-lg backdrop-blur-sm overflow-hidden pointer-events-auto"
      style={
        panelAnchor
          ? { top: panelTop, left: panelLeft, right: 8, bottom: "auto" }
          : { bottom: 8, left: 8, right: 8 }
      }
      role="region"
      aria-label="Resolved snippet preview"
    >
      <div className="shrink-0 flex items-center gap-2 px-2 py-1.5 border-b border-(--border) bg-(--panel)">
        <span className="text-[10px] uppercase tracking-wide text-(--text-muted) font-medium">
          Resolved copy
        </span>
        <button
          type="button"
          onClick={() => void copy()}
          className={`shrink-0 text-xs px-2.5 py-0.5 rounded font-medium transition-colors ${
            copied
              ? "bg-(--green)/20 text-(--green)"
              : "bg-(--accent-soft)/15 text-(--accent-soft) hover:bg-(--hover)"
          }`}
          title="Copy with variables resolved (Ctrl+Shift+C)"
        >
          {copied ? "✓ Copied" : "Copy"}
        </button>
        <span className="flex-1" />
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 text-xs px-1.5 py-0.5 rounded text-(--text-muted) hover:text-(--text) hover:bg-(--input-bg)"
          aria-label="Close resolved snippet preview"
          title="Close (Escape)"
        >
          ×
        </button>
      </div>
      <p className="shrink-0 px-2.5 pt-1 text-[10px] text-(--text-muted)">
        Select text below or use Copy · Ctrl+Shift+C
      </p>
      <pre className="flex-1 min-h-0 overflow-y-auto px-2.5 pb-2 text-[11px] font-mono text-(--green)/90 whitespace-pre-wrap break-all leading-relaxed select-text cursor-text">
        {resolved}
      </pre>
    </div>
  );
}
