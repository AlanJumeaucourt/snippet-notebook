import type * as Y from "yjs";

function singlePatch(
  oldDoc: string,
  newDoc: string,
): { from: number; to: number; insert: string } | null {
  if (oldDoc === newDoc) return null;
  let start = 0;
  const minLen = Math.min(oldDoc.length, newDoc.length);
  while (start < minLen && oldDoc[start] === newDoc[start]) start++;
  let endOld = oldDoc.length;
  let endNew = newDoc.length;
  while (endOld > start && endNew > start && oldDoc[endOld - 1] === newDoc[endNew - 1]) {
    endOld--;
    endNew--;
  }
  return { from: start, to: endOld, insert: newDoc.slice(start, endNew) };
}

/** Replace notebook markdown in a Y.Text (var picker, reset, etc.). */
export function applyYTextDocument(ytext: Y.Text, newDoc: string, origin?: string | object): void {
  const current = ytext.toString();
  if (current === newDoc) return;
  const patch = singlePatch(current, newDoc);
  const doc = ytext.doc;
  if (!doc) return;
  doc.transact(() => {
    if (patch) {
      ytext.delete(patch.from, patch.to - patch.from);
      ytext.insert(patch.from, patch.insert);
    } else {
      ytext.delete(0, ytext.length);
      ytext.insert(0, newDoc);
    }
  }, origin);
}
