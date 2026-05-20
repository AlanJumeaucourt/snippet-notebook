import type { EditorView } from "@codemirror/view";

/** Coalesce decoration rebuilds to one animation frame. */
export function scheduleDecorationRebuild(plugin: {
  scheduled: boolean;
  view: EditorView;
  rebuild: () => void;
}): void {
  if (plugin.scheduled) return;
  plugin.scheduled = true;
  requestAnimationFrame(() => {
    plugin.scheduled = false;
    plugin.rebuild();
  });
}
