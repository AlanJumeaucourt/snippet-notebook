import {
  extractCodeBlockAnchors,
  findCodeBlockAtLine,
  findCodeBlockByFenceLine,
  type CodeBlockAnchor,
} from "./document";
import { extractVariableNames, substituteVariables } from "./variables";
import {
  extractVarsFences,
  getEffectiveVarsForBlock,
  getGlobalVars,
  getLocalVarsForBlock,
  lookupVarInDocument,
} from "./vars-markdown";
import type { VariableConfig } from "./types";

const PLACEHOLDER_RE = /\{\{(\w+)\}\}/g;

export type PlaceholderHit = {
  name: string;
  from: number;
  to: number;
  blockStartLine?: number;
  inVarsFence: boolean;
};

function lineIndexAt(doc: string, pos: number): number {
  return doc.slice(0, pos).split("\n").length - 1;
}

export type DocFenceIndex = {
  codeBlocks: CodeBlockAnchor[];
  varsFences: ReturnType<typeof extractVarsFences>;
};

export function buildDocFenceIndex(doc: string): DocFenceIndex {
  return {
    codeBlocks: extractCodeBlockAnchors(doc),
    varsFences: extractVarsFences(doc),
  };
}

function contextAtLineIndexed(
  lineIndex: number,
  index: DocFenceIndex,
): { inVarsFence: boolean; blockStartLine?: number } | null {
  const code = index.codeBlocks.find((b) => lineIndex > b.startLine && lineIndex < b.endLine);
  if (code) return { inVarsFence: false, blockStartLine: code.startLine };

  const vars = index.varsFences.find((f) => lineIndex > f.startLine && lineIndex < f.endLine);
  if (vars) {
    return {
      inVarsFence: true,
      blockStartLine: vars.scope === "local" ? vars.blockStartLine : undefined,
    };
  }
  return null;
}

function contextAtLine(
  doc: string,
  lineIndex: number,
): { inVarsFence: boolean; blockStartLine?: number } | null {
  return contextAtLineIndexed(lineIndex, buildDocFenceIndex(doc));
}

function hitFromPlaceholder(doc: string, ph: InlinePlaceholder): PlaceholderHit | null {
  const ctx = contextAtLine(doc, lineIndexAt(doc, ph.from));
  if (!ctx) return null;
  return {
    name: ph.name,
    from: ph.from,
    to: ph.to,
    blockStartLine: ph.blockStartLine,
    inVarsFence: ctx.inVarsFence,
  };
}

export function findPlaceholderAt(doc: string, pos: number): PlaceholderHit | null {
  for (const ph of listInlinePlaceholders(doc)) {
    if (pos >= ph.from && pos <= ph.to) {
      const hit = hitFromPlaceholder(doc, ph);
      if (hit) return hit;
    }
  }
  // Clicks on the green preview widget sit at the end of the placeholder.
  for (const ph of listInlinePlaceholders(doc)) {
    if (pos === ph.to || pos === ph.to + 1) {
      const hit = hitFromPlaceholder(doc, ph);
      if (hit) return hit;
    }
  }
  return null;
}

export type InlinePlaceholder = {
  from: number;
  to: number;
  name: string;
  blockStartLine?: number;
};

export function listInlinePlaceholders(doc: string, index?: DocFenceIndex): InlinePlaceholder[] {
  const fenceIndex = index ?? buildDocFenceIndex(doc);
  const hits: InlinePlaceholder[] = [];
  let match: RegExpExecArray | null;
  PLACEHOLDER_RE.lastIndex = 0;
  while ((match = PLACEHOLDER_RE.exec(doc))) {
    const from = match.index;
    const ctx = contextAtLineIndexed(lineIndexAt(doc, from), fenceIndex);
    if (!ctx) continue;
    hits.push({
      from,
      to: from + match[0].length,
      name: match[1],
      blockStartLine: ctx.blockStartLine,
    });
  }
  return hits;
}

export function rangeIntersects(
  from: number,
  to: number,
  ranges: readonly { from: number; to: number }[],
  margin = 0,
): boolean {
  const a = from - margin;
  const b = to + margin;
  for (const r of ranges) {
    if (b > r.from && a < r.to) return true;
  }
  return false;
}

export function effectiveVarsForBlock(
  document: string,
  block: CodeBlockAnchor,
): Record<string, VariableConfig> {
  const blockVarNames = extractVariableNames(block.content);
  const effective = { ...getEffectiveVarsForBlock(document, block.startLine) };
  for (const name of blockVarNames) {
    if (!effective[name]?.options?.length) {
      const found = lookupVarInDocument(document, name, block.startLine);
      if (found) effective[name] = found;
    }
  }
  return effective;
}

/** Code block whose resolved text is shown when Ctrl/Cmd+clicking a placeholder or snippet. */
export function codeBlockForPlaceholderClick(
  doc: string,
  info: { from: number; blockStartLine?: number },
): CodeBlockAnchor | null {
  if (info.blockStartLine != null) {
    const byFence = findCodeBlockByFenceLine(doc, info.blockStartLine);
    if (byFence && extractVariableNames(byFence.content).length > 0) return byFence;
  }
  const line = lineIndexAt(doc, info.from);
  const atLine = findCodeBlockAtLine(doc, line);
  if (atLine && extractVariableNames(atLine.content).length > 0) return atLine;
  return null;
}

function varMapForBlock(
  document: string,
  block: CodeBlockAnchor,
): Record<string, { value: string }> {
  const effective = effectiveVarsForBlock(document, block);
  return Object.fromEntries(Object.entries(effective).map(([k, v]) => [k, { value: v.value }]));
}

/** Placeholder names in a snippet block that lack a resolved value at copy time. */
export function unresolvedSnippetPlaceholders(
  document: string,
  block: CodeBlockAnchor,
): string[] {
  const names = extractVariableNames(block.content);
  if (names.length === 0) return [];

  const varMap = varMapForBlock(document, block);
  const unresolved: string[] = [];
  for (const name of names) {
    const resolved = substituteVariables(`{{${name}}}`, varMap);
    if (resolved === "" || /\{\{\w+\}\}/.test(resolved)) unresolved.push(name);
  }
  return unresolved;
}

export function resolvedSnippet(document: string, block: CodeBlockAnchor): string {
  return substituteVariables(block.content, varMapForBlock(document, block));
}

export function prepareSnippetCopy(
  document: string,
  block: CodeBlockAnchor,
): { text: string; unresolved: string[] } {
  return {
    text: resolvedSnippet(document, block),
    unresolved: unresolvedSnippetPlaceholders(document, block),
  };
}

export function previewPlaceholderValue(
  document: string,
  name: string,
  blockStartLine?: number,
): string {
  const cfg = lookupVarInDocument(document, name, blockStartLine);
  if (!cfg) return "?";
  const vars = blockStartLine
    ? getEffectiveVarsForBlock(document, blockStartLine)
    : getGlobalVars(document);
  const map = Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, { value: v.value }]));
  map[name] = { value: cfg.value };
  return substituteVariables(`{{${name}}}`, map);
}

/** Resolved copy value plus friendly label when using `name = ip | LABEL:ip, …`. */
export function placeholderPreviewDisplay(
  document: string,
  name: string,
  blockStartLine?: number,
): string {
  const cfg = lookupVarInDocument(document, name, blockStartLine);
  const value = previewPlaceholderValue(document, name, blockStartLine);
  if (!cfg) return value;
  const chosen = cfg.options.find((o) => o.value === cfg.value);
  if (chosen && chosen.label !== chosen.value) {
    return `${value} (${chosen.label})`;
  }
  return value;
}

export function hasMultipleChoices(config: VariableConfig): boolean {
  const values = new Set(config.options.map((o) => o.value).filter(Boolean));
  return values.size > 1;
}

export function varPickerScope(
  document: string,
  name: string,
  blockStartLine?: number,
): "global" | "local" {
  if (blockStartLine == null) return "global";
  if (name in getLocalVarsForBlock(document, blockStartLine)) return "local";
  if (name in getGlobalVars(document)) return "global";
  return "local";
}
