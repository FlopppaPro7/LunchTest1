--[[
	Exporter — assembles the normalized scan into the rbxflow document and
	encodes it as JSON. It performs no I/O beyond JSONEncode; the UI decides
	what to do with the resulting string. Nothing is uploaded anywhere.

	Schema: schema/rbxflow.schema.md (format "rbxflow", version 1).
]]

local HttpService = game:GetService("HttpService")

local Config = require(script.Parent.Config)

local Exporter = {}

local function attributesOf(inst: Instance): { [string]: any }?
	local ok, attrs = pcall(function()
		return inst:GetAttributes()
	end)
	if ok and typeof(attrs) == "table" and next(attrs) ~= nil then
		return attrs
	end
	return nil
end

local function baseDict(node)
	local d: { [string]: any } = {
		id = node.id,
		name = node.name,
		className = node.className,
		path = node.path,
	}
	if node.parentId ~= nil then
		d.parentId = node.parentId
	end
	local attrs = attributesOf(node.instance)
	if attrs then
		d.attributes = attrs
	end
	return d
end

-- Builds the full rbxflow table from a completed scan + analysis.
function Exporter.build(scanner, relationships, warnings): { [string]: any }
	local instances = {}
	local scripts = {}
	local remotes = {}

	for _, node in scanner:nodes() do
		local class = node.className
		if Config.SCRIPT_CLASSES[class] then
			local d = baseDict(node)
			d.environment = node.environment or "shared"
			d.functions = node.functions or {}
			if node.source ~= nil then
				d.source = node.source
			end
			table.insert(scripts, d)
		elseif Config.REMOTE_CLASSES[class] then
			table.insert(remotes, baseDict(node))
		else
			table.insert(instances, baseDict(node))
		end
	end

	local placeName = game.Name
	if placeName == nil or placeName == "" then
		placeName = "Roblox Place"
	end

	local generatedAt = "unknown"
	pcall(function()
		generatedAt = DateTime.now():ToIsoDate()
	end)

	return {
		format = Config.FORMAT,
		version = Config.VERSION,
		project = {
			name = placeName,
			generatedAt = generatedAt,
			placeId = tostring(game.PlaceId),
			gameId = tostring(game.GameId),
			scanner = { name = Config.SCANNER_NAME, version = Config.SCANNER_VERSION },
		},
		instances = instances,
		scripts = scripts,
		remotes = remotes,
		events = {},
		functions = {},
		relationships = relationships,
		warnings = warnings,
		-- Reserved for a future runtime-tracing version; empty in the MVP.
		runtime = { executions = {}, events = {}, timings = {} },
	}
end

-- Encodes a built document as a JSON string. Returns (json, err).
function Exporter.encode(doc): (string?, string?)
	local ok, result = pcall(function()
		return HttpService:JSONEncode(doc)
	end)
	if ok then
		return result, nil
	end
	return nil, tostring(result)
end

return Exporter
