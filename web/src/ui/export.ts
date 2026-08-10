/**
 * Export helpers — filtered graph JSON, PNG, SVG, and a Markdown analysis
 * report. Everything is generated client-side; nothing leaves the browser.
 */

import type { ProjectModel } from "../model/types";
import type { GraphController } from "../graph/graphController";
import { download } from "./dom";

/** Export the currently-visible graph as a minimal rbxflow-shaped JSON. */
export function exportFilteredJson(
  model: ProjectModel,
  visibleNodeIds: Set<string>,
  filename = "rbxflow-filtered.json"
): void {
  const nodes = model.nodes.filter((n) => visibleNodeIds.has(n.id));
  const edges = model.edges.filter((e) => visibleNodeIds.has(e.from) && visibleNodeIds.has(e.to));
  const doc = {
    format: "rbxflow",
    version: 1,
    project: { ...model.info, note: "Filtered export from RBXFlow web app." },
    nodes: nodes.map((n) => ({
      id: n.id,
      name: n.name,
      kind: n.kind,
      className: n.className,
      path: n.path,
      environment: n.environment,
    })),
    relationships: edges.map((e) => ({
      id: e.id,
      from: e.from,
      to: e.to,
      type: e.type,
      line: e.line,
      confidence: e.confidence,
    })),
  };
  download(filename, JSON.stringify(doc, null, 2), "application/json");
}

export function exportPng(graph: GraphController, filename = "rbxflow-graph.png"): void {
  const uri = graph.exportPng();
  download(filename, dataUriToBlob(uri));
}

export function exportSvg(graph: GraphController, filename = "rbxflow-graph.svg"): void {
  const svg = graph.exportSvg();
  download(filename, svg, "image/svg+xml");
}

export function exportReport(model: ProjectModel, filename = "rbxflow-report.md"): void {
  const s = model.stats;
  const lines: string[] = [];
  lines.push(`# RBXFlow Analysis — ${model.info.name ?? "Untitled Project"}`, "");
  if (model.info.generatedAt) lines.push(`_Scanned: ${model.info.generatedAt}_`, "");
  lines.push("## Overview", "");
  lines.push("| Metric | Count |", "| --- | ---: |");
  lines.push(`| Scripts | ${s.scripts} |`);
  lines.push(`| ModuleScripts | ${s.moduleScripts} |`);
  lines.push(`| LocalScripts | ${s.localScripts} |`);
  lines.push(`| RemoteEvents | ${s.remoteEvents} |`);
  lines.push(`| RemoteFunctions | ${s.remoteFunctions} |`);
  lines.push(`| Bindables | ${s.bindables} |`);
  lines.push(`| Instances | ${s.instances} |`);
  lines.push(`| Relationships | ${s.relationships} |`);
  lines.push(`| Server scripts | ${s.serverScripts} |`);
  lines.push(`| Client scripts | ${s.clientScripts} |`);
  lines.push(`| Shared modules | ${s.sharedModules} |`);
  lines.push(`| Warnings | ${s.warnings} |`, "");

  // Relationship type breakdown.
  const byType = new Map<string, number>();
  for (const e of model.edges) byType.set(e.type, (byType.get(e.type) ?? 0) + 1);
  lines.push("## Relationships by type", "");
  lines.push("| Type | Count |", "| --- | ---: |");
  for (const [t, c] of [...byType].sort((a, b) => b[1] - a[1])) lines.push(`| ${t} | ${c} |`);
  lines.push("");

  if (model.warnings.length) {
    lines.push("## Warnings", "");
    for (const w of model.warnings) {
      const script = w.scriptId ? model.nodeById.get(w.scriptId)?.name ?? w.scriptId : "—";
      lines.push(`- **${w.type}** (${script}${w.line != null ? `:${w.line}` : ""}): ${w.message}`);
    }
    lines.push("");
  }

  download(filename, lines.join("\n"), "text/markdown");
}

function dataUriToBlob(uri: string): Blob {
  const [meta, b64] = uri.split(",");
  const mime = /data:(.*?);/.exec(meta)?.[1] ?? "image/png";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
