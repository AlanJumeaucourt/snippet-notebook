# Snippet Notebook — Agent Guide

Personal snippet manager: one markdown document in CodeMirror, sidebar TOC, inline `{{variables}}`, copy resolved snippets. App lives in this directory (`frontend/`).

**Agents:** When the owner states a UX preference, constraint, or “do not regress” remark, **append it yourself** to **Product decisions (do not regress)** in this file in the same session — do not wait for them to ask. See **Maintaining this section** below.

## Commands

```sh
cd frontend
vp install
vp dev          # http://localhost:3000
vp build && tsc --noEmit
```

Use `vp` for package management (see Vite+ section below). Do not commit secrets in `src/lib/default-document.md`.

## Architecture

| Area                           | Path                                                                                                 |
| ------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Shell UI                       | `src/components/SnippetNotebook.tsx`                                                                 |
| Editor + popover + snippet bar | `src/components/DocumentEditor.tsx`                                                                  |
| Variable picker / popover      | `src/components/VariablePicker.tsx`, `VariablePopover.tsx`                                           |
| Default notebook               | `src/lib/default-document.md` → `defaults.ts`                                                        |
| Var parse/write                | `src/lib/vars-markdown.ts`                                                                           |
| Placeholder click + preview    | `src/lib/snippet-vars.ts`, `codemirror-variables.ts`, `placeholder-click.ts`                         |
| Editor sync + undo             | `src/lib/editor.ts` (`applyDocumentPreservingView`, `recordHistory`)                                 |
| CM theme + fences              | `src/lib/codemirror-theme.ts`, `codemirror-extensions.ts`                                            |
| Fenced code highlight          | `src/lib/codemirror-languages.ts` (`@codemirror/language-data`)                                      |
| Persistence                    | `src/lib/storage.ts` — key `snippet-notebook`, `{ document: string }` only                           |
| P2P sync                       | `src/lib/sync/*`, `src/hooks/useNotebookSync.ts`, `SyncPanel.tsx` — Yjs/WebRTC; see `sync/README.md` |
| Hook                           | `src/hooks/useNotebook.ts`                                                                           |

**No bottom variables panel.** All var UX is inline: click `{{name}}`, snippet bar when cursor is in a code block with placeholders.

## Variable model (markdown is source of truth)

````markdown
```vars global
user_id = your-user-id
```
````

```vars
target_host = 10.0.0.10 | DEV:10.0.0.10, PROD:10.0.0.30
```

```bash
ssh {{user_id}}@host#{{target_host}}@jump.example.com
```

````

- **Global** — ` ```vars global ` (or `vars global` tag)
- **Local** — ` ```vars ` immediately before the snippet code fence; tied via `extractVarsFences` → `blockStartLine`
- **Line syntax** — `name = selectedValue | opt1, opt2`
  - **Colon globals** — `NAME:value` (no `=`) for compact inventories (e.g. `KENTIKA_INT_RUNNER_IP:10.0.0.11`)
  - **Regex picker** — `name = /pattern/` (name or value, default), `name = name:/pattern/`, or `name = value:/pattern/`; click `{{name}}` to pick; the global’s **value** is copied; options are computed from globals at resolve time — on save only `selected | pattern` is written, not the full option list (`storeRegexVar` in `vars-markdown.ts`)
  - Use `LABEL:value` only when the picker needs a friendly name (DEV, PROD)
  - Plain values: do not duplicate as `value | value` — `formatVarLine` in `vars-markdown.ts` omits unlabeled repeats after `|`
- **Placeholders** — `{{name}}` in code or vars blocks only (not prose)
- **Resolution** — `substituteVariables` + nested `{{ref}}` in var values via `resolveVariableValues` in `variables.ts`

## Editor integration rules

1. **Typing** — `onChange` from CodeMirror `updateListener`; updates React `document` state.
2. **UI var changes** — must use `applyDocFromUI` in `DocumentEditor.tsx`:
   - `applyDocumentPreservingView(view, newDoc, { recordHistory: true })`
   - set `valueRef` + `onChange` immediately
   - `applyingExternalRef` so the `value` prop sync effect does not revert the editor
3. **Prop → editor sync** — `useEffect` only when `current !== value` and `current !== valueRef.current` (parent reset / external load).
4. **Placeholders** — `variableInlineExtension()`; click opens `VariablePopover`; green `→` preview is a widget (`ignoreEvent` + own mousedown). Use `PLACEHOLDER_MARK_STYLE` so shell `$…{{var}}` stays purple.
5. **Template literals** — in `defaults.ts` / TS strings, escape `$` before `{{`: `` \${{machine}} `` so TS does not interpolate.

## Section links

- `[label](#anchor-id)` — slug = heading text lowercased, punctuation stripped, spaces → `-`; duplicates get `-1`, `-2`
- **Ctrl/Cmd+click** — `internalLinkClickExtension` in `codemirror-extensions.ts`

## Syntax highlighting

- Fenced languages: `markdown({ codeLanguages: fencedCodeLanguages })` — full set from `@codemirror/language-data` (```js, ```python, ```bash, etc.).
- Vars fences: custom decorations in `codemirror-extensions.ts`, not nested language parsers.

## UX shortcuts

| Action | Shortcut |
|--------|----------|
| Find | Ctrl/Cmd+F — opens find with the current editor selection as the query when text is selected |
| Find next / previous | Enter / Shift+Enter (also ▼ / ▲ on find bar) |
| New section | Ctrl/Cmd+N |
| Copy snippet | **Copy** button on each ` ```lang ` fence; Ctrl/Cmd+Shift+C in block |
| Copy notebook for sharing | Sidebar **Copy for sharing** — full markdown, `{{placeholders}}` kept, `vars` values cleared (`documentForSharing`) |
| Fold section / code block | Click **▸** in gutter, or **Ctrl/Cmd+Shift+[** fold / **Ctrl/Cmd+Shift+]** unfold; **Ctrl/Cmd+Alt+[** / **Ctrl/Cmd+Alt+]** fold/unfold all |
| Unfold folded range | Click **…** placeholder or **▾** in gutter |

## Product decisions (do not regress)

Collected from owner feedback across app development. **Read this before changing editor, find, variables, or layout.**

### Maintaining this section (agents — required)

When the owner gives feedback you should preserve (taste, “don’t …”, “I want …”, bug-as-policy, shortcut behavior, layout rules):

1. **Edit this file** — add a concise bullet under the right subsection (`Vision`, `Variables & inline UX`, `Find`, `Defaults & content`, etc.). If nothing fits, add `### Other` or extend the Find table / Files line.
2. **Same task** — do not end the session with only a code fix; update docs in the same PR/commit batch as the behavior change.
3. **One bullet = one rule** — imperative, testable (e.g. “Find bar must show `current / total` counter”, not a transcript).
4. **Point to code** when non-obvious — suffix with `` (`path/to/file.ts`) `` or a one-word implementation hint.
5. **Do not duplicate** the full list into the Cursor skill — skill stays short and links here.
6. **Optional** — if the rule is user-facing, add one line to `README.md` Usage; update the **Checklist for changes** if it is a new invariant agents should verify.
7. **Skip** one-off typos, secrets in chat, or “fix this once” bugs with no lasting policy — use judgment.

If you implement a fix for owner feedback and the rule is not already listed here, **you forgot step 1**.

### Vision

- **Sublime-like** — minimal chrome, keyboard-first, easy to read and write; very few buttons.
- **One page** — left sidebar (heading TOC) + main editor only; infinite scroll in the editor.
- **Sidebar headings** — only markdown `#` … `######` lines **outside** fenced code/vars blocks; `#` shell/Python comments inside ` ``` ` fences must not appear in the outline (`extractHeadingAnchors` in `document.ts`).
- **Mobile** — below `md` (768px) hide the left sidebar; editor uses full width (`hidden md:flex` on aside in `SnippetNotebook.tsx`). Sidebar actions (outline jump, Copy for sharing, + Section, Reset) are desktop-only; **Ctrl/Cmd+N** still adds a section on mobile.
- **P2P sync** — optional WebRTC (Yjs + `y-webrtc`); room passphrase encrypts traffic; no server stores the notebook (signaling/TURN only). Sidebar **Sync** panel; `VITE_SYNC_*` env for infra URLs (`frontend/.env.example`, `sync/README.md`).
- **Personal doc first** — full markdown notebook, not a snippet-only tool; snippets are fenced code blocks.
- **Markdown is the only database** — global/local variables live in `vars` fences; no separate var store in `localStorage`.
- **No legacy** — greenfield app; do not add migration shims unless explicitly requested.

### Variables & inline UX

- **No bottom variables panel** — removed on purpose; all var UX is inline in the editor.
- **Click `{{name}}`** in code or `vars` fences → `VariablePopover` (multi-choice list + add field).
- **Green `→ value (LABEL)`** preview after placeholders shows what copy will use; preview is clickable too.
- **Copy snippet** — every fenced code block (` ```lang `, any language) shows a small inline **Copy** button on the opening fence line; click copies the block (`{{…}}` resolved when present). **Warns** (toast + amber **Copy** button) when any placeholder has no value — copy still proceeds. **Ctrl/Cmd+Shift+C** when the cursor is in that block (`codemirror-variables.ts`, `snippet-copy-click.ts`). Clipboard must run synchronously from the click handler (`copyTextToClipboard` in `clipboard.ts`); use `click` on the widget, not `await` before `writeText` (mobile WebKit).
- **Resolved snippet preview** — optional; opens on **Ctrl/Cmd+click** on a `{{placeholder}}`, green preview, or anywhere in a snippet code block (not on cursor enter). Plain click on placeholder → variable popover only. Preview text is **selectable** (`user-select: text`). **Escape** or **×** closes preview (`SnippetBar.tsx`, `resolvedPreviewClickExtension`).
- **Multi-option vars** — picker must work on click; adding a value must not produce `value | value` when label equals value (`formatVarLine`); **4+ options** show a fuzzy search field in `VariablePopover` (filters label and value).
- **Plain add** — user enters one token only; use `LABEL:value` in the add field only when a friendly picker label is needed.
- **Global placeholders** — same visual treatment for all globals (e.g. `MY_TGI` and `MY_AGI` must not look like different “kinds” because of shell `$` highlighting — `PLACEHOLDER_MARK_STYLE` + CSS `!important`).
- **Placeholders only in fences** — not in markdown prose / instruction lines in defaults.
- **Selecting a var from UI must not** jump scroll to top or disturb layout (use `applyDocFromUI` + `valueRef` / `applyingExternalRef`).
- **Undo (Ctrl/Cmd+Z)** after UI var pick / add option must work — `applyDocumentPreservingView(..., { recordHistory: true })`, `userEvent: 'select.var'`, then **focus editor**; prop sync (`useLayoutEffect`) must skip when `view.doc === valueRef.current` and must **never** re-apply stale React `value` after `undo`/`redo` (`pendingHistorySyncRef`); non-edit dispatches (find margin compartment) use `addToHistory: false`; **must work immediately after page reload** (before any typing) via keyboard routing to editor when needed.
- **Popover** — anchor to placeholder screen position; update on editor scroll and window resize; close if anchor off-screen.
- **Share notebook** — sidebar **Copy for sharing** copies the full document via `documentForSharing`: snippet bodies unchanged (`{{name}}` preserved); `vars` fence lines lose literal values (multi-option labels kept, e.g. `DEV:`); `{{other_var}}` references in var values stay (`vars-markdown.ts`).

### Find (Ctrl/Cmd+F)

Custom find bar in `DocumentEditor.tsx` — **not** CodeMirror’s built-in search panel.

| Requirement | Implementation |
|-------------|----------------|
| Simple search, not fancy chrome | Floating overlay bar; no separate replace UI unless requested |
| Selection seeds find | **Ctrl/Cmd+F** with a non-empty editor selection pre-fills the find field and highlights matches (`DocumentEditor.tsx` `openFind`) |
| Must not “move the whole notebook” | Overlay does not shrink editor column; `scrollToSearchMatchIfNeeded` (scroll only if match off-screen, `y: 'nearest'`); sidebar `scrollIntoView` only when active heading is **outside** nav viewport |
| First line readable under find bar | `cm-find-open` extra `.cm-content` padding + `findBarScrollMargin` / `FIND_BAR_CONTENT_PAD` in `editor.ts` |
| Match highlights visible | Built-in CM highlighter skips when `panel == null` — use **`findHighlightPlugin`** in `codemirror-extensions.ts` + theme/CSS `.cm-searchMatch` / `.cm-searchMatch-selected` |
| Occurrence counter | `computeFindMatchStats` in `find-stats.ts` — show `3 / 12`, `— / 12` before first navigation, `No results` |
| Previous match | ▲ button and **Shift+Enter** (`findPrevious`) |

Files: `DocumentEditor.tsx`, `find-stats.ts`, `editor.ts` (`FIND_BAR_*`, `findBarScrollMargin`), `codemirror-extensions.ts`, `codemirror-theme.ts`, `app.css`, `SnippetNotebook.tsx` (sidebar scroll guard).

### Defaults & content

- **`default-document.md`** — generic placeholders only (`example.com`, `your-token-here`); **no real credentials**, emails, tokens, or internal hostnames in repo defaults.
- First-run doc should **demonstrate features** (global vars, local vars, multi-option `|`, bash/powershell fences) without leaking secrets.
- In TS template strings for default markdown, escape `$` before `{{` (e.g. `` \${{machine}} ``) so bundlers do not treat `{{` as interpolation.

### Editor folding

- **IDE-style fold** — collapse markdown sections (from `#` … `######` until the next heading of equal or higher level) and fenced code/`vars` blocks so long notebooks scroll less (`foldGutter` + markdown `headerIndent` in `codemirror-extensions.ts`).
- **Gutter chevrons** — **▸** / **▾** between line numbers and content; folded body shows a clickable **…** placeholder (dark theme in `codemirror-theme.ts`).
- **Keyboard** — **Ctrl/Cmd+Shift+[** fold at cursor, **Ctrl/Cmd+Shift+]** unfold; **Ctrl/Cmd+Alt+[** / **Ctrl/Cmd+Alt+]** fold/unfold all (`foldKeymap`).
- **Fold state is session-only** — not stored in markdown; persisted in `localStorage` key `snippet-notebook-folds` by anchor line text (`fold-persistence.ts`); save immediately on fold/unfold; **do not clear** stored folds on unmount when the editor has no folds yet (`saveFolds(view, false)`); cleared on **Reset to default** or when the user unfolds all.
- **Scroll position** — persisted in `localStorage` key `snippet-notebook-scroll` (`scroll-persistence.ts`); restored after folds on reload; **focus uses `preventScroll`** so restore is not undone; unmount must not write `scrollTop: 0` during restore (`skipIfZero` / skip while `skipScrollSaveRef`); sync auto-connect delayed 400ms so scroll restores before yCollab remount (`useNotebookSync.ts`); cleared on **Reset to default**.
- **Copy with unset vars** — still copies resolved text, but shows a toast + warning styling on **Copy** when placeholders lack values (`prepareSnippetCopy`, `snippet-copy-click.ts`, `SnippetBar.tsx`).

### Syntax highlighting

- **Fenced code highlighting** uses `@codemirror/language-data` via `fencedCodeLanguages` in `codemirror-languages.ts` (large bundle; intentional).
- **Text selection** must stay visible — use native `::selection` on `.cm-line` (do **not** re-enable `drawSelection`; its layer renders under syntax/active-line backgrounds). No opaque `background` on placeholder marks (outline/box-shadow only).
- **Editor performance** — fence/placeholder plugins must not rebuild on every scroll or selection frame: vars fence highlights only on `docChanged`; variable widgets only near viewport (`rangeIntersects`); find/selection highlights debounced via `requestAnimationFrame`; `saveNotebook` debounced (~400ms); sidebar headings cached in `DocumentEditor` (re-parse markdown titles only when the document changes).

### Historical notes (context only)

- User once had a **bottom variables panel** and **VariablesPanel** in README — intentionally removed; do not restore without explicit request.
- User wanted RPA/SSH-style snippets: one command template, IP/env chosen via multi-option var — document pattern in defaults, not hard-coded product names in code.

## Checklist for changes

- [ ] Owner UX / policy feedback recorded in **Product decisions** (agents add bullets themselves — see **Maintaining this section**)
- [ ] Var UI changes go through `handleSetGlobal` / `handleSetLocal` / `applyDocFromUI`, not raw `setData` bypassing the editor
- [ ] Undo works after popover changes (single patch + `userEvent: 'select.var'`, editor focused)
- [ ] Find changes keep overlay layout, `findHighlightPlugin`, stats, and gentle scroll (see **Product decisions**)
- [ ] New default content stays generic (no credentials) in `default-document.md`
- [ ] `vp build && tsc --noEmit` passes
- [ ] README bullets match behavior if user-facing

## Do not

- Reintroduce a bottom `VariablesPanel` without an explicit request
- Remove or shrink `@codemirror/language-data` without an explicit request (notebook relies on full fenced-language support)
- Store variables outside markdown (no `blockVariables` in localStorage)
- Use `{{name}}` in instructional prose in defaults (clicks only work in fences)

---

<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, but it invokes Vite through `vp dev` and `vp build`.

## Vite+ Workflow

`vp` is a global binary that handles the full development lifecycle. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

### Start

- create - Create a new project from a template
- migrate - Migrate an existing project to Vite+
- config - Configure hooks and agent integration
- staged - Run linters on staged files
- install (`i`) - Install dependencies
- env - Manage Node.js versions

### Develop

- dev - Run the development server
- check - Run format, lint, and TypeScript type checks
- lint - Lint code
- fmt - Format code
- test - Run tests

### Execute

- run - Run monorepo tasks
- exec - Execute a command from local `node_modules/.bin`
- dlx - Execute a package binary without installing it as a dependency
- cache - Manage the task cache

### Build

- build - Build for production
- pack - Build libraries
- preview - Preview production build

### Manage Dependencies

Vite+ automatically detects and wraps the underlying package manager such as pnpm, npm, or Yarn through the `packageManager` field in `package.json` or package manager-specific lockfiles.

- add - Add packages to dependencies
- remove (`rm`, `un`, `uninstall`) - Remove packages from dependencies
- update (`up`) - Update packages to latest versions
- dedupe - Deduplicate dependencies
- outdated - Check for outdated packages
- list (`ls`) - List installed packages
- why (`explain`) - Show why a package is installed
- info (`view`, `show`) - View package information from the registry
- link (`ln`) / unlink - Manage local package links
- pm - Forward a command to the package manager

### Maintain

- upgrade - Update `vp` itself to the latest version

These commands map to their corresponding tools. For example, `vp dev --port 3000` runs Vite's dev server and works the same as Vite. `vp test` runs JavaScript tests through the bundled Vitest. The version of all tools can be checked using `vp --version`. This is useful when researching documentation, features, and bugs.

## Common Pitfalls

- **Using the package manager directly:** Do not use pnpm, npm, or Yarn directly. Vite+ can handle all package manager operations.
- **Always use Vite commands to run tools:** Don't attempt to run `vp vitest` or `vp oxlint`. They do not exist. Use `vp test` and `vp lint` instead.
- **Running scripts:** Vite+ built-in commands (`vp dev`, `vp build`, `vp test`, etc.) always run the Vite+ built-in tool, not any `package.json` script of the same name. To run a custom script that shares a name with a built-in command, use `vp run <script>`. For example, if you have a custom `dev` script that runs multiple services concurrently, run it with `vp run dev`, not `vp dev` (which always starts Vite's dev server).
- **Do not install Vitest, Oxlint, Oxfmt, or tsdown directly:** Vite+ wraps these tools. They must not be installed directly. You cannot upgrade these tools by installing their latest versions. Always use Vite+ commands.
- **Use Vite+ wrappers for one-off binaries:** Use `vp dlx` instead of package-manager-specific `dlx`/`npx` commands.
- **Import JavaScript modules from `vite-plus`:** Instead of importing from `vite` or `vitest`, all modules should be imported from the project's `vite-plus` dependency. For example, `import { defineConfig } from 'vite-plus';` or `import { expect, test, vi } from 'vite-plus/test';`. You must not install `vitest` to import test utilities.
- **Type-Aware Linting:** There is no need to install `oxlint-tsgolint`, `vp lint --type-aware` works out of the box.

## CI Integration

For GitHub Actions, consider using [`voidzero-dev/setup-vp`](https://github.com/voidzero-dev/setup-vp) to replace separate `actions/setup-node`, package-manager setup, cache, and install steps with a single action.

```yaml
- uses: voidzero-dev/setup-vp@v1
  with:
    cache: true
- run: vp check
- run: vp test
````

## Review Checklist for Agents

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to validate changes.
<!--VITE PLUS END-->
