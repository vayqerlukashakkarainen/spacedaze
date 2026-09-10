import type { GameObj, KEventController } from "kaplay"
import { k, layers } from "../main"
import { loopService } from "../services/core/loopService"
import {
	depositCarriedDebree,
	getCarriedDebree,
	getDepositedDebree,
} from "../services/economy/debreeEconomyService"
import { tags } from "../tags"
import {
	addThemedText,
	createUiCommandButton,
	createUiPanel,
	createUiTelemetryStrip,
	playUiModalClose,
	playUiModalOpen,
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
let closing = false
let pausedObjects = new Set<GameObj>()
let escapeController: KEventController | undefined
let activeBackdrop: GameObj | undefined
let activePanel: GameObj | undefined

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
		k.animate(),
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
		animated: true,
		tags: [tags.debreeDepositUi],
	})
	activeBackdrop = backdrop
	activePanel = panel
	playUiModalOpen(backdrop, panel, {
		panelPos: k.center(),
		backdropOpacity: 0.82,
	})
	panel.use(uiHitRegion(k.vec2(PANEL_WIDTH, PANEL_HEIGHT), true))
	panel.onClick(() => {})

	addThemedText(panel, {
		pos: k.vec2(-226, -104),
		text: "SALVAGE RELAY",
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
		text: "DEPOSITED SALVAGE SURVIVES DEATH. KEEP SOME CARRIED TO BUY RUN UPGRADES.",
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
		closeDebreeDepositPanel(true, () => options.onDeposit(amount))
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
		onClick: () => hideDebreeDepositPanel(),
	})

	backdrop.onClick(() => hideDebreeDepositPanel())
	escapeController = k.onKeyPress("escape", () => hideDebreeDepositPanel())
	return true
}

export function hideDebreeDepositPanel(animate = true) {
	closeDebreeDepositPanel(animate)
}

function closeDebreeDepositPanel(
	animate: boolean,
	onClosed?: () => void
) {
	if (!open || closing) return
	if (!animate || !activeBackdrop?.exists() || !activePanel?.exists()) {
		finishClosingDebreeDepositPanel(onClosed)
		return
	}
	closing = true
	const backdrop = activeBackdrop
	const panel = activePanel
	void playUiModalClose(backdrop, panel, {
		panelPos: k.center(),
		backdropOpacity: 0.82,
	}).then(() => finishClosingDebreeDepositPanel(onClosed))
}

function finishClosingDebreeDepositPanel(onClosed?: () => void) {
	open = false
	closing = false
	uiState.modalOpen = false
	escapeController?.cancel()
	escapeController = undefined
	k.destroyAll(tags.debreeDepositUi)
	activeBackdrop = undefined
	activePanel = undefined
	for (const object of pausedObjects) {
		if (object.exists()) object.paused = false
	}
	pausedObjects.clear()
	loopService.resumeAll()
	onClosed?.()
}
