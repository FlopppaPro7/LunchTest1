/**
 * Traversal helpers over the normalized model: BFS shortest path, connected
 * sets for focus mode, and depth-limited neighborhoods for the depth control.
 */

import type { ProjectModel } from "../model/types";

export type Direction = "incoming" | "outgoing" | "both";

/** Neighboring node ids of `id` following edges in the given direction. */
function neighbors(model: ProjectModel, id: string, dir: Direction): string[] {
  const out: string[] = [];
  if (dir === "outgoing" || dir === "both") {
    for (const e of model.outgoing.get(id) ?? []) out.push(e.to);
  }
  if (dir === "incoming" || dir === "both") {
    for (const e of model.incoming.get(id) ?? []) out.push(e.from);
  }
  return out;
}

/**
 * Node ids reachable from `start` within `depth` hops (both directions).
 * depth <= 0 or Infinity means "unlimited".
 */
export function neighborhood(
  model: ProjectModel,
  start: string,
  depth: number,
  dir: Direction = "both"
): Set<string> {
  const seen = new Set<string>([start]);
  if (!model.nodeById.has(start)) return seen;
  const limit = depth <= 0 ? Infinity : depth;
  let frontier = [start];
  let level = 0;
  while (frontier.length && level < limit) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const nb of neighbors(model, id, dir)) {
        if (!seen.has(nb)) {
          seen.add(nb);
          next.push(nb);
        }
      }
    }
    frontier = next;
    level++;
  }
  return seen;
}

export interface FoundPath {
  nodes: string[];
  edges: string[];
}

/**
 * BFS shortest path from `from` to `to`, following edge direction. Returns null
 * if unreachable. Also returns the specific edge ids traversed.
 */
export function findPath(
  model: ProjectModel,
  from: string,
  to: string,
  dir: Direction = "outgoing"
): FoundPath | null {
  if (from === to) return { nodes: [from], edges: [] };
  if (!model.nodeById.has(from) || !model.nodeById.has(to)) return null;

  const prev = new Map<string, { node: string; edge: string }>();
  const queue: string[] = [from];
  const visited = new Set<string>([from]);

  while (queue.length) {
    const cur = queue.shift()!;
    const edges = [];
    if (dir === "outgoing" || dir === "both") {
      for (const e of model.outgoing.get(cur) ?? []) edges.push({ next: e.to, edge: e.id });
    }
    if (dir === "incoming" || dir === "both") {
      for (const e of model.incoming.get(cur) ?? []) edges.push({ next: e.from, edge: e.id });
    }
    for (const { next, edge } of edges) {
      if (visited.has(next)) continue;
      visited.add(next);
      prev.set(next, { node: cur, edge });
      if (next === to) return reconstruct(prev, from, to);
      queue.push(next);
    }
  }
  return null;
}

function reconstruct(
  prev: Map<string, { node: string; edge: string }>,
  from: string,
  to: string
): FoundPath {
  const nodes: string[] = [to];
  const edges: string[] = [];
  let cur = to;
  while (cur !== from) {
    const step = prev.get(cur)!;
    edges.push(step.edge);
    nodes.push(step.node);
    cur = step.node;
  }
  nodes.reverse();
  edges.reverse();
  return { nodes, edges };
}
