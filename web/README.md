# RBXFlow — Web App

An interactive, browser-only visualizer for Roblox game structure. It imports
the JSON exported by the *Game Flow Scanner* Studio plugin and renders it as an
explorable graph. It never scans Roblox itself and never uploads anything.

## Run

```bash
npm install
npm run dev      # dev server at http://localhost:5173
npm run build    # type-check + static build into ./dist
npm run preview  # preview the production build
```

On start the app loads the bundled sample (`public/sample-game.rbxflow.json`)
so you can explore immediately. Use **Open Project** or drag a `.json` file
onto the window to load your own export.

## Architecture

The app follows a strict one-way pipeline. The UI never touches raw JSON —
everything downstream of `normalize` works against the indexed `ProjectModel`.

```
 JSON text
    │  model/parse.ts        JSON.parse
    ▼
 RawDocument
    │  model/validate.ts     format == "rbxflow", version check, friendly errors
    ▼
 (validated)
    │  model/normalize.ts    → ProjectModel: nodes, edges, indexes, stats
    ▼
 ProjectModel ──────────────────────────────────────────────┐
    │  graph/buildGraph.ts   mode + filters → Cytoscape elements
    ▼                                                         │
 GraphController (graph/graphController.ts)                   │  Explorer
    │  the only module that talks to Cytoscape                │  Inspector
    ▼                                                         │  Search
 Canvas/WebGL graph  ◀── theme/theme.ts (centralized styling) │  Stats
                                                              │  Warnings
                          app.ts orchestrates all of the above┘
```

### Directory map

| File / dir              | Responsibility                                             |
|-------------------------|------------------------------------------------------------|
| `model/types.ts`        | Raw JSON types + normalized model types.                   |
| `model/validate.ts`     | Schema validation with human-readable errors.              |
| `model/parse.ts`        | text/File → validated `RawDocument`.                       |
| `model/normalize.ts`    | `RawDocument` → indexed `ProjectModel` (nodes/edges/stats).|
| `theme/theme.ts`        | **Centralized** theme: node/edge/env colors, labels. Add a theme here. |
| `graph/modes.ts`        | The 6 graph modes (declarative node/edge filters).         |
| `graph/layouts.ts`      | The 6 layouts (Cytoscape layout options).                  |
| `graph/buildGraph.ts`   | Model + mode + filters → renderer elements.                |
| `graph/cytoStyles.ts`   | Builds the Cytoscape stylesheet from the theme.            |
| `graph/pathfind.ts`     | BFS shortest path, depth-limited neighborhoods.            |
| `graph/graphController.ts` | Wraps Cytoscape: view ops, focus, path highlight, export. |
| `ui/importer.ts`        | File picker + drag-and-drop.                               |
| `ui/explorer.ts`        | Collapsible project tree.                                  |
| `ui/inspector.ts`       | Node + relationship inspector (+ syntax-highlighted source).|
| `ui/search.ts`          | Global search index over names/paths/functions.            |
| `ui/stats.ts`           | Overview panel (clickable filters).                        |
| `ui/warnings.ts`        | Scanner warnings (click to locate).                        |
| `ui/export.ts`          | Filtered JSON / PNG / SVG / Markdown report.               |
| `ui/highlight.ts`       | Dependency-free Luau syntax highlighter for snippets.      |
| `app.ts`                | View state + orchestration of the whole pipeline.          |

## Why Cytoscape.js

The spec calls for hundreds of scripts and thousands of relationships.
Cytoscape.js renders on a **canvas** (not one DOM node per graph node), so it
stays responsive at that scale, and ships batteries-included pan/zoom/drag,
layouts, and PNG/SVG export.

## Runtime-ready

The normalizer records whether the file carried a `runtime` block
(`ProjectModel.hasRuntime`) and the schema reserves it for future execution
tracing. The MVP does not use it, but nothing in the architecture prevents a
later version from layering runtime data onto the same model.

## Privacy

100% client-side. No network calls except fetching the bundled sample file from
the same origin. No analytics, no external services.
