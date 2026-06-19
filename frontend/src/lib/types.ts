/** One choice: label in UI (e.g. INT), value in snippet (e.g. IP). */
export type VarOption = {
  label: string;
  value: string;
};

export type RegexTarget = "name" | "value" | "both";

export type VariableConfig = {
  value: string;
  options: VarOption[];
  /** When set, options are built from globals matching this pattern. */
  regex?: string;
  regexFlags?: string;
  /** Which global field(s) `regex` is tested against (default `both`). */
  regexTarget?: RegexTarget;
  /** How this line is written in markdown (`name:value` vs `name = value`). */
  syntax?: "colon" | "equals";
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
