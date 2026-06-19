# Snippet Notebook

A one-page snippet manager with a Sublime Text–style interface: left sidebar, monospace editor, minimal chrome.

One **full-page markdown editor** for personal docs: headings, notes, lists, and fenced code blocks in a single scrollable file. The left sidebar is a table of contents from `#` / `##` / `###` headings **outside** code fences (lines like `# comment` inside a ` ```bash ` block are not headings) and **follows your scroll position**.

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
- **Copy snippet** — every fenced code block has a **Copy** button on the ` ```lang ` line (click to copy; `{{variables}}` are resolved when present). If a variable has no value, copy still runs but a warning toast appears. `Ctrl+Shift+C` / `Cmd+Shift+C` works when the cursor is in that block. **Ctrl+click** / **Cmd+click** on blocks with placeholders opens an optional resolved preview. Plain click on `{{variable}}` opens the value picker.
- **Copy for sharing** — sidebar button copies the full notebook with `{{placeholders}}` intact but all `vars` values cleared (safe to paste for a colleague).
- **Link to a section** — Standard markdown `[label](#anchor-id)`. The anchor id is the heading text slugified (lowercase, no punctuation, spaces → hyphens; duplicate titles get `-1`, `-2`, …). **Ctrl+click** or **Cmd+click** the link to jump (same ids as the sidebar outline).
- **New section** — `Ctrl+N` or “+ Section” at the bottom of the sidebar.
- **Find** — `Ctrl+F` / `Cmd+F`: overlay search bar, match highlights, `3 / 12` counter, ▲/▼ (Shift+Enter / Enter).
- **Fold** — click **▸** in the gutter to collapse a heading section or fenced code/`vars` block; **Ctrl/Cmd+Shift+[** fold, **Ctrl/Cmd+Shift+]** unfold at cursor. Fold state is restored on reload (stored separately from the markdown).
- **Scroll position** — where you were reading is restored on reload (stored separately from the markdown).
- **Copy unset vars** — copying a snippet with empty/missing `{{variables}}` still copies but shows a warning toast.
- Data is stored in `localStorage` under `snippet-notebook`.
- **Sync (optional)** — sidebar **Sync**: same room name + passphrase on each device; realtime P2P edit via WebRTC (no notebook stored on a sync server). Configure signaling/TURN in `.env.local` — see `frontend/.env.example` and [`sync/README.md`](../sync/README.md).

Contributors and AI agents: see **`AGENTS.md`** (especially **Product decisions (do not regress)**) for UX rules accumulated from project feedback.

## Build

```sh
vp build
```

## Deploy (Render Static Site)

Build emits a static site in `.output/public/` (including `index.html`).

| Setting           | Value                          |
| ----------------- | ------------------------------ |
| Root Directory    | `frontend`                     |
| Build Command     | `bun install && bun run build` |
| Publish Directory | `.output/public`               |

Do **not** publish `.output/server/` — that folder is only used during the build.
