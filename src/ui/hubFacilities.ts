import type { GameObj, Vec2 } from "kaplay"
import { getScore, k, layers, spendScore } from "../main"
import {
	getContractOffers,
	getSelectedContract,
	RunContract,
	selectContract,
} from "../services/contractService"
import {
	getForgeLevel,
	getForgeUpgradeCost,
	isBlueprintDiscovered,
	upgradeForge,
} from "../services/hubProgressService"
import { getLastRunStats } from "../services/runStatsService"
import {
	getAllRewardDefinitions,
	REWARD_RARITY_COLORS,
	type RewardDefinition,
} from "../services/rewardService"
import { setNextGeneratedRunSeed } from "../levels/runMap"
import { saveGame } from "../util"
import { tags } from "../tags"
import { uiState } from "./uiState"
import {
	addThemedText,
	createUiActionButton,
	createUiBadge,
	createUiPanel,
	createUiProgressBar,
	playUiModalClose,
	playUiModalOpen,
	createUiSectionHeader,
	createUiSelectableRow,
	createUiStatList,
	createUiSurface,
	createUiVerticalFlow,
	UI_COLORS,
} from "./common"
import { getUnlockedWarpZones, WARP_ZONES } from "../services/warpZoneService"
import {
	addLvl,
	getPermanentUpgradeLevel,
	PERMANENT_UPGRADE_KEYS,
	type PermanentUpgradeKey,
} from "../upg"
import { getUpgradeDefinition } from "../upgrades/upgradeRegistry"
import { loadPlayer } from "../player"
import {
	playShopMenuCloseSound,
	playShopMenuOpenSound,
} from "../services/shopMenuSoundService"

let panelOpen = false
let panelClosing = false
let panelCloseHandler: (() => void) | undefined
let activePanel: GameObj | undefined
let activeBackdrop: GameObj | undefined

export function hubFacilityPanelOpen() {
	return panelOpen
}

export function showContractTerminal() {
	const panel = openPanel("CONTRACT TERMINAL")
	if (!panel) return

	const selected = getSelectedContract()
	panel.add([
		k.text(
			selected ? `QUEUED: ${selected.name}` : "SELECT THE NEXT EXPEDITION",
			{ size: 10, font: "unscii" }
		),
		k.pos(0, -165),
		k.anchor("center"),
		k.color(...UI_COLORS.accent),
	])

	const offers = getContractOffers()
	for (let index = 0; index < offers.length; index++) {
		const contract = offers[index]
		const x = (index - 1) * 220
		const card = panel.add([
			k.rect(200, 230),
			k.pos(x, -5),
			k.anchor("center"),
			k.color(...UI_COLORS.panel),
			k.outline(2, k.rgb(...UI_COLORS.accent)),
		])
		card.add([
			k.text(contract.name, {
				size: 12,
				font: "unscii",
				width: 180,
				align: "center",
			}),
			k.pos(0, -82),
			k.anchor("center"),
		])
		card.add([
			k.text(contract.description, {
				size: 9,
				font: "unscii",
				width: 170,
				align: "center",
			}),
			k.pos(0, -22),
			k.anchor("center"),
			k.color(...UI_COLORS.muted),
		])
		card.add([
			k.text(`SEED ${contract.seed}`, { size: 9, font: "unscii" }),
			k.pos(0, 40),
			k.anchor("center"),
		])
		addButton(card, k.vec2(0, 82), "QUEUE CONTRACT", () => {
			queueContract(contract)
		})
	}
}

export function showSalvageForge(playTransitionSound = true) {
	const panel = openPanel("SALVAGE FORGE", undefined, playTransitionSound)
	if (!panel) return

	const level = getForgeLevel()
	const cost = getForgeUpgradeCost()
	panel.add([
		k.text(`FORGE LEVEL ${level}/3`, { size: 18, font: "unscii" }),
		k.pos(0, -90),
		k.anchor("center"),
		k.color(...UI_COLORS.accent),
	])
	panel.add([
		k.text(
			level >= 3
				? "REWARD RECEIVER FULLY CALIBRATED\n+45% ENEMY REWARD DROP CHANCE"
				: `NEXT CALIBRATION\n+15% ENEMY REWARD DROP CHANCE\n\nCOST ${cost} SCRAP  |  AVAILABLE ${getScore()}`,
			{ size: 11, font: "unscii", width: 440, align: "center" }
		),
		k.pos(0, 0),
		k.anchor("center"),
	])
	if (level < 3) {
		addButton(panel, k.vec2(0, 95), "UPGRADE FORGE", () => {
			if (!spendScore(cost)) return
			if (!upgradeForge()) return
			saveGame("slot1")
			hideHubFacilityPanel(false)
			showSalvageForge(false)
		})
	}
}

export function showRunDebrief() {
	const panel = openPanel("POST-RUN DEBRIEF")
	if (!panel) return
	const stats = getLastRunStats()
	if (!stats) {
		panel.add([
			k.text("NO COMPLETED EXPEDITION ON RECORD", {
				size: 13,
				font: "unscii",
			}),
			k.anchor("center"),
		])
		return
	}

	const minutes = Math.floor(stats.durationSeconds / 60)
	const seconds = stats.durationSeconds % 60
	const rows = [
		["OUTCOME", stats.outcome],
		["CONTRACT", stats.contractName],
		["DURATION", `${minutes}:${seconds.toString().padStart(2, "0")}`],
		["HOSTILES DESTROYED", `${stats.kills}`],
		["SALVAGE RECOVERED", `${stats.salvageEarned}`],
		["REWARDS COLLECTED", `${stats.rewardsCollected}`],
		["HIGHEST RARITY", stats.highestRarity],
	]
	rows.forEach(([label, value], index) => {
		const y = -125 + index * 38
		panel.add([
			k.text(label, { size: 10, font: "unscii" }),
			k.pos(-260, y),
			k.color(...UI_COLORS.muted),
		])
		panel.add([
			k.text(value, { size: 11, font: "unscii" }),
			k.pos(260, y),
			k.anchor("right"),
			k.color(...UI_COLORS.accent),
		])
	})
}

export function showBlueprintArchive() {
	const panel = openPanel("BLUEPRINT ARCHIVE")
	if (!panel) return
	const blueprints = new Map(
		getAllRewardDefinitions().map((reward) => [
			reward.upgradeKey ?? reward.powerupKey ?? reward.id,
			reward,
		])
	)
	const definitions = [...blueprints.entries()]
	const discoveredCount = definitions.filter(([key]) =>
		isBlueprintDiscovered(key)
	).length
	const pageSize = 5
	let selectedIndex = Math.max(
		0,
		definitions.findIndex(([key]) => isBlueprintDiscovered(key))
	)
	let page = Math.floor(selectedIndex / pageSize)
	const pageCount = Math.max(1, Math.ceil(definitions.length / pageSize))
	const listRoot = panel.add([k.pos(0, 0)])
	const detailRoot = panel.add([k.pos(0, 0)])

	createUiSectionHeader(panel, {
		pos: k.vec2(-350, -194),
		width: 700,
		height: 50,
		eyebrow: "ENGINEERING ARCHIVE",
		title: "BLUEPRINT TERMINAL",
		action: `${discoveredCount} / ${definitions.length} DISCOVERED`,
	})
	createUiProgressBar(panel, {
		pos: k.vec2(250, -151),
		width: 88,
		value: definitions.length > 0 ? discoveredCount / definitions.length : 0,
	})
	createUiSurface(panel, {
		pos: k.vec2(-350, -136),
		size: k.vec2(260, 290),
	})
	createUiSurface(panel, {
		pos: k.vec2(-80, -136),
		size: k.vec2(430, 290),
		borderColor: UI_COLORS.accent,
	})

	const render = () => {
		destroyChildren(listRoot)
		destroyChildren(detailRoot)
		createUiSectionHeader(listRoot, {
			pos: k.vec2(-350, -136),
			width: 260,
			title: "RECOVERED SCHEMATICS",
			eyebrow: "RECORD INDEX",
			action: `PAGE ${page + 1}/${pageCount}`,
		})
		const pageStart = page * pageSize
		const rowControls: Array<{
			setSelected: (value: boolean) => void
			setStatus: (value: string) => void
			baseStatus: string
		}> = []
		definitions.slice(pageStart, pageStart + pageSize).forEach(
			([key, reward], rowIndex) => {
				const definitionIndex = pageStart + rowIndex
				const discovered = isBlueprintDiscovered(key)
				const control = createUiSelectableRow(listRoot, {
					pos: k.vec2(-350, -84 + rowIndex * 42),
					width: 260,
					title: discovered ? reward.name : "???????? ????????",
					meta: blueprintRecordId(key, definitionIndex),
					status: definitionIndex === selectedIndex
						? "SELECTED"
						: discovered ? "RECOVERED" : "ENCRYPTED",
					selected: definitionIndex === selectedIndex,
					onClick: () => {
						selectedIndex = definitionIndex
						rowControls.forEach((row, index) => {
							const isSelected = pageStart + index === selectedIndex
							row.setSelected(isSelected)
							row.setStatus(isSelected ? "SELECTED" : row.baseStatus)
						})
						renderBlueprintDetail(
							detailRoot,
							key,
							reward,
							definitionIndex
						)
					},
				})
				rowControls.push({
					...control,
					baseStatus: discovered ? "RECOVERED" : "ENCRYPTED",
				})
			}
		)
		createUiActionButton(listRoot, {
			pos: k.vec2(-342, 130),
			text: "<",
			size: k.vec2(34, 18),
			disabled: page === 0,
			onClick: () => {
				page--
				render()
			},
		})
		createUiActionButton(listRoot, {
			pos: k.vec2(-132, 130),
			text: ">",
			size: k.vec2(34, 18),
			disabled: page >= pageCount - 1,
			onClick: () => {
				page++
				render()
			},
		})

		const selected = definitions[selectedIndex]
		if (selected) {
			renderBlueprintDetail(
				detailRoot,
				selected[0],
				selected[1],
				selectedIndex
			)
		}
	}

	render()
}

function renderBlueprintDetail(
	root: GameObj,
	key: string,
	reward: RewardDefinition,
	index: number
) {
	destroyChildren(root)
	const discovered = isBlueprintDiscovered(key)
	createUiSectionHeader(root, {
		pos: k.vec2(-80, -136),
		width: 430,
		height: 52,
		eyebrow: blueprintRecordId(key, index),
		title: discovered ? reward.name : "ENCRYPTED RECORD",
	})
	createUiBadge(root, {
		pos: k.vec2(258, -126),
		text: discovered ? reward.rarity : "ENCRYPTED",
		width: 80,
		color: discovered
			? REWARD_RARITY_COLORS[reward.rarity]
			: UI_COLORS.warning,
	})

	if (discovered) {
		root.add([
			k.pos(135, -34),
			k.circle(48, { fill: false }),
			k.outline(1, k.rgb(...UI_COLORS.border)),
		])
		root.add([
			k.pos(135, -34),
			k.sprite(reward.sprite),
			k.anchor("center"),
			k.scale(2.25),
		])
	} else {
		addThemedText(root, {
			text: "?",
			pos: k.vec2(111, -52),
			variant: "display",
			size: 32,
			width: 48,
			align: "center",
			color: k.rgb(...UI_COLORS.muted),
		})
	}

	root.add([
		k.pos(-80, 51),
		k.rect(430, 1),
		k.color(...UI_COLORS.border),
	])
	addThemedText(root, {
		text: "FIELD NOTES",
		pos: k.vec2(-66, 64),
		variant: "eyebrow",
		width: 190,
	})
	addThemedText(root, {
		text: discovered ? reward.description.toUpperCase() : "DATA CORRUPTED. RECOVER THIS SCHEMATIC IN THE FIELD.",
		pos: k.vec2(-66, 82),
		variant: discovered ? "body" : "muted",
		width: 190,
	})
	createUiStatList(root, {
		pos: k.vec2(145, 64),
		width: 190,
		rowHeight: 22,
		rows: discovered
			? Object.entries(reward.stats).slice(0, 3).map(([label, value]) => ({
				label: label.replace(/([A-Z])/g, " $1").toUpperCase(),
				value: `${value}`.toUpperCase(),
			}))
			: [{ label: "STATUS", value: "ENCRYPTED" }],
	})
}

function blueprintRecordId(key: string, index: number) {
	const prefix = key.replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase()
	return `BP-${prefix.padEnd(3, "X")}-${`${index + 1}`.padStart(3, "0")}`
}

function destroyChildren(parent: GameObj) {
	for (const child of [...parent.children]) destroyObjectTree(child)
}

export function showTrainingRange(playTransitionSound = true) {
	const panelSize = k.vec2(760, 300)
	const panel = openPanel(undefined, panelSize, playTransitionSound)
	if (!panel) return

	createUiSectionHeader(panel, {
		pos: k.vec2(-379, -149),
		width: 758,
		height: 54,
		eyebrow: "TRAINING FACILITY",
		title: "TRAINING RANGE",
		action: `SALVAGE  ${getScore()}`,
	})
	addThemedText(panel, {
		text: "PERMANENT SHIP SYSTEMS",
		pos: k.vec2(-358, -83),
		variant: "eyebrow",
		width: 716,
	})
	PERMANENT_UPGRADE_KEYS.forEach((key, index) => {
		addPermanentUpgradeCard(panel, key, index)
	})
}

function addPermanentUpgradeCard(
	panel: GameObj,
	key: PermanentUpgradeKey,
	index: number
) {
	const definition = getUpgradeDefinition(key)
	if (!definition) return
	const currentLevel = getPermanentUpgradeLevel(key) ?? -1
	const nextLevel = definition.levels[currentLevel + 1]
	const displayedLevel = nextLevel ?? definition.levels[currentLevel]
	const card = createUiSurface(panel, {
		pos: k.vec2(index === 0 ? -358 : 10, -62),
		size: k.vec2(348, 92),
		tone: "raised",
	})

	card.add([
		k.sprite(definition.levels[0].sprite),
		k.pos(23, 46),
		k.anchor("center"),
		k.scale(1.25),
	])
	addThemedText(card, {
		text: definition.toolName.toUpperCase(),
		pos: k.vec2(48, 12),
		variant: "heading",
		width: 178,
	})
	addThemedText(card, {
		text: nextLevel
			? `LEVEL ${currentLevel + 1} / ${definition.levels.length}`
			: `LEVEL ${definition.levels.length} / ${definition.levels.length}  //  OWNED`,
		pos: k.vec2(48, 30),
		variant: "muted",
		width: 178,
	})
	if (displayedLevel) {
		addThemedText(card, {
			text: displayedLevel.desc,
			pos: k.vec2(48, 48),
			variant: "body",
			width: 178,
		})
	}

	if (!nextLevel) {
		createUiBadge(card, {
			pos: k.vec2(242, 36),
			text: "MAX LEVEL",
			width: 94,
		})
		return
	}

	createUiActionButton(card, {
		pos: k.vec2(242, 27),
		text: `BUY ${nextLevel.price}`,
		size: k.vec2(94, 38),
		disabled: getScore() < nextLevel.price,
		onClick: () => {
			if (!spendScore(nextLevel.price)) return
			if (addLvl(key) === undefined) return
			loadPlayer()
			hideHubFacilityPanel(false)
			showTrainingRange(false)
		},
	})
}

export function showWarpZoneRegistry() {
	const panel = openPanel("WARP ZONES")
	if (!panel) return
	const unlockedZones = getUnlockedWarpZones()

	panel.add([
		k.text(`${unlockedZones.length} / ${WARP_ZONES.length} ZONES UNLOCKED`, {
			size: 12,
			font: "unscii",
		}),
		k.pos(0, -105),
		k.anchor("center"),
		k.color(...UI_COLORS.accent),
	])
	panel.add([
		k.text(unlockedZones.map((zone) => `${zone.name}  //  ${zone.description}`).join("\n\n"), {
			size: 11,
			font: "unscii",
			width: 560,
			align: "center",
		}),
		k.pos(0, -25),
		k.anchor("center"),
	])
	panel.add([
		k.text("NEW ZONES WILL APPEAR HERE WHEN THEIR COORDINATES ARE UNLOCKED", {
			size: 9,
			font: "unscii",
			width: 500,
			align: "center",
		}),
		k.pos(0, 80),
		k.anchor("center"),
		k.color(...UI_COLORS.muted),
	])
}

export function hideHubFacilityPanel(playTransitionSound = true) {
	if (!panelOpen || panelClosing) return
	if (!playTransitionSound) {
		finishClosingHubFacilityPanel(false)
		return
	}
	panelClosing = true
	playShopMenuCloseSound()
	const panel = activePanel
	const backdrop = activeBackdrop
	if (!panel?.exists() || !backdrop?.exists()) {
		finishClosingHubFacilityPanel(false)
		return
	}
	void playUiModalClose(backdrop, panel, {
		panelPos: k.center(),
		backdropOpacity: 0.8,
	}).then(() => finishClosingHubFacilityPanel(false))
}

function finishClosingHubFacilityPanel(playTransitionSound: boolean) {
	const closeHandler = panelCloseHandler
	panelCloseHandler = undefined
	panelOpen = false
	panelClosing = false
	uiState.modalOpen = false
	for (const obj of k.get<GameObj>(tags.hubFacilityUi)) {
		destroyObjectTree(obj)
	}
	for (const obj of k.get<GameObj>(tags.gameLoop)) obj.paused = false
	closeHandler?.()
	if (playTransitionSound) playShopMenuCloseSound()
	activePanel = undefined
	activeBackdrop = undefined
}

function openPanel(
	title?: string,
	size = k.vec2(720, 440),
	playTransitionSound = true
) {
	if (panelOpen) return undefined
	panelOpen = true
	uiState.modalOpen = true
	for (const obj of k.get<GameObj>(tags.gameLoop)) obj.paused = true

	const backdrop = k.add([
		k.rect(k.width(), k.height()),
		k.pos(0, 0),
		k.color(k.BLACK),
		k.opacity(0.8),
		k.animate(),
		k.fixed(),
		k.layer(layers.uiEffects),
		tags.hubFacilityUi,
	])
	const panel = createUiPanel({
		pos: k.center(),
		size,
		title,
		anchor: "center",
		layer: layers.uiEffects,
		tags: [tags.hubFacilityUi],
		animated: true,
	})
	activeBackdrop = backdrop
	activePanel = panel
	playUiModalOpen(backdrop, panel, {
		panelPos: k.center(),
		backdropOpacity: 0.8,
	})
	addButton(
		panel,
		k.vec2(0, size.y / 2 - 35),
		"CLOSE",
		() => hideHubFacilityPanel()
	)
	if (playTransitionSound) playShopMenuOpenSound()
	return panel
}

function addButton(
	parent: GameObj,
	pos: Vec2,
	text: string,
	onClick: () => void,
	width: number = 180
) {
	return createUiActionButton(parent, {
		pos: pos.sub(width / 2, 19),
		text,
		onClick,
		size: k.vec2(width, 38),
	})
}

function queueContract(contract: RunContract) {
	selectContract(contract)
	setNextGeneratedRunSeed(contract.seed)
	hideHubFacilityPanel()
}

function destroyObjectTree(obj: GameObj) {
	for (const child of [...obj.children]) destroyObjectTree(child)
	k.destroy(obj)
}
