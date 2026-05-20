import { SearchQuery } from "@codemirror/search";
import type { EditorState } from "@codemirror/state";

export type FindMatchStats = {
  total: number;
  /** 1-based index of the active match, or null if none selected */
  current: number | null;
};

export function computeFindMatchStats(state: EditorState, searchText: string): FindMatchStats {
  const trimmed = searchText.trim();
  if (!trimmed) return { total: 0, current: null };

  const query = new SearchQuery({ search: searchText, caseSensitive: false });
  if (!query.valid) return { total: 0, current: null };

  const matches: { from: number; to: number }[] = [];
  const cursor = query.getCursor(state, 0, state.doc.length);
  for (let next = cursor.next(); !next.done; next = cursor.next()) {
    matches.push(next.value);
  }

  if (matches.length === 0) return { total: 0, current: null };

  const { from, to } = state.selection.main;
  let idx = matches.findIndex((m) => m.from === from && m.to === to);
  if (idx < 0) {
    idx = matches.findIndex((m) => from >= m.from && to <= m.to);
  }

  return {
    total: matches.length,
    current: idx >= 0 ? idx + 1 : null,
  };
}
