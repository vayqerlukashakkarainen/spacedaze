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
	beginInputBindingCapture,
	cancelInputBindingCapture,
	formatInputBinding,
	getInputActionDefinition,
	getInputBinding,
	INPUT_ACTIONS,
	resetInputBindings,
	type InputActionId,
	type InputController,
} from "../services/inputBindingService"
import {
	addThemedText,
	createUiActionButton,
	createUiScrollable,
	createUiSectionHeader,
	createUiSlider,
	createUiSurface,
} from "./common"
import { createUiVolumeControls } from "./volumeControls"

interface UiOptionsPanelProps {
	pos: Vec2
	width: number
	height: number
}

type OptionsTab = "Audio" | "Video" | "Bindings"

const OPTIONS_TABS: readonly OptionsTab[] = ["Audio", "Video", "Bindings"]
const TAB_GAP = 4
const TAB_HEIGHT = 34
const PANEL_PADDING = 8
const CONTENT_TOP = 50

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

	let activeTab: OptionsTab = "Audio"
	let activeView: GameObj | undefined
	let captureAction: InputActionId | undefined
	let captureController: InputController | undefined
	let bindingStatus = "CLICK A BINDING TO CHANGE IT"
	let destroyed = false

	const stopCapture = () => {
		captureController?.cancel()
		captureController = undefined
		captureAction = undefined
	}

	const render = () => {
		if (destroyed || !panel.exists()) return
		if (activeView?.exists()) k.destroy(activeView)
		activeView = panel.add([k.pos(0, 0)])
		const view = activeView
		const innerWidth = width - PANEL_PADDING * 2
		const tabWidth = (innerWidth - TAB_GAP * (OPTIONS_TABS.length - 1)) /
			OPTIONS_TABS.length
		for (const [index, tab] of OPTIONS_TABS.entries()) {
			createUiActionButton(view, {
				pos: k.vec2(
					PANEL_PADDING + index * (tabWidth + TAB_GAP),
					PANEL_PADDING
				),
				size: k.vec2(tabWidth, TAB_HEIGHT),
				text: tab.toUpperCase(),
				selected: activeTab === tab,
				onClick: () => {
					if (activeTab === tab) return
					stopCapture()
					activeTab = tab
					bindingStatus = "CLICK A BINDING TO CHANGE IT"
					k.wait(0, render)
				},
			})
		}

		const contentPos = k.vec2(PANEL_PADDING, CONTENT_TOP)
		const contentWidth = innerWidth
		const contentHeight = height - CONTENT_TOP - PANEL_PADDING
		if (activeTab === "Audio") {
			addAudioTab(view, contentPos, contentWidth)
			return
		}
		if (activeTab === "Video") {
			addVideoTab(view, contentPos, contentWidth)
			return
		}
		addBindingsTab(view, {
			pos: contentPos,
			width: contentWidth,
			height: contentHeight,
			captureAction,
			status: bindingStatus,
			onCapture: (action) => {
				stopCapture()
				captureAction = action
				bindingStatus = "PRESS INPUT  //  ESC CANCELS"
				render()
				k.wait(0, () => {
					if (!panel.exists() || captureAction !== action) return
					captureController = beginInputBindingCapture(action, {
						onBound: (change) => {
							captureController = undefined
							captureAction = undefined
							bindingStatus = change.swappedAction
								? `SWAPPED WITH ${getInputActionDefinition(change.swappedAction).label}`
								: `${getInputActionDefinition(action).label} UPDATED`
							render()
						},
						onCancel: () => {
							captureController = undefined
							captureAction = undefined
							bindingStatus = "BINDING CHANGE CANCELLED"
							render()
						},
					})
				})
			},
			onReset: () => {
				stopCapture()
				resetInputBindings()
				bindingStatus = "DEFAULT BINDINGS RESTORED"
				render()
			},
		})
	}

	panel.onDestroy(() => {
		destroyed = true
		cancelInputBindingCapture()
		captureController = undefined
	})
	render()
	return panel
}

function addAudioTab(parent: GameObj, pos: Vec2, width: number) {
	const controls = parent.add([k.pos(pos)])
	createUiVolumeControls(controls, {
		pos: k.vec2(0, 0),
		width,
	})
}

function addVideoTab(parent: GameObj, pos: Vec2, width: number) {
	const controls = parent.add([k.pos(pos)])
	createUiSectionHeader(controls, {
		pos: k.vec2(0, 0),
		width,
		eyebrow: "VIDEO / COMFORT",
		title: "DISPLAY SYSTEMS",
		action: "AUTO-SAVE",
	})
	const fullscreenStatus = addThemedText(controls, {
		pos: k.vec2(0, 70),
		text: fullscreenStatusText(),
		variant: "caption",
		width,
		align: "right",
	})
	createUiActionButton(controls, {
		pos: k.vec2(0, 58),
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

	const shakeLabel = addThemedText(controls, {
		pos: k.vec2(0, 101),
		text: intensityLabel("SCREEN SHAKE", getScreenShakeIntensity()),
		variant: "muted",
		width,
	})
	createUiSlider(controls, {
		pos: k.vec2(0, 120),
		width,
		value: getScreenShakeIntensity(),
		onChange: (value) => {
			setScreenShakeIntensity(value)
			shakeLabel.text = intensityLabel("SCREEN SHAKE", value)
		},
	})

	const flashLabel = addThemedText(controls, {
		pos: k.vec2(0, 142),
		text: intensityLabel("SCREEN FLASH", getScreenFlashIntensity()),
		variant: "muted",
		width,
	})
	createUiSlider(controls, {
		pos: k.vec2(0, 161),
		width,
		value: getScreenFlashIntensity(),
		onChange: (value) => {
			setScreenFlashIntensity(value)
			flashLabel.text = intensityLabel("SCREEN FLASH", value)
		},
	})

	const postProcessingStatus = addThemedText(controls, {
		pos: k.vec2(0, 211),
		text: postProcessingStatusText(),
		variant: "caption",
		width,
		align: "right",
	})
	createUiActionButton(controls, {
		pos: k.vec2(0, 199),
		size: k.vec2(Math.min(190, width - 140), 32),
		text: "TOGGLE POST FX",
		onClick: () => {
			setPostProcessingEnabled(!getPostProcessingEnabled())
			postProcessingStatus.text = postProcessingStatusText()
		},
	})
}

interface BindingsTabProps {
	pos: Vec2
	width: number
	height: number
	captureAction?: InputActionId
	status: string
	onCapture: (action: InputActionId) => void
	onReset: () => void
}

function addBindingsTab(
	parent: GameObj,
	{
		pos,
		width,
		height,
		captureAction,
		status,
		onCapture,
		onReset,
	}: BindingsTabProps
) {
	const scrollable = createUiScrollable({
		parent,
		pos,
		width,
		height,
		contentHeight: 605,
		scrollStep: 32,
	})
	const content = scrollable.content
	const rowWidth = width - 8
	createUiSectionHeader(content, {
		pos: k.vec2(0, 0),
		width: rowWidth,
		eyebrow: "INPUT CONTROL",
		title: "FLIGHT BINDINGS",
		action: "AUTO-SAVE",
	})
	addThemedText(content, {
		pos: k.vec2(10, 60),
		text: status,
		variant: captureAction ? "caption" : "muted",
		width: rowWidth - 20,
	})

	let y = 88
	let previousGroup = ""
	for (const action of INPUT_ACTIONS) {
		if (action.group !== previousGroup) {
			if (previousGroup) y += 8
			addThemedText(content, {
				pos: k.vec2(10, y + 8),
				text: action.group,
				variant: "eyebrow",
				width: rowWidth - 20,
			})
			y += 28
			previousGroup = action.group
		}
		addThemedText(content, {
			pos: k.vec2(10, y + 10),
			text: action.label,
			variant: "body",
			width: rowWidth - 168,
		})
		createUiActionButton(content, {
			pos: k.vec2(rowWidth - 150, y),
			size: k.vec2(140, 32),
			text: captureAction === action.id
				? "PRESS INPUT..."
				: formatInputBinding(getInputBinding(action.id)),
			selected: captureAction === action.id,
			onClick: () => onCapture(action.id),
		})
		y += 38
	}
	createUiActionButton(content, {
		pos: k.vec2(10, y + 8),
		size: k.vec2(rowWidth - 20, 34),
		text: "RESET DEFAULT BINDINGS",
		onClick: onReset,
	})
	scrollable.setContentHeight(y + 54)
	scrollable.scrollToStart()
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
