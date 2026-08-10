/**
 * Layout definitions. Each returns a Cytoscape layout options object.
 * The selected layout id is persisted (see ui/persistence via app.ts).
 */

export type LayoutId =
  | "hierarchical"
  | "topToBottom"
  | "leftToRight"
  | "forceDirected"
  | "radial"
  | "circular";

export interface LayoutDef {
  id: LayoutId;
  label: string;
  options(): Record<string, unknown>;
}

const animate = { animate: true, animationDuration: 350, fit: true, padding: 40 };

export const LAYOUTS: Record<LayoutId, LayoutDef> = {
  hierarchical: {
    id: "hierarchical",
    label: "Hierarchical",
    options: () => ({ name: "dagre", rankDir: "TB", nodeSep: 40, rankSep: 80, ...animate }),
  },
  topToBottom: {
    id: "topToBottom",
    label: "Top → Bottom",
    options: () => ({
      name: "breadthfirst",
      directed: true,
      spacingFactor: 1.1,
      grid: false,
      ...animate,
    }),
  },
  leftToRight: {
    id: "leftToRight",
    label: "Left → Right",
    options: () => ({ name: "dagre", rankDir: "LR", nodeSep: 40, rankSep: 90, ...animate }),
  },
  forceDirected: {
    id: "forceDirected",
    label: "Force-directed",
    options: () => ({
      name: "fcose",
      quality: "default",
      randomize: true,
      nodeRepulsion: 6500,
      idealEdgeLength: 90,
      nodeSeparation: 90,
      ...animate,
    }),
  },
  radial: {
    id: "radial",
    label: "Radial",
    options: () => ({
      name: "concentric",
      concentric: (n: { degree: () => number }) => n.degree(),
      levelWidth: () => 1,
      minNodeSpacing: 40,
      ...animate,
    }),
  },
  circular: {
    id: "circular",
    label: "Circular",
    options: () => ({ name: "circle", spacingFactor: 1.2, ...animate }),
  },
};

export const LAYOUT_ORDER: LayoutId[] = [
  "hierarchical",
  "forceDirected",
  "radial",
  "circular",
  "leftToRight",
  "topToBottom",
];
