/**
 * Warnings panel — groups scanner warnings by type. Clicking a warning locates
 * the relevant script (and reports the line) via callback.
 */

import type { ProjectModel } from "../model/types";
import { clear, el } from "./dom";

export interface WarningsCallbacks {
  onLocate(scriptId: string | null, line: number | null, message: string): void;
}

export class WarningsPanel {
  constructor(private root: HTMLElement, private cb: WarningsCallbacks) {}

  render(model: ProjectModel): void {
    clear(this.root);
    this.root.append(el("div", { class: "panel-title", textContent: "WARNINGS" }));

    if (model.warnings.length === 0) {
      this.root.append(el("div", { class: "muted small", textContent: "No warnings reported." }));
      return;
    }

    // Group counts by type.
    const byType = new Map<string, number>();
    for (const w of model.warnings) byType.set(w.type, (byType.get(w.type) ?? 0) + 1);

    const summary = el("div", { class: "warn-summary" });
    for (const [type, count] of byType) {
      summary.append(
        el("div", { class: "warn-summary-row" }, [
          el("span", { class: "warn-icon", textContent: "⚠" }),
          el("span", { class: "warn-count", textContent: String(count) }),
          el("span", { class: "warn-type", textContent: humanize(type) }),
        ])
      );
    }
    this.root.append(summary);

    const list = el("div", { class: "warn-list" });
    for (const w of model.warnings) {
      const scriptName = w.scriptId ? model.nodeById.get(w.scriptId)?.name ?? w.scriptId : null;
      const row = el("div", { class: "warn-row" }, [
        el("span", { class: "warn-icon", textContent: "⚠" }),
        el("div", { class: "warn-body" }, [
          el("div", { class: "warn-message", textContent: w.message }),
          el("div", {
            class: "warn-loc",
            textContent: [scriptName, w.line != null ? `line ${w.line}` : null].filter(Boolean).join(" · ") || humanize(w.type),
          }),
        ]),
      ]);
      row.addEventListener("click", () => this.cb.onLocate(w.scriptId, w.line, w.message));
      list.append(row);
    }
    this.root.append(list);
  }
}

function humanize(type: string): string {
  return type.replace(/_/g, " ");
}
