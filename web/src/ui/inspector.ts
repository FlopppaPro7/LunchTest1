/**
 * Inspector — renders node metadata (with Show Connections + Focus/Find Path
 * actions) and relationship (edge) details with a highlighted source snippet.
 */

import type { ModelEdge, ModelNode, ProjectModel } from "../model/types";
import { KIND_LABELS, RELATIONSHIP_LABELS } from "../theme/theme";
import { clear, el } from "./dom";
import { highlightLuau } from "./highlight";

export interface InspectorCallbacks {
  onFocus(id: string): void;
  onShowConnections(id: string, dir: "incoming" | "outgoing" | "both"): void;
  onPickPathEndpoint(id: string): void;
  onSelect(id: string): void;
}

export class Inspector {
  constructor(private root: HTMLElement, private cb: InspectorCallbacks) {}

  showEmpty(): void {
    clear(this.root);
    this.root.append(
      el("div", { class: "inspector-empty" }, [
        el("div", { class: "inspector-title", textContent: "INSPECTOR" }),
        el("div", { class: "muted", textContent: "Select a node or edge to inspect it." }),
      ])
    );
  }

  showNode(model: ProjectModel, node: ModelNode): void {
    clear(this.root);
    const outgoing = model.outgoing.get(node.id) ?? [];
    const incoming = model.incoming.get(node.id) ?? [];
    const requires = outgoing.filter((e) => e.type === "require");
    const requiredBy = incoming.filter((e) => e.type === "require");
    const remoteConns = [...outgoing, ...incoming].filter((e) =>
      ["fires_server", "fires_client", "invokes_server", "invokes_client", "server_event", "client_event"].includes(e.type)
    );

    const head = el("div", { class: "inspector-head" }, [
      el("div", { class: "inspector-eyebrow", textContent: "INSPECTOR" }),
      el("div", { class: "inspector-name", textContent: node.name }),
      el("span", { class: `pill pill-${node.kind}`, textContent: KIND_LABELS[node.kind] }),
    ]);

    const meta = el("div", { class: "meta-grid" });
    const addMeta = (label: string, value: string) => {
      meta.append(
        el("div", { class: "meta-cell" }, [
          el("div", { class: "meta-label", textContent: label }),
          el("div", { class: "meta-value", textContent: value }),
        ])
      );
    };
    addMeta("Type", node.className);
    if (node.environment) addMeta("Environment", node.environment);
    addMeta("Path", node.path);
    if (node.functions) addMeta("Functions", String(node.functions.length));
    addMeta("Requires", String(requires.length));
    addMeta("Required By", String(requiredBy.length));
    addMeta("Remote Connections", String(remoteConns.length));
    addMeta("Relationships", String(outgoing.length + incoming.length));

    const actions = el("div", { class: "inspector-actions" }, [
      button("« Focus", "primary", () => this.cb.onFocus(node.id)),
      button("Find Path…", "ghost", () => this.cb.onPickPathEndpoint(node.id)),
    ]);

    const conn = el("div", { class: "conn-actions" }, [
      el("div", { class: "section-label", textContent: "Show Connections" }),
      el("div", { class: "btn-row" }, [
        button("Incoming", "chip", () => this.cb.onShowConnections(node.id, "incoming")),
        button("Outgoing", "chip", () => this.cb.onShowConnections(node.id, "outgoing")),
        button("Both", "chip", () => this.cb.onShowConnections(node.id, "both")),
      ]),
    ]);

    // Incoming / outgoing lists.
    const lists = el("div", { class: "conn-lists" });
    lists.append(this.connList(model, "Incoming", incoming, "from"));
    lists.append(this.connList(model, "Outgoing", outgoing, "to"));

    // Attributes.
    let attrs: HTMLElement | null = null;
    if (Object.keys(node.attributes).length) {
      attrs = el("div", { class: "attr-block" }, [
        el("div", { class: "section-label", textContent: "Attributes" }),
      ]);
      for (const [k, v] of Object.entries(node.attributes)) {
        attrs.append(
          el("div", { class: "attr-row" }, [
            el("span", { class: "attr-key", textContent: k }),
            el("span", { class: "attr-val", textContent: JSON.stringify(v) }),
          ])
        );
      }
    }

    this.root.append(head, actions, conn, meta, lists);
    if (attrs) this.root.append(attrs);
  }

  private connList(
    model: ProjectModel,
    title: string,
    edges: ModelEdge[],
    endpoint: "from" | "to"
  ): HTMLElement {
    const box = el("div", { class: "conn-group" }, [
      el("div", { class: "section-label", textContent: `${title} (${edges.length})` }),
    ]);
    if (edges.length === 0) {
      box.append(el("div", { class: "muted small", textContent: "—" }));
      return box;
    }
    for (const e of edges.slice(0, 40)) {
      const otherId = endpoint === "from" ? e.from : e.to;
      const other = model.nodeById.get(otherId);
      const row = el("div", { class: "conn-row", title: e.snippet ?? "" }, [
        el("span", { class: `dot type-dot-${e.type}` }),
        el("span", { class: "conn-name", textContent: other?.name ?? otherId }),
        el("span", { class: "conn-type", textContent: RELATIONSHIP_LABELS[e.type] ?? e.type }),
      ]);
      row.addEventListener("click", () => this.cb.onSelect(otherId));
      box.append(row);
    }
    if (edges.length > 40) box.append(el("div", { class: "muted small", textContent: `+${edges.length - 40} more` }));
    return box;
  }

  showEdge(model: ProjectModel, edge: ModelEdge): void {
    clear(this.root);
    const from = model.nodeById.get(edge.from);
    const to = model.nodeById.get(edge.to);

    const head = el("div", { class: "inspector-head" }, [
      el("div", { class: "inspector-eyebrow", textContent: "RELATIONSHIP" }),
      el("div", { class: "inspector-name", textContent: RELATIONSHIP_LABELS[edge.type] ?? edge.type }),
      el("span", { class: `pill conf-${edge.confidence}`, textContent: `${edge.confidence} confidence` }),
    ]);

    const meta = el("div", { class: "meta-grid" });
    const addMeta = (label: string, value: string, onClick?: () => void) => {
      const cell = el("div", { class: "meta-cell" + (onClick ? " clickable" : "") }, [
        el("div", { class: "meta-label", textContent: label }),
        el("div", { class: "meta-value", textContent: value }),
      ]);
      if (onClick) cell.addEventListener("click", onClick);
      meta.append(cell);
    };
    addMeta("From", from?.name ?? edge.from, from ? () => this.cb.onSelect(edge.from) : undefined);
    addMeta("To", to?.name ?? edge.to, to ? () => this.cb.onSelect(edge.to) : undefined);
    addMeta("Type", edge.type);
    if (edge.line != null) addMeta("Line", String(edge.line));
    addMeta("Confidence", edge.confidence);
    for (const [k, v] of Object.entries(edge.meta)) addMeta(k, String(v));

    this.root.append(head, meta);

    if (edge.snippet) {
      const src = el("div", { class: "snippet-block" }, [
        el("div", { class: "section-label", textContent: "Source" }),
      ]);
      const pre = el("pre", { class: "snippet" });
      pre.innerHTML = highlightLuau(edge.snippet);
      src.append(pre);
      this.root.append(src);
    }
  }
}

function button(label: string, variant: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.className = `btn btn-${variant}`;
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}
