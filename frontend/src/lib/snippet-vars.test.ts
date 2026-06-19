import { expect, test } from "vite-plus/test";
import { findCodeBlockByFenceLine } from "./document";
import { prepareSnippetCopy, unresolvedSnippetPlaceholders } from "./snippet-vars";

const DOC = [
  "```vars global",
  "user_id = alice",
  "```",
  "",
  "```vars",
  "target_host = ",
  "```",
  "",
  "```bash",
  "ssh {{user_id}}@{{target_host}}",
  "```",
  "",
  "```bash",
  "echo {{missing_var}}",
  "```",
].join("\n");

function blockAtFence(fenceLine: number) {
  const block = findCodeBlockByFenceLine(DOC, fenceLine);
  if (!block) throw new Error(`no block at ${fenceLine}`);
  return block;
}

test("unresolvedSnippetPlaceholders flags empty and undefined vars", () => {
  const both = blockAtFence(DOC.split("\n").indexOf("```bash"));
  expect(unresolvedSnippetPlaceholders(DOC, both)).toEqual(["target_host"]);

  const missing = blockAtFence(DOC.split("\n").lastIndexOf("```bash"));
  expect(unresolvedSnippetPlaceholders(DOC, missing)).toEqual(["missing_var"]);
});

test("prepareSnippetCopy still returns resolved text with unset placeholders", () => {
  const both = blockAtFence(DOC.split("\n").indexOf("```bash"));
  const { text, unresolved } = prepareSnippetCopy(DOC, both);
  expect(text).toBe("ssh alice@{{target_host}}");
  expect(unresolved).toEqual(["target_host"]);
});
