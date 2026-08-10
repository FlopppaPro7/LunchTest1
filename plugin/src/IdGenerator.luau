--[[
	IdGenerator — allocates stable, unique, non-name-based IDs.

	IDs are prefixed by kind purely for readability (module_001, remote_002…);
	the web app keys off className, not the prefix. Because traversal order is
	deterministic, the same place produces the same IDs across scans.
]]

local IdGenerator = {}
IdGenerator.__index = IdGenerator

local PREFIX = {
	Script = "script",
	LocalScript = "local",
	ModuleScript = "module",
	RemoteEvent = "remote",
	RemoteFunction = "remote",
	BindableEvent = "bindable",
	BindableFunction = "bindable",
	Event = "event",
	Function = "function",
}

function IdGenerator.new()
	return setmetatable({ counters = {} }, IdGenerator)
end

-- Returns a fresh id for a given kind/className.
function IdGenerator:next(kind: string): string
	local prefix = PREFIX[kind] or "instance"
	local n = (self.counters[prefix] or 0) + 1
	self.counters[prefix] = n
	return string.format("%s_%03d", prefix, n)
end

return IdGenerator
