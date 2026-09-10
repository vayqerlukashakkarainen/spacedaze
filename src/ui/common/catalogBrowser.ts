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
	const columnGap = UI_SPACING.lg
	const root = parent.add([k.pos(props.pos)])
	const hasTitle = Boolean(props.title?.trim())
	const headerHeight = hasTitle
		? props.meta ? 56 : 40
		: props.meta ? 40 : 0
	const headerBottomGap = headerHeight > 0 ? UI_SPACING.sm : 0
	if (headerHeight > 0) {
		createUiSurface(root, {
			pos: k.vec2(0, 0),
			size: k.vec2(listWidth, headerHeight),
			tone: "raised",
		})
	}
	if (hasTitle) {
		addThemedText(root, {
			text: props.title ?? "",
			pos: k.vec2(UI_SPACING.md, 6),
			variant: "heading",
			size: UI_FONT_SIZES.subheading,
			width: listWidth - UI_SPACING.md * 2,
			color: k.rgb(...UI_COLORS.text),
		})
	}
	if (props.meta) {
		addThemedText(root, {
			text: props.meta,
			pos: k.vec2(UI_SPACING.md, hasTitle ? 28 : 10),
			variant: "eyebrow",
			width:
				listWidth - UI_SPACING.md * 2 - (props.metaRightInset ?? 0),
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
		rowsTop: headerHeight + headerBottomGap,
		detailLeft: listWidth + columnGap,
		detailWidth: props.size.x - listWidth - columnGap,
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
	const root = parent.add([k.pos(props.pos)])
	if (props.icon) {
		root.add([
			k.sprite(props.icon, { width: 38, height: 38 }),
			k.pos(19, 22),
			k.anchor("center"),
		])
	}
	const titleLeft = props.icon ? 52 : 0
	if (props.recordLabel) {
		addThemedText(root, {
			text: props.recordLabel,
			pos: k.vec2(titleLeft, 0),
			variant: "caption",
			width: props.size.x - titleLeft,
		})
	}
	const titleTop = props.recordLabel ? 17 : 0
	addThemedText(root, {
		text: props.title,
		pos: k.vec2(titleLeft, titleTop),
		variant: "display",
		size: UI_FONT_SIZES.sectionTitle,
		width: props.size.x - titleLeft,
	})
	if (props.description) {
		addThemedText(root, {
			text: props.description,
			pos: k.vec2(titleLeft, titleTop + 25),
			variant: "muted",
			width: props.size.x - titleLeft,
		})
	}

	const recordingTop = props.description ? 70 : titleTop + 30
	const recordingHeight = 420
	const showRecording = props.showRecording ?? true
	if (showRecording) {
		createUiFieldRecording(root, {
			pos: k.vec2(0, recordingTop),
			size: k.vec2(props.size.x, recordingHeight),
			footer: props.videoFooter,
			videoUrl: props.videoUrl,
		})
	}
	const notesTop = showRecording
		? recordingTop + recordingHeight + UI_SPACING.md
		: recordingTop + UI_SPACING.md
	const noteLeft = Math.round(props.size.x * 0.61)
	addThemedText(root, {
		text: props.howTitle,
		pos: k.vec2(0, notesTop),
		variant: "caption",
		width: noteLeft - UI_SPACING.lg,
	})
	addThemedText(root, {
		text: props.howText,
		pos: k.vec2(0, notesTop + 20),
		variant: "body",
		size: UI_FONT_SIZES.label,
		lineHeight: 1.45,
		width: noteLeft - UI_SPACING.lg,
	})
	if (props.tipTitle && props.tipText) {
		addThemedText(root, {
			text: props.tipTitle,
			pos: k.vec2(0, notesTop + 76),
			variant: "caption",
			width: noteLeft - UI_SPACING.lg,
		})
		addThemedText(root, {
			text: props.tipText,
			pos: k.vec2(0, notesTop + 96),
			variant: "muted",
			lineHeight: 1.4,
			width: noteLeft - UI_SPACING.lg,
		})
	}
	if (props.inputPrompts && props.inputPrompts.length > 0) {
		createInputPromptRow(root, {
			pos: k.vec2(0, notesTop + (props.tipText ? 132 : 76)),
			prompts: props.inputPrompts,
			align: "left",
			color: UI_COLORS.text,
			labelColor: UI_COLORS.muted,
			fontSize: UI_FONT_SIZES.micro,
			iconHeight: 26,
			promptGap: 16,
		})
	}
	root.add([
		k.pos(noteLeft, notesTop),
		k.rect(1, Math.max(78, props.size.y - notesTop)),
		k.color(...UI_COLORS.border),
	])
	addThemedText(root, {
		text: props.noteTitle,
		pos: k.vec2(noteLeft + UI_SPACING.lg, notesTop),
		variant: "caption",
		color: k.rgb(...UI_COLORS.warning),
		width: props.size.x - noteLeft - UI_SPACING.lg,
	})
	addThemedText(root, {
		text: props.noteText,
		pos: k.vec2(noteLeft + UI_SPACING.lg, notesTop + 20),
		variant: "muted",
		lineHeight: 1.4,
		width: props.size.x - noteLeft - UI_SPACING.lg,
	})
	if (props.input) {
		const inputTop = props.size.y - 26
		const inputWidth = Math.max(38, props.input.length * 7 + 14)
		const input = createUiSurface(root, {
			pos: k.vec2(noteLeft + UI_SPACING.lg, inputTop),
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
				pos: k.vec2(noteLeft + UI_SPACING.lg + inputWidth + 8, inputTop + 6),
				variant: "eyebrow",
			})
		}
	}
	return root
}
