import type { DocCodeBlock, DocHeading, DocNode } from "./types";
import { isVarsFence } from "./vars-markdown";

const HEADING_RE = /^(#{1,6})\s+(.+)$/;
const FENCE_OPEN_RE = /^```([^\n`]+?)\s*$/;

export type HeadingAnchor = DocHeading & { line: number };

export type CodeBlockAnchor = DocCodeBlock & {
  startLine: number;
  endLine: number;
};

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/** Stable id for a heading title (same rules as the sidebar outline). */
export function headingIdForText(text: string, slugCounts: Map<string, number>): string {
  const base = slugify(text) || "section";
  const count = slugCounts.get(base) ?? 0;
  slugCounts.set(base, count + 1);
  return count === 0 ? base : `${base}-${count}`;
}

const INTERNAL_LINK_RE = /\[([^\]]*)\]\(#([^)]+)\)/g;

/** Anchor id when the cursor is on a `[label](#anchor)` link (Ctrl/Cmd+click to jump). */
export function internalLinkTargetAt(doc: string, pos: number): string | null {
  let match: RegExpExecArray | null;
  INTERNAL_LINK_RE.lastIndex = 0;
  while ((match = INTERNAL_LINK_RE.exec(doc))) {
    const start = match.index;
    const end = start + match[0].length;
    if (pos >= start && pos < end) return match[2];
  }
  return null;
}

export function findHeadingLineByAnchorId(doc: string, anchorId: string): number | null {
  const slugCounts = new Map<string, number>();
  const lines = doc.split("\n");
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const m = lines[lineIndex].match(HEADING_RE);
    if (!m) continue;
    const id = headingIdForText(m[2].trim(), slugCounts);
    if (id === anchorId) return lineIndex;
  }
  return null;
}

export function parseDocument(doc: string): DocNode[] {
  const lines = doc.split("\n");
  const nodes: DocNode[] = [];
  const slugCounts = new Map<string, number>();
  let blockIndex = 0;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const headingMatch = line.match(HEADING_RE);
    if (headingMatch) {
      const text = headingMatch[2].trim();
      nodes.push({
        type: "heading",
        id: headingIdForText(text, slugCounts),
        level: headingMatch[1].length,
        text,
      });
      i++;
      continue;
    }

    if (FENCE_OPEN_RE.test(line)) {
      const lang = line.match(FENCE_OPEN_RE)?.[1] ?? "";
      if (isVarsFence(lang)) {
        i++;
        while (i < lines.length && !/^```\s*$/.test(lines[i])) i++;
        if (i < lines.length) i++;
        continue;
      }
      const contentLines: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        contentLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++;
      const id = `block-${blockIndex++}`;
      nodes.push({
        type: "code",
        id,
        lang,
        content: contentLines.join("\n"),
      });
      continue;
    }

    const textLines: string[] = [];
    while (i < lines.length && !HEADING_RE.test(lines[i]) && !FENCE_OPEN_RE.test(lines[i])) {
      textLines.push(lines[i]);
      i++;
    }
    const content = textLines.join("\n");
    if (content.trim()) {
      nodes.push({ type: "text", content });
    }
  }

  return nodes;
}

export function extractHeadingAnchors(doc: string): HeadingAnchor[] {
  const lines = doc.split("\n");
  const slugCounts = new Map<string, number>();
  const anchors: HeadingAnchor[] = [];

  lines.forEach((line, lineIndex) => {
    const match = line.match(HEADING_RE);
    if (!match) return;
    const text = match[2].trim();
    const id = headingIdForText(text, slugCounts);
    anchors.push({
      id,
      level: match[1].length,
      text,
      line: lineIndex,
    });
  });

  return anchors;
}

export function extractCodeBlockAnchors(doc: string): CodeBlockAnchor[] {
  const lines = doc.split("\n");
  const anchors: CodeBlockAnchor[] = [];
  let blockIndex = 0;
  let i = 0;

  while (i < lines.length) {
    if (FENCE_OPEN_RE.test(lines[i])) {
      const lang = lines[i].match(FENCE_OPEN_RE)?.[1] ?? "";
      if (isVarsFence(lang)) {
        i++;
        while (i < lines.length && !/^```\s*$/.test(lines[i])) i++;
        if (i < lines.length) i++;
        continue;
      }
      const startLine = i;
      const contentLines: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        contentLines.push(lines[i]);
        i++;
      }
      const endLine = i < lines.length ? i : lines.length - 1;
      if (i < lines.length) i++;
      anchors.push({
        type: "code",
        id: `block-${blockIndex++}`,
        lang,
        content: contentLines.join("\n"),
        startLine,
        endLine,
      });
      continue;
    }
    i++;
  }

  return anchors;
}

export function findCodeBlockAtLine(doc: string, lineIndex: number): CodeBlockAnchor | null {
  const blocks = extractCodeBlockAnchors(doc);
  return blocks.find((b) => lineIndex > b.startLine && lineIndex < b.endLine) ?? null;
}

/** Resolve a code block by its opening fence line (stable across var edits). */
export function findCodeBlockByFenceLine(
  doc: string,
  fenceStartLine: number,
): CodeBlockAnchor | null {
  return extractCodeBlockAnchors(doc).find((b) => b.startLine === fenceStartLine) ?? null;
}

export function activeHeadingForLine(headings: HeadingAnchor[], lineIndex: number): string | null {
  let active: string | null = headings[0]?.id ?? null;
  for (const h of headings) {
    if (h.line <= lineIndex) active = h.id;
    else break;
  }
  return active;
}

export function serializeDocument(nodes: DocNode[]): string {
  const parts: string[] = [];

  for (const node of nodes) {
    if (node.type === "heading") {
      parts.push(`${"#".repeat(node.level)} ${node.text}`, "");
    } else if (node.type === "code") {
      const lang = node.lang ? node.lang : "";
      parts.push("```" + lang, node.content, "```", "");
    } else if (node.type === "text") {
      parts.push(node.content, "");
    }
  }

  return parts.join("\n").replace(/\n+$/, "") + "\n";
}

export function extractHeadings(nodes: DocNode[]): DocHeading[] {
  return nodes
    .filter((n): n is Extract<DocNode, { type: "heading" }> => n.type === "heading")
    .map(({ id, level, text }) => ({ id, level, text }));
}

export function extractCodeBlocks(nodes: DocNode[]): DocCodeBlock[] {
  return nodes.filter((n): n is DocCodeBlock => n.type === "code");
}

export function appendSectionMarkdown(doc: string): string {
  const trimmed = doc.replace(/\n+$/, "");
  return `${trimmed}\n\n## New section\n\nNotes here.\n\n\`\`\`\n\n\`\`\`\n`;
}
