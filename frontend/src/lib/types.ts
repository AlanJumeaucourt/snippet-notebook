/** One choice: label in UI (e.g. INT), value in snippet (e.g. IP). */
export type VarOption = {
  label: string;
  value: string;
};

export type VariableConfig = {
  value: string;
  options: VarOption[];
};

/** Everything lives in `document` markdown. */
export type NotebookData = {
  document: string;
};

export type DocHeading = {
  id: string;
  level: number;
  text: string;
};

export type DocCodeBlock = {
  type: "code";
  id: string;
  lang: string;
  content: string;
};

export type DocHeadingNode = {
  type: "heading";
  id: string;
  level: number;
  text: string;
};

export type DocTextNode = {
  type: "text";
  content: string;
};

export type DocNode = DocHeadingNode | DocCodeBlock | DocTextNode;
