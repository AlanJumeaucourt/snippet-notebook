import * as React from "react";
import { AddOptionField } from "~/components/AddOptionField";
import { VariablePicker } from "~/components/VariablePicker";
import { fuzzyFilterOptions } from "~/lib/fuzzy-match";
import { hasMultipleChoices, previewPlaceholderValue, varPickerScope } from "~/lib/snippet-vars";
import type { VariableConfig, VarOption } from "~/lib/types";
import { lookupVarInDocument } from "~/lib/vars-markdown";

function VariableOptionList({
  name,
  options,
  value,
  onSelect,
  onAdd,
}: {
  name: string;
  options: VarOption[];
  value: string;
  onSelect: (value: string) => void;
  onAdd: (option: string) => void;
}) {
  const searchRef = React.useRef<HTMLInputElement>(null);
  const [query, setQuery] = React.useState("");
  const filtered = React.useMemo(() => fuzzyFilterOptions(options, query), [options, query]);

  React.useEffect(() => {
    searchRef.current?.focus();
  }, []);

  return (
    <div className="space-y-1">
      <p className="text-[10px] text-(--text-muted) mb-2">
        Pick one — the <strong>value</strong> (e.g. IP) is copied into the snippet, not the label.
      </p>
      {options.length >= 4 ? (
        <input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          placeholder="Search…"
          aria-label={`Search ${name} options`}
          className="w-full mb-2 bg-(--input-bg) border border-(--border) rounded-md px-2.5 py-1.5 text-[11px] font-mono outline-none focus:border-(--accent-soft) focus:ring-1 focus:ring-(--glow) placeholder:text-(--text-muted)"
        />
      ) : null}
      <ul
        className="space-y-1 max-h-52 overflow-y-auto overscroll-contain"
        role="listbox"
        aria-label={`${name} options`}
      >
        {filtered.map((opt) => {
          const selected = value === opt.value;
          return (
            <li key={`${opt.label}:${opt.value}`}>
              <button
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => onSelect(opt.value)}
                className={`w-full text-left px-2.5 py-2 rounded-md border transition-colors ${
                  selected
                    ? "border-(--accent-soft) bg-(--selection) text-(--text-bright)"
                    : "border-transparent hover:bg-(--hover) text-(--text)"
                }`}
              >
                {opt.label === opt.value ? (
                  <span className="font-mono text-[11px]">{opt.value}</span>
                ) : (
                  <>
                    <span className="font-semibold text-(--cyan)">{opt.label}</span>
                    <span className="ml-2 font-mono text-[10px] text-(--text-muted)">
                      {opt.value}
                    </span>
                  </>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {filtered.length === 0 ? (
        <p className="text-[10px] text-(--text-muted) px-1 py-2">
          No matches for “{query.trim()}”.
        </p>
      ) : null}
      <AddOptionField onAdd={onAdd} />
    </div>
  );
}

export function VariablePopover({
  document,
  name,
  blockStartLine,
  anchor,
  onClose,
  onSetGlobal,
  onSetLocal,
  onAddGlobalOption,
  onAddLocalOption,
}: {
  document: string;
  name: string;
  blockStartLine?: number;
  anchor: { x: number; y: number };
  onClose: () => void;
  onSetGlobal: (name: string, value: string) => void;
  onSetLocal: (blockStart: number, name: string, value: string) => void;
  onAddGlobalOption: (name: string, option: string) => void;
  onAddLocalOption: (blockStart: number, name: string, option: string) => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const config =
    lookupVarInDocument(document, name, blockStartLine) ??
    ({ value: "", options: [] } satisfies VariableConfig);
  const preview = previewPlaceholderValue(document, name, blockStartLine);
  const scope = varPickerScope(document, name, blockStartLine);
  const multi = hasMultipleChoices(config);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);

    const onDown = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node)) return;
      onClose();
    };
    const attach = window.setTimeout(() => {
      window.addEventListener("mousedown", onDown, true);
    }, 0);

    return () => {
      window.clearTimeout(attach);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown, true);
    };
  }, [onClose]);

  const setValue = (value: string) => {
    if (scope === "local" && blockStartLine != null) {
      onSetLocal(blockStartLine, name, value);
    } else {
      onSetGlobal(name, value);
    }
    onClose();
  };

  const addOption = (option: string) => {
    if (scope === "local" && blockStartLine != null) {
      onAddLocalOption(blockStartLine, name, option);
    } else {
      onAddGlobalOption(name, option);
    }
  };

  const pad = 12;
  const popoverW = Math.min(420, window.innerWidth - pad * 2);
  const popoverH = Math.min(320, window.innerHeight - pad * 2);

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[min(280px,calc(100vw-24px))] max-w-[min(420px,calc(100vw-24px))] rounded-lg border border-(--border) bg-(--panel) shadow-[0_12px_40px_rgba(0,0,0,0.45)] p-3 max-md:p-4"
      style={{
        left: Math.max(pad, Math.min(anchor.x, window.innerWidth - popoverW - pad)),
        top: Math.max(pad, Math.min(anchor.y, window.innerHeight - popoverH - pad)),
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="text-[10px] uppercase tracking-wider text-(--text-muted) mb-2">
        <span className="text-(--purple) font-mono">{`{{${name}}}`}</span>
        <span className="mx-1">·</span>
        <span className={scope === "local" ? "text-(--purple)" : "text-(--accent-soft)"}>
          {scope}
        </span>
      </div>

      {multi ? (
        <VariableOptionList
          name={name}
          options={config.options}
          value={config.value}
          onSelect={setValue}
          onAdd={addOption}
        />
      ) : (
        <VariablePicker
          name={name}
          config={config}
          onSelect={setValue}
          onAddOption={addOption}
          onRemoveOption={() => {}}
        />
      )}

      <div className="mt-3 pt-2 border-t border-(--border-subtle)">
        <div className="text-[10px] text-(--text-muted) mb-1">Copies as</div>
        <code className="block text-[11px] font-mono text-(--green) break-all bg-(--code-bg) rounded px-2 py-1">
          {preview || "—"}
        </code>
      </div>
    </div>
  );
}
