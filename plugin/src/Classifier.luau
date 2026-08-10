--[[
	Classifier — decides whether a script is server / client / shared.

	Combines the top-level service with the script class. Respects Script
	RunContext when available. A ModuleScript is classed by location (shared by
	default) rather than assumed server-only.
]]

local Config = require(script.Parent.Config)

local Classifier = {}

-- Walks up to (but not including) `game`, returning the top-level service name.
local function topService(inst: Instance): string?
	local current = inst
	local parent = current.Parent
	while parent ~= nil and parent ~= game do
		current = parent
		parent = current.Parent
	end
	if parent == game then
		return current.Name
	end
	return nil
end

function Classifier.environment(inst: Instance): string
	local service = topService(inst)
	local class = inst.ClassName

	-- LocalScripts are always client.
	if class == "LocalScript" then
		return "client"
	end

	-- Honor an explicit RunContext on Scripts (Client/Server/Legacy).
	if class == "Script" then
		local ok, ctx = pcall(function()
			return (inst :: any).RunContext
		end)
		if ok and ctx ~= nil then
			local name = tostring(ctx)
			if string.find(name, "Client") then
				return "client"
			elseif string.find(name, "Server") then
				return "server"
			end
		end
	end

	if service ~= nil then
		if Config.SERVER_SERVICES[service] then
			return "server"
		elseif Config.CLIENT_SERVICES[service] then
			return "client"
		elseif Config.SHARED_SERVICES[service] then
			-- A Script in a shared container still runs on the server by default.
			if class == "Script" then
				return "server"
			end
			return "shared"
		end
	end

	-- Fallbacks by class.
	if class == "Script" then
		return "server"
	end
	return "shared"
end

return Classifier
