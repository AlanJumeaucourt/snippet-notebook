import {
  foldEffect,
  foldState,
  foldable,
  foldedRanges,
  forceParsing,
  syntaxTreeAvailable,
  unfoldEffect,
} from "@codemirror/language";
import { Transaction } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { EditorView as EditorViewClass } from "@codemirror/view";

const STORAGE_KEY = "snippet-notebook-folds";

export type SavedFold = {
  anchorLine: number;
  anchorText: string;
  endLine: number;
};

export function findAnchorLine(
  doc: EditorView["state"]["doc"],
  saved: SavedFold,
): number | null {
  if (saved.anchorLine >= 1 && saved.anchorLine <= doc.lines) {
    if (doc.line(saved.anchorLine).text === saved.anchorText) return saved.anchorLine;
  }
  const radius = 80;
  for (let delta = 0; delta <= radius; delta++) {
    for (const sign of delta === 0 ? [0] : [-1, 1]) {
      const n = saved.anchorLine + delta * sign;
      if (n < 1 || n > doc.lines) continue;
      if (doc.line(n).text === saved.anchorText) return n;
    }
  }
  for (let n = 1; n <= doc.lines; n++) {
    if (doc.line(n).text === saved.anchorText) return n;
  }
  return null;
}

export function loadSavedFolds(): SavedFold[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is SavedFold =>
        item != null &&
        typeof item === "object" &&
        typeof (item as SavedFold).anchorLine === "number" &&
        typeof (item as SavedFold).anchorText === "string" &&
        typeof (item as SavedFold).endLine === "number",
    );
  } catch {
    return [];
  }
}

export function serializeFolds(view: EditorView): SavedFold[] {
  const { doc } = view.state;
  const folds: SavedFold[] = [];
  foldedRanges(view.state).between(0, doc.length, (from, to) => {
    const anchorLine = doc.lineAt(from);
    const endLine = doc.lineAt(Math.max(from, to - 1));
    folds.push({
      anchorLine: anchorLine.number,
      anchorText: anchorLine.text,
      endLine: endLine.number,
    });
  });
  return folds;
}

export function saveFolds(view: EditorView, clearWhenEmpty = true): void {
  if (typeof window === "undefined") return;
  const folds = serializeFolds(view);
  if (folds.length === 0) {
    if (clearWhenEmpty) localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(folds));
}

export function clearSavedFolds(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

function foldRangeForSavedLine(
  state: EditorView["state"],
  doc: EditorView["state"]["doc"],
  anchorLine: number,
): { from: number; to: number } | null {
  const line = doc.line(anchorLine);
  return foldable(state, line.from, line.to);
}

/** Apply stored folds; returns how many were restored. */
export function applySavedFolds(view: EditorView): number {
  const saved = loadSavedFolds();
  if (!saved.length) return 0;

  const { state } = view;
  const { doc } = state;
  const effects: ReturnType<typeof foldEffect.of>[] = [];

  for (const fold of saved) {
    const anchorLine = findAnchorLine(doc, fold);
    if (anchorLine == null) continue;

    const range = foldRangeForSavedLine(state, doc, anchorLine);
    if (range) effects.push(foldEffect.of(range));
  }

  if (!effects.length) return 0;

  view.dispatch({
    effects,
    annotations: Transaction.addToHistory.of(false),
  });
  return effects.length;
}

const MAX_RESTORE_ATTEMPTS = 40;

export function restoreSavedFolds(view: EditorView, attempt = 0): void {
  if (!loadSavedFolds().length) return;

  forceParsing(view, view.state.doc.length, 200);
  if (!syntaxTreeAvailable(view.state) && attempt < MAX_RESTORE_ATTEMPTS) {
    window.requestAnimationFrame(() => restoreSavedFolds(view, attempt + 1));
    return;
  }

  const applied = applySavedFolds(view);
  if (applied === 0 && attempt < MAX_RESTORE_ATTEMPTS) {
    window.requestAnimationFrame(() => restoreSavedFolds(view, attempt + 1));
  }
}

export function foldPersistenceListener(
  saveDebounced: (view: EditorView) => void,
  saveNow: (view: EditorView) => void,
) {
  return EditorViewClass.updateListener.of((update) => {
    const foldChanged =
      update.startState.field(foldState, false) !== update.state.field(foldState, false);
    const foldedByUser = update.transactions.some((tr) =>
      tr.effects.some((e) => e.is(foldEffect) || e.is(unfoldEffect)),
    );
    if (foldChanged || foldedByUser) {
      saveNow(update.view);
    } else if (update.docChanged) {
      saveDebounced(update.view);
    }
  });
}
