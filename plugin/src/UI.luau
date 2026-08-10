--[[
	UI — builds the dock-widget interface. Kept entirely separate from scanning
	and exporting: it exposes callbacks (onScan, onExport) and setters
	(setStatus, setCounts, showExport) and knows nothing about the DataModel.

	Studio plugins cannot write files to disk, so "Export" shows the JSON in a
	read-only, select-all textbox to copy into a .json file.
]]

local UI = {}
UI.__index = UI

-- Palette (mirrors the RBXFlow web app's dark dev-tool look).
local C = {
	bg = Color3.fromRGB(13, 17, 23),
	panel = Color3.fromRGB(22, 29, 38),
	panel2 = Color3.fromRGB(28, 37, 48),
	border = Color3.fromRGB(35, 44, 56),
	text = Color3.fromRGB(230, 237, 243),
	sub = Color3.fromRGB(125, 136, 150),
	accent = Color3.fromRGB(76, 154, 255),
	accentText = Color3.fromRGB(7, 16, 25),
	ok = Color3.fromRGB(87, 201, 139),
	warn = Color3.fromRGB(242, 184, 75),
}

local function make(className: string, props: { [string]: any }, children: { Instance }?): Instance
	local inst = Instance.new(className)
	for k, v in props do
		(inst :: any)[k] = v
	end
	if children then
		for _, child in children do
			child.Parent = inst
		end
	end
	return inst
end

local function statRow(labelText: string): (Frame, TextLabel)
	local value = make("TextLabel", {
		Name = "Value",
		Text = "0",
		Font = Enum.Font.Code,
		TextSize = 14,
		TextColor3 = C.text,
		TextXAlignment = Enum.TextXAlignment.Right,
		BackgroundTransparency = 1,
		Size = UDim2.new(0.4, 0, 1, 0),
		Position = UDim2.new(0.6, 0, 0, 0),
	}) :: TextLabel

	local row = make("Frame", {
		Name = "Row",
		BackgroundTransparency = 1,
		Size = UDim2.new(1, 0, 0, 22),
	}, {
		make("TextLabel", {
			Text = labelText,
			Font = Enum.Font.Gotham,
			TextSize = 13,
			TextColor3 = C.sub,
			TextXAlignment = Enum.TextXAlignment.Left,
			BackgroundTransparency = 1,
			Size = UDim2.new(0.6, 0, 1, 0),
		}),
		value,
	}) :: Frame

	return row, value
end

local function button(text: string, primary: boolean): TextButton
	return make("TextButton", {
		Text = text,
		Font = Enum.Font.GothamMedium,
		TextSize = 14,
		AutoButtonColor = true,
		TextColor3 = primary and C.accentText or C.text,
		BackgroundColor3 = primary and C.accent or C.panel2,
		BorderSizePixel = 0,
		Size = UDim2.new(1, 0, 0, 34),
	}, {
		make("UICorner", { CornerRadius = UDim.new(0, 6) }),
	}) :: TextButton
end

function UI.new(parent: Instance, callbacks: { onScan: () -> (), onExport: () -> () })
	local self = setmetatable({ includeSource = false }, UI)

	local root = make("Frame", {
		Name = "GameFlowScanner",
		BackgroundColor3 = C.bg,
		BorderSizePixel = 0,
		Size = UDim2.fromScale(1, 1),
	}, {
		make("UIPadding", {
			PaddingTop = UDim.new(0, 12),
			PaddingBottom = UDim.new(0, 12),
			PaddingLeft = UDim.new(0, 12),
			PaddingRight = UDim.new(0, 12),
		}),
		make("UIListLayout", {
			Padding = UDim.new(0, 10),
			SortOrder = Enum.SortOrder.LayoutOrder,
		}),
	})
	root.Parent = parent

	local order = 0
	local function add(child: Instance)
		order += 1
		child:SetAttribute("LayoutOrder", order);
		(child :: any).LayoutOrder = order
		child.Parent = root
	end

	add(make("TextLabel", {
		Text = "GAME FLOW SCANNER",
		Font = Enum.Font.GothamBold,
		TextSize = 15,
		TextColor3 = C.text,
		TextXAlignment = Enum.TextXAlignment.Left,
		BackgroundTransparency = 1,
		Size = UDim2.new(1, 0, 0, 20),
	}))

	local scanBtn = button("Scan Project", true)
	scanBtn.Activated:Connect(function()
		callbacks.onScan()
	end)
	add(scanBtn)

	local status = make("TextLabel", {
		Text = "Status: Ready",
		Font = Enum.Font.Gotham,
		TextSize = 13,
		TextColor3 = C.sub,
		TextWrapped = true,
		TextXAlignment = Enum.TextXAlignment.Left,
		BackgroundTransparency = 1,
		Size = UDim2.new(1, 0, 0, 32),
	}) :: TextLabel
	add(status)
	self.status = status

	-- Counts panel.
	local counts = make("Frame", {
		BackgroundColor3 = C.panel,
		BorderSizePixel = 0,
		Size = UDim2.new(1, 0, 0, 156),
	}, {
		make("UICorner", { CornerRadius = UDim.new(0, 8) }),
		make("UIPadding", {
			PaddingTop = UDim.new(0, 10),
			PaddingBottom = UDim.new(0, 10),
			PaddingLeft = UDim.new(0, 12),
			PaddingRight = UDim.new(0, 12),
		}),
		make("UIListLayout", { Padding = UDim.new(0, 2), SortOrder = Enum.SortOrder.LayoutOrder }),
	})

	self.values = {}
	local labels = {
		{ "Scripts", "scripts" },
		{ "Modules", "modules" },
		{ "LocalScripts", "locals" },
		{ "Remotes", "remotes" },
		{ "Relationships", "relationships" },
		{ "Warnings", "warnings" },
	}
	for i, pair in labels do
		local row, value = statRow(pair[1]);
		(row :: any).LayoutOrder = i
		row.Parent = counts
		self.values[pair[2]] = value
	end
	add(counts)

	-- Include Source Code toggle.
	local checkBox = make("TextButton", {
		Text = "",
		AutoButtonColor = true,
		BackgroundColor3 = C.panel2,
		BorderSizePixel = 0,
		Size = UDim2.new(0, 20, 0, 20),
	}, {
		make("UICorner", { CornerRadius = UDim.new(0, 4) }),
	}) :: TextButton
	local check = make("TextLabel", {
		Text = "",
		Font = Enum.Font.GothamBold,
		TextSize = 14,
		TextColor3 = C.accent,
		BackgroundTransparency = 1,
		Size = UDim2.fromScale(1, 1),
	}) :: TextLabel
	check.Parent = checkBox
	checkBox.Activated:Connect(function()
		self.includeSource = not self.includeSource
		check.Text = self.includeSource and "✓" or ""
	end)

	local toggleRow = make("Frame", {
		BackgroundTransparency = 1,
		Size = UDim2.new(1, 0, 0, 22),
	}, {
		make("UIListLayout", {
			FillDirection = Enum.FillDirection.Horizontal,
			VerticalAlignment = Enum.VerticalAlignment.Center,
			Padding = UDim.new(0, 8),
		}),
		checkBox,
		make("TextLabel", {
			Text = "Include Source Code",
			Font = Enum.Font.Gotham,
			TextSize = 13,
			TextColor3 = C.text,
			TextXAlignment = Enum.TextXAlignment.Left,
			BackgroundTransparency = 1,
			Size = UDim2.new(1, -28, 1, 0),
		}),
	})
	add(toggleRow)

	local exportBtn = button("Export JSON", false)
	exportBtn.Activated:Connect(function()
		callbacks.onExport()
	end)
	add(exportBtn)

	-- Export output (read-only textbox for copy).
	local hint = make("TextLabel", {
		Text = "Select all (Ctrl/Cmd+A) and copy, then paste into a .json file.",
		Font = Enum.Font.Gotham,
		TextSize = 11,
		TextColor3 = C.sub,
		TextWrapped = true,
		TextXAlignment = Enum.TextXAlignment.Left,
		BackgroundTransparency = 1,
		Visible = false,
		Size = UDim2.new(1, 0, 0, 28),
	}) :: TextLabel
	add(hint)
	self.hint = hint

	local outputBox = make("TextBox", {
		Text = "",
		Font = Enum.Font.Code,
		TextSize = 11,
		TextColor3 = C.text,
		TextXAlignment = Enum.TextXAlignment.Left,
		TextYAlignment = Enum.TextYAlignment.Top,
		TextWrapped = true,
		MultiLine = true,
		ClearTextOnFocus = false,
		TextEditable = true,
		BackgroundColor3 = Color3.fromRGB(10, 14, 19),
		BorderColor3 = C.border,
		Visible = false,
		Size = UDim2.new(1, 0, 0, 200),
	}, {
		make("UICorner", { CornerRadius = UDim.new(0, 6) }),
		make("UIPadding", {
			PaddingTop = UDim.new(0, 8),
			PaddingBottom = UDim.new(0, 8),
			PaddingLeft = UDim.new(0, 8),
			PaddingRight = UDim.new(0, 8),
		}),
	}) :: TextBox
	add(outputBox)
	self.outputBox = outputBox

	local selectBtn = button("Select All", false)
	selectBtn.Visible = false
	selectBtn.Activated:Connect(function()
		outputBox:CaptureFocus()
		pcall(function()
			outputBox.SelectionStart = 1
			outputBox.CursorPosition = #outputBox.Text + 1
		end)
	end)
	add(selectBtn)
	self.selectBtn = selectBtn

	return self
end

function UI:setStatus(text: string)
	self.status.Text = "Status: " .. text
end

function UI:setCounts(counts: { [string]: number })
	for key, label in self.values do
		label.Text = tostring(counts[key] or 0)
	end
end

function UI:getIncludeSource(): boolean
	return self.includeSource
end

function UI:showExport(json: string)
	self.outputBox.Text = json
	self.outputBox.Visible = true
	self.selectBtn.Visible = true
	self.hint.Visible = true
end

return UI
