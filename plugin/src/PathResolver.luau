--[[
	PathResolver — best-effort static resolution of a Luau instance-path
	expression to an actual Instance.

	Handles the forms that appear in the vast majority of real code:
	  script.Parent.Foo
	  game.ReplicatedStorage.Modules.Foo
	  game:GetService("ReplicatedStorage").Remotes.Fire
	  ReplicatedStorage:WaitForChild("Remotes").Fire      (via a local alias)
	  Alias.Child["Name"]

	It resolves through a symbol table of `local` aliases the Analyzer builds.
	Anything it cannot resolve returns nil — callers must NOT fabricate an edge.
]]

local Config = require(script.Parent.Config)

local PathResolver = {}

local function trim(s: string): string
	return (string.gsub(s, "^%s*(.-)%s*$", "%1"))
end

-- Collapse method-child accessors and bracket indexes into plain `.field`.
local function normalize(expr: string): string
	expr = trim(expr)
	expr = string.gsub(expr, "game%s*:%s*GetService%s*%(%s*['\"]([%w_]+)['\"]%s*%)", "%1")
	expr = string.gsub(expr, ":%s*WaitForChild%s*%(%s*['\"]([%w_]+)['\"]%s*%)", ".%1")
	expr = string.gsub(expr, ":%s*FindFirstChild%s*%(%s*['\"]([%w_]+)['\"]%s*%)", ".%1")
	expr = string.gsub(expr, "%[%s*['\"]([%w_]+)['\"]%s*%]", ".%1")
	expr = string.gsub(expr, "%s+", "")
	return expr
end

local function split(expr: string): { string }
	local tokens = {}
	for token in string.gmatch(expr, "[^%.]+") do
		table.insert(tokens, token)
	end
	return tokens
end

-- symbols: { [name]: Instance }
function PathResolver.resolve(expr: string, scriptInst: Instance, symbols: { [string]: Instance }): Instance?
	if expr == nil or expr == "" then
		return nil
	end
	local tokens = split(normalize(expr))
	if #tokens == 0 then
		return nil
	end

	local first = tokens[1]
	local current: Instance?

	if symbols[first] then
		current = symbols[first]
	elseif first == "script" then
		current = scriptInst
	elseif first == "game" then
		current = game
	elseif first == "workspace" or first == "Workspace" then
		current = workspace
	elseif Config.KNOWN_SERVICES[first] then
		local ok, svc = pcall(function()
			return game:GetService(first)
		end)
		current = ok and svc or nil
	else
		return nil
	end

	if current == nil then
		return nil
	end

	for i = 2, #tokens do
		local tk = tokens[i]
		if tk == "Parent" then
			current = current.Parent
		else
			local ok, child = pcall(function()
				return current:FindFirstChild(tk)
			end)
			current = ok and child or nil
		end
		if current == nil then
			return nil
		end
	end

	return current
end

PathResolver.normalize = normalize

return PathResolver
