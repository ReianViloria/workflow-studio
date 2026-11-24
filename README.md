# Workflow Studio

Interactive workflow-driven architecture canvas and single-file AI spec compiler (`SPECS.md`).

Built by **Reian Brendo B. Viloria** for visual system planning, dependency mapping, and clean single-file context ingestion for AI coding agents.

## Quick Start

```bash
npm install
npm run dev
```

Open **`http://localhost:3333`** (uses port `3333` by default so it never clashes with local apps running on `3000`).

## Key Features
- **Searchable Project Switcher (Lazy-Loaded):** Only the active project board is loaded into memory; inactive projects only read lightweight `board.json` metadata.
- **Create New Projects:** Click **New Project** in the top bar to spin up a fresh board under `boards/<project-slug>/` cloned from `starter-blueprint` (or any existing board).
- **Right-Hand Markdown Drawer:** Click any node to read or edit its Markdown specification (`content/<slug>.md`) with copyable code blocks and instant disk sync.
- **Single-File AI Compilation (`SPECS.md`):** Every save automatically compiles `boards/<project>/SPECS.md` (or run `npm run compile` after manual disk edits).
- **Cascading Unused Paths (`Skip`) & Optional Badges:** Mark unused branches `Skipped` to grey/cross them out and cascade downstream (respecting multi-parent active paths) while tagging `[SKIPPED — DO NOT IMPLEMENT]` in `SPECS.md`.

## License
Proprietary — All Rights Reserved. See [LICENSE](./LICENSE).
