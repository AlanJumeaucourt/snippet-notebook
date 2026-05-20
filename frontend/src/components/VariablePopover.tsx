import * as React from "react";
import { AddOptionField } from "~/components/AddOptionField";
import { VariablePicker } from "~/components/VariablePicker";
import { hasMultipleChoices, previewPlaceholderValue, varPickerScope } from "~/lib/snippet-vars";
import { lookupVarInDocument } from "~/lib/vars-markdown";
import type { VariableConfig } from "~/lib/types";

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

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[280px] max-w-[min(420px,calc(100vw-24px))] rounded-lg border border-(--border) bg-(--panel) shadow-[0_12px_40px_rgba(0,0,0,0.45)] p-3"
      style={{
        left: Math.max(8, Math.min(anchor.x, window.innerWidth - 300)),
        top: Math.max(8, Math.min(anchor.y, window.innerHeight - 240)),
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
        <div className="space-y-1">
          <p className="text-[10px] text-(--text-muted) mb-2">
            Pick one — the <strong>value</strong> (e.g. IP) is copied into the snippet, not the
            label.
          </p>
          <ul className="space-y-1" role="listbox" aria-label={`${name} options`}>
            {config.options.map((opt) => {
              const selected = config.value === opt.value;
              return (
                <li key={`${opt.label}:${opt.value}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => setValue(opt.value)}
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
          <AddOptionField onAdd={addOption} />
        </div>
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
