import { createFileRoute } from "@tanstack/react-router";
import { SnippetNotebook } from "~/components/SnippetNotebook";

export const Route = createFileRoute("/")({
  ssr: false,
  component: SnippetNotebook,
});
