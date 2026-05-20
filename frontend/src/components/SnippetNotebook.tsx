import * as React from "react";
import { DocumentEditor } from "~/components/DocumentEditor";
import { useNotebook } from "~/hooks/useNotebook";
import { extractHeadingAnchors } from "~/lib/document";
import { documentForSharing } from "~/lib/vars-markdown";

const LEVEL_BORDER = [
  "border-l-[var(--accent-soft)]",
  "border-l-[var(--cyan)]",
  "border-l-[var(--green)]",
  "border-l-[var(--purple)]",
  "border-l-[var(--text-muted)]",
  "border-l-[var(--text-muted)]",
];

export function SnippetNotebook() {
  const api = useNotebook();
  const navRef = React.useRef<HTMLElement>(null);
  const [filter, setFilter] = React.useState("");
  const [activeHeadingId, setActiveHeadingId] = React.useState<string | null>(null);
  const [activeBlock, setActiveBlock] = React.useState(
    null as import("~/lib/document").CodeBlockAnchor | null,
  );
  const [scrollToLine, setScrollToLine] = React.useState<number | null>(null);
  const [shareCopied, setShareCopied] = React.useState(false);

  const headings = React.useMemo(() => extractHeadingAnchors(api.document), [api.document]);

  const filteredHeadings = headings.filter((h) => {
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    return h.text.toLowerCase().includes(q);
  });

  React.useEffect(() => {
    if (!activeHeadingId || !navRef.current) return;
    const nav = navRef.current;
    const el = nav.querySelector(`[data-heading-id="${activeHeadingId}"]`) as HTMLElement | null;
    if (!el) return;
    const navRect = nav.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    if (elRect.top >= navRect.top && elRect.bottom <= navRect.bottom) return;
    el.scrollIntoView({ block: "nearest" });
  }, [activeHeadingId]);

  const scrollAfterAdd = React.useRef(false);

  React.useEffect(() => {
    if (!scrollAfterAdd.current) return;
    scrollAfterAdd.current = false;
    const last = extractHeadingAnchors(api.document).at(-1);
    if (last) setScrollToLine(last.line);
  }, [api.document]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        scrollAfterAdd.current = true;
        api.addSection();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [api.addSection]);

  if (!api.hydrated) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-3 bg-[var(--bg)] text-[var(--text)]">
        <div
          className="w-8 h-8 rounded-full border-2 border-[var(--border)] border-t-[var(--accent-soft)] animate-spin"
          aria-hidden
        />
        <span className="text-sm font-mono">Loading notebook…</span>
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden bg-[var(--bg)] text-[var(--text)]">
      <aside className="w-56 shrink-0 flex flex-col border-r border-[var(--border)] bg-[var(--sidebar)] shadow-[4px_0_24px_rgba(0,0,0,0.25)]">
        <div className="px-3 py-3 border-b border-[var(--border)] bg-[var(--sidebar-top)]">
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full bg-[var(--accent-soft)] shadow-[0_0_8px_var(--glow)]"
              aria-hidden
            />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-bright)]">
              Snippet Notebook
            </span>
          </div>
        </div>
        <div className="px-2 py-2">
          <input
            type="search"
            placeholder="Filter outline…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full bg-[var(--input-bg)]/80 border border-[var(--border)] rounded-md px-2.5 py-1.5 text-sm outline-none focus:border-[var(--accent-soft)] focus:ring-1 focus:ring-[var(--glow)] placeholder:text-[var(--text-muted)] transition-colors"
          />
        </div>
        <nav ref={navRef} className="flex-1 overflow-y-auto text-sm py-1">
          {filteredHeadings.length === 0 && (
            <p className="px-3 py-2 text-[11px] text-[var(--text-muted)] italic">
              Add # headings in the editor
            </p>
          )}
          {filteredHeadings.map((h) => {
            const active = activeHeadingId === h.id;
            const border = LEVEL_BORDER[Math.min(h.level - 1, 5)];
            return (
              <button
                key={`${h.id}-${h.line}`}
                type="button"
                data-heading-id={h.id}
                title={`#${h.id}`}
                onClick={() => setScrollToLine(h.line)}
                style={{ paddingLeft: `${(h.level - 1) * 10 + 12}px` }}
                className={`w-full text-left py-1.5 pr-3 truncate border-l-2 transition-colors ${border} ${
                  active
                    ? "text-[var(--text-bright)] bg-[var(--selection)] border-l-[var(--accent-soft)]!"
                    : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--hover)]"
                } ${h.level === 1 ? "font-medium" : ""}`}
              >
                {h.text}
              </button>
            );
          })}
        </nav>
        <div className="border-t border-[var(--border)] p-2 space-y-1">
          <button
            type="button"
            onClick={() => {
              void (async () => {
                await navigator.clipboard.writeText(documentForSharing(api.document));
                setShareCopied(true);
                window.setTimeout(() => setShareCopied(false), 1500);
              })();
            }}
            className={`w-full px-2 py-1.5 text-left text-sm rounded-md transition-colors ${
              shareCopied
                ? "text-[var(--green)] bg-[var(--green)]/10"
                : "text-[var(--accent-soft)] hover:bg-[var(--hover)]"
            }`}
            title="Copy entire notebook with {{placeholders}} kept but var values cleared"
          >
            {shareCopied ? "✓ Copied for sharing" : "Copy for sharing"}
          </button>
          <button
            type="button"
            onClick={() => {
              scrollAfterAdd.current = true;
              api.addSection();
            }}
            className="w-full px-2 py-1.5 text-left text-sm text-[var(--cyan)] rounded-md hover:bg-[var(--hover)] transition-colors"
            title="Add section (Ctrl+N)"
          >
            + Section
          </button>
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  "Replace your notebook with the built-in welcome document? Your current text will be lost.",
                )
              ) {
                api.resetToDefault();
                setScrollToLine(0);
              }
            }}
            className="w-full px-2 py-1.5 text-left text-[11px] text-[var(--text-muted)] rounded-md hover:bg-[var(--hover)] hover:text-[var(--danger)] transition-colors"
            title="Load the built-in example notebook"
          >
            Reset to default
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-[var(--editor)]">
        <DocumentEditor
          value={api.document}
          onChange={api.setDocument}
          onActiveHeadingChange={setActiveHeadingId}
          onActiveBlockChange={setActiveBlock}
          activeBlock={activeBlock}
          scrollToHeadingLine={scrollToLine}
          onScrollToHeadingDone={() => setScrollToLine(null)}
        />
      </div>
    </div>
  );
}
