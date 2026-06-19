import type { RegexTarget, VarOption, VariableConfig } from "./types";

const FENCE_OPEN_RE = /^```([^\n`]+?)\s*$/;
const VAR_LINE_RE = /^(\w+)\s*=\s*(.+)$/;
const COLON_VAR_LINE_RE = /^(\w+)\s*:\s*(.+)$/;
const REGEX_LITERAL_RE = /^\/((?:\\.|[^/])+)\/([gimsuy]*)$/;

export function parseRegexLiteral(text: string): { pattern: string; flags: string } | null {
  const match = text.trim().match(REGEX_LITERAL_RE);
  if (!match) return null;
  return { pattern: match[1], flags: match[2] ?? "" };
}

export function formatRegexLiteral(pattern: string, flags = ""): string {
  return `/${pattern}/${flags}`;
}

export function parseRegexSelector(text: string): {
  pattern: string;
  flags: string;
  target: RegexTarget;
} | null {
  const trimmed = text.trim();
  const prefixMatch = trimmed.match(/^(name|n|value|v|both|b):(.+)$/i);
  let target: RegexTarget = "both";
  let literal = trimmed;
  if (prefixMatch) {
    const p = prefixMatch[1].toLowerCase();
    target = p === "v" || p === "value" ? "value" : p === "b" || p === "both" ? "both" : "name";
    literal = prefixMatch[2].trim();
  }
  const parsed = parseRegexLiteral(literal);
  if (!parsed) return null;
  return { ...parsed, target };
}

export function formatRegexSelector(
  pattern: string,
  flags = "",
  target: RegexTarget = "both",
): string {
  const lit = formatRegexLiteral(pattern, flags);
  if (target === "value") return `value:${lit}`;
  if (target === "name") return `name:${lit}`;
  return lit;
}

function globalMatchesRegex(re: RegExp, target: RegexTarget, name: string, val: string): boolean {
  switch (target) {
    case "name":
      return re.test(name);
    case "value":
      return re.test(val);
    case "both":
      return re.test(name) || re.test(val);
  }
}

/** Build picker options from globals matching `config.regex` on name, value, or both. */
export function expandRegexVar(doc: string, config: VariableConfig): VariableConfig {
  if (!config.regex) return config;

  let re: RegExp;
  try {
    re = new RegExp(config.regex, config.regexFlags ?? "");
  } catch {
    return config;
  }

  const target = config.regexTarget ?? "both";
  const globals = getGlobalVars(doc);
  const options: VarOption[] = [];
  for (const [name, globalCfg] of Object.entries(globals)) {
    if (!globalMatchesRegex(re, target, name, globalCfg.value)) continue;
    options.push({ label: name, value: globalCfg.value });
  }
  options.sort((a, b) => a.label.localeCompare(b.label));

  const value = options.some((o) => o.value === config.value)
    ? config.value
    : (options[0]?.value ?? "");

  return { ...config, value, options };
}

function materializeVarConfig(doc: string, config: VariableConfig): VariableConfig {
  return config.regex ? expandRegexVar(doc, config) : config;
}

/** Regex picker options are computed from globals — only persist pattern + selection. */
function storeRegexVar(config: VariableConfig): VariableConfig {
  if (!config.regex) return config;
  return {
    value: config.value,
    options: [],
    regex: config.regex,
    regexFlags: config.regexFlags,
    regexTarget: config.regexTarget,
    syntax: "equals",
  };
}

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
  if (config.syntax === "colon" && !config.regex) {
    return `${name}:${config.value || ""}`;
  }

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

  if (config.regex) {
    const pattern = formatRegexSelector(
      config.regex,
      config.regexFlags ?? "",
      config.regexTarget ?? "both",
    );
    if (config.value) {
      return `${name} = ${config.value} | ${pattern}`;
    }
    return `${name} = ${pattern}`;
  }

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

function regexConfigFromSelector(
  selector: { pattern: string; flags: string; target: RegexTarget },
  syntax: "colon" | "equals",
): VariableConfig {
  return {
    value: "",
    options: [],
    regex: selector.pattern,
    regexFlags: selector.flags || undefined,
    regexTarget: selector.target,
    syntax,
  };
}

function parseVarAssignment(
  name: string,
  rest: string,
  syntax: "colon" | "equals" = "equals",
): { name: string; config: VariableConfig } {
  const pipeIdx = rest.indexOf("|");
  const mainPart = pipeIdx >= 0 ? rest.slice(0, pipeIdx).trim() : rest.trim();
  const regexSelector = parseRegexSelector(mainPart);

  if (regexSelector) {
    const config = regexConfigFromSelector(regexSelector, syntax);
    return { name, config };
  }

  if (pipeIdx >= 0) {
    const value = mainPart;
    const tokens = rest
      .slice(pipeIdx + 1)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const regexToken = tokens.length > 0 ? parseRegexSelector(tokens[0]) : null;
    if (regexToken) {
      const base = regexConfigFromSelector(regexToken, syntax);
      return {
        name,
        config: {
          ...base,
          value,
          options: [],
        },
      };
    }

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
      config: { value: resolved, options, syntax },
    };
  }

  const single = mainPart;
  return {
    name,
    config: {
      value: single,
      options: single ? [{ label: single, value: single }] : [],
      syntax,
    },
  };
}

export function parseVarLine(line: string): { name: string; config: VariableConfig } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;

  const equalsMatch = trimmed.match(VAR_LINE_RE);
  if (equalsMatch) {
    return parseVarAssignment(equalsMatch[1], equalsMatch[2].trim());
  }

  const colonMatch = trimmed.match(COLON_VAR_LINE_RE);
  if (colonMatch) {
    return parseVarAssignment(colonMatch[1], colonMatch[2].trim(), "colon");
  }

  return null;
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
    if (local) return materializeVarConfig(doc, local);
  }
  const global = getGlobalVars(doc)[name];
  return global ? materializeVarConfig(doc, global) : undefined;
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
  const merged = {
    ...getGlobalVars(doc),
    ...getLocalVarsForBlock(doc, blockStartLine),
  };
  return Object.fromEntries(
    Object.entries(merged).map(([name, cfg]) => [name, materializeVarConfig(doc, cfg)]),
  );
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
    const stored = Object.fromEntries(Object.entries(vars).map(([n, c]) => [n, storeRegexVar(c)]));
    return replaceFenceBody(lines, fence, stored).join("\n");
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
  const raw =
    scope === "global"
      ? getGlobalVars(doc)[name]
      : blockStartLine != null
        ? getLocalVarsForBlock(doc, blockStartLine)[name]
        : undefined;

  const fallback = blockStartLine != null ? getGlobalVars(doc)[name] : undefined;

  const current = raw ?? fallback;

  const config: VariableConfig = current?.regex
    ? storeRegexVar({ ...current, value })
    : current
      ? { ...current, value }
      : { value, options: [{ label: value, value }], syntax: "equals" };

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
    regex: config.regex,
    regexFlags: config.regexFlags,
    regexTarget: config.regexTarget,
    syntax: config.syntax,
  };
}

function formatRedactedVarLine(name: string, config: VariableConfig): string {
  const redacted = redactVariableConfig(config);
  if (redacted.regex) {
    return formatVarLine(name, redacted);
  }
  if (redacted.syntax === "colon") {
    return `${name}:${redacted.value}`;
  }
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
