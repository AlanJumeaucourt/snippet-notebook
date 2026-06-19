import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { foldGutter, foldKeymap } from "@codemirror/language";
import { getSearchQuery, search, setSearchQuery } from "@codemirror/search";
import { RangeSetBuilder } from "@codemirror/state";
import {
    Decoration,
    DecorationSet,
    EditorView,
    ViewPlugin,
    type ViewUpdate,
    highlightActiveLine,
    highlightActiveLineGutter,
    keymap,
    lineNumbers,
} from "@codemirror/view";
import { scheduleDecorationRebuild } from "~/lib/codemirror-schedule";
import { scrollToSearchMatchIfNeeded } from "~/lib/editor";
import { fencedCodeLanguages } from "./codemirror-languages";
import { notebookSyntax, notebookTheme } from "./codemirror-theme";
import { internalLinkTargetAt } from "./document";

const INTERNAL_LINK_RE = /\[([^\]]*)\]\(#([^)]+)\)/g;
const VARS_FENCE = /^```vars(\s+global)?\s*$/;
const VAR_ASSIGN = /^(\w+)\s*=\s*(.+)$/;
const VAR_COLON = /^(\w+)\s*:\s*(.+)$/;

function buildDecorations(view: EditorView): DecorationSet {
  const marks: ReturnType<Decoration["range"]>[] = [];
  const doc = view.state.doc;
  const docText = doc.toString();

  let inVarsBlock = false;

  for (let lineNo = 1; lineNo <= doc.lines; lineNo++) {
    const lineObj = doc.line(lineNo);
    const line = lineObj.text;
    const lineStart = lineObj.from;

    if (VARS_FENCE.test(line)) {
      marks.push(Decoration.line({ class: "cm-vars-fence" }).range(lineStart));
      inVarsBlock = true;
      continue;
    }
    if (inVarsBlock && /^```\s*$/.test(line)) {
      inVarsBlock = false;
      continue;
    }

    if (inVarsBlock) {
      const trimmed = line.trim();
      if (trimmed.startsWith("#")) continue;

      const assign = trimmed.match(VAR_ASSIGN);
      const colon = !assign ? trimmed.match(VAR_COLON) : null;
      const match = assign ?? colon;
      if (match) {
        const name = match[1];
        const rest = match[2];
        const pipeIdx = rest.indexOf("|");
        const nameStart = line.indexOf(name);
        if (nameStart >= 0) {
          marks.push(
            Decoration.mark({ class: "cm-var-assignment" }).range(
              lineStart + nameStart,
              lineStart + nameStart + name.length,
            ),
          );
        }
        if (pipeIdx >= 0) {
          const pipeStart = line.indexOf("|", nameStart);
          if (pipeStart >= 0) {
            marks.push(
              Decoration.mark({ class: "cm-var-pipe" }).range(
                lineStart + pipeStart,
                lineStart + pipeStart + 1,
              ),
            );
            const valuePart = rest.slice(0, pipeIdx).trim();
            const valStart = line.indexOf(valuePart, nameStart);
            if (valStart >= 0 && valuePart) {
              marks.push(
                Decoration.mark({ class: "cm-var-value" }).range(
                  lineStart + valStart,
                  lineStart + valStart + valuePart.length,
                ),
              );
            }
            const optionsPart = rest.slice(pipeIdx + 1);
            const optionRe = /[A-Za-z][\w-]*:/g;
            let optionMatch: RegExpExecArray | null;
            const optsStart = line.indexOf(optionsPart, pipeStart);
            if (optsStart >= 0) {
              while ((optionMatch = optionRe.exec(optionsPart))) {
                const label = optionMatch[0].slice(0, -1);
                marks.push(
                  Decoration.mark({ class: "cm-var-option" }).range(
                    lineStart + optsStart + optionMatch.index,
                    lineStart + optsStart + optionMatch.index + label.length,
                  ),
                );
              }
            }
          }
        } else {
          const sep = colon ? ":" : "=";
          const valStart = line.indexOf(sep, nameStart);
          if (valStart >= 0) {
            const valueStart = line.indexOf(rest.trim(), valStart);
            if (valueStart >= 0 && rest.trim() && !rest.includes("{{")) {
              marks.push(
                Decoration.mark({ class: "cm-var-value" }).range(
                  lineStart + valueStart,
                  lineStart + valueStart + rest.trim().length,
                ),
              );
            }
          }
        }
      }
    }

    if (/^```[\w]/.test(line) && !VARS_FENCE.test(line)) {
      marks.push(Decoration.line({ class: "cm-fenced-code" }).range(lineStart));
    }
  }

  let match: RegExpExecArray | null;
  INTERNAL_LINK_RE.lastIndex = 0;
  while ((match = INTERNAL_LINK_RE.exec(docText))) {
    marks.push(
      Decoration.mark({ class: "cm-internal-link" }).range(
        match.index,
        match.index + match[0].length,
      ),
    );
  }

  return Decoration.set(marks, true);
}

export function internalLinkClickExtension(
  getDoc: () => string,
  onFollow: (anchorId: string) => void,
) {
  return EditorView.domEventHandlers({
    mousedown(event, view) {
      if (!(event.ctrlKey || event.metaKey)) return false;
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (pos == null) return false;
      const anchorId = internalLinkTargetAt(getDoc(), pos);
      if (!anchorId) return false;
      event.preventDefault();
      onFollow(anchorId);
      return true;
    },
  });
}

/** Built-in search highlighter only runs when CM’s panel is open; we use a custom find bar. */
const findMatchMark = Decoration.mark({ class: "cm-searchMatch" });
const findMatchSelectedMark = Decoration.mark({
  class: "cm-searchMatch cm-searchMatch-selected",
});

const findHighlightPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    view!: EditorView;
    scheduled = false;
    constructor(view: EditorView) {
      this.view = view;
      this.decorations = this.build(view);
    }
    rebuild() {
      this.decorations = this.build(this.view);
    }
    update(update: ViewUpdate) {
      const queryChanged = update.transactions.some((tr) =>
        tr.effects.some((e) => e.is(setSearchQuery)),
      );
      if (update.docChanged || update.viewportChanged || queryChanged) {
        this.rebuild();
        return;
      }
      if (update.selectionSet) {
        scheduleDecorationRebuild(this);
      }
    }
    build(view: EditorView): DecorationSet {
      const query = getSearchQuery(view.state);
      if (!query.valid) return Decoration.none;

      const builder = new RangeSetBuilder<Decoration>();
      for (const { from, to } of view.visibleRanges) {
        const cursor = query.getCursor(view.state, from, to);
        for (let next = cursor.next(); !next.done; next = cursor.next()) {
          const matchFrom = next.value.from;
          const matchTo = next.value.to;
          const selected = view.state.selection.ranges.some(
            (r) => r.from === matchFrom && r.to === matchTo,
          );
          builder.add(matchFrom, matchTo, selected ? findMatchSelectedMark : findMatchMark);
        }
      }
      return builder.finish();
    }
  },
  { decorations: (v) => v.decorations },
);

const highlightPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);

export function notebookExtensions() {
  return [
    lineNumbers(),
    foldGutter({
      openText: "▾",
      closedText: "▸",
    }),
    highlightActiveLineGutter(),
    highlightActiveLine(),
    history(),
    notebookTheme,
    notebookSyntax,
    markdown({ codeLanguages: fencedCodeLanguages }),
    highlightPlugin,
    search({ scrollToMatch: scrollToSearchMatchIfNeeded }),
    findHighlightPlugin,
    keymap.of([...historyKeymap, ...defaultKeymap, ...foldKeymap]),
    EditorView.lineWrapping,
  ];
}
