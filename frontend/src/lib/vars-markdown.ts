import type { VarOption, VariableConfig } from "./types";

const FENCE_OPEN_RE = /^```([^\n`]+?)\s*$/;
const VAR_LINE_RE = /^(\w+)\s*=\s*(.+)$/;

export type VarsFenceAnchor = {
  scope: "global" | "local";
  startLine: number;
  endLine: number;
  vars: Record<string, VariableConfig>;
  blockStartLine?: number;
};

export function parseOptionToken(token: string): VarOption {
  const trimmed = token.trim();
  const colon = trimmed.indexOf(":");
  if (colon > 0) {
    return {
      label: trimmed.slice(0, colon).trim(),
      value: trimmed.slice(colon + 1).trim(),
    };
  }
  return { label: trimmed, value: trimmed };
}

export function formatOptionToken(opt: VarOption): string {
  return opt.label === opt.value ? opt.value : `${opt.label}:${opt.value}`;
}

export function optionValues(config: VariableConfig): string[] {
  return config.options.map((o) => o.value);
}

export function isVarsFence(lang: string): boolean {
  const tag = lang.trim();
  return tag === "vars" || tag.startsWith("vars ");
}

export function isVarsGlobal(lang: string): boolean {
  return lang.trim().includes("global");
}

export function formatVarLine(name: string, config: VariableConfig): string {
  const seen = new Set<string>();
  const options: VarOption[] = [];
  const add = (opt: VarOption) => {
    const key = opt.value;
    if (!key || seen.has(key)) return;
    seen.add(key);
    options.push(opt);
  };

  const current = config.options.find((o) => o.value === config.value);
  if (current) add(current);
  else if (config.value) add({ label: config.value, value: config.value });
  for (const o of config.options) add(o);

  if (options.length <= 1) {
    return `${name} = ${config.value || options[0]?.value || ""}`;
  }

  // After `|`, list choices only — not the same unlabeled value as the selection.
  const pipeOptions = options.filter((o) => !(o.label === o.value && o.value === config.value));

  if (pipeOptions.length === 0) {
    return `${name} = ${config.value}`;
  }

  return `${name} = ${config.value} | ${pipeOptions.map(formatOptionToken).join(", ")}`;
}

export function parseVarLine(line: string): { name: string; config: VariableConfig } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const match = trimmed.match(VAR_LINE_RE);
  if (!match) return null;

  const name = match[1];
  const rest = match[2].trim();
  const pipeIdx = rest.indexOf("|");

  if (pipeIdx >= 0) {
    const value = rest.slice(0, pipeIdx).trim();
    const tokens = rest
      .slice(pipeIdx + 1)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const parsed = tokens.map(parseOptionToken);
    const byValue = new Map<string, VarOption>();
    if (value) {
      const direct = parsed.find((o) => o.value === value || o.label === value);
      byValue.set(direct?.value ?? value, direct ?? { label: value, value });
    }
    for (const o of parsed) byValue.set(o.value, o);
    const options = [...byValue.values()];
    const resolved = options.find((o) => o.value === value)?.value ?? options[0]?.value ?? value;
    return {
      name,
      config: { value: resolved, options },
    };
  }

  const single = rest;
  return {
    name,
    config: {
      value: single,
      options: single ? [{ label: single, value: single }] : [],
    },
  };
}

export function parseVarsBlockContent(content: string): Record<string, VariableConfig> {
  const vars: Record<string, VariableConfig> = {};
  for (const line of content.split("\n")) {
    const parsed = parseVarLine(line);
    if (parsed) vars[parsed.name] = parsed.config;
  }
  return vars;
}

export function extractVarsFences(doc: string): VarsFenceAnchor[] {
  const lines = doc.split("\n");
  const fences: VarsFenceAnchor[] = [];
  let pendingLocal: VarsFenceAnchor | null = null;
  let i = 0;

  while (i < lines.length) {
    const open = lines[i].match(FENCE_OPEN_RE);
    if (!open) {
      i++;
      continue;
    }

    const lang = open[1];
    const startLine = i;

    if (isVarsFence(lang)) {
      const contentLines: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        contentLines.push(lines[i]);
        i++;
      }
      const endLine = i < lines.length ? i : lines.length - 1;
      if (i < lines.length) i++;

      const fence: VarsFenceAnchor = {
        scope: isVarsGlobal(lang) ? "global" : "local",
        startLine,
        endLine,
        vars: parseVarsBlockContent(contentLines.join("\n")),
      };
      fences.push(fence);
      if (fence.scope === "local") pendingLocal = fence;
      continue;
    }

    i++;
    while (i < lines.length && !/^```\s*$/.test(lines[i])) i++;
    if (i < lines.length) i++;

    if (pendingLocal) {
      pendingLocal.blockStartLine = startLine;
      pendingLocal = null;
    }
  }

  return fences;
}

export function getGlobalVars(doc: string): Record<string, VariableConfig> {
  const merged: Record<string, VariableConfig> = {};
  for (const fence of extractVarsFences(doc)) {
    if (fence.scope === "global") {
      Object.assign(merged, fence.vars);
    }
  }
  return merged;
}

export function lookupVarInDocument(
  doc: string,
  name: string,
  blockStartLine?: number,
): VariableConfig | undefined {
  if (blockStartLine != null) {
    const local = getLocalVarsForBlock(doc, blockStartLine)[name];
    if (local) return local;
  }
  return getGlobalVars(doc)[name];
}

export function getLocalVarsForBlock(
  doc: string,
  blockStartLine: number,
): Record<string, VariableConfig> {
  const fence = extractVarsFences(doc).find(
    (f) => f.scope === "local" && f.blockStartLine === blockStartLine,
  );
  return fence?.vars ?? {};
}

export function getEffectiveVarsForBlock(
  doc: string,
  blockStartLine: number,
): Record<string, VariableConfig> {
  return {
    ...getGlobalVars(doc),
    ...getLocalVarsForBlock(doc, blockStartLine),
  };
}

function replaceFenceBody(
  lines: string[],
  fence: VarsFenceAnchor,
  vars: Record<string, VariableConfig>,
): string[] {
  const body = Object.entries(vars).map(([name, cfg]) => formatVarLine(name, cfg));
  const next = [...lines];
  next.splice(fence.startLine + 1, fence.endLine - fence.startLine - 1, ...body);
  return next;
}

function findGlobalFenceForVar(doc: string, name: string): VarsFenceAnchor | undefined {
  const globals = extractVarsFences(doc).filter((f) => f.scope === "global");
  return globals.findLast((f) => name in f.vars) ?? globals.at(-1) ?? globals[0];
}

function findLocalFence(doc: string, blockStartLine: number): VarsFenceAnchor | undefined {
  return extractVarsFences(doc).find(
    (f) => f.scope === "local" && f.blockStartLine === blockStartLine,
  );
}

export function setVarInDocument(
  doc: string,
  scope: "global" | "local",
  name: string,
  config: VariableConfig,
  blockStartLine?: number,
): string {
  const lines = doc.split("\n");
  const fence =
    scope === "global"
      ? findGlobalFenceForVar(doc, name)
      : blockStartLine != null
        ? findLocalFence(doc, blockStartLine)
        : undefined;

  if (fence) {
    const vars = { ...fence.vars, [name]: config };
    return replaceFenceBody(lines, fence, vars).join("\n");
  }

  if (scope === "global") {
    const block = ["```vars global", formatVarLine(name, config), "```", ""];
    return [...block, doc].join("\n");
  }

  if (blockStartLine == null) return doc;

  const insert = ["```vars", formatVarLine(name, config), "```", ""];
  const next = [...lines];
  next.splice(blockStartLine, 0, ...insert);
  return next.join("\n");
}

export function updateVarValue(
  doc: string,
  scope: "global" | "local",
  name: string,
  value: string,
  blockStartLine?: number,
): string {
  const current =
    scope === "global"
      ? getGlobalVars(doc)[name]
      : blockStartLine != null
        ? (getLocalVarsForBlock(doc, blockStartLine)[name] ?? getGlobalVars(doc)[name])
        : undefined;

  const config: VariableConfig = current
    ? { ...current, value }
    : { value, options: [{ label: value, value }] };

  if (scope === "local" && blockStartLine != null) {
    const local = getLocalVarsForBlock(doc, blockStartLine);
    if (local[name]) {
      return setVarInDocument(doc, "local", name, config, blockStartLine);
    }
    if (getGlobalVars(doc)[name]) {
      return setVarInDocument(
        doc,
        "local",
        name,
        { ...getGlobalVars(doc)[name], value },
        blockStartLine,
      );
    }
  }

  return setVarInDocument(doc, scope, name, config, blockStartLine);
}

export function addVarOption(
  doc: string,
  scope: "global" | "local",
  name: string,
  option: string,
  blockStartLine?: number,
): string {
  const trimmed = option.trim();
  if (!trimmed) return doc;

  const parsed = parseOptionToken(trimmed);
  const base =
    scope === "global"
      ? getGlobalVars(doc)[name]
      : blockStartLine != null
        ? getEffectiveVarsForBlock(doc, blockStartLine)[name]
        : undefined;

  const config: VariableConfig = base ?? {
    value: parsed.value,
    options: [],
  };
  if (config.options.some((o) => o.value === parsed.value)) return doc;

  return setVarInDocument(
    doc,
    scope,
    name,
    {
      value: config.value || parsed.value,
      options: [...config.options, parsed],
    },
    blockStartLine,
  );
}

export function varsFenceToMarkdown(vars: Record<string, VariableConfig>, global = false): string {
  const tag = global ? "vars global" : "vars";
  const body = Object.entries(vars).map(([n, c]) => formatVarLine(n, c));
  return ["```" + tag, ...body, "```"].join("\n");
}

const VAR_REF_RE = /^\{\{\w+\}\}$/;

function isVarReference(value: string): boolean {
  return VAR_REF_RE.test(value.trim());
}

/** Strip secret values from a var; keep `{{other_var}}` cross-references. */
export function redactVariableConfig(config: VariableConfig): VariableConfig {
  const redact = (v: string) => (isVarReference(v) ? v : "");
  return {
    value: redact(config.value),
    options: config.options.map((o) => ({
      label: o.label === o.value && !isVarReference(o.value) ? "…" : o.label,
      value: redact(o.value),
    })),
  };
}

function formatRedactedVarLine(name: string, config: VariableConfig): string {
  const redacted = redactVariableConfig(config);
  const pipeOptions = redacted.options.filter(
    (o) => !(o.label === "…" && o.value === redacted.value),
  );
  if (pipeOptions.length <= 1 && !redacted.options.some((o) => o.label !== "…")) {
    return `${name} = ${redacted.value}`;
  }
  const tokens = pipeOptions.map((o) =>
    o.label !== o.value && o.label !== "…" ? `${o.label}:` : "…",
  );
  const unique = [...new Set(tokens)];
  if (unique.length === 0 || (unique.length === 1 && unique[0] === "…")) {
    return `${name} = ${redacted.value}`;
  }
  return `${name} = ${redacted.value} | ${unique.join(", ")}`;
}

/** Full notebook markdown safe to share: snippets unchanged, vars fence values cleared. */
export function documentForSharing(doc: string): string {
  const fences = extractVarsFences(doc);
  if (fences.length === 0) return doc;

  let lines = doc.split("\n");
  for (const fence of [...fences].sort((a, b) => b.startLine - a.startLine)) {
    const body = Object.entries(fence.vars).map(([name, cfg]) => formatRedactedVarLine(name, cfg));
    const next = [...lines];
    next.splice(fence.startLine + 1, fence.endLine - fence.startLine - 1, ...body);
    lines = next;
  }
  return lines.join("\n");
}
