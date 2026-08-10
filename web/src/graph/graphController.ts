/**
 * Graph controller — the only module that talks to Cytoscape directly.
 *
 * Everything above it (App, UI panels) issues intent: "render this model in
 * this mode", "focus node X", "highlight this path", "run this layout". The
 * controller keeps the cy instance and translates intent into renderer calls.
 */

import cytoscape, { type Core, type EdgeSingular, type NodeSingular } from "cytoscape";
import dagre from "cytoscape-dagre";
import fcose from "cytoscape-fcose";
import svg from "cytoscape-svg";
import { buildStylesheet } from "./cytoStyles";
import { LAYOUTS, type LayoutId } from "./layouts";
import { buildElements, type BuildOptions } from "./buildGraph";
import type { ProjectModel } from "../model/types";

cytoscape.use(dagre);
cytoscape.use(fcose);
cytoscape.use(svg);

export interface GraphCallbacks {
  onNodeSelect(id: string): void;
  onEdgeSelect(id: string): void;
  onBackground(): void;
}

export class GraphController {
  private cy: Core;
  private model: ProjectModel | null = null;
  private lastLayout: LayoutId = "hierarchical";

  constructor(container: HTMLElement, private cb: GraphCallbacks) {
    // Touch devices keep one-finger panning; on desktop, left-drag no longer
    // pans the view — left-click selects, and panning is done with the middle
    // mouse button (see setupMiddleMousePan).
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;

    this.cy = cytoscape({
      container,
      style: buildStylesheet(),
      wheelSensitivity: 0.2,
      minZoom: 0.05,
      maxZoom: 4,
      pixelRatio: 1, // canvas renderer scales fine; keeps large graphs fast
      userPanningEnabled: coarsePointer,
      boxSelectionEnabled: false,
    });

    this.cy.on("tap", "node", (e) => this.cb.onNodeSelect(e.target.id()));
    this.cy.on("tap", "edge", (e) => this.cb.onEdgeSelect(e.target.id()));
    this.cy.on("tap", (e) => {
      if (e.target === this.cy) this.cb.onBackground();
    });

    this.setupMiddleMousePan(container);
  }

  /**
   * Middle-mouse-button panning: hold the middle button and drag to move the
   * view. Works regardless of the userPanningEnabled setting, so left-click
   * stays reserved for selection on desktop.
   */
  private setupMiddleMousePan(container: HTMLElement): void {
    let panning = false;
    let last = { x: 0, y: 0 };

    const onDown = (e: MouseEvent) => {
      if (e.button !== 1) return; // middle button only
      e.preventDefault();
      panning = true;
      last = { x: e.clientX, y: e.clientY };
      container.style.cursor = "grabbing";
    };
    const onMove = (e: MouseEvent) => {
      if (!panning) return;
      const dx = e.clientX - last.x;
      const dy = e.clientY - last.y;
      last = { x: e.clientX, y: e.clientY };
      this.cy.panBy({ x: dx, y: dy });
    };
    const stop = () => {
      if (!panning) return;
      panning = false;
      container.style.cursor = "";
    };

    // Capture phase so we intercept the middle-button press before Cytoscape's
    // own canvas listeners can consume it.
    container.addEventListener("mousedown", onDown, true);
    window.addEventListener("mousemove", onMove, true);
    window.addEventListener("mouseup", stop, true);
    // Suppress the browser's middle-click auxiliary action (autoscroll).
    container.addEventListener(
      "auxclick",
      (e) => {
        if (e.button === 1) e.preventDefault();
      },
      true
    );
  }

  setModel(model: ProjectModel): void {
    this.model = model;
  }

  /** Rebuild elements for a mode/filter set and run the current layout. */
  render(opts: BuildOptions, layout: LayoutId = this.lastLayout): void {
    if (!this.model) return;
    const { elements } = buildElements(this.model, opts);
    this.cy.batch(() => {
      this.cy.elements().remove();
      this.cy.add(elements);
    });
    this.runLayout(layout);
  }

  runLayout(id: LayoutId): void {
    this.lastLayout = id;
    if (this.cy.elements().length === 0) return;
    const def = LAYOUTS[id] ?? LAYOUTS.hierarchical;
    const layout = this.cy.layout(def.options() as never);
    layout.run();
  }

  get currentLayout(): LayoutId {
    return this.lastLayout;
  }

  // View ops ---------------------------------------------------------------
  fit(): void {
    this.cy.animate({ fit: { eles: this.cy.elements(), padding: 40 }, duration: 300 });
  }

  reset(): void {
    this.clearHighlights();
    this.cy.animate({ fit: { eles: this.cy.elements(), padding: 40 }, duration: 300 });
  }

  zoomBy(factor: number): void {
    const z = this.cy.zoom() * factor;
    this.cy.zoom({ level: z, renderedPosition: { x: this.cy.width() / 2, y: this.cy.height() / 2 } });
  }

  // Selection & centering --------------------------------------------------
  selectNode(id: string, center = true): void {
    const n = this.cy.getElementById(id);
    if (n.empty()) return;
    this.cy.elements().unselect();
    n.select();
    if (center) this.cy.animate({ center: { eles: n }, zoom: Math.max(this.cy.zoom(), 0.8), duration: 300 });
  }

  selectEdge(id: string): void {
    const e = this.cy.getElementById(id);
    if (e.empty()) return;
    this.cy.elements().unselect();
    e.select();
  }

  hasNode(id: string): boolean {
    return !this.cy.getElementById(id).empty();
  }

  // Highlighting -----------------------------------------------------------
  clearHighlights(): void {
    this.cy.elements().removeClass("faded highlight path showlabel");
  }

  /** Focus mode: fade everything not connected to `id`. */
  focusNode(id: string): void {
    const n = this.cy.getElementById(id) as NodeSingular;
    if (n.empty()) return;
    const keep = n.closedNeighborhood();
    this.cy.batch(() => {
      this.cy.elements().addClass("faded");
      keep.removeClass("faded").addClass("highlight");
      n.removeClass("faded").addClass("highlight");
    });
    this.cy.animate({ fit: { eles: keep, padding: 60 }, duration: 300 });
  }

  /** Highlight a specific set of nodes+edges (path finding). */
  highlightPath(nodeIds: string[], edgeIds: string[]): void {
    this.clearHighlights();
    const all = this.cy.collection();
    const path = this.cy.collection();
    nodeIds.forEach((id) => path.merge(this.cy.getElementById(id)));
    edgeIds.forEach((id) => path.merge(this.cy.getElementById(id)));
    this.cy.batch(() => {
      this.cy.elements().difference(path).addClass("faded");
      path.removeClass("faded").addClass("path");
    });
    if (path.nonempty()) this.cy.animate({ fit: { eles: path, padding: 80 }, duration: 350 });
    all.length; // (no-op to satisfy noUnusedLocals in strict builds)
  }

  /** Show/hide relationship-type labels on edges. */
  toggleEdgeLabels(show: boolean): void {
    if (show) this.cy.edges().addClass("showlabel");
    else this.cy.edges().removeClass("showlabel");
  }

  // Connections helper -----------------------------------------------------
  neighborsOf(id: string, dir: "incoming" | "outgoing" | "both") {
    const n = this.cy.getElementById(id) as NodeSingular;
    if (n.empty()) return { nodes: [] as string[] };
    let edges: EdgeSingular[] = [];
    if (dir === "incoming") edges = n.incomers("edge").toArray() as EdgeSingular[];
    else if (dir === "outgoing") edges = n.outgoers("edge").toArray() as EdgeSingular[];
    else edges = n.connectedEdges().toArray() as EdgeSingular[];
    const ids = new Set<string>();
    for (const e of edges) {
      const other = e.source().id() === id ? e.target().id() : e.source().id();
      ids.add(other);
    }
    return { nodes: [...ids] };
  }

  // Export -----------------------------------------------------------------
  exportPng(): string {
    return this.cy.png({ full: true, scale: 2, bg: getComputedStyle(document.documentElement).getPropertyValue("--bg-0") || "#0d1117" });
  }

  exportSvg(): string {
    // provided by cytoscape-svg
    return (this.cy as unknown as { svg(o: object): string }).svg({ full: true, scale: 1 });
  }

  counts(): { nodes: number; edges: number } {
    return { nodes: this.cy.nodes().length, edges: this.cy.edges().length };
  }

  restyle(): void {
    this.cy.style(buildStylesheet());
  }
}
