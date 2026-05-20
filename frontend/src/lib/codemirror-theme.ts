import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";

/** Monokai / Sublime-inspired palette */
export const palette = {
  bg: "#1e1e1e",
  gutter: "#252526",
  gutterActive: "#2d2d30",
  lineHighlight: "#2a2d2e",
  border: "#3e3e42",
  text: "#d4d4d4",
  muted: "#858585",
  heading: "#569cd6",
  heading2: "#4ec9b0",
  accent: "#ce9178",
  keyword: "#c586c0",
  string: "#ce9178",
  number: "#b5cea8",
  comment: "#6a9955",
  fence: "#808080",
  variable: "#c678dd",
  varName: "#9cdcfe",
  varValue: "#b5cea8",
  varPipe: "#858585",
  selection: "#264f78",
  cursor: "#aeafad",
  purple: "#c678dd",
  cyan: "#56b6c2",
  yellow: "#dcdcaa",
  /** Snippet placeholders {{name}} — same everywhere */
  placeholder: "#e5b3ff",
  placeholderBg: "rgba(198, 120, 221, 0.22)",
  placeholderBorder: "rgba(198, 120, 221, 0.45)",
  /** Resolved preview after placeholder */
  preview: "#98c379",
  previewMuted: "rgba(152, 195, 121, 0.75)",
};

/** Inline style so bash/shell highlighter cannot recolor `$…{{var}}` differently. */
export const PLACEHOLDER_MARK_STYLE = [
  `color: ${palette.placeholder}`,
  `box-shadow: inset 0 0 0 1px ${palette.placeholderBorder}`,
  "border-radius: 3px",
  "font-weight: 600",
].join("; ");

export const notebookTheme = EditorView.theme(
  {
    "&": {
      height: "100%",
      backgroundColor: palette.bg,
      color: palette.text,
      fontSize: "13px",
    },
    ".cm-content": {
      fontFamily: "ui-monospace, 'SF Mono', 'Fira Code', Menlo, Monaco, Consolas, monospace",
      padding: "16px 0",
      caretColor: palette.cursor,
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: palette.cursor,
    },
    ".cm-line::selection, .cm-line *::selection": {
      backgroundColor: `${palette.selection} !important`,
      color: "inherit !important",
    },
    ".cm-gutters": {
      backgroundColor: palette.gutter,
      color: palette.muted,
      borderRight: `1px solid ${palette.border}`,
    },
    ".cm-activeLineGutter": {
      backgroundColor: palette.gutterActive,
      color: palette.text,
    },
    ".cm-activeLine": {
      backgroundColor: palette.lineHighlight,
    },
    ".cm-lineNumbers .cm-gutterElement": {
      padding: "0 10px 0 16px",
      minWidth: "3ch",
    },
    ".cm-scroller": {
      overflow: "auto",
      fontFamily: "inherit",
    },
    ".cm-variable-placeholder": {
      color: `${palette.placeholder} !important`,
      fontWeight: "600",
      borderRadius: "3px",
      boxShadow: `inset 0 0 0 1px ${palette.placeholderBorder}`,
    },
    ".cm-variable-clickable:hover": {
      backgroundColor: "rgba(198, 120, 221, 0.18) !important",
    },
    ".cm-var-preview": {
      color: `${palette.preview} !important`,
      fontStyle: "normal",
      fontWeight: "500",
      opacity: "1",
    },
    ".cm-vars-fence": {
      color: palette.cyan,
      fontWeight: "600",
    },
    ".cm-var-assignment": {
      color: palette.varName,
      fontWeight: "600",
    },
    ".cm-var-value": {
      color: palette.varValue,
    },
    ".cm-var-pipe": {
      color: palette.varPipe,
    },
    ".cm-var-option": {
      color: palette.yellow,
    },
    ".cm-fenced-code": {
      color: palette.yellow,
    },
    ".cm-searchMatch": {
      backgroundColor: "rgba(86, 156, 246, 0.42) !important",
      borderRadius: "2px",
      boxShadow: "inset 0 -2px 0 rgba(86, 156, 246, 0.85)",
    },
    ".cm-searchMatch-selected": {
      backgroundColor: "rgba(206, 145, 120, 0.5) !important",
      boxShadow: "inset 0 -2px 0 rgba(206, 145, 120, 1), 0 0 0 1px rgba(206, 145, 120, 0.65)",
    },
    ".cm-searchMatch .cm-selectionMatch": {
      backgroundColor: `${palette.selection} !important`,
    },
  },
  { dark: true },
);

export const notebookHighlight = HighlightStyle.define([
  { tag: t.heading1, color: palette.heading, fontWeight: "bold" },
  { tag: t.heading2, color: palette.heading2, fontWeight: "bold" },
  { tag: t.heading3, color: palette.cyan, fontWeight: "bold" },
  { tag: t.heading4, color: palette.cyan },
  { tag: t.heading5, color: palette.muted },
  { tag: t.heading6, color: palette.muted },
  { tag: t.strong, color: palette.yellow, fontWeight: "bold" },
  { tag: t.emphasis, color: palette.heading2, fontStyle: "italic" },
  { tag: t.strikethrough, color: palette.muted, textDecoration: "line-through" },
  { tag: t.link, color: palette.heading, textDecoration: "underline" },
  { tag: t.url, color: palette.string },
  { tag: t.monospace, color: palette.accent },
  { tag: t.comment, color: palette.comment, fontStyle: "italic" },
  { tag: t.processingInstruction, color: palette.fence },
  { tag: t.keyword, color: palette.keyword },
  { tag: t.string, color: palette.string },
  { tag: t.number, color: palette.number },
  { tag: t.bool, color: palette.keyword },
  { tag: t.separator, color: palette.fence },
  { tag: t.contentSeparator, color: palette.border },
  { tag: t.variableName, color: palette.varName },
  { tag: t.function(t.variableName), color: palette.cyan },
  { tag: t.function(t.propertyName), color: palette.cyan },
  { tag: t.propertyName, color: palette.varName },
  { tag: t.operator, color: palette.muted },
  { tag: t.punctuation, color: palette.muted },
  { tag: t.regexp, color: palette.string },
  { tag: t.special(t.string), color: palette.yellow },
  { tag: t.definition(t.variableName), color: palette.cyan },
]);

export const notebookSyntax = syntaxHighlighting(notebookHighlight);
