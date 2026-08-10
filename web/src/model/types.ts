/**
 * Data model layer — types.
 *
 * Two families of types live here:
 *   - `Raw*`  : the shape of the on-disk rbxflow JSON (the schema contract).
 *   - `Model` : the normalized, indexed internal model the rest of the app uses.
 *
 * Nothing outside `model/` should ever read the Raw* types directly — the UI,
 * graph builder, search, etc. all consume the normalized `ProjectModel`.
 */

// ---------------------------------------------------------------------------
// Raw JSON shapes (schema/rbxflow.schema.md)
// ---------------------------------------------------------------------------

export type Confidence = "high" | "medium" | "low";
export type Environment = "server" | "client" | "shared";

export interface RawProjectInfo {
  name?: string;
  generatedAt?: string;
  placeId?: string;
  gameId?: string;
  scanner?: { name?: string; version?: string };
}

export interface RawInstance {
  id: string;
  name: string;
  className: string;
  path?: string;
  parentId?: string | null;
  attributes?: Record<string, unknown>;
}

export interface RawScript extends RawInstance {
  environment?: Environment;
  functions?: string[];
  source?: string;
}

export interface RawRemote extends RawInstance {}

export interface RawEvent {
  id: string;
  name: string;
  remoteId?: string;
  path?: string;
}

export interface RawFunction {
  id: string;
  name: string;
  scriptId?: string;
  line?: number;
}

export interface RawRelationship {
  id?: string;
  from: string;
  to: string;
  type: string;
  line?: number;
  snippet?: string;
  confidence?: Confidence;
  meta?: Record<string, unknown>;
}

export interface RawWarning {
  id?: string;
  type: string;
  scriptId?: string;
  line?: number;
  message: string;
}

export interface RawDocument {
  format: string;
  version: number;
  project?: RawProjectInfo;
  instances?: RawInstance[];
  scripts?: RawScript[];
  remotes?: RawRemote[];
  events?: RawEvent[];
  functions?: RawFunction[];
  relationships?: RawRelationship[];
  warnings?: RawWarning[];
  runtime?: unknown;
}

// ---------------------------------------------------------------------------
// Normalized model
// ---------------------------------------------------------------------------

/** The kind a node plays in the graph, independent of raw arrays. */
export type NodeKind =
  | "Script"
  | "LocalScript"
  | "ModuleScript"
  | "RemoteEvent"
  | "RemoteFunction"
  | "BindableEvent"
  | "BindableFunction"
  | "Event"
  | "Function"
  | "Instance";

export interface ModelNode {
  id: string;
  name: string;
  kind: NodeKind;
  className: string;
  path: string;
  parentId: string | null;
  environment: Environment | null;
  attributes: Record<string, unknown>;
  /** Script-only extras. */
  functions?: string[];
  source?: string;
  /** Event-only: the remote/bindable it belongs to. */
  remoteId?: string;
  /** Function-only: the owning script. */
  scriptId?: string;
  line?: number;
}

export interface ModelEdge {
  id: string;
  from: string;
  to: string;
  type: string;
  line: number | null;
  snippet: string | null;
  confidence: Confidence;
  meta: Record<string, unknown>;
}

export interface ModelWarning {
  id: string;
  type: string;
  scriptId: string | null;
  line: number | null;
  message: string;
}

export interface ProjectStats {
  scripts: number;
  moduleScripts: number;
  localScripts: number;
  serverScripts: number;
  clientScripts: number;
  sharedModules: number;
  remoteEvents: number;
  remoteFunctions: number;
  bindables: number;
  instances: number;
  relationships: number;
  warnings: number;
}

export interface ProjectModel {
  info: RawProjectInfo;
  nodes: ModelNode[];
  edges: ModelEdge[];
  warnings: ModelWarning[];
  stats: ProjectStats;

  // Indexes (built once, used everywhere) --------------------------------
  nodeById: Map<string, ModelNode>;
  edgeById: Map<string, ModelEdge>;
  /** node id -> outgoing edges */
  outgoing: Map<string, ModelEdge[]>;
  /** node id -> incoming edges */
  incoming: Map<string, ModelEdge[]>;

  /** Whether the raw file carried a (possibly empty) runtime block. */
  hasRuntime: boolean;
}
