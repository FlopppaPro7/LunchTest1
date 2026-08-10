/**
 * Import UI — file picker + drag-and-drop, with friendly error reporting.
 * Emits a validated RawDocument (or an error message) via callbacks.
 */

import { parseFile, parseText } from "../model/parse";
import { RbxflowValidationError } from "../model/validate";
import type { RawDocument } from "../model/types";
import { el } from "./dom";

export interface ImporterCallbacks {
  onLoaded(doc: RawDocument, filename: string): void;
  onError(message: string): void;
}

export class Importer {
  private input: HTMLInputElement;

  constructor(private cb: ImporterCallbacks) {
    this.input = el("input", { type: "file", accept: ".json,application/json" });
    this.input.style.display = "none";
    this.input.addEventListener("change", () => {
      const f = this.input.files?.[0];
      if (f) this.loadFile(f);
      this.input.value = "";
    });
    document.body.append(this.input);
  }

  openPicker(): void {
    this.input.click();
  }

  private async loadFile(file: File): Promise<void> {
    if (!/\.json$/i.test(file.name)) {
      // Not fatal — still try, some exports may lack extension.
    }
    try {
      const doc = await parseFile(file);
      this.cb.onLoaded(doc, file.name);
    } catch (err) {
      this.reportError(err);
    }
  }

  async loadTextAs(text: string, filename: string): Promise<void> {
    try {
      const doc = parseText(text);
      this.cb.onLoaded(doc, filename);
    } catch (err) {
      this.reportError(err);
    }
  }

  private reportError(err: unknown): void {
    if (err instanceof RbxflowValidationError) this.cb.onError(err.message);
    else if (err instanceof Error) this.cb.onError(err.message);
    else this.cb.onError(String(err));
  }

  /** Wire drag-and-drop onto a drop zone element with a highlight overlay. */
  attachDropZone(zone: HTMLElement, overlay: HTMLElement): void {
    let depth = 0;
    const show = () => overlay.classList.add("active");
    const hide = () => overlay.classList.remove("active");

    zone.addEventListener("dragenter", (e) => {
      e.preventDefault();
      depth++;
      show();
    });
    zone.addEventListener("dragover", (e) => e.preventDefault());
    zone.addEventListener("dragleave", (e) => {
      e.preventDefault();
      if (--depth <= 0) {
        depth = 0;
        hide();
      }
    });
    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      depth = 0;
      hide();
      const file = e.dataTransfer?.files?.[0];
      if (file) this.loadFile(file);
    });
  }
}
