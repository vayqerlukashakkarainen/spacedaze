import type { GameObj, KEventController } from "kaplay"
import { k, layers } from "../main"
import { loopService } from "../services/loopService"
import {
	depositCarriedDebree,
	getCarriedDebree,
	getDepositedDebree,
} from "../services/debreeEconomyService"
import { tags } from "../tags"
import {
	addThemedText,
	createUiCommandButton,
	createUiPanel,
	createUiTelemetryStrip,
	uiHitRegion,
	UI_COLORS,
} from "./common"
import { uiState } from "./uiState"

interface DebreeDepositPanelOptions {
	onDeposit: (amount: number) => void
}

const PANEL_WIDTH = 520
const PANEL_HEIGHT = 270
let open = false
let pausedObjects = new Set<GameObj>()
let escapeController: KEventController | undefined

export function debreeDepositPanelOpen() {
	return open
}

export function showDebreeDepositPanel(options: DebreeDepositPanelOptions) {
	if (open || getCarriedDebree() <= 0) return false
	open = true
	uiState.modalOpen = true
	pausedObjects = new Set()
	for (const object of k.get<GameObj>(tags.gameLoop)) {
		if (object.paused) continue
		object.paused = true
		pausedObjects.add(object)
	}
	loopService.pauseAll()

	const backdrop = k.add([
		k.pos(0, 0),
		k.rect(k.width(), k.height()),
		k.color(...UI_COLORS.background),
		k.opacity(0.82),
		k.fixed(),
		k.layer(layers.uiEffects),
		uiHitRegion(k.vec2(k.width(), k.height())),
		tags.debreeDepositUi,
	])
	const panel = createUiPanel({
		pos: k.center(),
		size: k.vec2(PANEL_WIDTH, PANEL_HEIGHT),
		anchor: "center",
		layer: layers.uiEffects,
		tags: [tags.debreeDepositUi],
	})
	panel.use(uiHitRegion(k.vec2(PANEL_WIDTH, PANEL_HEIGHT), true))
	panel.onClick(() => {})

	addThemedText(panel, {
		pos: k.vec2(-226, -104),
		text: "DEBREE RELAY",
		variant: "eyebrow",
		color: k.rgb(...UI_COLORS.success),
	})
	addThemedText(panel, {
		pos: k.vec2(-226, -78),
		text: "SECURE YOUR HAUL",
		variant: "display",
		size: 20,
	})
	addThemedText(panel, {
		pos: k.vec2(-226, -44),
		text: "DEPOSITED DEBREE SURVIVES DEATH. KEEP SOME CARRIED TO BUY RUN UPGRADES.",
		variant: "muted",
		width: 452,
		size: 9,
	})
	createUiTelemetryStrip(panel, {
		pos: k.vec2(-218, 2),
		width: 436,
		gap: 12,
		items: [
			{ label: "CARRIED", value: `${getCarriedDebree()}` },
			{ label: "SAFE", value: `${getDepositedDebree()}` },
		],
	})

	const deposit = (ratio: number) => {
		const carried = getCarriedDebree()
		const requested = ratio >= 1
			? carried
			: Math.max(1, Math.floor(carried * ratio))
		const amount = depositCarriedDebree(requested)
		if (amount <= 0) return
		hideDebreeDepositPanel()
		options.onDeposit(amount)
	}
	for (const [index, choice] of [
		{ label: "25%", ratio: 0.25 },
		{ label: "50%", ratio: 0.5 },
		{ label: "ALL", ratio: 1 },
	].entries()) {
		createUiCommandButton(panel, {
			pos: k.vec2(-226 + index * 152, 62),
			size: k.vec2(140, 38),
			index: `0${index + 1}`,
			text: choice.label,
			onClick: () => deposit(choice.ratio),
		})
	}
	createUiCommandButton(panel, {
		pos: k.vec2(-226, 102),
		size: k.vec2(444, 30),
		index: "ESC",
		text: "KEEP CARRYING",
		onClick: hideDebreeDepositPanel,
	})

	backdrop.onClick(hideDebreeDepositPanel)
	escapeController = k.onKeyPress("escape", hideDebreeDepositPanel)
	return true
}

export function hideDebreeDepositPanel() {
	if (!open) return
	open = false
	uiState.modalOpen = false
	escapeController?.cancel()
	escapeController = undefined
	k.destroyAll(tags.debreeDepositUi)
	for (const object of pausedObjects) {
		if (object.exists()) object.paused = false
	}
	pausedObjects.clear()
	loopService.resumeAll()
}
