# RBXFlow JSON Schema (`format: "rbxflow"`)

This document is the **contract** between the Roblox Studio plugin
(*Game Flow Scanner*) and the RBXFlow web application. It is the only thing
the two projects share. Either side can be developed independently as long as
it honors this schema.

## Design rules

1. **Additive only.** New versions may add fields. They must never repurpose or
   remove an existing field. Old files must keep loading in newer web apps.
2. **Stable IDs.** Every referenceable object has a unique, stable string id
   (`script_001`, `module_004`, `remote_002`, `instance_017`, …). Relationships
   reference objects by id, never by name (names are not unique).
3. **Never fabricate.** If the scanner cannot resolve something statically it
   emits `confidence: "low"` and/or a `warnings[]` entry — it does not invent a
   relationship.
4. **Runtime-ready.** A reserved top-level `runtime` object exists for a future
   version that carries execution traces. The MVP leaves it out or empty.

## Top-level shape

```jsonc
{
  "format": "rbxflow",          // REQUIRED, must equal "rbxflow"
  "version": 1,                  // REQUIRED integer schema version

  "project": {
    "name": "MyGame",
    "generatedAt": "2026-08-10T00:00:00Z",
    "placeId": "0",
    "gameId": "0",
    "scanner": { "name": "Game Flow Scanner", "version": "1.0.0" }
  },

  "instances":     [ /* Instance[]     */ ],
  "scripts":       [ /* ScriptNode[]   */ ],
  "remotes":       [ /* Remote[]       */ ],
  "events":        [ /* EventNode[]    */ ],
  "functions":     [ /* FunctionNode[] */ ],
  "relationships": [ /* Relationship[] */ ],
  "warnings":      [ /* Warning[]      */ ],

  // Reserved for a future runtime-tracing version. MVP ignores it.
  "runtime": { "executions": [], "events": [], "timings": [] }
}
```

Any of the array fields may be omitted or empty. The web app treats missing
arrays as `[]`.

## Object types

### Instance
Non-script Instances worth showing (Folders, Models, and important referenced
Instances). Scripts/remotes have their own arrays but are *also* Instances in
the DataModel; to avoid duplication a script is listed in `scripts[]` and a
remote in `remotes[]` — `instances[]` is for everything else worth a node.

```jsonc
{
  "id": "instance_001",
  "name": "Map",
  "className": "Model",
  "path": "Workspace.Map",
  "parentId": "instance_000",     // id of parent node, or null
  "attributes": { "Version": 3 }  // optional, only when useful
}
```

### ScriptNode (Script | LocalScript | ModuleScript)

```jsonc
{
  "id": "script_001",
  "name": "WeaponService",
  "className": "ModuleScript",       // Script | LocalScript | ModuleScript
  "path": "ServerScriptService.Services.WeaponService",
  "parentId": "instance_010",
  "environment": "server",           // server | client | shared
  "functions": ["Fire", "Reload"],   // names of top-level functions found
  "source": "…",                     // OPTIONAL full source (only if user opted in)
  "attributes": { }                  // optional
}
```

### Remote (RemoteEvent | RemoteFunction | BindableEvent | BindableFunction)

```jsonc
{
  "id": "remote_001",
  "name": "FireWeapon",
  "className": "RemoteEvent",
  "path": "ReplicatedStorage.Remotes.FireWeapon",
  "parentId": "instance_020"
}
```

### EventNode
An event/connection point (a signal that scripts connect to). Optional — the
scanner may model connections purely as relationships instead.

```jsonc
{
  "id": "event_001",
  "name": "OnServerEvent",
  "remoteId": "remote_001",          // the remote/bindable this event belongs to
  "path": "ReplicatedStorage.Remotes.FireWeapon.OnServerEvent"
}
```

### FunctionNode
A statically discovered function (optional granularity).

```jsonc
{
  "id": "function_001",
  "name": "ApplyDamage",
  "scriptId": "script_002",
  "line": 44
}
```

### Relationship
The heart of the graph. `from`/`to` are ids of any node above.

```jsonc
{
  "id": "rel_0001",
  "from": "script_001",
  "to": "module_004",
  "type": "require",                 // see relationship types below
  "line": 18,                        // source line, optional
  "snippet": "local Dmg = require(...)", // short source snippet, optional
  "confidence": "high",              // high | medium | low
  "meta": { "direction": "client_to_server" } // optional extra data
}
```

### Warning

```jsonc
{
  "id": "warn_001",
  "type": "dynamic_reference",       // free-form category
  "scriptId": "script_012",          // optional
  "line": 43,                        // optional
  "message": "Could not statically determine referenced Instance."
}
```

## Relationship types (standardized, extensible)

| type                 | meaning                                             |
|----------------------|-----------------------------------------------------|
| `require`            | `require(module)` dependency                        |
| `function_call`      | statically identifiable call between scripts/modules|
| `fires_server`       | `:FireServer()`                                     |
| `fires_client`       | `:FireClient()` / `:FireAllClients()`               |
| `invokes_server`     | `:InvokeServer()`                                   |
| `invokes_client`     | `:InvokeClient()`                                   |
| `server_event`       | `.OnServerEvent` handler                            |
| `client_event`       | `.OnClientEvent` handler                            |
| `event_connection`   | `Signal:Connect(fn)`                                |
| `instance_reference` | static reference to an Instance path                |
| `attribute_read`     | `GetAttribute(name)`                                |
| `attribute_write`    | `SetAttribute(name, …)`                             |
| `parent_reference`   | `script.Parent` / hierarchy reference               |
| `unknown`            | detected but not resolvable                         |

New types may be added later; the web app renders unknown types with a neutral
fallback style rather than failing.

## Client / server classification

`environment` on a script is one of `server`, `client`, `shared`. The web app
uses it to lay out and color the client vs. server split. A ModuleScript is not
assumed server- or client-only from location alone — usage can override it.
