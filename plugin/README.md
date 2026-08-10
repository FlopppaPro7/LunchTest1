# Game Flow Scanner — Roblox Studio plugin

A lightweight, **read-only** Studio plugin that scans the current place and
exports a `rbxflow` JSON file for the [RBXFlow web app](../web) to visualize.
It does **not** visualize anything itself, never modifies your game, and never
uploads data anywhere.

## What it does

1. Walks the DataModel and collects scripts, remotes/bindables, and the
   structural instances (folders, models, services) that connect them.
2. Statically analyzes each script's `Source` and detects relationships:
   `require`, `function_call`, `fires_server`/`fires_client`,
   `invokes_server`/`invokes_client`, `server_event`/`client_event`,
   `event_connection`, `instance_reference`, `attribute_read`/`attribute_write`,
   `parent_reference`.
3. Classifies each script as **server / client / shared**.
4. Exports a single JSON document matching [`../schema/rbxflow.schema.md`](../schema/rbxflow.schema.md).

It performs **static analysis only**. Dynamic code such as `require(someVar)` or
string-built paths cannot always be resolved — those become **warnings** and/or
`low` confidence, never fabricated relationships. Local aliases (including
`game:GetService(...)`) are tracked so the common resolvable forms do resolve.

## Install

### Option A — single file (no tooling)

1. Open `dist/GameFlowScanner.server.luau` and copy its contents.
2. In Studio, paste into a new **Script** (e.g. in ServerScriptService).
3. Right-click the Script → **Save as Local Plugin**.
4. The **Flow Scanner** button appears in the Plugins tab.

> The single file is generated from `src/` — see *Building* below.

### Option B — Rojo (recommended for development)

```bash
# from the plugin/ directory, with Rojo installed (https://rojo.space)
rojo build --plugin GameFlowScanner.rbxmx
```

`--plugin` writes the built model straight into your local Studio plugins
folder, so it loads on the next Studio launch. Omit `--plugin` and pass
`-o GameFlowScanner.rbxmx` to build a file you drag into the Plugins folder
instead. Use `rojo serve` for live-syncing while editing.

## Use

1. Click **Flow Scanner** in the Plugins tab to open the widget.
2. (Optional) tick **Include Source Code** to embed full script source in the
   export (useful for the web inspector's snippets; larger files).
3. Click **Scan Project**. Progress and live counts appear as it works; it
   yields periodically so Studio stays responsive.
4. Click **Export JSON**. Because Studio plugins cannot write files to disk,
   the JSON appears in a read-only box — **Select All**, copy, and paste into a
   `.json` file.
5. Open that file in the RBXFlow web app.

> **Permissions:** reading another script's `Source` may require granting the
> plugin *Script Injection* permission the first time. Scripts whose source
> can't be read are reported as warnings and the scan still completes.

## Architecture

Scanning, analysis, export, and UI are fully separated so each can change
independently:

| Module | Responsibility |
|--------|----------------|
| `src/Main.server.luau` | Plugin entry: toolbar + dock widget, wires modules. The only file that touches plugin APIs. |
| `src/Config.luau` | Constants: relationship types, class/service tables, version. |
| `src/IdGenerator.luau` | Stable, non-name-based IDs (`module_001`, `remote_002`…). |
| `src/Scanner.luau` | Read-only DataModel walk → nodes + parent links. |
| `src/Classifier.luau` | server / client / shared per script. |
| `src/PathResolver.luau` | Static resolution of instance-path expressions + aliases. |
| `src/Analyzer.luau` | Static source analysis → relationships + warnings. |
| `src/Exporter.luau` | Assembles the rbxflow document, `JSONEncode`. |
| `src/UI.luau` | Dock widget: scan button, counts, export box. |

## Building the single-file bundle

The bundle in `dist/` is generated from `src/` by a small Node script:

```bash
node build/bundle.mjs
```

It inlines each ModuleScript into one Script (rewriting `require(script.Parent.X)`
to an internal loader) so the result installs with **Save as Local Plugin**.
Edit `src/` — never `dist/` — and re-run the bundler.

## Limitations (by design)

- Static analysis can't see runtime behavior. The schema reserves a `runtime`
  block for a future version that could add execution tracing; this MVP leaves
  it empty.
- Very large places: scanning is incremental, but a place with tens of
  thousands of instances will still take a moment. Only scripts, remotes, and
  their ancestors (plus referenced instances) become nodes — not every Part.
