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
import { getAllRewardDefinitions } from "../services/rewardService"
import { setNextGeneratedRunSeed } from "../levels/runMap"
import { saveGame } from "../util"
import { tags } from "../tags"
import { uiState } from "./uiState"
import { createUiPanel } from "./common/panel"
import { UI_COLORS } from "./common/theme"
import { getUnlockedWarpZones, WARP_ZONES } from "../services/warpZoneService"
import {
	equipWeapon,
	getEquippedWeaponId,
	isWeaponOwned,
	WEAPONS,
} from "../services/weaponService"

let panelOpen = false
let panelCloseHandler: (() => void) | undefined

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

export function showSalvageForge() {
	const panel = openPanel("SALVAGE FORGE")
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
			hideHubFacilityPanel()
			showSalvageForge()
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
	panel.add([
		k.text(
			`DISCOVERED ${discoveredCount} / ${definitions.length}`,
			{ size: 10, font: "unscii" }
		),
		k.pos(0, -172),
		k.anchor("center"),
		k.color(...UI_COLORS.accent),
	])

	definitions.forEach(([key, reward], index) => {
		const column = index % 2
		const row = Math.floor(index / 2)
		const discovered = isBlueprintDiscovered(key)
		panel.add([
			k.text(discovered ? reward.name : "????????", {
				size: 9,
				font: "unscii",
				width: 300,
			}),
			k.pos(column === 0 ? -310 : 20, -140 + row * 24),
			k.color(discovered ? k.WHITE : k.rgb(...UI_COLORS.muted)),
		])
	})
}

export function showArsenal() {
	const panel = openPanel("ARSENAL")
	if (!panel) return
	const equippedWeaponId = getEquippedWeaponId()

	panel.add([
		k.text("SELECT A PERMANENT PRIMARY WEAPON", {
			size: 10,
			font: "unscii",
		}),
		k.pos(0, -170),
		k.anchor("center"),
		k.color(...UI_COLORS.accent),
	])

	WEAPONS.forEach((weapon, index) => {
		const owned = isWeaponOwned(weapon.id)
		const equipped = weapon.id === equippedWeaponId
		const card = panel.add([
			k.rect(205, 286),
			k.pos((index - 1) * 225, -2),
			k.anchor("center"),
			k.area(),
			k.color(...(equipped ? UI_COLORS.panelHover : UI_COLORS.panel)),
			k.outline(2, k.rgb(...(equipped ? UI_COLORS.accent : UI_COLORS.muted))),
		])

		card.add([
			k.sprite(weapon.icon),
			k.pos(0, -102),
			k.anchor("center"),
			k.scale(1.75),
		])
		card.add([
			k.text(weapon.name, {
				size: 11,
				font: "unscii",
				width: 185,
				align: "center",
			}),
			k.pos(0, -57),
			k.anchor("center"),
			k.color(...UI_COLORS.accent),
		])
		card.add([
			k.text(weapon.description, {
				size: 8,
				font: "unscii",
				width: 175,
				align: "center",
			}),
			k.pos(0, -17),
			k.anchor("center"),
			k.color(...UI_COLORS.muted),
		])

		const modifier = weapon.piercing
			? `PIERCE +${weapon.piercing.maxPierces}`
			: weapon.chain
				? `CHAIN +${weapon.chain.maxChains}`
				: "NO PRESET MODIFIER"
		const roundsPerSecond = 1 / weapon.fireCooldown
		card.add([
			k.text(
				`DAMAGE  ${formatMultiplier(weapon.damageMultiplier)}\nRATE    ${roundsPerSecond.toFixed(1)}/S\nSPEED   ${formatMultiplier(weapon.projectileSpeedMultiplier)}\n\n${modifier}`,
				{ size: 9, font: "unscii", width: 170, align: "left" }
			),
			k.pos(-76, 37),
			k.color(k.WHITE),
		])
		card.add([
			k.text(equipped ? "EQUIPPED" : owned ? "CLICK TO EQUIP" : "LOCKED", {
				size: 9,
				font: "unscii",
			}),
			k.pos(0, 119),
			k.anchor("center"),
			k.color(...(equipped ? UI_COLORS.accent : UI_COLORS.muted)),
		])

		if (!owned || equipped) return
		card.onHover(() => {
			card.color = k.rgb(...UI_COLORS.panelHover)
		})
		card.onHoverEnd(() => {
			card.color = k.rgb(...UI_COLORS.panel)
		})
		card.onClick(() => {
			if (!equipWeapon(weapon.id)) return
			saveGame("slot1")
			hideHubFacilityPanel()
			showArsenal()
		})
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

export function showWarpZoneSelector(
	onSelect: (zoneId: string) => void,
	onCancel: () => void
) {
	const panel = openPanel("SELECT WARP ZONE")
	if (!panel) {
		onCancel()
		return
	}
	panelCloseHandler = onCancel
	const zones = getUnlockedWarpZones()

	panel.add([
		k.text("CHOOSE AN UNLOCKED DESTINATION", {
			size: 10,
			font: "unscii",
		}),
		k.pos(0, -130),
		k.anchor("center"),
		k.color(...UI_COLORS.muted),
	])

	zones.forEach((zone, index) => {
		const y = -60 + index * 62
		addButton(panel, k.vec2(0, y), zone.name, () => {
			panelCloseHandler = undefined
			hideHubFacilityPanel()
			onSelect(zone.id)
		})
	})
}

export function hideHubFacilityPanel() {
	if (!panelOpen) return
	const closeHandler = panelCloseHandler
	panelCloseHandler = undefined
	panelOpen = false
	uiState.modalOpen = false
	for (const obj of k.get<GameObj>(tags.hubFacilityUi)) {
		destroyObjectTree(obj)
	}
	for (const obj of k.get<GameObj>(tags.gameLoop)) obj.paused = false
	closeHandler?.()
}

function openPanel(title: string) {
	if (panelOpen) return undefined
	panelOpen = true
	uiState.modalOpen = true
	for (const obj of k.get<GameObj>(tags.gameLoop)) obj.paused = true

	k.add([
		k.rect(k.width(), k.height()),
		k.pos(0, 0),
		k.color(k.BLACK),
		k.opacity(0.8),
		k.fixed(),
		k.layer(layers.uiEffects),
		tags.hubFacilityUi,
	])
	const panel = createUiPanel({
		pos: k.center(),
		size: k.vec2(720, 440),
		title,
		anchor: "center",
		layer: layers.uiEffects,
		tags: [tags.hubFacilityUi],
	})
	addButton(panel, k.vec2(0, 185), "CLOSE", hideHubFacilityPanel)
	return panel
}

function addButton(
	parent: GameObj,
	pos: Vec2,
	text: string,
	onClick: () => void
) {
	const button = parent.add([
		k.rect(180, 38),
		k.pos(pos),
		k.anchor("center"),
		k.area(),
		k.color(...UI_COLORS.panel),
		k.outline(2, k.rgb(...UI_COLORS.accent)),
	])
	button.add([
		k.text(text, { size: 10, font: "unscii" }),
		k.anchor("center"),
	])
	button.onHover(() => {
		button.color = k.rgb(...UI_COLORS.panelHover)
	})
	button.onHoverEnd(() => {
		button.color = k.rgb(...UI_COLORS.panel)
	})
	button.onClick(onClick)
	return button
}

function queueContract(contract: RunContract) {
	selectContract(contract)
	setNextGeneratedRunSeed(contract.seed)
	hideHubFacilityPanel()
}

function formatMultiplier(value: number) {
	return `${value.toFixed(value % 1 === 0 ? 0 : 2)}x`
}

function destroyObjectTree(obj: GameObj) {
	for (const child of [...obj.children]) destroyObjectTree(child)
	k.destroy(obj)
}
