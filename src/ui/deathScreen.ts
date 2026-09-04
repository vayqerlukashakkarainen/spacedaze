import { k, layers, mainSoundVolume } from "../main"
import type { PlayerDeathCause } from "../services/damageService"
import {
	getHubLevelDefinition,
	getHubLevelForDeposited,
	HUB_LEVELS,
} from "../services/hubProgressService"
import type { RunEndSummary } from "../services/runCompletionService"
import { audioService } from "../services/audioService"
import { tags } from "../tags"
import {
	addThemedText,
	createUiActionButton,
	createUiPanel,
	createUiProgressBar,
	createUiSectionHeader,
	createUiTelemetryStrip,
	UI_COLORS,
	UI_FONT_SIZES,
} from "./common"

const KILLER_REVEAL_DELAY = 1
const DEPOSIT_COUNT_DELAY = 0.25

export function showDeathScreen(
	cause: PlayerDeathCause,
	runSummary?: RunEndSummary,
	onContinue?: () => void
) {
	hideDeathScreen()
	const screen = k.add([
		k.rect(k.width(), k.height()),
		k.pos(0, 0),
		k.color(0, 0, 0),
		k.opacity(0.72),
		k.fixed(),
		k.layer(layers.ui),
		tags.deathScreen,
	])

	k.add([
		k.text("DEAD", { font: "", size: UI_FONT_SIZES.death }),
		k.pos(k.center().add(0, runSummary ? -210 : -90)),
		k.anchor("center"),
		k.color(k.WHITE),
		k.fixed(),
		k.layer(layers.ui),
		tags.deathScreen,
	])

	if (runSummary) addAnimatedDepositPanel(screen, runSummary)

	k.wait(KILLER_REVEAL_DELAY, () => {
		if (!screen.exists()) return
		const killerY = runSummary ? -132 : 10
		k.add([
			k.sprite(cause.sprite ?? "bullet1", { width: 38, height: 38 }),
			k.pos(k.center().add(0, killerY)),
			k.anchor("center"),
			k.color(k.WHITE),
			k.fixed(),
			k.layer(layers.ui),
			tags.deathScreen,
		])
		k.add([
			k.text(`KILLED BY ${cause.name.toUpperCase()}`, {
				font: "unscii",
				size: UI_FONT_SIZES.subheading,
			}),
			k.pos(k.center().add(0, killerY + 42)),
			k.anchor("center"),
			k.color(...UI_COLORS.danger),
			k.fixed(),
			k.layer(layers.ui),
			tags.deathScreen,
		])
	})

	let continued = false
	const continueRun = () => {
		if (continued) return
		continued = true
		onContinue?.()
	}
	const buttonWidth = 260
	const buttonY = Math.min(
		k.height() - 52,
		runSummary ? k.height() / 2 + 286 : k.height() / 2 + 130
	)
	createUiActionButton(screen, {
		pos: k.vec2(k.width() / 2 - buttonWidth / 2, buttonY),
		size: k.vec2(buttonWidth, 36),
		text: "CONTINUE",
		promptAction: "confirm",
		onClick: continueRun,
	})
	const enterController = k.onKeyPress("enter", continueRun)
	screen.onDestroy(() => enterController.cancel())
}

function addAnimatedDepositPanel(screen: ReturnType<typeof k.add>, summary: RunEndSummary) {
	const panelSize = k.vec2(Math.min(600, k.width() - 40), 250)
	const panel = createUiPanel({
		pos: k.center().add(0, 105),
		size: panelSize,
		anchor: "center",
		layer: layers.ui,
		tags: [tags.deathScreen],
	})
	const left = -panelSize.x / 2
	const top = -panelSize.y / 2
	createUiSectionHeader(panel, {
		pos: k.vec2(left + 1, top + 1),
		width: panelSize.x - 2,
		height: 52,
		eyebrow: "DESTROYED EXPEDITION",
		title: "SALVAGE DEPOSIT",
	})
	const depositValue = addThemedText(panel, {
		text: "+0",
		pos: k.vec2(-130, top + 66),
		variant: "display",
		size: UI_FONT_SIZES.hero,
		width: 260,
		align: "center",
		color: k.rgb(...UI_COLORS.success),
	})
	depositValue.use(k.scale(1))
	addThemedText(panel, {
		text: "DEBRIS DEPOSITED",
		pos: k.vec2(-130, top + 104),
		variant: "caption",
		width: 260,
		align: "center",
	})
	const progressBar = createUiProgressBar(panel, {
		pos: k.vec2(left + 32, top + 132),
		width: panelSize.x - 64,
		height: 6,
		value: getProgressAtXp(summary.hub.previousXp),
	})
	const xpLabel = addThemedText(panel, {
		text: "",
		pos: k.vec2(left + 32, top + 146),
		variant: "muted",
		width: panelSize.x - 64,
		align: "right",
	})
	const levelLabel = addThemedText(panel, {
		text: `HUB LEVEL ${summary.hub.previousLevel}`,
		pos: k.vec2(left + 32, top + 174),
		variant: "body",
		width: panelSize.x - 64,
	})
	createUiTelemetryStrip(panel, {
		pos: k.vec2(left + 32, top + 198),
		width: panelSize.x - 64,
		gap: 12,
		items: [
			{
				label: "RUN TIME",
				value: summary.run
					? formatDuration(summary.run.durationSeconds)
					: "--:--",
			},
			{ label: "KILLS", value: `${summary.run?.kills ?? 0}` },
			{ label: "REWARDS", value: `${summary.run?.rewardsCollected ?? 0}` },
			{
				label: "DEBRIS LOST",
				value: `${summary.debree.lost}`,
				valueColor: k.rgb(...UI_COLORS.danger),
			},
		],
	})

	let elapsed = 0
	let lastCount = -1
	let lastTickAt = 0
	let displayedLevel = summary.hub.previousLevel
	let finished = false
	const countDuration = Math.min(1.8, 0.85 + summary.debree.deposited * 0.012)
	screen.onUpdate(() => {
		if (!panel.exists()) return
		elapsed += k.dt()
		const rawProgress = k.clamp(
			(elapsed - DEPOSIT_COUNT_DELAY) / countDuration,
			0,
			1
		)
		const eased = 1 - Math.pow(1 - rawProgress, 3)
		const count = Math.round(summary.debree.deposited * eased)
		const xp = summary.hub.previousXp + count
		const level = getHubLevelForDeposited(xp)
		const next = HUB_LEVELS.find((candidate) => candidate.level === level + 1)
		depositValue.text = `+${count}`
		levelLabel.text = level > summary.hub.previousLevel
			? `HUB LEVEL ${summary.hub.previousLevel}  >  ${level}`
			: `HUB LEVEL ${level}`
		xpLabel.text = next
			? `${xp} / ${next.requiredDeposited} HUB XP  //  ${Math.max(0, next.requiredDeposited - xp)} NEEDED`
			: `${xp} HUB XP  //  MAXIMUM LEVEL`
		progressBar.setValue(getProgressAtXp(xp))

		if (count !== lastCount) {
			lastCount = count
			depositValue.scale = k.vec2(1.1)
			if (elapsed - lastTickAt >= 0.075 && rawProgress < 1) {
				lastTickAt = elapsed
				audioService.playSound("collect1", {
					volume: mainSoundVolume * 0.12,
					detune: Math.round(k.lerp(-250, 550, rawProgress)),
				})
			}
		}
		depositValue.scale = k.vec2(k.lerp(depositValue.scale.x, 1, k.dt() * 12))
		if (level > displayedLevel) {
			displayedLevel = level
			k.shake(4)
			audioService.playSound("high_rarity_reveal", {
				volume: mainSoundVolume * 0.55,
				detune: level * 80,
			})
		}
		if (rawProgress >= 1 && !finished) {
			finished = true
			audioService.playSound("purchase1", {
				volume: mainSoundVolume * 0.7,
			})
			if (summary.hub.currentLevel > summary.hub.previousLevel) {
				levelLabel.color = k.rgb(...UI_COLORS.success)
			}
		}
	})
}

function formatDuration(durationSeconds: number) {
	const minutes = Math.floor(durationSeconds / 60)
	const seconds = durationSeconds % 60
	return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

function getProgressAtXp(xp: number) {
	const level = getHubLevelForDeposited(xp)
	const current = getHubLevelDefinition(level)
	const next = HUB_LEVELS.find((definition) => definition.level === level + 1)
	if (!next) return 1
	return k.clamp(
		(xp - current.requiredDeposited) /
			(next.requiredDeposited - current.requiredDeposited),
		0,
		1
	)
}

export function hideDeathScreen() {
	const roots = k.get(tags.deathScreen)
	for (const root of roots) {
		if (root.exists()) root.destroy()
	}
}
