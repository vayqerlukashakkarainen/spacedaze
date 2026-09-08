import type { GameObj, Vec2 } from "kaplay"
import { k } from "../main"
import {
	getPostProcessingEnabled,
	getScreenFlashIntensity,
	getScreenShakeIntensity,
	setPostProcessingEnabled,
	setScreenFlashIntensity,
	setScreenShakeIntensity,
} from "../services/displaySettingsService"
import {
	addThemedText,
	createUiActionButton,
	createUiScrollable,
	createUiSectionHeader,
	createUiSlider,
	createUiSurface,
	UI_COLORS,
} from "./common"
import { createUiVolumeControls } from "./volumeControls"

interface UiOptionsPanelProps {
	pos: Vec2
	width: number
	height: number
}

const CONTENT_HEIGHT = 566

export function createUiOptionsPanel(
	parent: GameObj,
	{ pos, width, height }: UiOptionsPanelProps
) {
	const panel = parent.add([k.pos(pos)])
	createUiSurface(panel, {
		pos: k.vec2(0, 0),
		size: k.vec2(width, height),
		tone: "raised",
		opacity: 0.98,
	})
	const scrollable = createUiScrollable({
		parent: panel,
		pos: k.vec2(8, 8),
		width: width - 16,
		height: height - 16,
		contentHeight: CONTENT_HEIGHT,
		captureWheel: true,
		scrollStep: 34,
	})
	const contentWidth = width - 29
	const handleVisible = (screenPosition: Vec2) => {
		const topLeft = scrollable.obj.toScreen(k.vec2(0, 0))
		const bottomRight = scrollable.obj.toScreen(
			k.vec2(width - 16, height - 16)
		)
		return screenPosition.x >= topLeft.x &&
			screenPosition.x <= bottomRight.x &&
			screenPosition.y >= topLeft.y &&
			screenPosition.y <= bottomRight.y
	}
	createUiVolumeControls(scrollable.content, {
		pos: k.vec2(0, 0),
		width: contentWidth,
		sliderHandleVisible: handleVisible,
	})
	addDisplayControls(scrollable.content, 190, contentWidth, handleVisible)
	addControlReference(scrollable.content, 430, contentWidth)
	scrollable.scrollToStart()
	return panel
}

function addDisplayControls(
	parent: GameObj,
	y: number,
	width: number,
	handleVisible: (screenPosition: Vec2) => boolean
) {
	createUiSectionHeader(parent, {
		pos: k.vec2(0, y),
		width,
		eyebrow: "VIDEO / COMFORT",
		title: "DISPLAY SYSTEMS",
		action: "AUTO-SAVE",
	})
	const fullscreenStatus = addThemedText(parent, {
		pos: k.vec2(0, y + 70),
		text: fullscreenStatusText(),
		variant: "caption",
		width,
		align: "right",
	})
	createUiActionButton(parent, {
		pos: k.vec2(0, y + 58),
		size: k.vec2(Math.min(190, width - 110), 32),
		text: "TOGGLE FULLSCREEN",
		onClick: () => {
			const fullscreen = !k.isFullscreen()
			k.setFullscreen(fullscreen)
			fullscreenStatus.text = fullscreen ? "FULLSCREEN" : "WINDOWED"
			k.wait(0.2, () => {
				if (!fullscreenStatus.exists()) return
				fullscreenStatus.text = fullscreenStatusText()
			})
		},
	})

	const shakeLabel = addThemedText(parent, {
		pos: k.vec2(0, y + 101),
		text: intensityLabel("SCREEN SHAKE", getScreenShakeIntensity()),
		variant: "muted",
		width,
	})
	createUiSlider(parent, {
		pos: k.vec2(0, y + 120),
		width,
		value: getScreenShakeIntensity(),
		handleVisible,
		onChange: (value) => {
			setScreenShakeIntensity(value)
			shakeLabel.text = intensityLabel("SCREEN SHAKE", value)
		},
	})

	const flashLabel = addThemedText(parent, {
		pos: k.vec2(0, y + 142),
		text: intensityLabel("SCREEN FLASH", getScreenFlashIntensity()),
		variant: "muted",
		width,
	})
	createUiSlider(parent, {
		pos: k.vec2(0, y + 161),
		width,
		value: getScreenFlashIntensity(),
		handleVisible,
		onChange: (value) => {
			setScreenFlashIntensity(value)
			flashLabel.text = intensityLabel("SCREEN FLASH", value)
		},
	})

	const postProcessingStatus = addThemedText(parent, {
		pos: k.vec2(0, y + 211),
		text: postProcessingStatusText(),
		variant: "caption",
		width,
		align: "right",
	})
	createUiActionButton(parent, {
		pos: k.vec2(0, y + 199),
		size: k.vec2(Math.min(190, width - 140), 32),
		text: "TOGGLE POST FX",
		onClick: () => {
			setPostProcessingEnabled(!getPostProcessingEnabled())
			postProcessingStatus.text = postProcessingStatusText()
		},
	})
}

function addControlReference(parent: GameObj, y: number, width: number) {
	createUiSectionHeader(parent, {
		pos: k.vec2(0, y),
		width,
		eyebrow: "INPUT REFERENCE",
		title: "FLIGHT CONTROLS",
	})
	addThemedText(parent, {
		pos: k.vec2(0, y + 61),
		text: [
			"MOVE  W A S D    BOOST  SHIFT",
			"FIRE  LEFT MOUSE    ARSENAL  Q / E",
			"SECONDARY  RIGHT MOUSE    MOBILITY  SPACE",
			"ULTIMATE  R",
			"INTERACT  F    TACTICAL MAP  TAB",
		].join("\n"),
		variant: "body",
		width,
		lineHeight: 1.5,
		color: k.rgb(...UI_COLORS.text),
	})
}

function intensityLabel(label: string, value: number) {
	return `${label}: ${Math.round(value * 100)}%`
}

function fullscreenStatusText() {
	return k.isFullscreen() ? "FULLSCREEN" : "WINDOWED"
}

function postProcessingStatusText() {
	return getPostProcessingEnabled() ? "ENHANCED" : "PERFORMANCE"
}
