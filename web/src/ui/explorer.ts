/**
 * Project Explorer — a collapsible tree built from node parent/child links.
 * Clicking an item focuses the graph on that object.
 */

import type { ModelNode, ProjectModel } from "../model/types";
import { getTheme, KIND_LABELS } from "../theme/theme";
import { clear, el } from "./dom";

export interface ExplorerCallbacks {
  onSelect(id: string): void;
}

export class Explorer {
  private root: HTMLElement;
  private collapsed = new Set<string>();

  constructor(container: HTMLElement, private cb: ExplorerCallbacks) {
    this.root = container;
  }

  render(model: ProjectModel): void {
    clear(this.root);

    // Build children index.
    const children = new Map<string | null, ModelNode[]>();
    for (const n of model.nodes) {
      const key = n.parentId && model.nodeById.has(n.parentId) ? n.parentId : null;
      const arr = children.get(key);
      if (arr) arr.push(n);
      else children.set(key, [n]);
    }
    const sortNodes = (a: ModelNode, b: ModelNode) =>
      a.name.localeCompare(b.name);

    const roots = (children.get(null) ?? []).sort(sortNodes);
    for (const r of roots) this.root.append(this.renderNode(r, children, sortNodes, 0));

    if (roots.length === 0) {
      this.root.append(el("div", { class: "explorer-empty", textContent: "No objects." }));
    }
  }

  highlight(id: string): void {
    for (const node of this.root.querySelectorAll(".tree-row.selected")) {
      node.classList.remove("selected");
    }
    const row = this.root.querySelector(`.tree-row[data-id="${CSS.escape(id)}"]`);
    if (row) {
      row.classList.add("selected");
      row.scrollIntoView({ block: "nearest" });
    }
  }

  private renderNode(
    node: ModelNode,
    children: Map<string | null, ModelNode[]>,
    sortFn: (a: ModelNode, b: ModelNode) => number,
    depth: number
  ): HTMLElement {
    const kids = (children.get(node.id) ?? []).sort(sortFn);
    const hasKids = kids.length > 0;
    const isCollapsed = this.collapsed.has(node.id);
    const theme = getTheme();
    const glyph = theme.nodes[node.kind]?.glyph ?? "•";

    const twisty = el("span", {
      class: `twisty ${hasKids ? (isCollapsed ? "collapsed" : "open") : "leaf"}`,
      textContent: hasKids ? (isCollapsed ? "▸" : "▾") : "",
    });

    const row = el(
      "div",
      { class: "tree-row", dataset: { id: node.id }, title: `${KIND_LABELS[node.kind]} · ${node.path}` },
      [
        twisty,
        el("span", { class: `tree-badge badge-${node.kind}`, textContent: glyph }),
        el("span", { class: "tree-label", textContent: node.name }),
      ]
    );
    row.style.paddingLeft = `${depth * 14 + 6}px`;

    twisty.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!hasKids) return;
      if (isCollapsed) this.collapsed.delete(node.id);
      else this.collapsed.add(node.id);
      // Re-render just the subtree by re-rendering whole tree (cheap enough).
      const parent = row.parentElement!;
      const replacement = this.renderNode(node, children, sortFn, depth);
      parent.replaceChild(replacement, wrapper);
    });

    row.addEventListener("click", () => this.cb.onSelect(node.id));

    const wrapper = el("div", { class: "tree-node" }, [row]);
    if (hasKids && !isCollapsed) {
      const childBox = el("div", { class: "tree-children" });
      for (const k of kids) childBox.append(this.renderNode(k, children, sortFn, depth + 1));
      wrapper.append(childBox);
    }
    return wrapper;
  }
}
