import * as React from "react";
import { redo, undo } from "@codemirror/commands";
import { EditorState, Transaction } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { SearchQuery, findNext, findPrevious, setSearchQuery } from "@codemirror/search";
import { debounce } from "~/lib/debounce";
import { computeFindMatchStats } from "~/lib/find-stats";
import {
  activeHeadingForLine,
  extractHeadingAnchors,
  findCodeBlockAtLine,
  findCodeBlockByFenceLine,
  findHeadingLineByAnchorId,
  type CodeBlockAnchor,
  type HeadingAnchor,
} from "~/lib/document";
import { internalLinkClickExtension, notebookExtensions } from "~/lib/codemirror-extensions";
import { resolvedPreviewClickExtension, variableInlineExtension } from "~/lib/codemirror-variables";
import { setPlaceholderClickHandler } from "~/lib/placeholder-click";
import { setSnippetCopyHandler, showSnippetCopyFeedback } from "~/lib/snippet-copy-click";
import { VariablePopover } from "~/components/VariablePopover";
import { SnippetBar } from "~/components/SnippetBar";
import {
  FIND_BAR_CONTENT_PAD,
  applyDocumentPreservingView,
  findBarMarginExtensions,
  findBarScrollMargin,
  getCursorLineFromView,
  getFirstVisibleLineFromView,
  lineAnchorInHost,
  placeholderScreenAnchor,
  scrollToLineInView,
} from "~/lib/editor";
import { extractVariableNames } from "~/lib/variables";
import {
  codeBlockForPlaceholderClick,
  findPlaceholderAt,
  listInlinePlaceholders,
  resolvedSnippet,
} from "~/lib/snippet-vars";
import { copyTextToClipboard } from "~/lib/clipboard";
import { addVarOption, updateVarValue } from "~/lib/vars-markdown";

function applyFindQuery(view: EditorView, text: string) {
  view.dispatch({
    effects: setSearchQuery.of(new SearchQuery({ search: text, caseSensitive: false })),
  });
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

type PopoverState = {
  name: string;
  blockStartLine?: number;
  from: number;
  to: number;
};

export function DocumentEditor({
  value,
  onChange,
  onActiveHeadingChange,
  onActiveBlockChange,
  activeBlock,
  scrollToHeadingLine,
  onScrollToHeadingDone,
}: {
  value: string;
  onChange: (value: string) => void;
  onActiveHeadingChange: (id: string | null) => void;
  onActiveBlockChange: (block: CodeBlockAnchor | null) => void;
  activeBlock: CodeBlockAnchor | null;
  scrollToHeadingLine: number | null;
  onScrollToHeadingDone: () => void;
}) {
  const editorPanelRef = React.useRef<HTMLDivElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const viewRef = React.useRef<EditorView | null>(null);
  const [previewPanelAnchor, setPreviewPanelAnchor] = React.useState<{
    top: number;
    left: number;
  } | null>(null);
  const findInputRef = React.useRef<HTMLInputElement>(null);
  const applyingExternalRef = React.useRef(false);
  const pendingHistorySyncRef = React.useRef(false);
  const [findOpen, setFindOpen] = React.useState(false);
  const [findText, setFindText] = React.useState("");
  const [findStats, setFindStats] = React.useState({
    total: 0,
    current: null as number | null,
  });
  const findPadScrollRef = React.useRef(0);
  const findOpenRef = React.useRef(findOpen);
  const findTextRef = React.useRef(findText);
  findOpenRef.current = findOpen;
  findTextRef.current = findText;

  const refreshFindStats = React.useCallback((view?: EditorView) => {
    const v = view ?? viewRef.current;
    if (!v || !findOpenRef.current) {
      setFindStats({ total: 0, current: null });
      return;
    }
    setFindStats(computeFindMatchStats(v.state, findTextRef.current));
  }, []);
  const refreshFindStatsRef = React.useRef(refreshFindStats);
  refreshFindStatsRef.current = refreshFindStats;

  const resolvedPreviewBlockRef = React.useRef<CodeBlockAnchor | null>(null);

  const syncPreviewPanelAnchor = React.useCallback(() => {
    const view = viewRef.current;
    const host = editorPanelRef.current;
    const block = resolvedPreviewBlockRef.current;
    if (!view || !host || !block) {
      setPreviewPanelAnchor(null);
      return;
    }
    const raw = lineAnchorInHost(view, block.startLine, host);
    if (!raw) {
      setPreviewPanelAnchor(null);
      return;
    }
    setPreviewPanelAnchor({
      top: raw.centerY + raw.lineHeight / 2 + 4,
      left: Math.min(raw.left, Math.max(8, host.clientWidth - 200)),
    });
  }, []);

  const syncPreviewPanelAnchorRef = React.useRef(syncPreviewPanelAnchor);
  syncPreviewPanelAnchorRef.current = syncPreviewPanelAnchor;

  const [resolvedPreviewBlock, setResolvedPreviewBlock] = React.useState<CodeBlockAnchor | null>(
    null,
  );
  const [popover, setPopover] = React.useState<PopoverState | null>(null);
  const [popoverAnchor, setPopoverAnchor] = React.useState<{
    x: number;
    y: number;
  } | null>(null);
  const onChangeRef = React.useRef(onChange);
  const valueRef = React.useRef(value);
  const headingsCacheRef = React.useRef<HeadingAnchor[]>([]);
  const contextRef = React.useRef({
    onActiveHeadingChange,
    onActiveBlockChange,
    value,
  });

  onChangeRef.current = onChange;
  valueRef.current = value;
  contextRef.current = {
    onActiveHeadingChange,
    onActiveBlockChange,
    value,
  };

  const updateContext = React.useCallback(
    (view: EditorView, mode: "all" | "scroll" | "caret" = "all") => {
      const {
        value: doc,
        onActiveHeadingChange: onHeading,
        onActiveBlockChange: onBlock,
      } = contextRef.current;
      if (mode === "all") {
        headingsCacheRef.current = extractHeadingAnchors(doc);
      }
      onHeading(activeHeadingForLine(headingsCacheRef.current, getFirstVisibleLineFromView(view)));
      if (mode !== "scroll") {
        onBlock(findCodeBlockAtLine(doc, getCursorLineFromView(view)));
      }
    },
    [],
  );

  const refreshFindStatsDebounced = React.useMemo(
    () =>
      debounce(() => {
        refreshFindStatsRef.current();
      }, 120),
    [],
  );

  const applyDocFromUI = React.useCallback(
    (newDoc: string) => {
      const view = viewRef.current;
      if (!view) {
        valueRef.current = newDoc;
        onChangeRef.current(newDoc);
        return;
      }
      if (newDoc === view.state.doc.toString()) return;

      applyingExternalRef.current = true;
      applyDocumentPreservingView(view, newDoc, { recordHistory: true });
      valueRef.current = newDoc;
      onChangeRef.current(newDoc);
      updateContext(view);
      applyingExternalRef.current = false;
      requestAnimationFrame(() => view.focus());
    },
    [updateContext],
  );

  const handleSetGlobal = React.useCallback(
    (name: string, v: string) => {
      applyDocFromUI(updateVarValue(valueRef.current, "global", name, v));
    },
    [applyDocFromUI],
  );

  const handleSetLocal = React.useCallback(
    (blockStart: number, name: string, v: string) => {
      applyDocFromUI(updateVarValue(valueRef.current, "local", name, v, blockStart));
    },
    [applyDocFromUI],
  );

  const handleAddGlobalOption = React.useCallback(
    (name: string, option: string) => {
      applyDocFromUI(addVarOption(valueRef.current, "global", name, option));
    },
    [applyDocFromUI],
  );

  const handleAddLocalOption = React.useCallback(
    (blockStart: number, name: string, option: string) => {
      applyDocFromUI(addVarOption(valueRef.current, "local", name, option, blockStart));
    },
    [applyDocFromUI],
  );

  const closeFind = React.useCallback(() => {
    setFindOpen(false);
    setFindText("");
    setFindStats({ total: 0, current: null });
    const view = viewRef.current;
    if (view) applyFindQuery(view, "");
    viewRef.current?.focus();
  }, []);

  const goFindNext = React.useCallback(() => {
    const view = viewRef.current;
    if (!view || !findTextRef.current.trim()) return;
    findNext(view);
    refreshFindStats(view);
  }, [refreshFindStats]);

  const goFindPrevious = React.useCallback(() => {
    const view = viewRef.current;
    if (!view || !findTextRef.current.trim()) return;
    findPrevious(view);
    refreshFindStats(view);
  }, [refreshFindStats]);

  const copyBlock = React.useCallback((block: CodeBlockAnchor, onDone?: (ok: boolean) => void) => {
    const text = resolvedSnippet(valueRef.current, block);
    copyTextToClipboard(text, onDone);
  }, []);

  const openResolvedPreview = React.useCallback((block: CodeBlockAnchor) => {
    if (extractVariableNames(block.content).length === 0) return;
    resolvedPreviewBlockRef.current = block;
    setResolvedPreviewBlock(block);
    setPopover(null);
    setPopoverAnchor(null);
    requestAnimationFrame(() => syncPreviewPanelAnchorRef.current());
  }, []);

  React.useEffect(() => {
    setSnippetCopyHandler((fenceStartLine) => {
      const block = findCodeBlockByFenceLine(valueRef.current, fenceStartLine);
      if (!block) return null;
      return resolvedSnippet(valueRef.current, block);
    });
    return () => setSnippetCopyHandler(null);
  }, []);

  React.useEffect(() => {
    const view = viewRef.current;
    if (!view || !findOpen) return;
    applyFindQuery(view, findText);
    refreshFindStats(view);
  }, [findText, findOpen, refreshFindStats]);

  React.useEffect(() => {
    const host = containerRef.current;
    const view = viewRef.current;
    if (host) host.classList.toggle("cm-find-open", findOpen);
    if (!view) return;

    if (findOpen) {
      const scroller = view.scrollDOM;
      if (findPadScrollRef.current === 0 && scroller.scrollTop > 0) {
        scroller.scrollTop += FIND_BAR_CONTENT_PAD;
        findPadScrollRef.current = FIND_BAR_CONTENT_PAD;
      }
      view.dispatch({
        effects: findBarScrollMargin.reconfigure(findBarMarginExtensions(true)),
        annotations: Transaction.addToHistory.of(false),
      });
    } else {
      if (findPadScrollRef.current > 0) {
        view.scrollDOM.scrollTop = Math.max(0, view.scrollDOM.scrollTop - findPadScrollRef.current);
        findPadScrollRef.current = 0;
      }
      view.dispatch({
        effects: findBarScrollMargin.reconfigure([]),
        annotations: Transaction.addToHistory.of(false),
      });
    }
  }, [findOpen]);

  const resolvePopoverRange = React.useCallback((doc: string, target: PopoverState) => {
    const at = findPlaceholderAt(doc, target.from);
    if (at?.name === target.name) {
      return { from: at.from, to: at.to };
    }
    const hit = listInlinePlaceholders(doc).find(
      (p) => p.name === target.name && p.blockStartLine === target.blockStartLine,
    );
    if (!hit) return null;
    return { from: hit.from, to: hit.to };
  }, []);

  const syncPopoverAnchor = React.useCallback(() => {
    const view = viewRef.current;
    if (!view || !popover) {
      setPopoverAnchor(null);
      return;
    }
    const doc = view.state.doc.toString();
    const range = resolvePopoverRange(doc, popover);
    if (!range) {
      setPopover(null);
      return;
    }
    const anchor = placeholderScreenAnchor(view, range.from, range.to);
    if (!anchor) {
      setPopover(null);
      return;
    }
    setPopoverAnchor(anchor);
  }, [popover, resolvePopoverRange]);

  React.useEffect(() => {
    setPlaceholderClickHandler((info, event) => {
      const doc = valueRef.current;
      if (event.ctrlKey || event.metaKey) {
        const block = codeBlockForPlaceholderClick(doc, info);
        if (block) openResolvedPreview(block);
        return;
      }
      setResolvedPreviewBlock(null);
      setPopover({
        name: info.name,
        blockStartLine: info.blockStartLine,
        from: info.from,
        to: info.to,
      });
    });
    return () => setPlaceholderClickHandler(null);
  }, [openResolvedPreview]);

  React.useEffect(() => {
    if (!resolvedPreviewBlock) return;
    const fresh = findCodeBlockByFenceLine(value, resolvedPreviewBlock.startLine);
    if (fresh && extractVariableNames(fresh.content).length > 0) {
      setResolvedPreviewBlock(fresh);
    } else {
      setResolvedPreviewBlock(null);
    }
  }, [value, resolvedPreviewBlock?.startLine]);

  React.useEffect(() => {
    syncPopoverAnchor();
  }, [syncPopoverAnchor, value]);

  React.useEffect(() => {
    if (!popover) return;
    const view = viewRef.current;
    if (!view) return;

    syncPopoverAnchor();
    const scrollEl = view.scrollDOM;
    const onMove = () => syncPopoverAnchor();
    scrollEl.addEventListener("scroll", onMove, { passive: true });
    window.addEventListener("resize", onMove);
    return () => {
      scrollEl.removeEventListener("scroll", onMove);
      window.removeEventListener("resize", onMove);
    };
  }, [popover, syncPopoverAnchor]);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const wantsUndo = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z";
      if (wantsUndo && !isEditableTarget(e.target)) {
        const view = viewRef.current;
        if (view) {
          e.preventDefault();
          const handled = e.shiftKey ? redo(view) : undo(view);
          if (!handled) {
            // Keep editor as the undo target after reload even when body had focus.
            view.focus();
          }
          return;
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        setFindOpen(true);
        requestAnimationFrame(() => findInputRef.current?.select());
      }
      if (e.key === "Escape" && resolvedPreviewBlock) {
        e.preventDefault();
        resolvedPreviewBlockRef.current = null;
        setResolvedPreviewBlock(null);
        setPreviewPanelAnchor(null);
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "c") {
        const block = resolvedPreviewBlock ?? activeBlock;
        if (!block) return;
        e.preventDefault();
        copyBlock(block, (ok) => {
          if (ok) showSnippetCopyFeedback(undefined, block.startLine);
        });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeBlock, resolvedPreviewBlock, copyBlock]);

  React.useEffect(() => {
    const parent = containerRef.current;
    if (!parent) return;

    const state = EditorState.create({
      doc: value,
      extensions: [
        ...notebookExtensions(),
        ...variableInlineExtension(),
        resolvedPreviewClickExtension(
          () => contextRef.current.value,
          (block) => openResolvedPreview(block),
        ),
        internalLinkClickExtension(
          () => contextRef.current.value,
          (anchorId) => {
            const view = viewRef.current;
            if (!view) return;
            const line = findHeadingLineByAnchorId(contextRef.current.value, anchorId);
            if (line == null) return;
            scrollToLineInView(view, line);
            updateContext(view);
          },
        ),
        findBarScrollMargin.of([]),
        EditorView.updateListener.of((update) => {
          const view = update.view;
          if (update.docChanged && !applyingExternalRef.current) {
            const doc = view.state.doc.toString();
            valueRef.current = doc;
            if (
              update.transactions.some((tr) => {
                return tr.isUserEvent("undo") || tr.isUserEvent("redo");
              })
            ) {
              pendingHistorySyncRef.current = true;
            }
            onChangeRef.current(doc);
          }
          if (update.docChanged || update.selectionSet) {
            if (!applyingExternalRef.current) {
              updateContext(view, update.docChanged ? "all" : "caret");
            }
            syncPreviewPanelAnchorRef.current();
            if (findOpenRef.current && findTextRef.current.trim()) {
              if (update.docChanged) {
                refreshFindStatsRef.current(view);
              } else if (update.selectionSet) {
                refreshFindStatsDebounced();
              }
            }
          }
        }),
      ],
    });

    const view = new EditorView({ state, parent });
    viewRef.current = view;
    updateContext(view);
    if (document.activeElement === document.body) {
      requestAnimationFrame(() => view.focus());
    }

    const onScroll = () => {
      if (!applyingExternalRef.current) updateContext(view, "scroll");
      syncPreviewPanelAnchorRef.current();
    };
    view.scrollDOM.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      view.scrollDOM.removeEventListener("scroll", onScroll);
      view.destroy();
      viewRef.current = null;
    };
  }, [updateContext, openResolvedPreview, refreshFindStatsDebounced]);

  React.useLayoutEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();

    if (pendingHistorySyncRef.current) {
      pendingHistorySyncRef.current = false;
      valueRef.current = current;
      return;
    }

    if (current === value) {
      valueRef.current = value;
      return;
    }
    // Editor already has the latest doc (typing, var picker); do not overwrite undo stack.
    if (current === valueRef.current) return;

    applyingExternalRef.current = true;
    applyDocumentPreservingView(view, value);
    valueRef.current = value;
    applyingExternalRef.current = false;
    updateContext(view);
  }, [value, updateContext]);

  React.useEffect(() => {
    if (scrollToHeadingLine == null) return;
    const view = viewRef.current;
    if (!view) return;
    scrollToLineInView(view, scrollToHeadingLine);
    updateContext(view);
    onScrollToHeadingDone();
  }, [scrollToHeadingLine, onScrollToHeadingDone, updateContext]);

  const findStatsLabel = !findText.trim()
    ? ""
    : findStats.total === 0
      ? "No results"
      : findStats.current != null
        ? `${findStats.current} / ${findStats.total}`
        : `— / ${findStats.total}`;

  React.useLayoutEffect(() => {
    resolvedPreviewBlockRef.current = resolvedPreviewBlock;
    syncPreviewPanelAnchor();
  }, [syncPreviewPanelAnchor, resolvedPreviewBlock, value]);

  React.useEffect(() => {
    if (!resolvedPreviewBlock) return;
    const onMove = () => syncPreviewPanelAnchor();
    window.addEventListener("resize", onMove);
    return () => window.removeEventListener("resize", onMove);
  }, [resolvedPreviewBlock, syncPreviewPanelAnchor]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div ref={editorPanelRef} className="relative flex-1 min-h-0">
        {resolvedPreviewBlock && (
          <SnippetBar
            document={value}
            block={resolvedPreviewBlock}
            panelAnchor={previewPanelAnchor}
            onClose={() => {
              resolvedPreviewBlockRef.current = null;
              setResolvedPreviewBlock(null);
              setPreviewPanelAnchor(null);
            }}
          />
        )}
        {findOpen && (
          <div
            className="absolute top-2 left-2 right-2 z-20 flex items-center gap-1.5 px-2 py-1.5 rounded border border-(--border) bg-(--panel) shadow-md max-md:top-[max(0.5rem,env(safe-area-inset-top))] max-md:left-3 max-md:right-3 max-md:gap-2 max-md:py-2"
            role="search"
          >
            <button
              type="button"
              onClick={goFindPrevious}
              disabled={!findText.trim() || findStats.total === 0}
              className="shrink-0 w-7 h-7 max-md:w-9 max-md:h-9 flex items-center justify-center rounded text-(--text-muted) hover:text-(--text) hover:bg-(--input-bg) disabled:opacity-40 disabled:pointer-events-none"
              aria-label="Previous match"
              title="Previous match (Shift+Enter)"
            >
              <span aria-hidden className="text-xs leading-none">
                ▲
              </span>
            </button>
            <button
              type="button"
              onClick={goFindNext}
              disabled={!findText.trim() || findStats.total === 0}
              className="shrink-0 w-7 h-7 max-md:w-9 max-md:h-9 flex items-center justify-center rounded text-(--text-muted) hover:text-(--text) hover:bg-(--input-bg) disabled:opacity-40 disabled:pointer-events-none"
              aria-label="Next match"
              title="Next match (Enter)"
            >
              <span aria-hidden className="text-xs leading-none">
                ▼
              </span>
            </button>
            <input
              ref={findInputRef}
              type="text"
              value={findText}
              onChange={(e) => setFindText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (e.shiftKey) goFindPrevious();
                  else goFindNext();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  closeFind();
                }
              }}
              placeholder="Find…"
              autoFocus
              className="flex-1 min-w-0 bg-(--input-bg) border border-(--border) rounded px-2 py-1 max-md:py-2 text-sm font-mono outline-none focus:border-(--accent-soft)"
            />
            {findStatsLabel ? (
              <span
                className="shrink-0 min-w-18 max-md:min-w-14 text-right text-xs font-mono tabular-nums text-(--text-muted)"
                aria-live="polite"
              >
                {findStatsLabel}
              </span>
            ) : null}
            <button
              type="button"
              onClick={closeFind}
              className="shrink-0 text-(--text-muted) hover:text-(--text) text-sm px-1"
              aria-label="Close find"
            >
              ×
            </button>
          </div>
        )}
        <div
          ref={containerRef}
          className="h-full min-h-0 overflow-hidden cm-editor-host"
          style={
            findOpen
              ? ({
                  ["--find-bar-pad" as string]: `${FIND_BAR_CONTENT_PAD}px`,
                } as React.CSSProperties)
              : undefined
          }
        />
      </div>
      {popover && popoverAnchor && (
        <VariablePopover
          document={value}
          name={popover.name}
          blockStartLine={popover.blockStartLine}
          anchor={popoverAnchor}
          onClose={() => {
            setPopover(null);
            setPopoverAnchor(null);
          }}
          onSetGlobal={handleSetGlobal}
          onSetLocal={handleSetLocal}
          onAddGlobalOption={handleAddGlobalOption}
          onAddLocalOption={handleAddLocalOption}
        />
      )}
    </div>
  );
}

export type { HeadingAnchor };
