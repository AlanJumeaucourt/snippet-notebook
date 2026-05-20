# Snippet Notebook

A one-page snippet manager with a Sublime Text–style interface: left sidebar, monospace editor, minimal chrome.

One **full-page markdown editor** for personal docs: headings, notes, lists, and fenced code blocks in a single scrollable file. The left sidebar is a table of contents from `#` / `##` / `###` headings and **follows your scroll position**.

Variables are stored **in the markdown** as `vars` code blocks. Place the cursor inside a snippet to edit local overrides; global vars apply everywhere.

## Getting Started

```sh
cd frontend
vp install
vp dev
```

Open [http://localhost:3000](http://localhost:3000).

## Usage

- **Editor** — One continuous document; edit everything in place like a personal wiki or notes file.
- **Sidebar** — Heading outline; active section tracks scroll; click to jump the editor to that line.
- **Global variables** — ` ```vars global ` block at the top (or anywhere):

  ```text
  host = api.example.com | api.example.com, localhost:3000
  ```

- **Local variables** — ` ```vars ` block immediately before a snippet; overrides global for that block only.

- **Line format** — `name = selectedValue | option1, option2` (the UI syncs these lines when you use dropdowns).

- **Variables inline** — click `{{name}}` in a code or `vars` block; multi-value vars (`name = ip | DEV:ip, PROD:ip`) open a labeled picker (DEV / PROD / …). Green `→ value (LABEL)` shows what will be copied.
- **Copy snippet** — every fenced code block has a **Copy** button on the ` ```lang ` line (click to copy; `{{variables}}` are resolved when present). `Ctrl+Shift+C` / `Cmd+Shift+C` works when the cursor is in that block. **Ctrl+click** / **Cmd+click** on blocks with placeholders opens an optional resolved preview. Plain click on `{{variable}}` opens the value picker.
- **Copy for sharing** — sidebar button copies the full notebook with `{{placeholders}}` intact but all `vars` values cleared (safe to paste for a colleague).
- **Link to a section** — Standard markdown `[label](#anchor-id)`. The anchor id is the heading text slugified (lowercase, no punctuation, spaces → hyphens; duplicate titles get `-1`, `-2`, …). **Ctrl+click** or **Cmd+click** the link to jump (same ids as the sidebar outline).
- **New section** — `Ctrl+N` or “+ Section” at the bottom of the sidebar.
- **Find** — `Ctrl+F` / `Cmd+F`: overlay search bar, match highlights, `3 / 12` counter, ▲/▼ (Shift+Enter / Enter).
- Data is stored in `localStorage` under `snippet-notebook`.

Contributors and AI agents: see **`AGENTS.md`** (especially **Product decisions (do not regress)**) for UX rules accumulated from project feedback.

## Build

```sh
vp build
```
