import * as React from "react";

export function AddOptionField({ onAdd }: { onAdd: (token: string) => void }) {
  const [draft, setDraft] = React.useState("");

  return (
    <div className="mt-2 pt-2 border-t border-(--border-subtle)">
      <label className="block text-[10px] text-(--text-muted) mb-1">Add choice</label>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            const token = draft.trim();
            if (!token) return;
            onAdd(token);
            setDraft("");
          }
        }}
        onMouseDown={(e) => e.stopPropagation()}
        placeholder="value or LABEL:value"
        className="w-full bg-(--input-bg) border border-(--border) rounded-md px-2 py-1 text-[11px] font-mono outline-none focus:border-(--cyan) placeholder:text-(--text-muted)"
      />
    </div>
  );
}
