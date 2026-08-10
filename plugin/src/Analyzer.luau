--[[
	Analyzer — static source analysis.

	For every script it reads Source (read-only) and detects relationships by
	pattern-matching, tracking `local` aliases so the common resolvable forms
	are resolved to real Instances. It NEVER fabricates: anything it cannot
	resolve becomes a warning and/or is skipped, never a made-up edge.

	Detected: require, function_call (via module aliases), FireServer/Client,
	InvokeServer/Client, OnServerEvent/OnClientEvent (+ invoke handlers),
	BindableEvent connections, instance/parent references, attribute read/write.
]]

local Config = require(script.Parent.Config)
local Classifier = require(script.Parent.Classifier)
local PathResolver = require(script.Parent.PathResolver)

local Analyzer = {}

local REMOTE_METHODS = {
	FireServer = true,
	FireClient = true,
	FireAllClients = true,
	InvokeServer = true,
	InvokeClient = true,
	Fire = true,
	Invoke = true,
	Connect = true,
	connect = true,
	Once = true,
	Wait = true,
	GetAttribute = true,
	SetAttribute = true,
	WaitForChild = true,
	FindFirstChild = true,
	GetService = true,
}

local function trim(s: string): string
	return (string.gsub(s, "^%s*(.-)%s*$", "%1"))
end

local function stripCR(s: string): string
	return (string.gsub(s, "\r$", ""))
end

local function splitLines(src: string): { string }
	local lines = {}
	local start = 1
	while true do
		local nl = string.find(src, "\n", start, true)
		if not nl then
			table.insert(lines, stripCR(string.sub(src, start)))
			break
		end
		table.insert(lines, stripCR(string.sub(src, start, nl - 1)))
		start = nl + 1
	end
	return lines
end

-- Extract the argument of the first require(...) on a line, honoring nested ().
local function requireArg(line: string): string?
	local rs = string.find(line, "require", 1, true)
	if not rs then
		return nil
	end
	local open = string.find(line, "(", rs, true)
	if not open then
		return nil
	end
	local depth = 1
	local i = open + 1
	while i <= #line do
		local c = string.sub(line, i, i)
		if c == "(" then
			depth += 1
		elseif c == ")" then
			depth -= 1
			if depth == 0 then
				return string.sub(line, open + 1, i - 1)
			end
		end
		i += 1
	end
	return nil
end

-- Analysis context bundles the mutable accumulators for one run.
local function newContext(scanner)
	return {
		scanner = scanner,
		relationships = {},
		warnings = {},
		relSeen = {},
		relCount = 0,
		warnCount = 0,
	}
end

local function addRel(ctx, fromId, toId, relType, line, snippet, confidence, meta)
	local extra = ""
	if meta then
		extra = tostring(meta.attribute or meta.method or "")
	end
	local key = string.format("%s|%s|%s|%s", fromId, toId, relType, extra)
	if ctx.relSeen[key] then
		return
	end
	ctx.relSeen[key] = true
	ctx.relCount += 1
	table.insert(ctx.relationships, {
		id = string.format("rel_%04d", ctx.relCount),
		from = fromId,
		to = toId,
		type = relType,
		line = line,
		snippet = snippet,
		confidence = confidence,
		meta = meta,
	})
end

local function addWarn(ctx, warnType, scriptId, line, message)
	ctx.warnCount += 1
	table.insert(ctx.warnings, {
		id = string.format("warn_%03d", ctx.warnCount),
		type = warnType,
		scriptId = scriptId,
		line = line,
		message = message,
	})
end

-- Resolve an expression to an instance id, optionally requiring a class filter.
local function resolveToId(ctx, expr, scriptInst, symbols, classFilter)
	local inst = PathResolver.resolve(expr, scriptInst, symbols)
	if inst == nil then
		return nil
	end
	if classFilter and not classFilter[inst.ClassName] then
		return nil
	end
	return ctx.scanner:add(inst)
end

local FIRE_MAP = {
	FireServer = { rel = Config.REL.FIRES_SERVER, dir = "client_to_server" },
	FireClient = { rel = Config.REL.FIRES_CLIENT, dir = "server_to_client" },
	FireAllClients = { rel = Config.REL.FIRES_CLIENT, dir = "server_to_client" },
	InvokeServer = { rel = Config.REL.INVOKES_SERVER, dir = "client_to_server" },
	InvokeClient = { rel = Config.REL.INVOKES_CLIENT, dir = "server_to_client" },
}

local HANDLER_MAP = {
	OnServerEvent = { rel = Config.REL.SERVER_EVENT, dir = "client_to_server" },
	OnClientEvent = { rel = Config.REL.CLIENT_EVENT, dir = "server_to_client" },
	OnServerInvoke = { rel = Config.REL.SERVER_EVENT, dir = "client_to_server", kind = "invoke" },
	OnClientInvoke = { rel = Config.REL.CLIENT_EVENT, dir = "server_to_client", kind = "invoke" },
}

local function collectFunctions(line: string, fnSet: { [string]: boolean })
	local n1 = string.match(line, "function%s+([%w_%.:]+)%s*%(")
	if n1 then
		local last = string.match(n1, "[%.:]([%w_]+)$") or n1
		fnSet[last] = true
	end
	local n2 = string.match(line, "local%s+function%s+([%w_]+)%s*%(")
	if n2 then
		fnSet[n2] = true
	end
	local n3 = string.match(line, "([%w_%.]+)%s*=%s*function%s*%(")
	if n3 then
		local last = string.match(n3, "[%.]([%w_]+)$") or n3
		fnSet[last] = true
	end
end

local REMOTE_CLASSES = Config.REMOTE_CLASSES
local ONLY_REMOTE_EVENT = { RemoteEvent = true }
local ONLY_REMOTE_FUNCTION = { RemoteFunction = true }
local ONLY_BINDABLE_EVENT = { BindableEvent = true }

local function analyzeScript(ctx, node, src, symbolsShared)
	local scriptInst = node.instance
	local fromId = node.id
	local symbols: { [string]: Instance } = {}
	local fnSet: { [string]: boolean } = {}
	local lines = splitLines(src)

	for lineNo, raw in lines do
		local line = raw
		local trimmed = trim(line)
		if trimmed == "" or string.sub(trimmed, 1, 2) == "--" then
			continue
		end
		local snippet = trimmed

		collectFunctions(line, fnSet)

		-- local NAME = RHS  ---------------------------------------------------
		local name, rhs = string.match(trimmed, "^local%s+([%w_]+)%s*=%s*(.+)$")
		if name and rhs then
			if string.find(rhs, "require", 1, true) then
				local arg = requireArg(line)
				if arg then
					local inst = PathResolver.resolve(arg, scriptInst, symbols)
					if inst ~= nil then
						symbols[name] = inst
						local toId = ctx.scanner:add(inst)
						local conf = (inst.ClassName == "ModuleScript") and "high" or "medium"
						addRel(ctx, fromId, toId, Config.REL.REQUIRE, lineNo, snippet, conf, nil)
					else
						addWarn(ctx, "unresolved_require", fromId, lineNo,
							"Could not statically resolve require() target: " .. trim(arg))
					end
				else
					addWarn(ctx, "dynamic_reference", fromId, lineNo,
						"Dynamic require() could not be parsed.")
				end
			else
				local inst = PathResolver.resolve(rhs, scriptInst, symbols)
				if inst ~= nil then
					symbols[name] = inst
					-- Only emit a reference edge for structural instances; remotes
					-- get their edge from usage (FireServer/etc.), not the alias,
					-- and bare service handles (game:GetService) are just noise.
					local isService = inst.Parent == game
					if not isService
						and not Config.SCRIPT_CLASSES[inst.ClassName]
						and not REMOTE_CLASSES[inst.ClassName]
					then
						local toId = ctx.scanner:add(inst)
						local relType = Config.REL.INSTANCE_REFERENCE
						if PathResolver.normalize(rhs) == "script.Parent" then
							relType = Config.REL.PARENT_REFERENCE
						end
						addRel(ctx, fromId, toId, relType, lineNo, snippet, "medium", nil)
					end
				end
			end
		end

		-- Fire / Invoke calls  -----------------------------------------------
		for recv, method in string.gmatch(line, "([%w_%.]+)%s*:%s*([%w_]+)%s*%(") do
			local fire = FIRE_MAP[method]
			if fire then
				local filter = (method == "InvokeServer" or method == "InvokeClient")
						and ONLY_REMOTE_FUNCTION
					or nil
				local toId = resolveToId(ctx, recv, scriptInst, symbols, filter)
				if toId == nil then
					-- Try without a hard class filter for lenient RemoteEvents.
					toId = resolveToId(ctx, recv, scriptInst, symbols, nil)
					if toId ~= nil then
						-- Guard: only keep if it actually resolved to a remote.
						local inst = PathResolver.resolve(recv, scriptInst, symbols)
						if inst == nil or not REMOTE_CLASSES[inst.ClassName] then
							toId = nil
						end
					end
				end
				if toId ~= nil then
					addRel(ctx, fromId, toId, fire.rel, lineNo, snippet, "high", { direction = fire.dir })
				else
					addWarn(ctx, "unknown_relationship", fromId, lineNo,
						string.format("Detected :%s() but could not resolve the remote (%s).", method, recv))
				end
			elseif method == "GetAttribute" or method == "SetAttribute" then
				local attr = string.match(line, method .. "%s*%(%s*['\"]([%w_]+)['\"]")
				local toId = resolveToId(ctx, recv, scriptInst, symbols, nil)
				if toId ~= nil then
					local relType = (method == "GetAttribute") and Config.REL.ATTRIBUTE_READ
						or Config.REL.ATTRIBUTE_WRITE
					addRel(ctx, fromId, toId, relType, lineNo, snippet, attr and "high" or "medium",
						attr and { attribute = attr } or nil)
				end
			elseif ctx.scanner ~= nil then
				-- function_call via a module alias.
				local aliasInst = symbols[recv]
				if aliasInst ~= nil and aliasInst.ClassName == "ModuleScript" and not REMOTE_METHODS[method] then
					local toId = ctx.scanner:add(aliasInst)
					addRel(ctx, fromId, toId, Config.REL.FUNCTION_CALL, lineNo, snippet, "medium",
						{ method = method })
				end
			end
		end

		-- function_call via a module alias using dot syntax (Module.Fn(...)).
		for recv, method in string.gmatch(line, "([%w_]+)%.([%w_]+)%s*%(") do
			local aliasInst = symbols[recv]
			if aliasInst ~= nil and aliasInst.ClassName == "ModuleScript" and not REMOTE_METHODS[method] then
				local toId = ctx.scanner:add(aliasInst)
				addRel(ctx, fromId, toId, Config.REL.FUNCTION_CALL, lineNo, snippet, "medium",
					{ method = method })
			end
		end

		-- Event handlers (.OnServerEvent / .OnClientEvent / invoke handlers) --
		for recv, handler in string.gmatch(line, "([%w_%.]+)%.(On%w+)") do
			local map = HANDLER_MAP[handler]
			if map then
				local filter = (handler == "OnServerInvoke" or handler == "OnClientInvoke")
						and ONLY_REMOTE_FUNCTION
					or ONLY_REMOTE_EVENT
				local toId = resolveToId(ctx, recv, scriptInst, symbols, filter)
				if toId == nil then
					toId = resolveToId(ctx, recv, scriptInst, symbols, nil)
					local inst = PathResolver.resolve(recv, scriptInst, symbols)
					if inst == nil or not REMOTE_CLASSES[inst.ClassName] then
						toId = nil
					end
				end
				if toId ~= nil then
					local meta = { direction = map.dir }
					if map.kind then
						meta.kind = map.kind
					end
					addRel(ctx, fromId, toId, map.rel, lineNo, snippet, "high", meta)
				end
			end
		end

		-- BindableEvent connection (X.Event:Connect).
		local bindRecv = string.match(line, "([%w_%.]+)%.Event%s*:%s*Connect")
		if bindRecv then
			local toId = resolveToId(ctx, bindRecv, scriptInst, symbols, ONLY_BINDABLE_EVENT)
			if toId ~= nil then
				addRel(ctx, fromId, toId, Config.REL.EVENT_CONNECTION, lineNo, snippet, "high", nil)
			end
		end
	end

	-- Materialize the function-name list for the node.
	local fns = {}
	for fnName in fnSet do
		table.insert(fns, fnName)
	end
	table.sort(fns)
	node.functions = fns
	symbolsShared[node.id] = symbols
end

-- options: { includeSource: boolean }
function Analyzer.run(scanner, options, onProgress)
	local ctx = newContext(scanner)
	local symbolsShared = {}
	local includeSource = options ~= nil and options.includeSource == true

	local nodes = scanner:nodes()
	local processed = 0
	for _, node in nodes do
		if Config.SCRIPT_CLASSES[node.className] then
			node.environment = Classifier.environment(node.instance)

			local ok, src = pcall(function()
				return (node.instance :: any).Source
			end)
			if ok and typeof(src) == "string" then
				if includeSource then
					node.source = src
				end
				local ok2, err = pcall(function()
					analyzeScript(ctx, node, src, symbolsShared)
				end)
				if not ok2 then
					addWarn(ctx, "parse_issue", node.id, nil,
						"Analysis failed for this script: " .. tostring(err))
				end
			else
				addWarn(ctx, "source_unavailable", node.id, nil,
					"Could not read Source (grant script-injection permission to analyze this script).")
			end
		end

		processed += 1
		if processed % Config.YIELD_EVERY == 0 then
			if onProgress then
				onProgress(processed, #nodes)
			end
			task.wait()
		end
	end

	return ctx.relationships, ctx.warnings
end

return Analyzer
