import { k, layers, mainSoundVolume } from "../main"
import { audioService } from "../services/audioService"
import {
	getHubLevelDefinition,
	HUB_FACILITIES,
	HUB_LEVELS,
	type HubFacilityId,
} from "../services/hubProgressService"
import {
	getAllRewardDefinitions,
	getRewardMinimumHubLevel,
	type RewardDefinition,
} from "../services/rewardService"
import { getUpgradeDefinition } from "../upgrades/upgradeRegistry"
import {
	consumePendingRunEndSummary,
	type RunEndSummary,
} from "../services/runCompletionService"
import {
	addThemedText,
	createUiActionButton,
	createUiPanel,
	createUiProgressBar,
	createUiScrollable,
	createUiSectionHeader,
	createUiStatList,
	playUiModalOpen,
	UI_COLORS,
	UI_FONT_SIZES,
} from "./common"
import { uiHitRegion } from "./common/hitRegion"

const SUMMARY_TAG = "runEndSummary"
const UNLOCK_ROW_HEIGHT = 34
const UNLOCK_COLUMN_GAP = 10

interface UnlockListEntry {
	name: string
	sprite: string
	meta?: string
}

interface UnlockSection {
	label: string
	entries: UnlockListEntry[]
}

const HUB_UNLOCK_ICONS: Readonly<Record<string, string>> = {
	"SALVAGE GHOST CHEST": "chest_salvage_ui",
	"EMERGENCY SERVICE DRONE": "drone_combat",
	"SECOND SALVAGE GHOST CHEST": "chest_salvage_ui",
	"COURIER TRAFFIC": "hub_ship_ring_runner",
	"GHOST WEAPON CACHE": "chest_weapon_ui",
	"SALVAGE HAULERS": "hub_salvage_hauler",
	"SIGNAL ARRAY": "room_signal_relay",
	"TRAINING RANGE EXPANSION": "facility_phase_station_minimal",
	"THIRD SALVAGE GHOST CHEST": "chest_salvage_ui",
	"MAINTENANCE WING": "hub_droid_repair",
	"DOCKING GANTRIES": "hub_ship_ring_runner",
	"OUTPOST TRAFFIC GRID": "hub_ship_jubilee",
	"HUB RESTORATION COMPLETE": "hub_progression_lamp",
	"PHASE CROWN": "hub_progression_lamp",
}

const HUB_FACILITY_ICONS: Readonly<Record<HubFacilityId, string>> = {
	contractTerminal: "facility_contract_terminal_1bit",
	trainingRange: "facility_phase_station_minimal",
	salvageForge: "facility_salvage_forge_1bit",
	debriefTerminal: "facility_debrief_terminal_1bit",
}

export function showPendingRunEndSummary() {
	const summary = consumePendingRunEndSummary()
	if (!summary) return false
	showRunEndSummary(summary)
	return true
}

function showRunEndSummary(summary: RunEndSummary) {
	k.destroyAll(SUMMARY_TAG)
	if (summary.hub.currentLevel > summary.hub.previousLevel) {
		showHubLevelUpSummary(summary)
		return
	}
	const panelSize = k.vec2(560, 390)
	const panelPos = k.center()
	const backdrop = k.add([
		k.pos(0, 0),
		k.rect(k.width(), k.height()),
		k.color(...UI_COLORS.background),
		k.opacity(0.82),
		k.fixed(),
		k.layer(layers.uiEffects),
		k.animate(),
		uiHitRegion(k.vec2(k.width(), k.height())),
		SUMMARY_TAG,
	])
	const panel = createUiPanel({
		pos: panelPos,
		size: panelSize,
		anchor: "center",
		layer: layers.uiEffects,
		animated: true,
		tags: [SUMMARY_TAG],
	})
	panel.use(uiHitRegion(panelSize, true))
	panel.onClick(() => {})

	const left = -panelSize.x / 2
	const top = -panelSize.y / 2
	createUiSectionHeader(panel, {
		pos: k.vec2(left + 1, top + 1),
		width: panelSize.x - 2,
		height: 58,
		eyebrow: `${summary.outcome} EXPEDITION`,
		title: "SALVAGE DEPOSIT",
		action: `HUB LEVEL ${summary.hub.currentLevel}`,
	})
	addThemedText(panel, {
		text: `+${summary.debree.deposited}`,
		pos: k.vec2(-120, top + 82),
		variant: "display",
		size: UI_FONT_SIZES.hero,
		align: "center",
		width: 240,
		color: k.rgb(...UI_COLORS.success),
	})
	addThemedText(panel, {
		text: "DEBRIS DEPOSITED",
		pos: k.vec2(-120, top + 124),
		variant: "caption",
		width: 240,
		align: "center",
	})

	const levelDefinition = getHubLevelDefinition(summary.hub.currentLevel)
	const nextDefinition = HUB_LEVELS.find(
		(definition) => definition.level === summary.hub.currentLevel + 1
	)
	const levelSpan = nextDefinition
		? nextDefinition.requiredDeposited - levelDefinition.requiredDeposited
		: 1
	const levelEarned = summary.hub.currentXp - levelDefinition.requiredDeposited
	createUiProgressBar(panel, {
		pos: k.vec2(left + 32, top + 158),
		width: panelSize.x - 64,
		height: 6,
		value: nextDefinition ? levelEarned / levelSpan : 1,
		color: UI_COLORS.accent,
	})
	addThemedText(panel, {
		text: nextDefinition
			? `${summary.hub.currentXp} / ${nextDefinition.requiredDeposited} HUB XP`
			: `${summary.hub.currentXp} HUB XP  //  MAXIMUM LEVEL`,
		pos: k.vec2(left + 32, top + 174),
		variant: "muted",
		width: panelSize.x - 64,
		align: "right",
	})

	const runDuration = summary.run
		? formatDuration(summary.run.durationSeconds)
		: "--:--"
	const columnGap = 24
	const statColumnWidth = (panelSize.x - 64 - columnGap) / 2
	createUiStatList(panel, {
		pos: k.vec2(left + 32, top + 205),
		width: statColumnWidth,
		rowHeight: 24,
		rows: [
			{ label: "RUN DURATION", value: runDuration },
			{ label: "HOSTILES DESTROYED", value: `${summary.run?.kills ?? 0}` },
			{ label: "REWARDS COLLECTED", value: `${summary.run?.rewardsCollected ?? 0}` },
			{ label: "HIGHEST RARITY", value: summary.run?.highestRarity ?? "NONE" },
		],
	})
	createUiStatList(panel, {
		pos: k.vec2(left + 32 + statColumnWidth + columnGap, top + 205),
		width: statColumnWidth,
		rowHeight: 24,
		rows: [
			{
				label: "HUB LEVEL",
				value: `${summary.hub.currentLevel}`,
			},
			{ label: "DEBRIS RECOVERED", value: `${summary.run?.salvageEarned ?? 0}` },
			{ label: "DEBRIS LOST", value: `${summary.debree.lost}` },
			{ label: "CHEST LUCK", value: `+${Math.round(levelDefinition.chestLuck * 100)}%` },
		],
	})

	let closed = false
	const close = () => {
		if (closed) return
		closed = true
		enterController.cancel()
		escapeController.cancel()
		k.destroyAll(SUMMARY_TAG)
	}
	createUiActionButton(panel, {
		pos: k.vec2(left + 150, top + 342),
		size: k.vec2(panelSize.x - 300, 32),
		text: "CONTINUE",
		promptAction: "confirm",
		onClick: close,
	})
	const enterController = k.onKeyPress("enter", close)
	const escapeController = k.onKeyPress("escape", close)
	backdrop.onClick(close)
	backdrop.onDestroy(() => {
		enterController.cancel()
		escapeController.cancel()
	})

	playUiModalOpen(backdrop, panel, { panelPos, backdropOpacity: 0.82 })
}

function showHubLevelUpSummary(summary: RunEndSummary) {
	const panelSize = k.vec2(
		Math.min(700, k.width() - 40),
		Math.min(680, k.height() - 40)
	)
	const panelPos = k.center()
	const backdrop = k.add([
		k.pos(0, 0),
		k.rect(k.width(), k.height()),
		k.color(...UI_COLORS.background),
		k.opacity(0.86),
		k.fixed(),
		k.layer(layers.uiEffects),
		k.animate(),
		uiHitRegion(k.vec2(k.width(), k.height())),
		SUMMARY_TAG,
	])
	const panel = createUiPanel({
		pos: panelPos,
		size: panelSize,
		anchor: "center",
		layer: layers.uiEffects,
		animated: true,
		tags: [SUMMARY_TAG],
	})
	panel.use(uiHitRegion(panelSize, true))
	panel.onClick(() => {})

	const left = -panelSize.x / 2
	const top = -panelSize.y / 2
	createUiSectionHeader(panel, {
		pos: k.vec2(left + 1, top + 1),
		width: panelSize.x - 2,
		height: 62,
		eyebrow: `${summary.outcome} EXPEDITION  //  +${summary.debree.deposited} DEBRIS DEPOSITED`,
		title: `HUB LEVEL ${summary.hub.currentLevel} REACHED`,
		action: `${summary.hub.previousLevel}  >  ${summary.hub.currentLevel}`,
	})
	addThemedText(panel, {
		text: "THESE ARE NOW DROPPABLE",
		pos: k.vec2(left + 28, top + 76),
		variant: "caption",
		width: panelSize.x - 56,
	})

	const viewportTop = top + 100
	const viewportHeight = panelSize.y - 158
	const viewportWidth = panelSize.x - 56
	const scrollable = createUiScrollable({
		parent: panel,
		pos: k.vec2(left + 28, viewportTop),
		width: viewportWidth,
		height: viewportHeight,
		contentHeight: viewportHeight,
		captureWheel: true,
		tags: [SUMMARY_TAG],
	})
	const contentWidth = viewportWidth - 8
	let contentY = 0
	const rewardSections = getRewardUnlockSections(summary)
	if (rewardSections.length === 0) {
		addThemedText(scrollable.content, {
			text: "NO NEW DROP TYPES AT THIS HUB LEVEL",
			pos: k.vec2(0, contentY + 4),
			variant: "muted",
			width: contentWidth,
		})
		contentY += 28
	} else {
		for (const section of rewardSections) {
			contentY = addUnlockSection(
				scrollable.content,
				contentY,
				contentWidth,
				section
			)
		}
	}

	const facilities = HUB_FACILITIES
		.filter((facility) =>
			facility.cost > 0 &&
			facility.requiredHubLevel > summary.hub.previousLevel &&
			facility.requiredHubLevel <= summary.hub.currentLevel
		)
	if (facilities.length > 0) {
		contentY = addUnlockSection(
			scrollable.content,
			contentY + 4,
			contentWidth,
			{
				label: "PURCHASABLE BUILDINGS",
				entries: facilities.map((facility) => ({
					name: facility.name,
					sprite: HUB_FACILITY_ICONS[facility.id],
					meta: `${facility.cost} DEBRIS`,
				})),
			}
		)
	}

	const facilityNames = facilities.map((facility) => facility.name)
	const hubSystems = summary.hub.unlocks.filter((unlock) =>
		!facilityNames.some((facilityName) => unlock.includes(facilityName))
	)
	if (hubSystems.length > 0) {
		contentY = addUnlockSection(
			scrollable.content,
			contentY + 4,
			contentWidth,
			{
				label: "HUB SYSTEMS",
				entries: hubSystems.map((unlock) => ({
					name: unlock,
					sprite: HUB_UNLOCK_ICONS[unlock] ?? "hub_progression_lamp",
				})),
			}
		)
	}

	scrollable.setContentHeight(contentY + 4)
	scrollable.scrollToStart()

	let closed = false
	const close = () => {
		if (closed) return
		closed = true
		enterController.cancel()
		escapeController.cancel()
		k.destroyAll(SUMMARY_TAG)
	}
	createUiActionButton(panel, {
		pos: k.vec2(left + panelSize.x / 2 - 100, top + panelSize.y - 44),
		size: k.vec2(200, 32),
		text: "CONTINUE",
		promptAction: "confirm",
		onClick: close,
	})
	const enterController = k.onKeyPress("enter", close)
	const escapeController = k.onKeyPress("escape", close)
	backdrop.onClick(close)
	backdrop.onDestroy(() => {
		enterController.cancel()
		escapeController.cancel()
	})

	playUiModalOpen(backdrop, panel, { panelPos, backdropOpacity: 0.86 })
	audioService.playSound("reward_shine_legendary", {
		volume: mainSoundVolume * 0.7,
	})
	k.shake(3)
}

function getRewardUnlockSections(summary: RunEndSummary): UnlockSection[] {
	const unlockedRewards = getAllRewardDefinitions().filter((definition) => {
		const requiredLevel = getRewardMinimumHubLevel(definition)
		return requiredLevel > summary.hub.previousLevel &&
			requiredLevel <= summary.hub.currentLevel &&
			isDroppable(definition)
	})
	const categories: readonly {
		label: string
		kinds: readonly RewardDefinition["kind"][]
	}[] = [
		{ label: "PRIMARY WEAPON", kinds: ["weapon"] },
		{ label: "SECONDARY WEAPON", kinds: ["activeModule"] },
		{ label: "MOBILITY", kinds: ["mobility"] },
		{ label: "ULTIMATE", kinds: ["ultimate"] },
		{ label: "UPGRADES", kinds: ["upgrade", "powerup"] },
		{ label: "ITEMS", kinds: ["item"] },
	]
	return categories
		.map((category) => ({
			label: category.label,
			entries: unlockedRewards
				.filter((reward) => category.kinds.includes(reward.kind))
				.map((reward) => ({
					name: getUnlockRewardName(reward),
					sprite: reward.sprite,
				})),
		}))
		.filter((section) => section.entries.length > 0)
}

function isDroppable(definition: RewardDefinition) {
	return Object.values(definition.weights).some((weight) => (weight ?? 0) > 0)
}

function getUnlockRewardName(definition: RewardDefinition) {
	if (!definition.upgradeKey) return definition.name
	return getUpgradeDefinition(definition.upgradeKey)?.toolName.toUpperCase() ??
		definition.name
}

function addUnlockSection(
	parent: ReturnType<typeof k.add>,
	y: number,
	width: number,
	section: UnlockSection
) {
	addThemedText(parent, {
		text: section.label,
		pos: k.vec2(0, y + 2),
		variant: "heading",
		width,
	})
	parent.add([
		k.pos(0, y + 20),
		k.rect(width, 1),
		k.color(...UI_COLORS.border),
	])
	y += 25
	const columns = width >= 500 ? 2 : 1
	const columnWidth = (width - UNLOCK_COLUMN_GAP * (columns - 1)) / columns
	for (const [index, entry] of section.entries.entries()) {
		const column = index % columns
		const rowIndex = Math.floor(index / columns)
		const x = column * (columnWidth + UNLOCK_COLUMN_GAP)
		const rowY = y + rowIndex * UNLOCK_ROW_HEIGHT
		const row = parent.add([
			k.pos(x, rowY),
			k.rect(columnWidth, UNLOCK_ROW_HEIGHT - 4),
			k.color(...UI_COLORS.panelRaised),
		])
		row.add([
			k.sprite(entry.sprite, { width: 22, height: 22 }),
			k.pos(17, (UNLOCK_ROW_HEIGHT - 4) / 2),
			k.anchor("center"),
		])
		addThemedText(row, {
			text: entry.name,
			pos: k.vec2(34, 9),
			variant: "body",
			width: columnWidth - (entry.meta ? 130 : 44),
		})
		if (entry.meta) {
			addThemedText(row, {
				text: entry.meta,
				pos: k.vec2(34, 9),
				variant: "caption",
				width: columnWidth - 44,
				align: "right",
			})
		}
	}
	return y + Math.ceil(section.entries.length / columns) * UNLOCK_ROW_HEIGHT + 8
}

function formatDuration(durationSeconds: number) {
	const minutes = Math.floor(durationSeconds / 60)
	const seconds = durationSeconds % 60
	return `${minutes}:${seconds.toString().padStart(2, "0")}`
}
