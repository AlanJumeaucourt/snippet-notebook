---
name: snippet-notebook
description: Develop and extend the Snippet Notebook app (TanStack Start, CodeMirror markdown editor, inline {{variables}} in vars fences). Use when editing frontend/, snippet-notebook, vars-markdown, DocumentEditor, variable popover, find bar, default-document.md, or when the user asks about placeholder resolution, copy snippet, undo, Ctrl+F, or AGENTS.md for this repo.
disable-model-invocation: true
---

# Snippet Notebook

**Always read [frontend/AGENTS.md](../../../frontend/AGENTS.md) first**, especially **Product decisions (do not regress)**.

**You must maintain that section:** when the owner gives UX feedback or a rule to remember, add a bullet under **Maintaining this section** in `AGENTS.md` yourself in the same task — do not wait for them to ask and do not copy the full list into this skill.

## Product in one paragraph

Single `localStorage` markdown file. Sidebar = heading TOC (scroll-spy; do not yank nav on every heading change). Editor = CodeMirror with fenced code highlighting via `@codemirror/language-data`. Variables live in ` ```vars ` / ` ```vars global ` blocks; snippets use `{{name}}`. Click placeholder → popover; green `→` = resolved copy value. **Ctrl/Cmd+click** snippet/`{{var}}` → floating resolved preview (selectable text); plain click → popover. Ctrl+Shift+C copies. **No bottom variables panel.**

## Variable line rules (do not regress)

| Case | Markdown |
|------|----------|
| Single value | `name = value` |
| Multiple choices | `name = selected \| DEV:10.0.0.1, PROD:10.0.0.2` |
| Plain add (UI) | Enter value only — never `value \| value` |
| Friendly label | User types `LABEL:value` in add field |

Implement in `formatVarLine` / `parseVarLine` (`vars-markdown.ts`). UI add path: `VariablePicker` → `applyDocFromUI` → `updateVarValue` / `addVarOption`.

## Critical editor path (UI → undo)

```
VariablePopover onSelect
  → DocumentEditor handleSetGlobal/Local
  → applyDocFromUI(newDoc)
      applyingExternalRef = true
      applyDocumentPreservingView(view, newDoc, { recordHistory: true })
      valueRef = newDoc; onChange(newDoc)
      applyingExternalRef = false
      view.focus()
```

Never update only React state for var picks. Never full-doc replace without `recordHistory` when the change came from UI.

Prop sync effect must skip when `view.doc === valueRef.current` (editor ahead of props).

## Find bar (Ctrl/Cmd+F) — do not regress

- Custom overlay in `DocumentEditor.tsx`, not CM `openSearchPanel`
- Highlights: `findHighlightPlugin` (CM built-in highlighter needs `panel` open — we do not use that)
- Stats: `find-stats.ts` → `3 / 12`, `— / 12`, `No results`; ▲/▼ and Shift+Enter / Enter
- No layout shift; gentle scroll (`scrollToSearchMatchIfNeeded`); extra top padding when open (`FIND_BAR_CONTENT_PAD`, `cm-find-open`)
- Sidebar: scroll active heading into view only if it is outside the nav viewport

## Placeholder clicks

- Active only inside code fences and `vars` fences (`snippet-vars.ts` `contextAtLine`)
- Not in markdown prose — do not put clickable `{{x}}` in default doc instructions
- Preview widget: `VarPreviewWidget` + `firePlaceholderClick`; bash `$` prefix needs `PLACEHOLDER_MARK_STYLE` / CSS `!important`
- Popover follows placeholder on scroll/resize

## Files to touch by task

| Task | Files |
|------|--------|
| Var format / parse | `vars-markdown.ts` |
| Default examples | `default-document.md`, `defaults.ts` |
| Inline preview / click | `codemirror-variables.ts`, `snippet-vars.ts` |
| Popover UX | `VariablePopover.tsx`, `VariablePicker.tsx` |
| Undo / sync / find padding | `editor.ts`, `DocumentEditor.tsx` |
| Find stats | `find-stats.ts` |
| Find highlights | `codemirror-extensions.ts`, `codemirror-theme.ts`, `app.css` |
| Fenced code languages | `codemirror-languages.ts` (`@codemirror/language-data`) |
| Sidebar scroll behavior | `SnippetNotebook.tsx` |

## Defaults policy

`default-document.md` = generic placeholders only (example.com, your-token-here). No real credentials, emails, or internal hostnames.

## Build

```sh
cd frontend && vp build && tsc --noEmit
```
