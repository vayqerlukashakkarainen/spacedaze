import type { GameObj } from "kaplay"
import { k, layers } from "../main"
import { tags } from "../tags"
import {
	addThemedText,
	createUiCommandButton,
	createUiPanel,
	createUiSectionHeader,
	createUiSurface,
	showUiConfirmationDialog,
	UI_COLORS,
} from "./common"
import type { UiConfirmationDialogController } from "./common"
import { createUiOptionsPanel } from "./optionsPanel"
import {
	playShopMenuCloseSound,
	playShopMenuOpenSound,
} from "../services/shopMenuSoundService"
import { uiState } from "./uiState"

interface PauseMenuActions {
	onResume: () => void
	onExitRun?: () => void
	onQuit: () => void
}

const PAUSE_WIDTH = 720
const PAUSE_HEIGHT = 450
const CONTENT_TOP = 68
const CONTENT_HEIGHT = 366
const COMMAND_LEFT = 16
const COMMAND_WIDTH = 252
const OPTIONS_LEFT = 280
const OPTIONS_WIDTH = 424
let confirmationDialog: UiConfirmationDialogController | undefined

export function showPauseMenu({
	onResume,
	onExitRun,
	onQuit,
}: PauseMenuActions) {
	if (k.get(tags.pauseMenu).length > 0) return
	uiState.pauseMenuOpen = true
	playShopMenuOpenSound()
	const scale = Math.min(
		1,
		(k.width() - 24) / PAUSE_WIDTH,
		(k.height() - 24) / PAUSE_HEIGHT
	)
	const pauseTags = [tags.pauseMenu]

	k.add([
		k.rect(k.width(), k.height()),
		k.pos(0, 0),
		k.color(...UI_COLORS.background),
		k.opacity(0.82),
		k.fixed(),
		k.layer(layers.ui),
		...pauseTags,
	])

	const root = createUiPanel({
		pos: k.vec2(
			(k.width() - PAUSE_WIDTH * scale) / 2,
			(k.height() - PAUSE_HEIGHT * scale) / 2
		),
		size: k.vec2(PAUSE_WIDTH, PAUSE_HEIGHT),
		frameless: true,
		scale,
		tags: pauseTags,
	})
	createUiSurface(root, {
		pos: k.vec2(0, 0),
		size: k.vec2(PAUSE_WIDTH, PAUSE_HEIGHT),
		tone: "default",
		opacity: 0.98,
	})
	createUiSectionHeader(root, {
		pos: k.vec2(0, 0),
		width: PAUSE_WIDTH,
		eyebrow: "FLIGHT CONTROL",
		title: "SIMULATION PAUSED",
		action: "ESC  RESUME",
	})

	createUiSurface(root, {
		pos: k.vec2(COMMAND_LEFT, CONTENT_TOP),
		size: k.vec2(COMMAND_WIDTH, CONTENT_HEIGHT),
		tone: "raised",
	})
	createUiSectionHeader(root, {
		pos: k.vec2(COMMAND_LEFT, CONTENT_TOP),
		width: COMMAND_WIDTH,
		eyebrow: "NAVIGATION",
		title: "SESSION CONTROL",
	})
	addSessionCommands(root, { onResume, onExitRun, onQuit })

	createUiOptionsPanel(root, {
		pos: k.vec2(OPTIONS_LEFT, CONTENT_TOP),
		width: OPTIONS_WIDTH,
		height: CONTENT_HEIGHT,
	})
}

function addSessionCommands(
	parent: GameObj,
	actions: PauseMenuActions
) {
	const showConfirmation = (
		title: string,
		message: string,
		confirmText: string,
		cancelText: string,
		onConfirm: () => void
	) => {
		if (confirmationDialog?.isOpen()) return
		confirmationDialog = showUiConfirmationDialog({
			title,
			message,
			confirmText,
			cancelText,
			onConfirm: () => {
				confirmationDialog = undefined
				onConfirm()
			},
			onCancel: () => {
				confirmationDialog = undefined
			},
		})
	}
	const buttonLeft = COMMAND_LEFT + 12
	const buttonWidth = COMMAND_WIDTH - 24
	const buttonHeight = 42
	let buttonY = CONTENT_TOP + 64
	let commandIndex = 1

	const addCommand = (
		text: string,
		trailingText: string,
		onClick: () => void,
		selected = false
	) => {
		createUiCommandButton(parent, {
			pos: k.vec2(buttonLeft, buttonY),
			size: k.vec2(buttonWidth, buttonHeight),
			index: commandIndex.toString().padStart(2, "0"),
			text,
			trailingText,
			selected,
			onClick,
		})
		buttonY += 52
		commandIndex++
	}

	addCommand("RESUME", ">", actions.onResume, true)
	if (actions.onExitRun) {
		addCommand("QUIT RUN", "", () => showConfirmation(
			"QUIT CURRENT RUN?",
			"ALL CARRIED SALVAGE AND CURRENT EXPEDITION PROGRESS WILL BE LOST. RETURN TO THE HUB?",
			"QUIT RUN",
			"KEEP FLYING",
			actions.onExitRun!
		))
	}
	addCommand("QUIT", "", () => showConfirmation(
		"QUIT TO MAIN MENU?",
		"LEAVE THE CURRENT SESSION AND RETURN TO THE MAIN MENU? SAVED PROGRESS WILL BE KEPT.",
		"QUIT",
		"STAY",
		actions.onQuit
	))

	addThemedText(parent, {
		pos: k.vec2(COMMAND_LEFT + 12, CONTENT_TOP + CONTENT_HEIGHT - 27),
		text: actions.onExitRun
			? "QUIT RUN ABANDONS CURRENT EXPEDITION"
			: "HUB SESSION ACTIVE",
		variant: actions.onExitRun ? "muted" : "caption",
		width: COMMAND_WIDTH - 24,
	})
}

export function hidePauseMenu() {
	uiState.pauseMenuOpen = false
	confirmationDialog?.close()
	confirmationDialog = undefined
	if (k.get(tags.pauseMenu).length === 0) return
	playShopMenuCloseSound()
	k.destroyAll(tags.pauseMenu)
}
