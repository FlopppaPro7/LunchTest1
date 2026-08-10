--[[
	Game Flow Scanner — plugin entry point.

	Creates the toolbar button and dock widget, then wires the UI to the
	Scanner / Analyzer / Exporter modules. This script is the ONLY place that
	touches plugin APIs; all analysis lives in the sibling ModuleScripts.

	Read-only: nothing in the user's game is created or modified.
]]

local IdGenerator = require(script.Parent.IdGenerator)
local Scanner = require(script.Parent.Scanner)
local Analyzer = require(script.Parent.Analyzer)
local Exporter = require(script.Parent.Exporter)
local UI = require(script.Parent.UI)

local toolbar = plugin:CreateToolbar("Game Flow Scanner")
local button = toolbar:CreateButton(
	"GameFlowScannerToggle",
	"Open the Game Flow Scanner",
	"rbxasset://textures/StudioSharedUI/menuAnalytics.png",
	"Flow Scanner"
)
button.ClickableWhenViewportHidden = true

local widgetInfo = DockWidgetPluginGuiInfo.new(
	Enum.InitialDockState.Right,
	false, -- initially disabled
	false,
	340, -- floating width
	560, -- floating height
	300, -- min width
	400 -- min height
)
local widget = plugin:CreateDockWidgetPluginGui("GameFlowScanner", widgetInfo)
widget.Title = "Game Flow Scanner"
widget.Name = "GameFlowScanner"

-- Latest scan result, held for export.
local state: { scanner: any, relationships: any, warnings: any }? = nil
local scanning = false

local ui
ui = UI.new(widget, {
	onScan = function()
		if scanning then
			return
		end
		scanning = true
		task.spawn(function()
			local ok, err = pcall(function()
				ui:setStatus("Scanning DataModel…")

				local idGen = IdGenerator.new()
				local scanner = Scanner.new(idGen)
				scanner:scan(function(processed)
					ui:setStatus(string.format("Scanning… %d instances", processed))
					ui:setCounts({
						scripts = scanner.counts.scripts,
						modules = scanner.counts.modules,
						locals = scanner.counts.locals,
						remotes = scanner.counts.remotes,
					})
				end)

				ui:setStatus("Analyzing source…")
				local relationships, warnings = Analyzer.run(scanner, {
					includeSource = ui:getIncludeSource(),
				}, function(done, total)
					ui:setStatus(string.format("Analyzing… %d / %d scripts", done, total))
				end)

				state = { scanner = scanner, relationships = relationships, warnings = warnings }
				ui:setCounts({
					scripts = scanner.counts.scripts,
					modules = scanner.counts.modules,
					locals = scanner.counts.locals,
					remotes = scanner.counts.remotes,
					relationships = #relationships,
					warnings = #warnings,
				})
				ui:setStatus(string.format(
					"Scan complete — %d relationships, %d warnings.",
					#relationships,
					#warnings
				))
			end)
			if not ok then
				ui:setStatus("Scan failed: " .. tostring(err))
			end
			scanning = false
		end)
	end,

	onExport = function()
		if state == nil then
			ui:setStatus("Run a scan first.")
			return
		end
		local doc = Exporter.build(state.scanner, state.relationships, state.warnings)
		local json, err = Exporter.encode(doc)
		if json ~= nil then
			ui:showExport(json)
			ui:setStatus(string.format("Exported %d characters — copy from the box below.", #json))
		else
			ui:setStatus("Export failed: " .. tostring(err))
		end
	end,
})

button.Click:Connect(function()
	widget.Enabled = not widget.Enabled
	button:SetActive(widget.Enabled)
end)

widget:GetPropertyChangedSignal("Enabled"):Connect(function()
	button:SetActive(widget.Enabled)
end)
