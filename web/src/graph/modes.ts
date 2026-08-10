/**
 * Graph modes — each mode is a declarative filter over the normalized model
 * describing which node kinds and relationship types are relevant.
 *
 * The GraphBuilder consumes these; adding a mode never touches rendering code.
 */

import type { NodeKind } from "../model/types";

export type GraphModeId =
  | "full"
  | "dependency"
  | "remote"
  | "event"
  | "instance"
  | "script";

export interface GraphMode {
  id: GraphModeId;
  label: string;
  description: string;
  /** null = allow all kinds. */
  nodeKinds: Set<NodeKind> | null;
  /** null = allow all relationship types. */
  edgeTypes: Set<string> | null;
  /** Whether this mode emphasizes client/server direction. */
  directional?: boolean;
}

const kinds = (...k: NodeKind[]) => new Set<NodeKind>(k);
const types = (...t: string[]) => new Set(t);

export const GRAPH_MODES: Record<GraphModeId, GraphMode> = {
  full: {
    id: "full",
    label: "Full Graph",
    description: "The entire discovered project.",
    nodeKinds: null,
    edgeTypes: null,
  },
  dependency: {
    id: "dependency",
    label: "Dependency Graph",
    description: "require and function-call relationships.",
    nodeKinds: kinds("Script", "LocalScript", "ModuleScript", "Function"),
    edgeTypes: types("require", "function_call"),
  },
  remote: {
    id: "remote",
    label: "Remote Graph",
    description: "Client/server remote communication.",
    nodeKinds: kinds(
      "Script",
      "LocalScript",
      "ModuleScript",
      "RemoteEvent",
      "RemoteFunction",
      "BindableEvent",
      "BindableFunction"
    ),
    edgeTypes: types(
      "fires_server",
      "fires_client",
      "invokes_server",
      "invokes_client",
      "server_event",
      "client_event"
    ),
    directional: true,
  },
  event: {
    id: "event",
    label: "Event Graph",
    description: "Event → connection → script.",
    nodeKinds: kinds(
      "Script",
      "LocalScript",
      "ModuleScript",
      "Event",
      "RemoteEvent",
      "BindableEvent"
    ),
    edgeTypes: types("event_connection", "server_event", "client_event"),
  },
  instance: {
    id: "instance",
    label: "Instance Graph",
    description: "Important Instance references.",
    nodeKinds: kinds("Script", "LocalScript", "ModuleScript", "Instance"),
    edgeTypes: types(
      "instance_reference",
      "attribute_read",
      "attribute_write",
      "parent_reference"
    ),
  },
  script: {
    id: "script",
    label: "Script Graph",
    description: "Only Scripts, LocalScripts and ModuleScripts.",
    nodeKinds: kinds("Script", "LocalScript", "ModuleScript"),
    edgeTypes: null,
  },
};

export const GRAPH_MODE_ORDER: GraphModeId[] = [
  "full",
  "dependency",
  "remote",
  "event",
  "instance",
  "script",
];
