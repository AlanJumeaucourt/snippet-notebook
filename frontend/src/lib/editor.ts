import {
  ChangeSet,
  Compartment,
  EditorSelection,
  StateEffect,
  Transaction,
  type Extension,
  type SelectionRange,
} from "@codemirror/state";
import { EditorView } from "@codemirror/view";

/** Extra top space so line 1 stays readable under the find overlay. */
export const FIND_BAR_TOP_MARGIN = 52;

/** Extra `.cm-content` padding while find is open (beyond theme’s 16px). */
export const FIND_BAR_CONTENT_PAD = 48;

export const findBarScrollMargin = new Compartment();

export function findBarMarginExtensions(active: boolean): Extension[] {
  if (!active) return [];
  return [EditorView.scrollMargins.of(() => ({ top: FIND_BAR_TOP_MARGIN }))];
}

export function getLineHeightFromView(view: EditorView): number {
  const line = view.lineBlockAt(view.state.doc.line(1).from);
  return line.height || 22;
}

export function getFirstVisibleLineFromView(view: EditorView): number {
  const top = view.scrollDOM.scrollTop;
  const block = view.lineBlockAtHeight(top + 4);
  return view.state.doc.lineAt(block.from).number - 1;
}

export function getCursorLineFromView(view: EditorView): number {
  const pos = view.state.selection.main.head;
  return view.state.doc.lineAt(pos).number - 1;
}

/** Line anchor beside a fence (```bash): centerY + left for vertically centered UI. */
export function lineAnchorInHost(
  view: EditorView,
  lineIndex: number,
  host: HTMLElement,
  side: "start" | "end" = "end",
): { centerY: number; left: number; lineHeight: number } | null {
  try {
    const lineNo = Math.min(Math.max(1, lineIndex + 1), view.state.doc.lines);
    const lineObj = view.state.doc.line(lineNo);
    const lineBlock = view.lineBlockAt(lineObj.from);
    const scrollTop = view.scrollDOM.scrollTop;
    const scrollBottom = scrollTop + view.scrollDOM.clientHeight;
    if (lineBlock.bottom < scrollTop || lineBlock.top > scrollBottom) return null;

    const scroller = view.scrollDOM;
    const scrollerRect = scroller.getBoundingClientRect();
    const hostRect = host.getBoundingClientRect();
    const lineTopInView = lineBlock.top - scrollTop;
    const lineHeight = lineBlock.bottom - lineBlock.top;
    const centerY = scrollerRect.top - hostRect.top + lineTopInView + lineHeight / 2;

    const end = view.coordsAtPos(lineObj.to, 1);
    const start = view.coordsAtPos(lineObj.from, 1);
    const left =
      side === "end" && end
        ? end.right - hostRect.left + 8
        : start
          ? start.left - hostRect.left
          : 8;
    return { centerY, left, lineHeight };
  } catch {
    return null;
  }
}

/** Screen position to place the variable popover (below the placeholder). */
export function placeholderScreenAnchor(
  view: EditorView,
  from: number,
  to: number,
): { x: number; y: number } | null {
  try {
    const end = view.coordsAtPos(to, 1);
    if (!end) return null;
    return { x: end.left, y: end.bottom + 6 };
  } catch {
    return null;
  }
}

const skipSearchScroll = StateEffect.define<null>();

/** Scroll only when the match is outside the editor viewport (used by find). */
export function scrollToSearchMatchIfNeeded(
  range: SelectionRange,
  view: EditorView,
): StateEffect<unknown> {
  const pos = range.head;
  try {
    const block = view.lineBlockAt(pos);
    const top = view.scrollDOM.scrollTop;
    const bottom = top + view.scrollDOM.clientHeight;
    const margin = 20;
    if (block.top >= top + margin && block.bottom <= bottom - margin) {
      return skipSearchScroll.of(null);
    }
  } catch {
    /* position not in view */
  }
  return EditorView.scrollIntoView(pos, { y: "nearest", yMargin: 32 });
}

export function scrollToLineInView(view: EditorView, line: number): void {
  const lineNo = Math.min(Math.max(1, line + 1), view.state.doc.lines);
  const lineObj = view.state.doc.line(lineNo);
  view.dispatch({
    selection: { anchor: lineObj.from },
    effects: EditorView.scrollIntoView(lineObj.from, { y: "start", yMargin: 80 }),
  });
  view.focus();
}

/** One contiguous replace when only part of the document changed (better undo). */
function singlePatch(
  oldDoc: string,
  newDoc: string,
): { from: number; to: number; insert: string } | null {
  if (oldDoc === newDoc) return null;
  let start = 0;
  const minLen = Math.min(oldDoc.length, newDoc.length);
  while (start < minLen && oldDoc[start] === newDoc[start]) start++;
  let endOld = oldDoc.length;
  let endNew = newDoc.length;
  while (endOld > start && endNew > start && oldDoc[endOld - 1] === newDoc[endNew - 1]) {
    endOld--;
    endNew--;
  }
  return { from: start, to: endOld, insert: newDoc.slice(start, endNew) };
}

/** Apply document without jumping scroll or losing cursor in a snippet. */
export function applyDocumentPreservingView(
  view: EditorView,
  newDoc: string,
  options?: { recordHistory?: boolean },
): void {
  const current = view.state.doc.toString();
  if (current === newDoc) return;

  const scrollTop = view.scrollDOM.scrollTop;

  const patch = singlePatch(current, newDoc);
  const record = options?.recordHistory === true;

  const changes = patch ? [patch] : [{ from: 0, to: current.length, insert: newDoc }];
  const changeSet = ChangeSet.of(changes, current.length);
  const main = view.state.selection.main;
  const selAnchor = changeSet.mapPos(main.anchor, 1);
  const selHead = changeSet.mapPos(main.head, 1);
  const selection = EditorSelection.single(
    Math.min(selAnchor, newDoc.length),
    Math.min(selHead, newDoc.length),
  );

  const dispatchSpec = record
    ? { userEvent: "select.var" as const }
    : { annotations: [Transaction.addToHistory.of(false)] };

  view.dispatch({
    changes,
    selection,
    scrollIntoView: false,
    ...dispatchSpec,
  });

  view.scrollDOM.scrollTop = scrollTop;
}
