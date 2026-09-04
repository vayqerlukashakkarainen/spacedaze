import { k, layers, mainSoundVolume } from "../main"
import { audioService } from "../services/audioService"
import {
	getHubLevelDefinition,
	HUB_LEVELS,
} from "../services/hubProgressService"
import {
	consumePendingRunEndSummary,
	type RunEndSummary,
} from "../services/runCompletionService"
import {
	addThemedText,
	createUiActionButton,
	createUiPanel,
	createUiProgressBar,
	createUiSectionHeader,
	createUiStatList,
	playUiModalOpen,
	UI_COLORS,
	UI_FONT_SIZES,
} from "./common"
import { uiHitRegion } from "./common/hitRegion"

const SUMMARY_TAG = "runEndSummary"

export function showPendingRunEndSummary() {
	const summary = consumePendingRunEndSummary()
	if (!summary) return false
	showRunEndSummary(summary)
	return true
}

function showRunEndSummary(summary: RunEndSummary) {
	k.destroyAll(SUMMARY_TAG)
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
	const leveledUp = summary.hub.currentLevel > summary.hub.previousLevel
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
		color: leveledUp ? UI_COLORS.success : UI_COLORS.accent,
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
				value: leveledUp
					? `${summary.hub.previousLevel}  >  ${summary.hub.currentLevel}`
					: `${summary.hub.currentLevel}`,
			},
			{ label: "DEBRIS RECOVERED", value: `${summary.run?.salvageEarned ?? 0}` },
			{ label: "DEBRIS LOST", value: `${summary.debree.lost}` },
			{ label: "CHEST LUCK", value: `+${Math.round(levelDefinition.chestLuck * 100)}%` },
		],
	})

	if (summary.hub.unlocks.length > 0) {
		addThemedText(panel, {
			text: `NEW  //  ${summary.hub.unlocks.join("  //  ")}`,
			pos: k.vec2(left + 32, top + 300),
			variant: "caption",
			width: panelSize.x - 64,
			align: "center",
		})
	}

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
	if (leveledUp) {
		audioService.playSound("reward_shine_legendary", {
			volume: mainSoundVolume * 0.7,
		})
		k.shake(3)
	}
}

function formatDuration(durationSeconds: number) {
	const minutes = Math.floor(durationSeconds / 60)
	const seconds = durationSeconds % 60
	return `${minutes}:${seconds.toString().padStart(2, "0")}`
}
