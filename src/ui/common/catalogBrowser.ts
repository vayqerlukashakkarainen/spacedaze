import type { GameObj, Vec2 } from "kaplay"
import { k } from "../../main"
import { createUiSurface } from "./surface"
import { addThemedText } from "./text"
import { UI_COLORS, UI_FONT_SIZES, UI_SIZES, UI_SPACING } from "./theme"
import {
	createInputPromptRow,
	type InputPromptEntry,
} from "./inputPrompt"

const FIELD_RECORDING_VIDEO_ASPECT = 1280 / 370

export interface UiCatalogBrowserProps {
	pos: Vec2
	size: Vec2
	title?: string
	meta?: string
	metaRightInset?: number
	listWidth?: number
}

export function createUiCatalogBrowser(
	parent: GameObj,
	props: UiCatalogBrowserProps
) {
	const listWidth = Math.min(
		Math.max(props.listWidth ?? 320, 260),
		props.size.x * 0.42
	)
	const root = parent.add([k.pos(props.pos)])
	const hasTitle = Boolean(props.title?.trim())
	const headerHeight = hasTitle
		? props.meta ? 46 : 28
		: props.meta ? 24 : 0
	if (hasTitle) {
		addThemedText(root, {
			text: props.title ?? "",
			pos: k.vec2(0, 0),
			variant: "heading",
			width: listWidth,
			color: k.rgb(...UI_COLORS.text),
		})
	}
	if (props.meta) {
		addThemedText(root, {
			text: props.meta,
			pos: k.vec2(0, hasTitle ? 22 : 0),
			variant: "eyebrow",
			width: listWidth - (props.metaRightInset ?? 0),
		})
	}
	root.add([
		k.pos(listWidth, 0),
		k.rect(1, props.size.y),
		k.color(...UI_COLORS.border),
	])

	return {
		root,
		listWidth,
		rowsTop: headerHeight,
		detailLeft: listWidth + UI_SPACING.md,
		detailWidth: props.size.x - listWidth - UI_SPACING.md,
		detailHeight: props.size.y,
	}
}

export interface UiFieldRecordingProps {
	pos: Vec2
	size: Vec2
	label?: string
	footer?: string
	videoUrl?: string
	accent?: readonly [number, number, number]
}

export function createUiFieldRecording(
	parent: GameObj,
	props: UiFieldRecordingProps
) {
	const accent = props.accent ?? UI_COLORS.accent
	const surface = createUiSurface(parent, {
		pos: props.pos,
		size: props.size,
		tone: "raised",
	})
	if (props.videoUrl) {
		const frameInset = UI_SIZES.border
		const playbackWidth = props.size.x - frameInset * 2
		const playbackHeight = props.size.y - frameInset * 2
		const playback = surface.add([
			k.pos(frameInset, frameInset),
			k.rect(playbackWidth, playbackHeight),
			k.color(0, 0, 0),
			k.mask("intersect"),
		])
		const videoWidth = Math.max(
			playbackWidth,
			playbackHeight * FIELD_RECORDING_VIDEO_ASPECT
		)
		const videoHeight = videoWidth / FIELD_RECORDING_VIDEO_ASPECT
		const video = playback.add([
			k.video(props.videoUrl, {
				width: videoWidth,
				height: videoHeight,
			}),
			k.pos(
				(playbackWidth - videoWidth) / 2,
				(playbackHeight - videoHeight) / 2
			),
			k.color(...UI_COLORS.background),
		])
		const loadingOverlay = surface.add([
			k.pos(frameInset, frameInset),
			k.rect(playbackWidth, playbackHeight),
			k.color(...UI_COLORS.background),
			k.z(2),
		])
		const loading = addThemedText(loadingOverlay, {
			text: "LOADING RECORDING...",
			pos: k.vec2(0, playbackHeight / 2 - UI_FONT_SIZES.small / 2),
			variant: "caption",
			width: playbackWidth,
			align: "center",
			z: 3,
		})
		const loadingStartedAt = k.time()
		video.mute = true
		video.play()
		video.onUpdate(() => {
			const hasBufferedFrame = video.currentTime >= 0.25
			const hasShownLoading = k.time() - loadingStartedAt >= 0.6
			if (hasBufferedFrame && hasShownLoading) {
				video.color = k.rgb(255, 255, 255)
				if (loadingOverlay.exists()) k.destroy(loadingOverlay)
				return
			}
			if (!loadingOverlay.exists()) return
			const dots = Math.floor(k.time() * 3) % 4
			loading.text = `LOADING RECORDING${".".repeat(dots)}`
		})
		video.onDestroy(() => video.pause())
	} else {
		addThemedText(surface, {
			text: props.label ?? "FIELD RECORDING  //  LOOP",
			pos: k.vec2(UI_SPACING.md, UI_SPACING.sm),
			variant: "eyebrow",
			width: props.size.x - UI_SPACING.md * 2,
		})
		addThemedText(surface, {
			text: "READY",
			pos: k.vec2(UI_SPACING.md, UI_SPACING.sm),
			variant: "caption",
			width: props.size.x - UI_SPACING.md * 2,
			align: "right",
		})
		const center = k.vec2(props.size.x / 2, props.size.y / 2)
		surface.add([
			k.pos(UI_SPACING.xl, center.y),
			k.rect(props.size.x - UI_SPACING.xl * 2, 1),
			k.color(...UI_COLORS.border),
			k.opacity(0.65),
		])
		surface.add([
			k.pos(center.x, 38),
			k.rect(1, props.size.y - 76),
			k.color(...UI_COLORS.border),
			k.opacity(0.45),
		])
		const target = surface.add([
			k.pos(center),
			k.circle(22),
			k.anchor("center"),
			k.color(...UI_COLORS.panelRaised),
			k.scale(1),
			k.outline(1, k.rgb(...accent)),
		])
		target.add([
			k.pos(0, 0),
			k.circle(5),
			k.anchor("center"),
			k.color(...accent),
		])
		const projectile = surface.add([
			k.pos(UI_SPACING.xl, center.y),
			k.rect(18, 3),
			k.anchor("center"),
			k.color(...accent),
			k.opacity(1),
		])
		const startX = UI_SPACING.xl
		const travel = props.size.x - UI_SPACING.xl * 2
		projectile.onUpdate(() => {
			const progress = (k.time() * 0.75) % 1
			projectile.pos.x = startX + travel * progress
			projectile.opacity = Math.min(1, (1 - progress) * 2.5)
			target.scale = k.vec2(1 + Math.max(0, 0.12 - Math.abs(progress - 0.5)) * 2)
		})
		addThemedText(surface, {
			text: props.footer ?? "00:05  //  FIELD DEMONSTRATION",
			pos: k.vec2(UI_SPACING.md, props.size.y - 20),
			variant: "eyebrow",
			width: props.size.x - UI_SPACING.md * 2,
		})
	}
	return surface
}

export interface UiTutorialDetailProps {
	pos: Vec2
	size: Vec2
	recordLabel?: string
	title: string
	description?: string
	howTitle: string
	howText: string
	tipTitle?: string
	tipText?: string
	inputPrompts?: readonly InputPromptEntry[]
	noteTitle: string
	noteText: string
	input?: string
	inputAction?: string
	icon?: string
	videoFooter?: string
	videoUrl?: string
	showRecording?: boolean
}

export function createUiTutorialDetail(
	parent: GameObj,
	props: UiTutorialDetailProps
) {
	const root = createUiSurface(parent, {
		pos: props.pos,
		size: props.size,
		tone: "raised",
	})
	const padding = UI_SPACING.lg
	if (props.icon) {
		root.add([
			k.sprite(props.icon, { width: 84, height: 84 }),
			k.pos(62, 60),
			k.anchor("center"),
		])
	}
	const titleLeft = props.icon ? 120 : padding
	addThemedText(root, {
		text: props.title,
		pos: k.vec2(titleLeft, 18),
		variant: "heading",
		width: props.size.x - titleLeft - padding,
	})
	if (props.recordLabel) {
		addThemedText(root, {
			text: props.recordLabel,
			pos: k.vec2(titleLeft, 44),
			variant: "eyebrow",
			width: props.size.x - titleLeft - padding,
		})
	}
	if (props.description) {
		addThemedText(root, {
			text: props.description,
			pos: k.vec2(titleLeft, props.recordLabel ? 68 : 44),
			variant: "body",
			lineHeight: 1.3,
			width: props.size.x - titleLeft - padding,
		})
	}

	const showRecording = props.showRecording ?? true
	const contentTop = props.icon || props.recordLabel || props.description ? 112 : 64
	const recordingHeight = k.clamp(
		props.size.y - contentTop - 174,
		150,
		280
	)
	if (showRecording) {
		createUiFieldRecording(root, {
			pos: k.vec2(padding, contentTop),
			size: k.vec2(props.size.x - padding * 2, recordingHeight),
			footer: props.videoFooter,
			videoUrl: props.videoUrl,
		})
	}
	const notesTop = showRecording
		? contentTop + recordingHeight + UI_SPACING.lg
		: contentTop
	const bodyWidth = props.size.x - padding * 2
	const noteLeft = showRecording
		? Math.round(props.size.x * 0.61)
		: padding
	const howWidth = showRecording
		? noteLeft - padding - UI_SPACING.lg
		: bodyWidth
	addThemedText(root, {
		text: props.howTitle,
		pos: k.vec2(padding, notesTop),
		variant: "eyebrow",
		width: howWidth,
	})
	addThemedText(root, {
		text: props.howText,
		pos: k.vec2(padding, notesTop + 26),
		variant: "body",
		lineHeight: 1.3,
		width: howWidth,
	})
	if (props.tipTitle && props.tipText) {
		const tipTop = notesTop + (showRecording ? 70 : 108)
		addThemedText(root, {
			text: props.tipTitle,
			pos: k.vec2(padding, tipTop),
			variant: "eyebrow",
			width: howWidth,
		})
		addThemedText(root, {
			text: props.tipText,
			pos: k.vec2(padding, tipTop + 26),
			variant: "muted",
			lineHeight: 1.35,
			width: howWidth,
		})
	}
	if (props.inputPrompts && props.inputPrompts.length > 0) {
		createInputPromptRow(root, {
			pos: k.vec2(
				padding,
				notesTop + (props.tipText ? 148 : 82)
			),
			prompts: props.inputPrompts,
			align: "left",
			color: UI_COLORS.text,
			labelColor: UI_COLORS.muted,
			fontSize: UI_FONT_SIZES.micro,
			iconHeight: 26,
			promptGap: 16,
		})
	}
	const noteTop = showRecording
		? notesTop
		: notesTop + (props.tipText ? 216 : 108)
	if (showRecording) {
		root.add([
			k.pos(noteLeft, notesTop),
			k.rect(1, Math.max(78, props.size.y - notesTop - padding)),
			k.color(...UI_COLORS.border),
		])
	}
	const noteTextLeft = showRecording
		? noteLeft + UI_SPACING.lg
		: padding
	const noteWidth = showRecording
		? props.size.x - noteTextLeft - padding
		: bodyWidth
	addThemedText(root, {
		text: props.noteTitle,
		pos: k.vec2(noteTextLeft, noteTop),
		variant: "eyebrow",
		width: noteWidth,
	})
	addThemedText(root, {
		text: props.noteText,
		pos: k.vec2(noteTextLeft, noteTop + 26),
		variant: "muted",
		lineHeight: 1.35,
		width: noteWidth,
	})
	if (props.input) {
		const inputTop = props.size.y - 40
		const inputWidth = Math.max(38, props.input.length * 7 + 14)
		const input = createUiSurface(root, {
			pos: k.vec2(noteTextLeft, inputTop),
			size: k.vec2(inputWidth, 22),
		})
		addThemedText(input, {
			text: props.input,
			pos: k.vec2(0, 6),
			variant: "eyebrow",
			width: inputWidth,
			align: "center",
			color: k.rgb(...UI_COLORS.text),
		})
		if (props.inputAction) {
			addThemedText(root, {
				text: props.inputAction,
				pos: k.vec2(noteTextLeft + inputWidth + 8, inputTop + 6),
				variant: "eyebrow",
			})
		}
	}
	return root
}
