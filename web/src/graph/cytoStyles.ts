/**
 * Builds the Cytoscape stylesheet from the active theme. All visual constants
 * derive from theme tokens — no hard-coded colors here.
 */

import type { StylesheetStyle } from "cytoscape";
import { getTheme, edgeStyleFor, RELATIONSHIP_LABELS } from "../theme/theme";
import type { NodeKind } from "../model/types";

export function buildStylesheet(): StylesheetStyle[] {
  const theme = getTheme();
  const styles: StylesheetStyle[] = [
    {
      selector: "node",
      style: {
        label: "data(label)",
        color: theme.graph.nodeText,
        "font-size": 11,
        "font-family": "'JetBrains Mono', ui-monospace, monospace",
        "text-valign": "center",
        "text-halign": "center",
        "text-wrap": "wrap",
        "text-max-width": "120px",
        width: "label",
        height: 26,
        padding: "8px",
        "border-width": 1.5,
        "text-outline-width": 0,
        "min-zoomed-font-size": 7,
      },
    },
    {
      selector: "edge",
      style: {
        width: 1.4,
        "curve-style": "bezier",
        "target-arrow-shape": "triangle",
        "arrow-scale": 0.9,
        "line-color": theme.edges.unknown.color,
        "target-arrow-color": theme.edges.unknown.color,
        opacity: 0.75,
        "font-size": 8,
        color: theme.graph.nodeText,
      },
    },
  ];

  // Per node-kind styling.
  for (const [kind, ns] of Object.entries(theme.nodes)) {
    styles.push({
      selector: `node.kind-${kind as NodeKind}`,
      style: {
        "background-color": ns.bg,
        "border-color": ns.border,
        color: ns.text,
        shape: ns.shape as never,
      },
    });
  }

  // Per relationship-type edge styling.
  for (const type of Object.keys(RELATIONSHIP_LABELS)) {
    const es = edgeStyleFor(theme, type);
    styles.push({
      selector: `edge.type-${type}`,
      style: {
        "line-color": es.color,
        "target-arrow-color": es.color,
        "line-style": es.line as never,
      },
    });
  }

  // Low-confidence edges are visually softer.
  styles.push({
    selector: "edge.conf-low",
    style: { opacity: 0.4, "line-style": "dashed" },
  });

  // Interaction states -----------------------------------------------------
  styles.push(
    {
      selector: "node:selected",
      style: {
        "border-width": 3,
        "border-color": theme.graph.selectionColor,
        "overlay-color": theme.graph.selectionColor,
        "overlay-opacity": 0.12,
        "overlay-padding": 6,
      },
    },
    {
      selector: "edge:selected",
      style: {
        width: 3,
        opacity: 1,
        "line-color": theme.graph.selectionColor,
        "target-arrow-color": theme.graph.selectionColor,
      },
    },
    {
      selector: ".faded",
      style: { opacity: theme.graph.fadedOpacity, "text-opacity": 0 },
    },
    {
      selector: "node.highlight",
      style: { "border-width": 3, "border-color": theme.graph.focusColor },
    },
    {
      selector: "node.path",
      style: {
        "border-width": 3,
        "border-color": theme.graph.pathColor,
        "background-blacken": -0.15,
      },
    },
    {
      selector: "edge.path",
      style: {
        width: 3.5,
        opacity: 1,
        "line-color": theme.graph.pathColor,
        "target-arrow-color": theme.graph.pathColor,
        "z-index": 999,
      },
    },
    {
      selector: "edge.showlabel",
      style: { label: "data(type)", "text-rotation": "autorotate", "text-background-color": theme.graph.background, "text-background-opacity": 0.85, "text-background-padding": "2px" },
    }
  );

  return styles;
}
