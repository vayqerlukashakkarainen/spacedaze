import type { GameObj } from "kaplay"
import { k, layers } from "../main"
import { tags } from "../tags"
import {
	addThemedText,
	createUiCommandButton,
	createUiPanel,
	createUiSectionHeader,
	createUiSurface,
	UI_COLORS,
} from "./common"
import { createUiVolumeControls } from "./volumeControls"
import {
	playShopMenuCloseSound,
	playShopMenuOpenSound,
} from "../services/shopMenuSoundService"

interface PauseMenuActions {
	onResume: () => void
	onExitRun?: () => void
	onQuit: () => void
}

const PAUSE_WIDTH = 620
const PAUSE_HEIGHT = 360
const CONTENT_TOP = 68
const CONTENT_HEIGHT = 276
const COMMAND_LEFT = 16
const COMMAND_WIDTH = 248
const AUDIO_LEFT = 276
const AUDIO_WIDTH = 328

export function showPauseMenu({
	onResume,
	onExitRun,
	onQuit,
}: PauseMenuActions) {
	if (k.get(tags.pauseMenu).length > 0) return
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

	createUiSurface(root, {
		pos: k.vec2(AUDIO_LEFT, CONTENT_TOP),
		size: k.vec2(AUDIO_WIDTH, CONTENT_HEIGHT),
		tone: "raised",
	})
	createUiVolumeControls(root, {
		pos: k.vec2(AUDIO_LEFT, CONTENT_TOP),
		width: AUDIO_WIDTH,
	})
	addThemedText(root, {
		pos: k.vec2(AUDIO_LEFT + 12, CONTENT_TOP + 202),
		text: "AUDIO ROUTING REMAINS LIVE WHILE FLIGHT SYSTEMS ARE SUSPENDED.",
		variant: "muted",
		width: AUDIO_WIDTH - 24,
		lineHeight: 1.35,
	})
	addThemedText(root, {
		pos: k.vec2(AUDIO_LEFT + 12, CONTENT_TOP + 249),
		text: "STATUS  //  HOLDING POSITION",
		variant: "caption",
		width: AUDIO_WIDTH - 24,
	})
}

function addSessionCommands(
	parent: GameObj,
	actions: PauseMenuActions
) {
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
		addCommand("EXIT RUN", "RETURN TO HUB", actions.onExitRun)
	}
	addCommand("QUIT", "MAIN MENU", actions.onQuit)

	addThemedText(parent, {
		pos: k.vec2(COMMAND_LEFT + 12, CONTENT_TOP + 249),
		text: actions.onExitRun
			? "EXIT RUN ABANDONS CURRENT EXPEDITION"
			: "HUB SESSION ACTIVE",
		variant: actions.onExitRun ? "muted" : "caption",
		width: COMMAND_WIDTH - 24,
	})
}

export function hidePauseMenu() {
	if (k.get(tags.pauseMenu).length === 0) return
	playShopMenuCloseSound()
	k.destroyAll(tags.pauseMenu)
}
