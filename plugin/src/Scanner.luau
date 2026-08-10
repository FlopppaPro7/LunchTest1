--[[
	Scanner — walks the DataModel and collects nodes. READ-ONLY: it never
	creates, modifies, or deletes anything in the user's game.

	It records scripts and remotes/bindables always, and adds the structural
	ancestors (Folders, Models, services) needed to connect them into a tree.
	Other instances are added on demand when a relationship resolves to them.
]]

local Config = require(script.Parent.Config)

local Scanner = {}
Scanner.__index = Scanner

export type Node = {
	id: string,
	kind: string,
	className: string,
	name: string,
	path: string,
	instance: Instance,
	parentId: string?,
	environment: string?,
	functions: { string }?,
	source: string?,
}

function Scanner.new(idGen)
	return setmetatable({
		idGen = idGen,
		order = {} :: { Instance },
		byInstance = {} :: { [Instance]: Node },
		counts = { scripts = 0, modules = 0, locals = 0, remotes = 0, instances = 0 },
	}, Scanner)
end

local function kindFor(class: string): string
	if Config.SCRIPT_CLASSES[class] or Config.REMOTE_CLASSES[class] then
		return class
	end
	return "Instance"
end

local function fullPath(inst: Instance): string
	local ok, path = pcall(function()
		return inst:GetFullName()
	end)
	if ok and typeof(path) == "string" then
		return path
	end
	return inst.Name
end

-- Adds an instance (and its ancestor chain) as a node; returns its id.
function Scanner:add(inst: Instance): string
	local existing = self.byInstance[inst]
	if existing then
		return existing.id
	end

	local class = inst.ClassName
	local kind = kindFor(class)
	local node: Node = {
		id = self.idGen:next(kind),
		kind = kind,
		className = class,
		name = inst.Name,
		path = fullPath(inst),
		instance = inst,
	}
	self.byInstance[inst] = node
	table.insert(self.order, inst)

	if Config.SCRIPT_CLASSES[class] then
		if class == "ModuleScript" then
			self.counts.modules += 1
		elseif class == "LocalScript" then
			self.counts.locals += 1
		else
			self.counts.scripts += 1
		end
	elseif Config.REMOTE_CLASSES[class] then
		self.counts.remotes += 1
	else
		self.counts.instances += 1
	end

	-- Ensure the ancestor chain exists so the tree is connected.
	local parent = inst.Parent
	if parent ~= nil and parent ~= game then
		self:add(parent)
	end

	return node.id
end

function Scanner:getId(inst: Instance): string?
	local n = self.byInstance[inst]
	return n and n.id or nil
end

function Scanner:getNode(inst: Instance): Node?
	return self.byInstance[inst]
end

-- Main pass: collect scripts and remotes from the scanned services.
function Scanner:scan(onProgress: ((processed: number) -> ())?)
	local processed = 0
	for _, serviceName in Config.SCAN_SERVICES do
		local ok, service = pcall(function()
			return game:GetService(serviceName)
		end)
		if not ok or service == nil then
			service = game:FindFirstChild(serviceName)
		end
		if service ~= nil then
			local ok2, descendants = pcall(function()
				return service:GetDescendants()
			end)
			if ok2 and descendants ~= nil then
				for _, desc in descendants do
					local class = desc.ClassName
					if Config.SCRIPT_CLASSES[class] or Config.REMOTE_CLASSES[class] then
						self:add(desc)
					end
					processed += 1
					if processed % Config.YIELD_EVERY == 0 then
						if onProgress then
							onProgress(processed)
						end
						task.wait()
					end
				end
			end
		end
	end

	-- Resolve parentId links now that the full set is known.
	for _, inst in self.order do
		local node = self.byInstance[inst]
		local parent = inst.Parent
		if parent ~= nil and self.byInstance[parent] then
			node.parentId = self.byInstance[parent].id
		else
			node.parentId = nil
		end
	end
end

-- Returns all collected nodes in insertion order.
function Scanner:nodes(): { Node }
	local list = {}
	for _, inst in self.order do
		table.insert(list, self.byInstance[inst])
	end
	return list
end

return Scanner
