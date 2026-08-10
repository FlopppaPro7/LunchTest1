/**
 * Centralized theme configuration.
 *
 * Every color used by the graph and (via CSS variables) the chrome comes from
 * here. Node/edge styling is derived from these tokens — nothing hard-codes a
 * hex value elsewhere. Add a new object to THEMES to add a future theme.
 */

import type { NodeKind } from "../model/types";

export interface NodeStyle {
  bg: string;
  border: string;
  text: string;
  shape:
    | "round-rectangle"
    | "rectangle"
    | "ellipse"
    | "diamond"
    | "hexagon"
    | "round-tag";
  /** Short glyph shown as a badge / legend marker. */
  glyph: string;
}

export interface EdgeStyle {
  color: string;
  /** Cytoscape line-style. */
  line: "solid" | "dashed" | "dotted";
}

export interface Theme {
  name: string;
  /** CSS custom properties applied to :root for the app chrome. */
  cssVars: Record<string, string>;
  graph: {
    background: string;
    nodeText: string;
    selectionColor: string;
    fadedOpacity: number;
    pathColor: string;
    focusColor: string;
  };
  nodes: Record<NodeKind, NodeStyle>;
  /** Per relationship-type edge style. `unknown` is the fallback. */
  edges: Record<string, EdgeStyle> & { unknown: EdgeStyle };
  /** Environment accent colors (server / client / shared). */
  environments: Record<"server" | "client" | "shared", string>;
}

const dark: Theme = {
  name: "Midnight",
  cssVars: {
    "--bg-0": "#0d1117",
    "--bg-1": "#12181f",
    "--bg-2": "#161d26",
    "--bg-3": "#1c2530",
    "--panel": "#12181f",
    "--panel-border": "#232c38",
    "--text-0": "#e6edf3",
    "--text-1": "#aeb9c4",
    "--text-2": "#7d8896",
    "--accent": "#4c9aff",
    "--accent-2": "#8b7dff",
    "--danger": "#ff6b6b",
    "--warn": "#f2b84b",
    "--ok": "#57c98b",
    "--server": "#4c9aff",
    "--client": "#f2b84b",
    "--shared": "#8b7dff",
    "--chip": "#1c2530",
    "--shadow": "rgba(0,0,0,0.4)",
  },
  graph: {
    background: "#0d1117",
    nodeText: "#e6edf3",
    selectionColor: "#4c9aff",
    fadedOpacity: 0.08,
    pathColor: "#57c98b",
    focusColor: "#4c9aff",
  },
  nodes: {
    Script: { bg: "#1f3a5f", border: "#4c9aff", text: "#e6edf3", shape: "round-rectangle", glyph: "S" },
    LocalScript: { bg: "#4a3a1a", border: "#f2b84b", text: "#e6edf3", shape: "round-rectangle", glyph: "L" },
    ModuleScript: { bg: "#332a5c", border: "#8b7dff", text: "#e6edf3", shape: "round-rectangle", glyph: "M" },
    RemoteEvent: { bg: "#123a33", border: "#57c98b", text: "#e6edf3", shape: "diamond", glyph: "RE" },
    RemoteFunction: { bg: "#0f3a44", border: "#3fc4d6", text: "#e6edf3", shape: "diamond", glyph: "RF" },
    BindableEvent: { bg: "#243043", border: "#6f8bb0", text: "#e6edf3", shape: "hexagon", glyph: "BE" },
    BindableFunction: { bg: "#243043", border: "#6f8bb0", text: "#e6edf3", shape: "hexagon", glyph: "BF" },
    Event: { bg: "#2c2438", border: "#b088e0", text: "#e6edf3", shape: "round-tag", glyph: "E" },
    Function: { bg: "#22303a", border: "#5fa8b8", text: "#e6edf3", shape: "ellipse", glyph: "ƒ" },
    Instance: { bg: "#1a222c", border: "#4a5666", text: "#c8d2dc", shape: "rectangle", glyph: "I" },
  },
  edges: {
    require: { color: "#4c9aff", line: "solid" },
    function_call: { color: "#7d8896", line: "solid" },
    fires_server: { color: "#57c98b", line: "solid" },
    fires_client: { color: "#f2b84b", line: "solid" },
    invokes_server: { color: "#3fc4d6", line: "dashed" },
    invokes_client: { color: "#d69a3f", line: "dashed" },
    server_event: { color: "#57c98b", line: "dotted" },
    client_event: { color: "#f2b84b", line: "dotted" },
    event_connection: { color: "#b088e0", line: "solid" },
    instance_reference: { color: "#6f8bb0", line: "dashed" },
    attribute_read: { color: "#5fa8b8", line: "dotted" },
    attribute_write: { color: "#d67a7a", line: "dotted" },
    parent_reference: { color: "#4a5666", line: "dotted" },
    unknown: { color: "#5a6472", line: "dashed" },
  },
  environments: {
    server: "#4c9aff",
    client: "#f2b84b",
    shared: "#8b7dff",
  },
};

export const THEMES: Record<string, Theme> = { dark };

let active: Theme = dark;

export function getTheme(): Theme {
  return active;
}

export function setTheme(name: string): Theme {
  const t = THEMES[name];
  if (t) active = t;
  applyCssVars(active);
  return active;
}

export function applyCssVars(theme: Theme = active): void {
  const root = document.documentElement;
  for (const [k, v] of Object.entries(theme.cssVars)) {
    root.style.setProperty(k, v);
  }
}

/** Human labels for relationship types (used in inspector/legend). */
export const RELATIONSHIP_LABELS: Record<string, string> = {
  require: "require",
  function_call: "function call",
  fires_server: "FireServer",
  fires_client: "FireClient",
  invokes_server: "InvokeServer",
  invokes_client: "InvokeClient",
  server_event: "OnServerEvent",
  client_event: "OnClientEvent",
  event_connection: "event connection",
  instance_reference: "instance reference",
  attribute_read: "attribute read",
  attribute_write: "attribute write",
  parent_reference: "parent reference",
  unknown: "unknown",
};

/** Human labels for node kinds. */
export const KIND_LABELS: Record<NodeKind, string> = {
  Script: "Script",
  LocalScript: "LocalScript",
  ModuleScript: "ModuleScript",
  RemoteEvent: "RemoteEvent",
  RemoteFunction: "RemoteFunction",
  BindableEvent: "BindableEvent",
  BindableFunction: "BindableFunction",
  Event: "Event",
  Function: "Function",
  Instance: "Instance",
};

export function edgeStyleFor(theme: Theme, type: string): EdgeStyle {
  return theme.edges[type] ?? theme.edges.unknown;
}
