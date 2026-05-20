import type { VariableConfig } from "./types";
import { optionValues } from "./vars-markdown";

const VARIABLE_PATTERN = /\{\{(\w+)\}\}/g;

export function extractVariableNames(content: string): string[] {
  const names = new Set<string>();
  for (const match of content.matchAll(VARIABLE_PATTERN)) {
    names.add(match[1]);
  }
  return [...names].sort();
}

export function mergeVariables(
  content: string,
  existing: Record<string, VariableConfig>,
): Record<string, VariableConfig> {
  const names = extractVariableNames(content);
  const merged: Record<string, VariableConfig> = {};

  for (const name of names) {
    const prev = existing[name];
    const options = prev?.options ?? [];
    const values = optionValues({ value: "", options });
    const value =
      prev?.value && values.includes(prev.value) ? prev.value : (options[0]?.value ?? "");
    merged[name] = { options, value };
  }

  return merged;
}

function resolveVariableValues(
  variables: Record<string, { value: string }>,
): Record<string, { value: string }> {
  const resolved = Object.fromEntries(
    Object.entries(variables).map(([k, v]) => [k, { value: v.value }]),
  );
  for (let pass = 0; pass < 16; pass++) {
    let changed = false;
    for (const [name, cfg] of Object.entries(resolved)) {
      const next = cfg.value.replace(VARIABLE_PATTERN, (_, ref: string) => {
        return resolved[ref]?.value ?? `{{${ref}}}`;
      });
      if (next !== cfg.value) {
        resolved[name] = { value: next };
        changed = true;
      }
    }
    if (!changed) break;
  }
  return resolved;
}

export function substituteVariables(
  content: string,
  variables: Record<string, { value: string }>,
): string {
  const resolved = resolveVariableValues(variables);
  return content.replace(VARIABLE_PATTERN, (_, name: string) => {
    return resolved[name]?.value ?? `{{${name}}}`;
  });
}
