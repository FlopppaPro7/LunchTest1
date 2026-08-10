# RBXFlow

**Roblox Game Flow Visualizer** — import the JSON exported by the *Game Flow
Scanner* Studio plugin and explore your game's structure as an interactive
graph: scripts, modules, remotes, events, instances, and every relationship
between them.

This repository holds two **completely independent** projects that share only
one thing — a JSON contract:

```
┌─────────────────────────┐        rbxflow JSON        ┌─────────────────────────┐
│  Game Flow Scanner       │  ───────────────────────▶  │  RBXFlow web app         │
│  (Roblox Studio plugin)  │      (exported file)       │  (static website)        │
│  scans + exports only    │                            │  imports + visualizes    │
└─────────────────────────┘                            └─────────────────────────┘
```

- The **plugin** only scans a place and writes a file. It never visualizes.
- The **web app** only imports a file. It never scans Roblox.
- Everything runs locally. No backend, no uploads, no analytics.

## Repository layout

| Path         | What it is                                                        |
|--------------|-------------------------------------------------------------------|
| `schema/`    | The `rbxflow` JSON contract — the single source of truth both sides target. |
| `web/`       | RBXFlow web application (Vite + TypeScript + Cytoscape.js).       |
| `fixtures/`  | A realistic sample `rbxflow` file for developing/testing the web app. |
| `plugin/`    | Game Flow Scanner Studio plugin (Luau) — *planned next milestone*. |

## Status

- ✅ **Web app MVP** — import + validation, normalized model, interactive graph,
  6 graph modes, 6 layouts, explorer, inspector, search, filters, focus mode,
  path finding, depth control, statistics, warnings, and export
  (JSON / PNG / SVG / report).
- ⏳ **Studio plugin** — schema and module architecture are designed
  (see `schema/rbxflow.schema.md`); implementation is the next milestone.

## Running the web app

```bash
cd web
npm install
npm run dev      # http://localhost:5173  (loads the bundled sample on start)
npm run build    # type-checks and produces a static site in web/dist
```

The built `web/dist` is a plain static site — host it anywhere (GitHub Pages,
S3, Netlify, or just open it behind any static file server).

## The data contract

See [`schema/rbxflow.schema.md`](schema/rbxflow.schema.md). The schema is
versioned and **additive-only**, so a future plugin version can add fields
(including the reserved `runtime` block for execution tracing) without breaking
files that existing apps already read.
