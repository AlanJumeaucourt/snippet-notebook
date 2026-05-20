import * as React from "react";
import type { VariableConfig } from "~/lib/types";

export function VariablePicker({
  name,
  config,
  onSelect,
  onAddOption,
}: {
  name: string;
  config: VariableConfig;
  onSelect: (value: string) => void;
  onAddOption: (option: string) => void;
  onRemoveOption: (option: string) => void;
}) {
  const [draft, setDraft] = React.useState("");

  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap">
      <span className="text-(--purple) font-mono font-semibold">{`{{${name}}}`}</span>
      <select
        value={config.value}
        onChange={(e) => onSelect(e.target.value)}
        onMouseDown={(e) => e.stopPropagation()}
        className="bg-(--input-bg) border border-(--border) rounded-md px-2 py-0.5 text-[11px] outline-none focus:border-(--accent-soft) focus:ring-1 focus:ring-(--glow) max-w-[200px] transition-shadow"
      >
        {config.options.length === 0 && <option value="">—</option>}
        {config.options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            const token = draft.trim();
            if (!token) return;
            onAddOption(token);
            setDraft("");
          }
        }}
        placeholder="add value…"
        title="Add another choice — Enter. Use LABEL:value only for friendly names (e.g. PROD:10.0.0.1)"
        className="w-24 bg-(--input-bg) border border-(--border) rounded-md px-1.5 py-0.5 text-[11px] font-mono outline-none focus:border-(--cyan) placeholder:text-(--text-muted) transition-colors"
      />
    </span>
  );
}
