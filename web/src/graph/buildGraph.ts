/**
 * Graph builder.
 *
 * Turns the normalized ProjectModel + the active mode + filters into a set of
 * Cytoscape element definitions. This is the boundary between "our model" and
 * "the renderer" — the renderer never sees the ProjectModel directly.
 */

import type { ElementDefinition } from "cytoscape";
import type { ModelEdge, ModelNode, ProjectModel } from "../model/types";
import { GRAPH_MODES, type GraphModeId } from "./modes";

export interface BuildOptions {
  mode: GraphModeId;
  /** When set, only include these node ids (used by focus/depth/search). */
  nodeAllowList?: Set<string> | null;
  /** Hide nodes matching these kinds even if the mode allows them. */
  hiddenKinds?: Set<string>;
  /** Hide edges matching these relationship types. */
  hiddenEdgeTypes?: Set<string>;
  /** Minimum confidence to include an edge. */
  minConfidence?: "low" | "medium" | "high";
}

const CONF_RANK: Record<string, number> = { low: 0, medium: 1, high: 2 };

export interface BuildResult {
  elements: ElementDefinition[];
  nodeCount: number;
  edgeCount: number;
}

export function buildElements(model: ProjectModel, opts: BuildOptions): BuildResult {
  const mode = GRAPH_MODES[opts.mode];
  const hiddenKinds = opts.hiddenKinds ?? new Set();
  const hiddenEdgeTypes = opts.hiddenEdgeTypes ?? new Set();
  const minRank = CONF_RANK[opts.minConfidence ?? "low"];

  const nodeIncluded = (n: ModelNode): boolean => {
    if (opts.nodeAllowList && !opts.nodeAllowList.has(n.id)) return false;
    if (mode.nodeKinds && !mode.nodeKinds.has(n.kind)) return false;
    if (hiddenKinds.has(n.kind)) return false;
    return true;
  };

  const includedNodeIds = new Set<string>();
  const elements: ElementDefinition[] = [];

  for (const n of model.nodes) {
    if (!nodeIncluded(n)) continue;
    includedNodeIds.add(n.id);
    elements.push(nodeElement(n));
  }

  let edgeCount = 0;
  for (const e of model.edges) {
    if (mode.edgeTypes && !mode.edgeTypes.has(e.type)) continue;
    if (hiddenEdgeTypes.has(e.type)) continue;
    if (CONF_RANK[e.confidence] < minRank) continue;
    if (!includedNodeIds.has(e.from) || !includedNodeIds.has(e.to)) continue;
    elements.push(edgeElement(e));
    edgeCount++;
  }

  return { elements, nodeCount: includedNodeIds.size, edgeCount };
}

function nodeElement(n: ModelNode): ElementDefinition {
  return {
    group: "nodes",
    data: {
      id: n.id,
      label: n.name,
      kind: n.kind,
      env: n.environment ?? "none",
      className: n.className,
      path: n.path,
    },
    classes: `kind-${n.kind} env-${n.environment ?? "none"}`,
  };
}

function edgeElement(e: ModelEdge): ElementDefinition {
  return {
    group: "edges",
    data: {
      id: e.id,
      source: e.from,
      target: e.to,
      type: e.type,
      confidence: e.confidence,
    },
    classes: `type-${e.type} conf-${e.confidence}`,
  };
}
