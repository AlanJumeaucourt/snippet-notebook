import type { NotebookData } from "./types";
import defaultDocument from "./default-document.md?raw";

export const DEFAULT_DOCUMENT = defaultDocument;

export function initialNotebook(): NotebookData {
  return { document: DEFAULT_DOCUMENT };
}
