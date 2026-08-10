--[[
	Config — constants shared across the scanner.

	Kept free of any Roblox side effects so it is trivially testable and safe to
	require from any module. Relationship types mirror schema/rbxflow.schema.md.
]]

local Config = {}

Config.FORMAT = "rbxflow"
Config.VERSION = 1
Config.SCANNER_NAME = "Game Flow Scanner"
Config.SCANNER_VERSION = "1.0.0"

-- How many instances to process between cooperative yields, so Studio stays
-- responsive on large places.
Config.YIELD_EVERY = 400

-- Standardized relationship types (extensible — new ones may be added later).
Config.REL = {
	REQUIRE = "require",
	FUNCTION_CALL = "function_call",
	FIRES_SERVER = "fires_server",
	FIRES_CLIENT = "fires_client",
	INVOKES_SERVER = "invokes_server",
	INVOKES_CLIENT = "invokes_client",
	SERVER_EVENT = "server_event",
	CLIENT_EVENT = "client_event",
	EVENT_CONNECTION = "event_connection",
	INSTANCE_REFERENCE = "instance_reference",
	ATTRIBUTE_READ = "attribute_read",
	ATTRIBUTE_WRITE = "attribute_write",
	PARENT_REFERENCE = "parent_reference",
	UNKNOWN = "unknown",
}

-- Script-like classes we read Source from.
Config.SCRIPT_CLASSES = {
	Script = true,
	LocalScript = true,
	ModuleScript = true,
}

-- Remote / bindable classes.
Config.REMOTE_CLASSES = {
	RemoteEvent = true,
	RemoteFunction = true,
	BindableEvent = true,
	BindableFunction = true,
}

-- Structural container classes worth showing as instance nodes.
Config.CONTAINER_CLASSES = {
	Folder = true,
	Model = true,
	Configuration = true,
	Actor = true,
}

-- Services scanned for scripts / remotes. Workspace is included but only its
-- scripts/remotes and their ancestors become nodes (not every Part).
Config.SCAN_SERVICES = {
	"ServerScriptService",
	"ServerStorage",
	"ReplicatedStorage",
	"ReplicatedFirst",
	"StarterPlayer",
	"StarterGui",
	"StarterPack",
	"Workspace",
	"Lighting",
	"SoundService",
	"Chat",
	"Teams",
}

-- Environment hints by top-level service.
Config.SERVER_SERVICES = {
	ServerScriptService = true,
	ServerStorage = true,
}
Config.CLIENT_SERVICES = {
	StarterPlayer = true,
	StarterGui = true,
	StarterPack = true,
	ReplicatedFirst = true,
	Players = true,
}
Config.SHARED_SERVICES = {
	ReplicatedStorage = true,
	Lighting = true,
	SoundService = true,
	Workspace = true,
	Chat = true,
	Teams = true,
}

-- Known service names PathResolver may treat as a root.
Config.KNOWN_SERVICES = {
	Workspace = true,
	Players = true,
	Lighting = true,
	ReplicatedStorage = true,
	ReplicatedFirst = true,
	ServerScriptService = true,
	ServerStorage = true,
	StarterGui = true,
	StarterPack = true,
	StarterPlayer = true,
	SoundService = true,
	Teams = true,
	Chat = true,
	TweenService = true,
	RunService = true,
	UserInputService = true,
	HttpService = true,
	CollectionService = true,
}

return Config
