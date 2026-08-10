/**
 * Global search — indexes names, paths, kinds, functions and remotes.
 * Results focus the graph on the chosen object.
 */

import type { ModelNode, ProjectModel } from "../model/types";
import { KIND_LABELS } from "../theme/theme";
import { clear, el } from "./dom";

export interface SearchCallbacks {
  onPick(id: string): void;
}

interface IndexEntry {
  node: ModelNode;
  haystack: string;
  extra: string; // matched-function display, etc.
}

export class Search {
  private index: IndexEntry[] = [];
  private results: HTMLElement;

  constructor(private input: HTMLInputElement, resultsEl: HTMLElement, private cb: SearchCallbacks) {
    this.results = resultsEl;
    this.input.addEventListener("input", () => this.run());
    this.input.addEventListener("focus", () => this.run());
    this.input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") this.close();
      if (e.key === "Enter") {
        const first = this.results.querySelector<HTMLElement>(".search-result");
        if (first?.dataset.id) this.pick(first.dataset.id);
      }
    });
    document.addEventListener("click", (e) => {
      if (!this.results.contains(e.target as Node) && e.target !== this.input) this.close();
    });
  }

  build(model: ProjectModel): void {
    this.index = model.nodes.map((node) => ({
      node,
      haystack: [node.name, node.path, node.className, KIND_LABELS[node.kind], ...(node.functions ?? [])]
        .join(" ")
        .toLowerCase(),
      extra: (node.functions ?? []).join(", "),
    }));
  }

  private run(): void {
    const q = this.input.value.trim().toLowerCase();
    clear(this.results);
    if (!q) {
      this.close();
      return;
    }
    const terms = q.split(/\s+/);
    const matches = this.index
      .filter((e) => terms.every((t) => e.haystack.includes(t)))
      .slice(0, 50);

    if (matches.length === 0) {
      this.results.append(el("div", { class: "search-empty", textContent: "No matches." }));
    } else {
      for (const m of matches) {
        const row = el(
          "div",
          { class: "search-result", dataset: { id: m.node.id } },
          [
            el("span", { class: `tree-badge badge-${m.node.kind}`, textContent: shortGlyph(m.node.kind) }),
            el("span", { class: "search-name", textContent: m.node.name }),
            el("span", { class: "search-path", textContent: m.node.path }),
          ]
        );
        row.addEventListener("click", () => this.pick(m.node.id));
        this.results.append(row);
      }
    }
    this.results.classList.add("open");
  }

  private pick(id: string): void {
    this.cb.onPick(id);
    this.close();
  }

  private close(): void {
    this.results.classList.remove("open");
    clear(this.results);
  }
}

function shortGlyph(kind: string): string {
  return kind.replace(/[a-z]/g, "").slice(0, 2) || kind[0].toUpperCase();
}
