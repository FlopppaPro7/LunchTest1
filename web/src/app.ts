/**
 * App controller — orchestrates the pipeline:
 *   parse → normalize → model → graph builder → renderer, and the UI panels.
 *
 * Holds all view state (mode, layout, depth, focus, filters, selection) and is
 * the single owner of the render pipeline. UI modules issue intent through
 * callbacks; nothing else touches the graph or model directly.
 */

import { normalize } from "./model/normalize";
import type { ProjectModel, RawDocument } from "./model/types";
import { GraphController } from "./graph/graphController";
import type { BuildOptions } from "./graph/buildGraph";
import { GRAPH_MODE_ORDER, GRAPH_MODES, type GraphModeId } from "./graph/modes";
import { LAYOUT_ORDER, LAYOUTS, type LayoutId } from "./graph/layouts";
import { neighborhood, findPath, type Direction } from "./graph/pathfind";
import { Explorer } from "./ui/explorer";
import { Inspector } from "./ui/inspector";
import { Search } from "./ui/search";
import { StatsPanel } from "./ui/stats";
import { WarningsPanel } from "./ui/warnings";
import { Importer } from "./ui/importer";
import * as Exporter from "./ui/export";
import { $, el, clear } from "./ui/dom";
import {
  applyCssVars,
  getTheme,
  KIND_LABELS,
  RELATIONSHIP_LABELS,
  edgeStyleFor,
} from "./theme/theme";
import type { NodeKind } from "./model/types";

const LS_LAYOUT = "rbxflow.layout";

/** localStorage can throw in sandboxed/embedded browsers — access it safely. */
const safeStorage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* storage unavailable — layout choice just won't persist */
    }
  },
};

export class App {
  private model: ProjectModel | null = null;
  private graph!: GraphController;

  // View state
  private mode: GraphModeId = "full";
  private layout: LayoutId = "hierarchical";
  private depth = 0; // 0 = unlimited
  private focusMode = false;
  private focusRootId: string | null = null;
  private focusDir: Direction = "both";
  private filterSet: Set<string> | null = null;
  private hiddenKinds = new Set<string>();
  private hiddenEdgeTypes = new Set<string>();
  private minConfidence: "low" | "medium" | "high" = "low";
  private pendingPathFrom: string | null = null;
  private selectedId: string | null = null;

  // UI modules
  private explorer!: Explorer;
  private inspector!: Inspector;
  private search!: Search;
  private stats!: StatsPanel;
  private warnings!: WarningsPanel;
  private importer!: Importer;

  init(): void {
    applyCssVars(getTheme());
    this.layout = (safeStorage.get(LS_LAYOUT) as LayoutId) || "hierarchical";

    this.graph = new GraphController($("#graph"), {
      onNodeSelect: (id) => this.handleNodeTap(id),
      onEdgeSelect: (id) => this.selectEdge(id),
      onBackground: () => this.clearSelection(),
    });

    this.explorer = new Explorer($("#explorer"), { onSelect: (id) => this.selectNode(id) });
    this.inspector = new Inspector($("#inspector"), {
      onFocus: (id) => this.enableFocus(id, "both"),
      onShowConnections: (id, dir) => this.enableFocus(id, dir),
      onPickPathEndpoint: (id) => this.beginFindPath(id),
      onSelect: (id) => this.selectNode(id),
    });
    this.search = new Search(
      $("#searchInput") as HTMLInputElement,
      $("#searchResults"),
      { onPick: (id) => this.selectNode(id) }
    );
    this.stats = new StatsPanel($("#stats"), {
      onFilterByKind: (kinds, label) => this.filterByKind(kinds, label),
      onFilterByEnv: (env, label) => this.filterByEnv(env, label),
      onClearFilter: () => this.clearFilter(),
    });
    this.warnings = new WarningsPanel($("#warnings"), {
      onLocate: (scriptId, line, msg) => this.locateWarning(scriptId, line, msg),
    });
    this.importer = new Importer({
      onLoaded: (doc, name) => this.loadDocument(doc, name),
      onError: (msg) => this.toast(msg, "Invalid RBXFlow file", true),
    });

    this.inspector.showEmpty();
    this.buildToolbar();
    this.buildModeBar();
    this.buildFiltersDrawer();
    this.wireControls();
    this.loadSample(); // convenience: preload the bundled fixture
  }

  // ---- Loading ---------------------------------------------------------
  private async loadSample(): Promise<void> {
    // Single-file builds (e.g. an embedded/offline distribution) can inline the
    // sample as a global so no fetch is needed. Fall back to fetching it.
    const embedded = (window as unknown as { __RBXFLOW_SAMPLE__?: RawDocument | string })
      .__RBXFLOW_SAMPLE__;
    if (embedded) {
      const text = typeof embedded === "string" ? embedded : JSON.stringify(embedded);
      await this.importer.loadTextAs(text, "sample-game.rbxflow.json");
      return;
    }
    try {
      const res = await fetch("./sample-game.rbxflow.json");
      if (!res.ok) return;
      const text = await res.text();
      await this.importer.loadTextAs(text, "sample-game.rbxflow.json");
    } catch {
      /* no sample available — user opens their own file */
    }
  }

  private loadDocument(doc: RawDocument, filename: string): void {
    this.model = normalize(doc);
    this.graph.setModel(this.model);

    // Reset view state for a fresh project.
    this.mode = "full";
    this.focusMode = false;
    this.focusRootId = null;
    this.filterSet = null;
    this.selectedId = null;
    (($("#focusToggle") as HTMLInputElement)).checked = false;

    ($("#projectName")).textContent = `${this.model.info.name ?? filename}`;
    ($("#dropOverlay")).classList.add("hidden");

    this.explorer.render(this.model);
    this.search.build(this.model);
    this.stats.render(this.model);
    this.warnings.render(this.model);
    this.inspector.showEmpty();
    this.updateModeBar();
    this.renderGraph();
    this.toast(
      `Loaded ${this.model.stats.scripts + this.model.stats.moduleScripts + this.model.stats.localScripts} scripts and ${this.model.stats.relationships} relationships.`,
      this.model.info.name ?? filename,
      false
    );
  }

  // ---- Render pipeline -------------------------------------------------
  private computeAllowList(): Set<string> | null {
    if (!this.model) return null;
    const sets: Set<string>[] = [];
    if (this.focusMode && this.focusRootId) {
      sets.push(neighborhood(this.model, this.focusRootId, this.depth, this.focusDir));
    }
    if (this.filterSet) sets.push(this.filterSet);
    if (sets.length === 0) return null;
    // Intersection of all active restriction sets.
    return sets.reduce((acc, s) => new Set([...acc].filter((x) => s.has(x))));
  }

  private renderGraph(): void {
    if (!this.model) return;
    const opts: BuildOptions = {
      mode: this.mode,
      nodeAllowList: this.computeAllowList(),
      hiddenKinds: this.hiddenKinds,
      hiddenEdgeTypes: this.hiddenEdgeTypes,
      minConfidence: this.minConfidence,
    };
    this.graph.render(opts, this.layout);
    if (this.selectedId && this.graph.hasNode(this.selectedId)) {
      this.graph.selectNode(this.selectedId, false);
    }
    this.updateStatus();
  }

  private updateStatus(): void {
    const c = this.graph.counts();
    const parts = [`${c.nodes} nodes`, `${c.edges} edges`, GRAPH_MODES[this.mode].label];
    if (this.focusMode && this.focusRootId && this.model) {
      const n = this.model.nodeById.get(this.focusRootId);
      parts.push(`focus: ${n?.name ?? ""}${this.depth ? ` (depth ${this.depth})` : ""}`);
    }
    ($("#statusStrip")).textContent = parts.join("  ·  ");
  }

  // ---- Selection -------------------------------------------------------
  private handleNodeTap(id: string): void {
    if (this.pendingPathFrom) {
      this.completeFindPath(id);
      return;
    }
    this.selectNode(id);
  }

  private selectNode(id: string): void {
    if (!this.model) return;
    if (this.pendingPathFrom) {
      this.completeFindPath(id);
      return;
    }
    const node = this.model.nodeById.get(id);
    if (!node) return;
    this.selectedId = id;

    if (!this.graph.hasNode(id)) {
      // Node not in current view — relax focus/filter so it becomes visible.
      this.focusMode = false;
      this.filterSet = null;
      (($("#focusToggle") as HTMLInputElement)).checked = false;
      this.focusRootId = null;
      this.renderGraph();
    }
    this.graph.selectNode(id, true);
    this.inspector.showNode(this.model, node);
    this.explorer.highlight(id);
    this.setTab("inspector");
    this.revealInspectorOnMobile();
  }

  private selectEdge(id: string): void {
    if (!this.model) return;
    const edge = this.model.edgeById.get(id);
    if (!edge) return;
    this.graph.selectEdge(id);
    this.inspector.showEdge(this.model, edge);
    this.setTab("inspector");
    this.revealInspectorOnMobile();
  }

  private clearSelection(): void {
    this.selectedId = null;
    this.inspector.showEmpty();
  }

  // ---- Focus / connections --------------------------------------------
  private enableFocus(id: string, dir: Direction): void {
    this.focusMode = true;
    this.focusRootId = id;
    this.focusDir = dir;
    this.selectedId = id;
    (($("#focusToggle") as HTMLInputElement)).checked = true;
    this.renderGraph();
    this.graph.selectNode(id, true);
  }

  private toggleFocus(on: boolean): void {
    this.focusMode = on;
    if (on && !this.focusRootId) this.focusRootId = this.selectedId;
    if (!on) this.focusDir = "both";
    this.renderGraph();
  }

  // ---- Find Path -------------------------------------------------------
  private beginFindPath(fromId: string): void {
    this.pendingPathFrom = fromId;
    const name = this.model?.nodeById.get(fromId)?.name ?? fromId;
    const bar = $("#pathbar");
    ($("#pathbarText")).textContent = `Find path from “${name}” — now select the target node.`;
    bar.classList.add("active");
  }

  private completeFindPath(toId: string): void {
    const fromId = this.pendingPathFrom!;
    this.pendingPathFrom = null;
    $("#pathbar").classList.remove("active");
    if (!this.model) return;
    if (fromId === toId) {
      this.toast("Pick a different target node.", "Find Path", true);
      return;
    }

    // Ensure both endpoints render: drop restrictions for a clean path view.
    this.focusMode = false;
    this.filterSet = null;
    (($("#focusToggle") as HTMLInputElement)).checked = false;

    // Try directed, then reverse, then undirected.
    let path = findPath(this.model, fromId, toId, "outgoing");
    if (!path) path = findPath(this.model, fromId, toId, "incoming");
    if (!path) path = findPath(this.model, fromId, toId, "both");

    this.renderGraph();

    if (!path) {
      const a = this.model.nodeById.get(fromId)?.name ?? fromId;
      const b = this.model.nodeById.get(toId)?.name ?? toId;
      this.toast(`No relationship path found between ${a} and ${b} in the current mode.`, "Find Path", true);
      return;
    }
    this.graph.highlightPath(path.nodes, path.edges);
    const names = path.nodes.map((n) => this.model!.nodeById.get(n)?.name ?? n).join("  →  ");
    this.toast(names, `Path (${path.nodes.length} nodes)`, false);
  }

  private cancelFindPath(): void {
    this.pendingPathFrom = null;
    $("#pathbar").classList.remove("active");
  }

  // ---- Filters (from stats + drawer) ----------------------------------
  private filterByKind(kinds: string[], label: string): void {
    if (!this.model) return;
    this.filterSet = new Set(
      this.model.nodes.filter((n) => kinds.includes(n.kind)).map((n) => n.id)
    );
    this.focusMode = false;
    this.renderGraph();
    this.toast(`Filtered to ${this.filterSet.size} ${label}.`, "Filter", false);
  }

  private filterByEnv(env: "server" | "client" | "shared", label: string): void {
    if (!this.model) return;
    this.filterSet = new Set(
      this.model.nodes.filter((n) => n.environment === env).map((n) => n.id)
    );
    this.focusMode = false;
    this.renderGraph();
    this.toast(`Filtered to ${this.filterSet.size} ${label}.`, "Filter", false);
  }

  private clearFilter(): void {
    this.filterSet = null;
    this.focusMode = false;
    this.focusRootId = null;
    (($("#focusToggle") as HTMLInputElement)).checked = false;
    this.renderGraph();
  }

  // ---- Warnings --------------------------------------------------------
  private locateWarning(scriptId: string | null, line: number | null, msg: string): void {
    if (scriptId && this.model?.nodeById.has(scriptId)) {
      this.selectNode(scriptId);
      this.toast(`${msg}${line != null ? `\nLine ${line}` : ""}`, "Warning located", false);
    } else {
      this.toast(msg, "Warning", true);
    }
  }

  // ---- Toolbar / controls ---------------------------------------------
  private buildToolbar(): void {
    const layoutSel = $("#layoutSelect") as HTMLSelectElement;
    clear(layoutSel);
    for (const id of LAYOUT_ORDER) {
      layoutSel.append(el("option", { value: id, textContent: LAYOUTS[id].label }));
    }
    layoutSel.value = this.layout;
  }

  private buildModeBar(): void {
    const bar = $("#modeBar");
    clear(bar);
    for (const id of GRAPH_MODE_ORDER) {
      const chip = el("button", {
        class: "mode-chip" + (id === this.mode ? " active" : ""),
        textContent: GRAPH_MODES[id].label,
        title: GRAPH_MODES[id].description,
        dataset: { mode: id },
      });
      chip.addEventListener("click", () => this.setMode(id));
      bar.append(chip);
    }
  }

  private updateModeBar(): void {
    for (const chip of $("#modeBar").querySelectorAll<HTMLElement>(".mode-chip")) {
      chip.classList.toggle("active", chip.dataset.mode === this.mode);
    }
  }

  private setMode(id: GraphModeId): void {
    this.mode = id;
    this.updateModeBar();
    this.renderGraph();
  }

  private setTab(name: string): void {
    for (const t of $("#rightTabs").querySelectorAll<HTMLElement>(".tab")) {
      t.classList.toggle("active", t.dataset.tab === name);
    }
    for (const p of document.querySelectorAll<HTMLElement>(".tab-panel")) {
      p.classList.toggle("active", p.dataset.panel === name);
    }
  }

  private wireControls(): void {
    $("#btnOpen").addEventListener("click", () => this.importer.openPicker());
    $("#btnOpen2").addEventListener("click", () => this.importer.openPicker());
    this.importer.attachDropZone($("#stage"), $("#dragHint"));

    const layoutSel = $("#layoutSelect") as HTMLSelectElement;
    layoutSel.addEventListener("change", () => {
      this.layout = layoutSel.value as LayoutId;
      safeStorage.set(LS_LAYOUT, this.layout);
      this.graph.runLayout(this.layout);
    });

    $("#btnFit").addEventListener("click", () => this.graph.fit());
    $("#btnReset").addEventListener("click", () => this.resetView());
    $("#zoomIn").addEventListener("click", () => this.graph.zoomBy(1.25));
    $("#zoomOut").addEventListener("click", () => this.graph.zoomBy(0.8));

    const depth = $("#depthSlider") as HTMLInputElement;
    depth.addEventListener("input", () => {
      this.depth = Number(depth.value);
      ($("#depthValue")).textContent = this.depth === 0 ? "Full" : String(this.depth);
      if (this.focusMode) this.renderGraph();
    });

    ($("#focusToggle") as HTMLInputElement).addEventListener("change", (e) => {
      this.toggleFocus((e.target as HTMLInputElement).checked);
    });
    ($("#edgeLabelToggle") as HTMLInputElement).addEventListener("change", (e) => {
      this.graph.toggleEdgeLabels((e.target as HTMLInputElement).checked);
    });

    // Tabs.
    for (const t of $("#rightTabs").querySelectorAll<HTMLElement>(".tab")) {
      t.addEventListener("click", () => this.setTab(t.dataset.tab!));
    }

    // Filters drawer.
    $("#btnFilters").addEventListener("click", () => $("#filtersDrawer").classList.toggle("open"));
    $("#closeFilters").addEventListener("click", () => $("#filtersDrawer").classList.remove("open"));

    // Export menu.
    const menu = $("#exportMenu");
    $("#btnExport").addEventListener("click", (e) => {
      e.stopPropagation();
      menu.classList.toggle("open");
    });
    document.addEventListener("click", () => menu.classList.remove("open"));
    for (const b of menu.querySelectorAll<HTMLElement>("button")) {
      b.addEventListener("click", () => this.doExport(b.dataset.export!));
    }

    // Mobile sidebar toggles.
    $("#btnMenuLeft").addEventListener("click", () => this.toggleSidebar("left"));
    $("#btnMenuRight").addEventListener("click", () => this.toggleSidebar("right"));
    $("#scrim").addEventListener("click", () => this.closeSidebars());

    // Path bar cancel.
    $("#pathCancel").addEventListener("click", () => this.cancelFindPath());

    // Keyboard: Esc cancels path/closes drawer; / focuses search.
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.cancelFindPath();
        $("#filtersDrawer").classList.remove("open");
      }
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        ($("#searchInput") as HTMLInputElement).focus();
      }
    });
  }

  // ---- Mobile sidebars -------------------------------------------------
  private get isMobile(): boolean {
    return window.matchMedia("(max-width: 860px)").matches;
  }

  private toggleSidebar(side: "left" | "right"): void {
    const target = $(`.sidebar.${side}`);
    const other = $(`.sidebar.${side === "left" ? "right" : "left"}`);
    other.classList.remove("open");
    const willOpen = !target.classList.contains("open");
    target.classList.toggle("open", willOpen);
    $("#scrim").classList.toggle("active", willOpen);
  }

  private closeSidebars(): void {
    $(".sidebar.left").classList.remove("open");
    $(".sidebar.right").classList.remove("open");
    $("#scrim").classList.remove("active");
  }

  /** After selecting on mobile, reveal the inspector so the result is visible. */
  private revealInspectorOnMobile(): void {
    if (!this.isMobile) return;
    $(".sidebar.left").classList.remove("open");
    $(".sidebar.right").classList.add("open");
    $("#scrim").classList.add("active");
  }

  private resetView(): void {
    this.focusMode = false;
    this.focusRootId = null;
    this.filterSet = null;
    this.depth = 0;
    (($("#focusToggle") as HTMLInputElement)).checked = false;
    ($("#depthSlider") as HTMLInputElement).value = "0";
    ($("#depthValue")).textContent = "Full";
    this.graph.clearHighlights();
    this.renderGraph();
    this.graph.reset();
  }

  private doExport(kind: string): void {
    if (!this.model) return;
    $("#exportMenu").classList.remove("open");
    const visible = this.computeAllowList() ?? new Set(this.model.nodes.map((n) => n.id));
    switch (kind) {
      case "json":
        Exporter.exportFilteredJson(this.model, visible);
        break;
      case "png":
        Exporter.exportPng(this.graph);
        break;
      case "svg":
        Exporter.exportSvg(this.graph);
        break;
      case "report":
        Exporter.exportReport(this.model);
        break;
    }
  }

  // ---- Filters drawer content (legend + toggles) ----------------------
  private buildFiltersDrawer(): void {
    const body = $("#filtersBody");
    clear(body);
    const theme = getTheme();

    // Node kinds.
    const kindGroup = el("div", { class: "filter-group" }, [el("h4", { textContent: "Node types" })]);
    for (const kind of Object.keys(theme.nodes) as NodeKind[]) {
      const ns = theme.nodes[kind];
      const cb = el("input", { type: "checkbox", checked: true }) as HTMLInputElement;
      cb.addEventListener("change", () => {
        if (cb.checked) this.hiddenKinds.delete(kind);
        else this.hiddenKinds.add(kind);
        this.renderGraph();
      });
      kindGroup.append(
        el("label", { class: "filter-row" }, [
          cb,
          el("span", { class: "legend-swatch", style: `background:${ns.bg};border-color:${ns.border}` }),
          el("span", { textContent: KIND_LABELS[kind] }),
        ])
      );
    }
    body.append(kindGroup);

    // Relationship types.
    const relGroup = el("div", { class: "filter-group" }, [el("h4", { textContent: "Relationships" })]);
    for (const type of Object.keys(RELATIONSHIP_LABELS)) {
      const es = edgeStyleFor(theme, type);
      const cb = el("input", { type: "checkbox", checked: true }) as HTMLInputElement;
      cb.addEventListener("change", () => {
        if (cb.checked) this.hiddenEdgeTypes.delete(type);
        else this.hiddenEdgeTypes.add(type);
        this.renderGraph();
      });
      relGroup.append(
        el("label", { class: "filter-row" }, [
          cb,
          el("span", { class: "legend-line", style: `border-top-color:${es.color};border-top-style:${es.line}` }),
          el("span", { textContent: RELATIONSHIP_LABELS[type] }),
        ])
      );
    }
    body.append(relGroup);

    // Confidence.
    const confGroup = el("div", { class: "filter-group" }, [el("h4", { textContent: "Minimum confidence" })]);
    const sel = el("select", { class: "select full" }) as HTMLSelectElement;
    for (const [v, label] of [["low", "Low (all)"], ["medium", "Medium and up"], ["high", "High only"]]) {
      sel.append(el("option", { value: v, textContent: label }));
    }
    sel.addEventListener("change", () => {
      this.minConfidence = sel.value as "low" | "medium" | "high";
      this.renderGraph();
    });
    confGroup.append(sel);
    body.append(confGroup);
  }

  // ---- Toast -----------------------------------------------------------
  private toast(message: string, title: string, isError: boolean): void {
    const wrap = $("#toastWrap");
    const t = el("div", { class: "toast" + (isError ? "" : " ok") }, [
      el("div", { class: "toast-title", textContent: title }),
      el("div", { textContent: message }),
    ]);
    wrap.append(t);
    setTimeout(() => t.remove(), isError ? 9000 : 5000);
  }
}
