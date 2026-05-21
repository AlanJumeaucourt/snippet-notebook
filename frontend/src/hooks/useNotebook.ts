import * as React from "react";
import { debounce } from "~/lib/debounce";
import { appendSectionMarkdown } from "~/lib/document";
import { clearNotebookStorage, initialNotebook, loadNotebook, saveNotebook } from "~/lib/storage";
import { applyYTextDocument } from "~/lib/sync/ytext-document";
import { useNotebookSync } from "~/hooks/useNotebookSync";
import type { NotebookData } from "~/lib/types";
import {
  addVarOption,
  getEffectiveVarsForBlock,
  getGlobalVars,
  getLocalVarsForBlock,
  updateVarValue,
} from "~/lib/vars-markdown";

export function useNotebook() {
  const [data, setData] = React.useState<NotebookData>(initialNotebook);
  const [hydrated, setHydrated] = React.useState(false);
  const documentRef = React.useRef(data.document);
  documentRef.current = data.document;

  React.useEffect(() => {
    const stored = loadNotebook();
    if (stored) setData(stored);
    setHydrated(true);
  }, []);

  const sync = useNotebookSync(() => documentRef.current, { enabled: hydrated });

  React.useEffect(() => {
    if (!sync.collab) return;
    const { ytext } = sync.collab;
    const onRemote = () => setData({ document: ytext.toString() });
    ytext.observe(onRemote);
    const merged = ytext.toString();
    if (merged !== documentRef.current) {
      setData({ document: merged });
    }
    return () => ytext.unobserve(onRemote);
  }, [sync.collab]);

  const saveDebounced = React.useMemo(
    () => debounce((next: NotebookData) => saveNotebook(next), 400),
    [],
  );

  React.useEffect(() => {
    if (!hydrated) return;
    saveDebounced(data);
  }, [data, hydrated, saveDebounced]);

  const setDocument = React.useCallback(
    (document: string) => {
      if (sync.collab) {
        applyYTextDocument(sync.collab.ytext, document, "local");
      }
      setData({ document });
    },
    [sync.collab],
  );

  const parsed = React.useMemo(
    () => ({
      global: getGlobalVars(data.document),
    }),
    [data.document],
  );

  const setGlobalVarValue = React.useCallback((name: string, value: string) => {
    setData((prev) => ({
      document: updateVarValue(prev.document, "global", name, value),
    }));
  }, []);

  const setLocalVarValue = React.useCallback(
    (blockStartLine: number, name: string, value: string) => {
      setData((prev) => ({
        document: updateVarValue(prev.document, "local", name, value, blockStartLine),
      }));
    },
    [],
  );

  const addGlobalVarOption = React.useCallback((name: string, option: string) => {
    setData((prev) => ({
      document: addVarOption(prev.document, "global", name, option),
    }));
  }, []);

  const addLocalVarOption = React.useCallback(
    (blockStartLine: number, name: string, option: string) => {
      setData((prev) => ({
        document: addVarOption(prev.document, "local", name, option, blockStartLine),
      }));
    },
    [],
  );

  const getBlockVars = React.useCallback(
    (blockStartLine: number) => getEffectiveVarsForBlock(data.document, blockStartLine),
    [data.document],
  );

  const getBlockLocalVars = React.useCallback(
    (blockStartLine: number) => getLocalVarsForBlock(data.document, blockStartLine),
    [data.document],
  );

  const addSection = React.useCallback(() => {
    setData((prev) => ({ document: appendSectionMarkdown(prev.document) }));
  }, []);

  const resetToDefault = React.useCallback(() => {
    const fresh = initialNotebook();
    clearNotebookStorage();
    setData(fresh);
    saveNotebook(fresh);
  }, []);

  return {
    hydrated,
    document: data.document,
    setDocument,
    globalVars: parsed.global,
    setGlobalVarValue,
    setLocalVarValue,
    addGlobalVarOption,
    addLocalVarOption,
    getBlockVars,
    getBlockLocalVars,
    addSection,
    resetToDefault,
    sync,
  };
}
