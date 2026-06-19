import { expect, test } from "vite-plus/test";
import { EditorState } from "@codemirror/state";
import { findAnchorLine, type SavedFold } from "./fold-persistence";

function docOf(lines: string[]) {
  return EditorState.create({ doc: lines.join("\n") }).doc;
}

test("findAnchorLine prefers exact line when text matches", () => {
  const doc = docOf(["# A", "body", "# B", "more"]);
  const saved: SavedFold = { anchorLine: 1, anchorText: "# A", endLine: 2 };
  expect(findAnchorLine(doc, saved)).toBe(1);
});

test("findAnchorLine relocates after lines inserted above", () => {
  const doc = docOf(["inserted", "# A", "body", "# B"]);
  const saved: SavedFold = { anchorLine: 1, anchorText: "# A", endLine: 2 };
  expect(findAnchorLine(doc, saved)).toBe(2);
});

test("findAnchorLine returns null when anchor text is gone", () => {
  const doc = docOf(["# X", "body"]);
  const saved: SavedFold = { anchorLine: 1, anchorText: "# A", endLine: 2 };
  expect(findAnchorLine(doc, saved)).toBeNull();
});
