/**
 * Data model layer — normalize.
 *
 * Converts a validated RawDocument into the indexed `ProjectModel` that the
 * rest of the application consumes. This is the single place where raw JSON is
 * interpreted; everything downstream works with the normalized model only.
 */

import type {
  ModelEdge,
  ModelNode,
  ModelWarning,
  NodeKind,
  ProjectModel,
  ProjectStats,
  RawDocument,
  RawRelationship,
} from "./types";

let edgeCounter = 0;
let warnCounter = 0;

function classNameToKind(className: string): NodeKind {
  switch (className) {
    case "Script":
    case "LocalScript":
    case "ModuleScript":
    case "RemoteEvent":
    case "RemoteFunction":
    case "BindableEvent":
    case "BindableFunction":
      return className;
    default:
      return "Instance";
  }
}

export function normalize(doc: RawDocument): ProjectModel {
  edgeCounter = 0;
  warnCounter = 0;

  const nodes: ModelNode[] = [];
  const nodeById = new Map<string, ModelNode>();

  const pushNode = (n: ModelNode) => {
    if (nodeById.has(n.id)) return; // ids are unique; ignore accidental dupes
    nodeById.set(n.id, n);
    nodes.push(n);
  };

  // Instances (non-script, non-remote structural nodes) --------------------
  for (const inst of doc.instances ?? []) {
    pushNode({
      id: inst.id,
      name: inst.name,
      kind: classNameToKind(inst.className),
      className: inst.className,
      path: inst.path ?? inst.name,
      parentId: inst.parentId ?? null,
      environment: null,
      attributes: inst.attributes ?? {},
    });
  }

  // Scripts ----------------------------------------------------------------
  for (const s of doc.scripts ?? []) {
    pushNode({
      id: s.id,
      name: s.name,
      kind: classNameToKind(s.className),
      className: s.className,
      path: s.path ?? s.name,
      parentId: s.parentId ?? null,
      environment: s.environment ?? null,
      attributes: s.attributes ?? {},
      functions: s.functions ?? [],
      source: s.source,
    });
  }

  // Remotes / bindables ----------------------------------------------------
  for (const r of doc.remotes ?? []) {
    pushNode({
      id: r.id,
      name: r.name,
      kind: classNameToKind(r.className),
      className: r.className,
      path: r.path ?? r.name,
      parentId: r.parentId ?? null,
      environment: null,
      attributes: r.attributes ?? {},
    });
  }

  // Events -----------------------------------------------------------------
  for (const e of doc.events ?? []) {
    pushNode({
      id: e.id,
      name: e.name,
      kind: "Event",
      className: "Event",
      path: e.path ?? e.name,
      parentId: e.remoteId ?? null,
      environment: null,
      attributes: {},
      remoteId: e.remoteId,
    });
  }

  // Functions --------------------------------------------------------------
  for (const f of doc.functions ?? []) {
    pushNode({
      id: f.id,
      name: f.name,
      kind: "Function",
      className: "Function",
      path: f.name,
      parentId: f.scriptId ?? null,
      environment: null,
      attributes: {},
      scriptId: f.scriptId,
      line: f.line,
    });
  }

  // Edges ------------------------------------------------------------------
  const edges: ModelEdge[] = [];
  const edgeById = new Map<string, ModelEdge>();
  const outgoing = new Map<string, ModelEdge[]>();
  const incoming = new Map<string, ModelEdge[]>();

  const addToIndex = (map: Map<string, ModelEdge[]>, key: string, edge: ModelEdge) => {
    const arr = map.get(key);
    if (arr) arr.push(edge);
    else map.set(key, [edge]);
  };

  for (const raw of doc.relationships ?? []) {
    // Skip relationships whose endpoints don't exist — never fabricate nodes.
    if (!nodeById.has(raw.from) || !nodeById.has(raw.to)) continue;
    const edge = normalizeEdge(raw);
    edges.push(edge);
    edgeById.set(edge.id, edge);
    addToIndex(outgoing, edge.from, edge);
    addToIndex(incoming, edge.to, edge);
  }

  // Warnings ---------------------------------------------------------------
  const warnings: ModelWarning[] = (doc.warnings ?? []).map((w) => ({
    id: w.id ?? `warn_${++warnCounter}`,
    type: w.type,
    scriptId: w.scriptId ?? null,
    line: w.line ?? null,
    message: w.message,
  }));

  const stats = computeStats(nodes, edges, warnings);

  return {
    info: doc.project ?? {},
    nodes,
    edges,
    warnings,
    stats,
    nodeById,
    edgeById,
    outgoing,
    incoming,
    hasRuntime: doc.runtime !== undefined,
  };
}

function normalizeEdge(raw: RawRelationship): ModelEdge {
  return {
    id: raw.id ?? `rel_auto_${++edgeCounter}`,
    from: raw.from,
    to: raw.to,
    type: raw.type || "unknown",
    line: raw.line ?? null,
    snippet: raw.snippet ?? null,
    confidence: raw.confidence ?? "medium",
    meta: raw.meta ?? {},
  };
}

function computeStats(
  nodes: ModelNode[],
  edges: ModelEdge[],
  warnings: ModelWarning[]
): ProjectStats {
  const s: ProjectStats = {
    scripts: 0,
    moduleScripts: 0,
    localScripts: 0,
    serverScripts: 0,
    clientScripts: 0,
    sharedModules: 0,
    remoteEvents: 0,
    remoteFunctions: 0,
    bindables: 0,
    instances: 0,
    relationships: edges.length,
    warnings: warnings.length,
  };

  for (const n of nodes) {
    switch (n.kind) {
      case "Script":
        s.scripts++;
        break;
      case "LocalScript":
        s.localScripts++;
        break;
      case "ModuleScript":
        s.moduleScripts++;
        break;
      case "RemoteEvent":
        s.remoteEvents++;
        break;
      case "RemoteFunction":
        s.remoteFunctions++;
        break;
      case "BindableEvent":
      case "BindableFunction":
        s.bindables++;
        break;
      case "Instance":
        s.instances++;
        break;
    }
    if (n.environment === "server") s.serverScripts++;
    else if (n.environment === "client") s.clientScripts++;
    else if (n.environment === "shared") s.sharedModules++;
  }

  return s;
}
