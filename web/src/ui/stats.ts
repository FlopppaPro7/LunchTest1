/**
 * Project overview (statistics) + warnings panels. Clicking a statistic filters
 * the graph; clicking a warning locates the relevant script.
 */

import type { ProjectModel } from "../model/types";
import { clear, el } from "./dom";

export interface StatsCallbacks {
  onFilterByKind(kinds: string[], label: string): void;
  onFilterByEnv(env: "server" | "client" | "shared", label: string): void;
  onClearFilter(): void;
}

export class StatsPanel {
  constructor(private root: HTMLElement, private cb: StatsCallbacks) {}

  render(model: ProjectModel): void {
    clear(this.root);
    const s = model.stats;
    this.root.append(el("div", { class: "panel-title", textContent: "PROJECT OVERVIEW" }));

    const grid = el("div", { class: "stat-grid" });
    const stat = (label: string, value: number, onClick?: () => void, accent?: string) => {
      const cell = el("div", { class: "stat-cell" + (onClick ? " clickable" : "") }, [
        el("div", { class: "stat-value", textContent: value.toLocaleString(), style: accent ? `color:${accent}` : "" }),
        el("div", { class: "stat-label", textContent: label }),
      ]);
      if (onClick) cell.addEventListener("click", onClick);
      grid.append(cell);
    };

    stat("Scripts", s.scripts, () => this.cb.onFilterByKind(["Script"], "Scripts"));
    stat("ModuleScripts", s.moduleScripts, () => this.cb.onFilterByKind(["ModuleScript"], "ModuleScripts"));
    stat("LocalScripts", s.localScripts, () => this.cb.onFilterByKind(["LocalScript"], "LocalScripts"));
    stat("RemoteEvents", s.remoteEvents, () => this.cb.onFilterByKind(["RemoteEvent"], "RemoteEvents"));
    stat("RemoteFunctions", s.remoteFunctions, () => this.cb.onFilterByKind(["RemoteFunction"], "RemoteFunctions"));
    stat("Instances", s.instances, () => this.cb.onFilterByKind(["Instance"], "Instances"));
    stat("Relationships", s.relationships);
    stat("Warnings", s.warnings, undefined, s.warnings ? "var(--warn)" : undefined);

    this.root.append(grid);

    const split = el("div", { class: "stat-split" }, [
      splitCell("Server", s.serverScripts, "var(--server)", () => this.cb.onFilterByEnv("server", "Server scripts")),
      splitCell("Client", s.clientScripts, "var(--client)", () => this.cb.onFilterByEnv("client", "Client scripts")),
      splitCell("Shared", s.sharedModules, "var(--shared)", () => this.cb.onFilterByEnv("shared", "Shared modules")),
    ]);
    this.root.append(split);
    this.root.append(
      (() => {
        const b = el("button", { class: "btn btn-ghost full", textContent: "Clear filter" });
        b.addEventListener("click", () => this.cb.onClearFilter());
        return b;
      })()
    );
  }
}

function splitCell(label: string, value: number, color: string, onClick: () => void): HTMLElement {
  const cell = el("div", { class: "split-cell clickable" }, [
    el("span", { class: "split-dot", style: `background:${color}` }),
    el("span", { class: "split-label", textContent: label }),
    el("span", { class: "split-value", textContent: value.toLocaleString() }),
  ]);
  cell.addEventListener("click", onClick);
  return cell;
}
