/** Tiny DOM helpers — avoids a framework while keeping call sites readable. */

type ElProps<K extends keyof HTMLElementTagNameMap> = Partial<
  Omit<HTMLElementTagNameMap[K], "style" | "dataset">
> & {
  class?: string;
  style?: string;
  dataset?: Record<string, string>;
};

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: ElProps<K> = {},
  children: (Node | string)[] = []
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  const { class: cls, dataset, style, ...rest } = props as Record<string, unknown>;
  if (cls) node.className = cls as string;
  if (style) node.setAttribute("style", style as string);
  if (dataset) for (const [k, v] of Object.entries(dataset)) node.dataset[k] = v;
  Object.assign(node, rest);
  for (const c of children) node.append(c);
  return node;
}

export function clear(node: HTMLElement): void {
  node.replaceChildren();
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function $(sel: string, root: ParentNode = document): HTMLElement {
  const node = root.querySelector(sel);
  if (!node) throw new Error(`Element not found: ${sel}`);
  return node as HTMLElement;
}

export function download(filename: string, content: string | Blob, mime = "application/octet-stream"): void {
  const blob = typeof content === "string" ? new Blob([content], { type: mime }) : content;
  const url = URL.createObjectURL(blob);
  const a = el("a", { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
