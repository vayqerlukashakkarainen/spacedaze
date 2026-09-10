import { k, layers, mainSoundVolume } from "../main"
import type { PlayerDeathCause } from "../services/combat/damageService"
import {
	getHubLevelDefinition,
	getHubLevelForDeposited,
	HUB_LEVELS,
} from "../services/hub/hubProgressService"
import type { RunEndSummary } from "../services/runs/runCompletionService"
import { gameSoundService } from "../services/audio/gameSoundService"
import { tags } from "../tags"
import { uiState } from "./uiState"
import {
	addThemedText,
	createUiActionButton,
	createUiPanel,
	createUiProgressBar,
	createUiScrollable,
	createUiSectionHeader,
	createUiTelemetryStrip,
	UI_COLORS,
	UI_FONT_SIZES,
} from "./common"

const KILLER_REVEAL_DELAY = 1
const DEPOSIT_COUNT_DELAY = 0.25
const LEVEL_CELEBRATION_INTERVAL = 0.18
const LEVEL_CELEBRATION_PARTICLES = 48

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

export function showRunClearScreen(
	summary: RunEndSummary,
	onContinue: () => void,
	options: {
		title?: string
		subtitle?: string
		continueText?: string
	} = {}
) {
	hideDeathScreen()
	uiState.modalOpen = true
	const screen = k.add([
		k.rect(k.width(), k.height()),
		k.pos(0, 0),
		k.color(0, 0, 0),
		k.opacity(0.82),
		k.fixed(),
		k.layer(layers.ui),
		tags.deathScreen,
	])

	k.add([
		k.text(options.title ?? "RUN CLEARED", {
			font: "",
			size: UI_FONT_SIZES.death,
		}),
		k.pos(k.center().add(0, -210)),
		k.anchor("center"),
		k.color(k.WHITE),
		k.fixed(),
		k.layer(layers.ui),
		tags.deathScreen,
	])
	k.add([
		k.text(options.subtitle ?? "WORMHOLE EXIT SECURED", {
			font: "unscii",
			size: UI_FONT_SIZES.subheading,
		}),
		k.pos(k.center().add(0, -162)),
		k.anchor("center"),
		k.color(...UI_COLORS.accent),
		k.fixed(),
		k.layer(layers.ui),
		tags.deathScreen,
	])

	addAnimatedDepositPanel(screen, summary)

	let continued = false
	const continueToHub = () => {
		if (continued) return
		continued = true
		hideDeathScreen()
		onContinue()
	}
	const buttonWidth = 260
	createUiActionButton(screen, {
		pos: k.vec2(
			k.width() / 2 - buttonWidth / 2,
			Math.min(k.height() - 52, k.height() / 2 + 286)
		),
		size: k.vec2(buttonWidth, 36),
		text: options.continueText ?? "RETURN TO HUB",
		promptAction: "confirm",
		onClick: continueToHub,
	})
	const enterController = k.onKeyPress("enter", continueToHub)
	screen.onDestroy(() => {
		enterController.cancel()
		uiState.modalOpen = false
	})
}

function addAnimatedDepositPanel(screen: ReturnType<typeof k.add>, summary: RunEndSummary) {
	const showsLevelUnlocks = summary.hub.currentLevel > summary.hub.previousLevel
	const panelSize = k.vec2(
		Math.min(600, k.width() - 40),
		showsLevelUnlocks ? 296 : 250
	)
	const panelPos = k.center().add(0, showsLevelUnlocks ? 82 : 105)
	const levelBurst = createLevelCelebrationEmitter(panelPos)
	const panel = createUiPanel({
		pos: panelPos,
		size: panelSize,
		anchor: "center",
		layer: layers.ui,
		animated: true,
		tags: [tags.deathScreen],
	})
	const left = -panelSize.x / 2
	const top = -panelSize.y / 2
	createUiSectionHeader(panel, {
		pos: k.vec2(left + 1, top + 1),
		width: panelSize.x - 2,
		height: 52,
		eyebrow: `${summary.outcome} EXPEDITION`,
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
		text: "SALVAGE DEPOSITED",
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
	const unlockScroll = showsLevelUnlocks
		? createUiScrollable({
			parent: panel,
			pos: k.vec2(left + 32, top + 196),
			width: panelSize.x - 64,
			height: 48,
			contentHeight: 48,
			scrollStep: 20,
			captureWheel: true,
			tags: [tags.deathScreen],
		})
		: undefined
	const unlockHeader = unlockScroll
		? addThemedText(unlockScroll.content, {
			text: "",
			pos: k.vec2(0, 2),
			variant: "caption",
			width: panelSize.x - 72,
			color: k.rgb(...UI_COLORS.success),
		})
		: undefined
	const unlockList = unlockScroll
		? addThemedText(unlockScroll.content, {
			text: "",
			pos: k.vec2(0, 20),
			variant: "body",
			size: UI_FONT_SIZES.small,
			width: panelSize.x - 72,
			color: k.WHITE,
		})
		: undefined
	if (unlockHeader) unlockHeader.hidden = true
	if (unlockList) unlockList.hidden = true
	createUiTelemetryStrip(panel, {
		pos: k.vec2(left + 32, top + (showsLevelUnlocks ? 248 : 198)),
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
			summary.outcome === "EXTRACTED"
				? {
					label: "HIGHEST RARITY",
					value: summary.run?.highestRarity ?? "NONE",
					valueColor: k.rgb(...UI_COLORS.accent),
				}
				: {
					label: "SALVAGE LOST",
					value: `${summary.debree.lost}`,
					valueColor: k.rgb(...UI_COLORS.danger),
				},
		],
	})

	let elapsed = 0
	let lastCount = -1
	let lastTickAt = 0
	let celebratedLevel = summary.hub.previousLevel
	let displayedUnlockLevel = summary.hub.previousLevel
	let nextLevelCelebrationAt = 0
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
		if (
			unlockHeader &&
			unlockList &&
			level !== displayedUnlockLevel
		) {
			displayedUnlockLevel = level
			const unlocks = level > summary.hub.previousLevel
				? getHubLevelDefinition(level).unlocks
				: []
			unlockHeader.hidden = unlocks.length === 0
			unlockList.hidden = unlocks.length === 0
			unlockHeader.text = unlocks.length > 0
				? `NEW HUB UNLOCKS  //  LEVEL ${level}`
				: ""
			unlockList.text = unlocks.join("  //  ")
			unlockScroll?.setContentHeight(
				unlocks.length > 0
					? unlockList.pos.y + unlockList.height + 4
					: 48
			)
			unlockScroll?.scrollToStart()
		}
		xpLabel.text = next
			? `${xp} / ${next.requiredDeposited} HUB XP  //  ${Math.max(0, next.requiredDeposited - xp)} NEEDED`
			: `${xp} HUB XP  //  MAXIMUM LEVEL`
		progressBar.setValue(getProgressAtXp(xp))

		if (count !== lastCount) {
			lastCount = count
			depositValue.scale = k.vec2(1.1)
			if (elapsed - lastTickAt >= 0.075 && rawProgress < 1) {
				lastTickAt = elapsed
				gameSoundService.play("collect1", {
					volume: mainSoundVolume * 0.12,
					detune: Math.round(k.lerp(-250, 550, rawProgress)),
				})
			}
		}
		depositValue.scale = k.vec2(k.lerp(depositValue.scale.x, 1, k.dt() * 12))
		if (level > celebratedLevel && elapsed >= nextLevelCelebrationAt) {
			celebratedLevel++
			nextLevelCelebrationAt = elapsed + LEVEL_CELEBRATION_INTERVAL
			playLevelCelebration(panel, levelBurst, celebratedLevel)
		}
		if (
			rawProgress >= 1 &&
			celebratedLevel >= summary.hub.currentLevel &&
			!finished
		) {
			finished = true
			gameSoundService.play("purchase1", {
				volume: mainSoundVolume * 0.7,
			})
			if (summary.hub.currentLevel > summary.hub.previousLevel) {
				levelLabel.color = k.rgb(...UI_COLORS.success)
			}
		}
	})
}

function createLevelCelebrationEmitter(pos: ReturnType<typeof k.vec2>) {
	const particleSprite = k.getSprite("particle4")
	if (!particleSprite?.data) return undefined
	return k.add([
		k.pos(pos),
		k.fixed(),
		k.layer(layers.ui),
		k.opacity(1),
		k.particles(
			{
				max: LEVEL_CELEBRATION_PARTICLES * Math.max(2, HUB_LEVELS.length),
				speed: [260, 520],
				angle: [0, 360],
				angularVelocity: [-240, 240],
				lifeTime: [0.55, 0.95],
				colors: [
					k.WHITE,
					k.rgb(...UI_COLORS.success),
					k.rgb(...UI_COLORS.accent),
				],
				opacities: [1, 0.9, 0],
				scales: [0.8, 1.8, 0.15],
				damping: [1.5, 3.5],
				texture: particleSprite.data.frames[0].tex,
				quads: [particleSprite.data.frames[0].q],
			},
			{
				rate: 0,
				direction: 0,
				spread: 360,
				position: k.vec2(0),
			}
		),
		tags.deathScreen,
	])
}

function playLevelCelebration(
	panel: ReturnType<typeof createUiPanel>,
	burst: ReturnType<typeof createLevelCelebrationEmitter>,
	level: number
) {
	if (!panel.exists()) return
	panel.animation.seek(0)
	panel.animate(
		"scale",
		[k.vec2(1), k.vec2(1.075), k.vec2(0.985), k.vec2(1)],
		{
			duration: 0.32,
			loops: 1,
			timing: [0, 0.34, 0.72, 1],
			easing: k.easings.easeOutCubic,
		}
	)

	burst?.emit(LEVEL_CELEBRATION_PARTICLES)

	k.shake(4)
	gameSoundService.play("high_rarity_reveal", {
		volume: mainSoundVolume * 0.55,
		detune: level * 80,
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
