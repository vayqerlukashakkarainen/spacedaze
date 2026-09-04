import type { GameObj, KEventController } from "kaplay"
import { k, layers } from "../main"
import { tags } from "../tags"
import {
	createInputPromptRow,
	UI_COLORS,
	UI_FONT_SIZES,
} from "../ui/common"
import { audioService } from "./audioService"
import {
	getDialogueVoiceProfile,
	playDialogueCharacter,
} from "./dialogueVoiceService"

export interface DialogueLine {
	speaker: string
	text: string | readonly DialogueTextSegment[]
	autoAdvance?: boolean
	disturbance?: boolean
}

export interface DialogueTextSegment {
	text: string
	waitAfter?: number
	color?: readonly [number, number, number]
	flash?: boolean
	textShake?: number
	sound?: {
		id: string
		volume?: number
		detune?: number
	}
	shake?: number
}

export interface DialogueOptions {
	blackout?: boolean
	overlayOpacity?: number
	pauseVisualEffects?: boolean
	onComplete?: () => void
	onSkip?: () => void
	skipLabel?: string
}

let activeDialog: GameObj | undefined
let activeResolve: (() => void) | undefined
let activeClose: (() => void) | undefined
let activeDialogShake: ((strength: number) => void) | undefined

export function dialogOpen() {
	return activeDialog?.exists() === true
}

export function showDialogue(
	lines: readonly DialogueLine[],
	options: DialogueOptions = {}
) {
	hideDialogue()
	if (lines.length === 0) {
		options.onComplete?.()
		return Promise.resolve()
	}

	const pausedObjects = pauseGameplayObjects(
		options.pauseVisualEffects !== false
	)
	let lineIndex = 0
	let visibleCharacters = 0
	let waitRemaining = 0
	let pauseIndex = 0
	let closing = false
	let shakeStrength = 0
	let shakeRemaining = 0
	let shakeOffset = k.vec2(0, 0)
	const controllers: KEventController[] = []
	const root = k.add([
		k.pos(0, 0),
		k.fixed(),
		k.layer(layers.uiEffects),
		k.z(30000),
		tags.dialog,
	])
	activeDialog = root
	activeDialogShake = (strength) => {
		shakeStrength = Math.max(shakeStrength, strength)
		shakeRemaining = Math.max(shakeRemaining, 0.18)
	}

	const overlayOpacity = options.blackout === true
		? 1
		: options.overlayOpacity ?? 0.64
	if (overlayOpacity > 0) {
		root.add([
			k.pos(0, 0),
			k.rect(k.width(), k.height()),
			k.color(0, 0, 0),
			k.opacity(overlayOpacity),
		])
	}
	const panelWidth = Math.min(700, k.width() - 48)
	const panelHeight = 146
	const panelX = (k.width() - panelWidth) / 2
	const panelY = k.height() - panelHeight - 32
	root.add([
		k.pos(panelX, panelY),
		k.rect(panelWidth, panelHeight),
		k.color(...UI_COLORS.panel),
		k.outline(1, k.rgb(...UI_COLORS.border)),
	])
	const speakerRail = root.add([
		k.pos(panelX, panelY),
		k.rect(4, panelHeight),
		k.color(...UI_COLORS.accent),
	])
	const speaker = root.add([
		k.pos(panelX + 22, panelY + 18),
		k.text("", { font: "unscii", size: UI_FONT_SIZES.body }),
		k.color(...UI_COLORS.accent),
	])
	const body = root.add([
		k.pos(panelX + 22, panelY + 50),
		k.text("", {
			font: "unscii",
			size: UI_FONT_SIZES.subheading,
			width: panelWidth - 44,
			lineSpacing: 6,
			transform: (index) => {
				const line = lines[lineIndex]
				const segment = getDialogueSegmentAt(line, index)
				const disturbance = getDialogueDisturbance(line, index)
				if (!segment) return {}
				return {
					pos: disturbance?.offset,
					color: segment.color ? k.rgb(...segment.color) : undefined,
					opacity: disturbance?.missing
						? 0
						: segment.flash
						? k.wave(0.2, 1, k.time() * 12)
						: 1,
				}
			},
		}),
		k.color(...UI_COLORS.text),
	])
	const prompt = createInputPromptRow(root, {
		pos: k.vec2(panelX + panelWidth - 22, panelY + panelHeight - 18),
		prompts: [{ action: "confirm" }],
		align: "right",
	})
	if (options.onSkip) {
		createInputPromptRow(root, {
			pos: k.vec2(panelX + 22, panelY + panelHeight - 18),
			prompts: [{
				action: "skip",
				label: options.skipLabel ?? "SKIP",
			}],
			align: "left",
		})
	}

	const dialogueLineComplete = (line: DialogueLine) =>
		visibleCharacters >= getDialogueLineText(line).length &&
		waitRemaining <= 0 &&
		pauseIndex >= getDialogueLinePauses(line).length
	const renderLine = () => {
		const line = lines[lineIndex]
		const lineText = getDialogueLineText(line)
		const profile = getDialogueVoiceProfile(line.speaker)
		const speakerColor = k.rgb(...profile.color)
		speaker.text = line.speaker.toUpperCase()
		speaker.color = speakerColor
		speakerRail.color = speakerColor
		body.text = lineText.slice(0, Math.floor(visibleCharacters))
		prompt.opacity = line.autoAdvance
			? 0
			: dialogueLineComplete(line)
			? k.wave(0.4, 1, k.time() * 4)
			: 0.3
	}
	const advance = (automatic: boolean = false) => {
		const line = lines[lineIndex]
		if (line.autoAdvance && !automatic) return
		const lineText = getDialogueLineText(line)
		if (!dialogueLineComplete(line)) {
			if (waitRemaining > 0) return
			const pause = getDialogueLinePauses(line)[pauseIndex]
			visibleCharacters = pause?.afterCharacter ?? lineText.length
			if (pause) {
				pauseIndex++
				waitRemaining = pause.duration
			}
			renderLine()
			return
		}
		if (lineIndex < lines.length - 1) {
			lineIndex++
			visibleCharacters = 0
			waitRemaining = 0
			pauseIndex = 0
			renderLine()
			return
		}
		finish(true)
	}
	const finish = (completed: boolean) => {
		if (closing) return
		closing = true
		for (const controller of controllers) controller.cancel()
		resumeGameplayObjects(pausedObjects)
		if (root.exists()) k.destroy(root)
		if (activeDialog === root) activeDialog = undefined
		if (activeDialog === undefined) activeDialogShake = undefined
		activeClose = undefined
		const resolve = activeResolve
		activeResolve = undefined
		if (completed) options.onComplete?.()
		resolve?.()
	}
	activeClose = () => finish(false)

	root.onUpdate(() => {
		root.pos = root.pos.sub(shakeOffset)
		shakeOffset = k.vec2(0, 0)
		if (shakeRemaining > 0) {
			shakeRemaining = Math.max(0, shakeRemaining - k.dt())
			const envelope = shakeRemaining / 0.18
			const amount = shakeStrength * envelope
			shakeOffset = k.rand(
				k.vec2(-amount, -amount),
				k.vec2(amount, amount)
			)
			root.pos = root.pos.add(shakeOffset)
			if (shakeRemaining === 0) shakeStrength = 0
		}
		const line = lines[lineIndex]
		const lineText = getDialogueLineText(line)
		if (waitRemaining > 0) {
			waitRemaining = Math.max(0, waitRemaining - k.dt())
			renderLine()
			return
		}
		const previousCharacterCount = Math.floor(visibleCharacters)
		visibleCharacters = Math.min(
			lineText.length,
			visibleCharacters + k.dt() * 38
		)
		const pause = getDialogueLinePauses(line)[pauseIndex]
		if (pause && visibleCharacters >= pause.afterCharacter) {
			visibleCharacters = pause.afterCharacter
			pauseIndex++
			waitRemaining = pause.duration
		}
		const nextCharacterCount = Math.floor(visibleCharacters)
		triggerDialogueSegmentCues(
			line,
			previousCharacterCount,
			nextCharacterCount
		)
		for (
			let index = previousCharacterCount;
			index < nextCharacterCount;
			index++
		) {
			if (/\S/.test(lineText[index])) {
				playDialogueCharacter(line.speaker)
			}
		}
		renderLine()
		if (dialogueLineComplete(line) && line.autoAdvance) advance(true)
	})
	controllers.push(k.onKeyPress("enter", () => advance(false)))
	controllers.push(k.onKeyPress("space", () => advance(false)))
	controllers.push(k.onMousePress("left", () => advance(false)))
	if (options.onSkip) {
		controllers.push(k.onKeyPress("escape", () => {
			finish(false)
			options.onSkip?.()
		}))
	}
	renderLine()

	return new Promise<void>((resolve) => {
		activeResolve = resolve
	})
}

function getDialogueLineText(line: DialogueLine) {
	return typeof line.text === "string"
		? line.text
		: line.text.map((segment) => segment.text).join("")
}

function getDialogueLinePauses(line: DialogueLine) {
	if (typeof line.text === "string") return []
	let characterCount = 0
	return line.text.flatMap((segment) => {
		characterCount += segment.text.length
		return segment.waitAfter === undefined
			? []
			: [{
				afterCharacter: characterCount,
				duration: segment.waitAfter,
			}]
	})
}

function getDialogueSegmentAt(
	line: DialogueLine,
	characterIndex: number
): DialogueTextSegment | undefined {
	if (typeof line.text === "string") {
		return { text: line.text }
	}
	let segmentStart = 0
	for (const segment of line.text) {
		const segmentEnd = segmentStart + segment.text.length
		if (characterIndex >= segmentStart && characterIndex < segmentEnd) {
			return segment
		}
		segmentStart = segmentEnd
	}
	return undefined
}

function getDialogueDisturbance(
	line: DialogueLine,
	characterIndex: number
) {
	const segment = getDialogueSegmentAt(line, characterIndex)
	const profile = getDialogueVoiceProfile(line.speaker)
	const lineDisturbance = line.disturbance === true
		? profile.disturbance
		: undefined
	const jitter = segment?.textShake ?? lineDisturbance?.jitter
	if (!jitter) return undefined
	const character = getDialogueLineText(line)[characterIndex]
	if (!character || /\s/.test(character)) return undefined
	const frequency = segment?.textShake
		? 18
		: lineDisturbance?.frequency ?? 10
	const frame = Math.floor(k.time() * frequency)
	const dropoutNoise = dialogueNoise(characterIndex, frame, 0)
	return {
		missing: /[A-Za-z0-9]/.test(character) &&
			dropoutNoise < (lineDisturbance?.dropoutChance ?? 0),
		offset: k.vec2(
			(dialogueNoise(characterIndex, frame, 1) * 2 - 1) *
				jitter,
			(dialogueNoise(characterIndex, frame, 2) * 2 - 1) *
				jitter
		),
	}
}

function dialogueNoise(index: number, frame: number, salt: number) {
	const value = Math.sin(
		(index + 1) * 12.9898 + (frame + salt * 97) * 78.233
	) * 43758.5453
	return value - Math.floor(value)
}

function triggerDialogueSegmentCues(
	line: DialogueLine,
	previousCharacterCount: number,
	nextCharacterCount: number
) {
	if (typeof line.text === "string") return
	let segmentStart = 0
	for (const segment of line.text) {
		if (
			segmentStart >= previousCharacterCount &&
			segmentStart < nextCharacterCount
		) {
			if (segment.sound) {
				audioService.playSound(segment.sound.id, {
					volume: segment.sound.volume ?? 1,
					detune: segment.sound.detune,
				})
			}
			if (segment.shake) shakeDialogue(segment.shake)
		}
		segmentStart += segment.text.length
	}
}

export function hideDialogue() {
	activeClose?.()
}

export function shakeDialogue(strength: number) {
	k.shake(strength)
	activeDialogShake?.(strength)
}

function pauseGameplayObjects(pauseVisualEffects: boolean) {
	const pausedObjects: GameObj[] = []
	for (const object of k.get<GameObj>(tags.gameLoop)) {
		if (object.paused) continue
		if (!pauseVisualEffects && isVisualEffect(object)) continue
		object.paused = true
		pausedObjects.push(object)
	}
	return pausedObjects
}

function isVisualEffect(object: GameObj) {
	const objectLayer = (object as GameObj & { layer?: string }).layer
	return objectLayer === layers.bg ||
		objectLayer === layers.gameEffects ||
		objectLayer === layers.gameText
}

function resumeGameplayObjects(objects: readonly GameObj[]) {
	for (const object of objects) {
		if (object.exists()) object.paused = false
	}
}
