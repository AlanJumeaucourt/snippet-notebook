import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  WidgetType,
  type ViewUpdate,
} from "@codemirror/view";
import { PLACEHOLDER_MARK_STYLE } from "./codemirror-theme";
import { scheduleDecorationRebuild } from "./codemirror-schedule";
import { firePlaceholderClick } from "./placeholder-click";
import { fireSnippetCopy } from "./snippet-copy-click";
import { findCodeBlockAtLine } from "./document";
import { extractVariableNames } from "./variables";
import {
  buildDocFenceIndex,
  findPlaceholderAt,
  listInlinePlaceholders,
  placeholderPreviewDisplay,
  rangeIntersects,
  type PlaceholderHit,
} from "./snippet-vars";
import type { CodeBlockAnchor } from "./document";

/** Extra lines around the viewport for placeholder widgets. */
const WIDGET_VIEW_MARGIN = 1200;

class VarPreviewWidget extends WidgetType {
  constructor(
    readonly display: string,
    readonly hit: PlaceholderHit,
  ) {
    super();
  }

  eq(other: VarPreviewWidget) {
    return other.display === this.display && other.hit.from === this.hit.from;
  }

  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-var-preview cm-var-preview-clickable";
    span.textContent = ` → ${this.display}`;
    span.title = "Click to change · Ctrl+click preview";
    span.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      firePlaceholderClick(this.hit, e);
    });
    return span;
  }

  ignoreEvent() {
    return true;
  }
}

class SnippetCopyWidget extends WidgetType {
  constructor(readonly fenceStartLine: number) {
    super();
  }

  eq(other: SnippetCopyWidget) {
    return other.fenceStartLine === this.fenceStartLine;
  }

  toDOM() {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cm-snippet-copy-btn";
    btn.dataset.fenceLine = String(this.fenceStartLine);
    btn.textContent = "Copy";
    btn.title = "Copy resolved snippet (Ctrl+Shift+C)";
    btn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      fireSnippetCopy(this.fenceStartLine, btn);
    });
    return btn;
  }

  ignoreEvent() {
    return true;
  }
}

function buildVariableDecorations(view: EditorView): DecorationSet {
  const doc = view.state.doc.toString();
  const index = buildDocFenceIndex(doc);
  const marks: ReturnType<Decoration["range"]>[] = [];

  for (const ph of listInlinePlaceholders(doc, index)) {
    const hit = {
      name: ph.name,
      from: ph.from,
      to: ph.to,
      blockStartLine: ph.blockStartLine,
      inVarsFence: false,
    };
    const nearViewport = rangeIntersects(ph.from, ph.to, view.visibleRanges, WIDGET_VIEW_MARGIN);

    if (nearViewport) {
      const preview = placeholderPreviewDisplay(doc, ph.name, ph.blockStartLine);
      marks.push(
        Decoration.mark({
          class: "cm-variable-placeholder cm-variable-clickable",
          attributes: {
            title: "Click to change · Ctrl+click preview",
            style: PLACEHOLDER_MARK_STYLE,
          },
        }).range(ph.from, ph.to),
      );
      marks.push(
        Decoration.widget({
          widget: new VarPreviewWidget(preview, hit),
          side: 1,
        }).range(ph.to),
      );
    } else {
      marks.push(
        Decoration.mark({
          class: "cm-variable-placeholder cm-variable-clickable",
          attributes: {
            title: "Click to change · Ctrl+click preview",
            style: PLACEHOLDER_MARK_STYLE,
          },
        }).range(ph.from, ph.to),
      );
    }
  }

  for (const block of index.codeBlocks) {
    const lineNo = block.startLine + 1;
    if (lineNo > view.state.doc.lines) continue;
    const lineObj = view.state.doc.line(lineNo);
    if (!rangeIntersects(lineObj.from, lineObj.to, view.visibleRanges, WIDGET_VIEW_MARGIN)) {
      continue;
    }
    marks.push(
      Decoration.widget({
        widget: new SnippetCopyWidget(block.startLine),
        side: 1,
      }).range(lineObj.to),
    );
  }

  return Decoration.set(marks, true);
}

const variableDecorationsPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    view!: EditorView;
    scheduled = false;
    constructor(view: EditorView) {
      this.view = view;
      this.decorations = buildVariableDecorations(view);
    }
    rebuild() {
      this.decorations = buildVariableDecorations(this.view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged) {
        this.rebuild();
        return;
      }
      if (update.viewportChanged) {
        scheduleDecorationRebuild(this);
      }
    }
  },
  { decorations: (v) => v.decorations },
);

function tryOpenPlaceholder(view: EditorView, event: MouseEvent): boolean {
  if (event.button !== 0) return false;
  const pos = view.posAtCoords({ x: event.clientX, y: event.clientY }, false);
  if (pos == null) return false;
  const hit = findPlaceholderAt(view.state.doc.toString(), pos);
  if (!hit) return false;
  event.preventDefault();
  event.stopPropagation();
  firePlaceholderClick(hit, event);
  return true;
}

/** Ctrl/Cmd+click inside a snippet code block (not on a placeholder) opens resolved preview. */
export function resolvedPreviewClickExtension(
  getDoc: () => string,
  onPreview: (block: CodeBlockAnchor) => void,
) {
  return EditorView.domEventHandlers({
    mousedown(event, view) {
      if (!(event.ctrlKey || event.metaKey) || event.button !== 0) return false;
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY }, false);
      if (pos == null) return false;
      const doc = getDoc();
      if (findPlaceholderAt(doc, pos)) return false;
      const line = view.state.doc.lineAt(pos).number - 1;
      const block = findCodeBlockAtLine(doc, line);
      if (!block || extractVariableNames(block.content).length === 0) return false;
      event.preventDefault();
      event.stopPropagation();
      onPreview(block);
      return true;
    },
  });
}

export function variableInlineExtension() {
  return [
    variableDecorationsPlugin,
    EditorView.domEventHandlers({
      mousedown(event, view) {
        return tryOpenPlaceholder(view, event);
      },
    }),
  ];
}
