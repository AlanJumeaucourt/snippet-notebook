import { initialNotebook } from "./defaults";
import type { NotebookData } from "./types";

const STORAGE_KEY = "snippet-notebook";

export function loadNotebook(): NotebookData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as NotebookData;
    if (typeof data.document !== "string") return null;
    return { document: data.document };
  } catch {
    return null;
  }
}

export function saveNotebook(data: NotebookData): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function clearNotebookStorage(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export { initialNotebook };
