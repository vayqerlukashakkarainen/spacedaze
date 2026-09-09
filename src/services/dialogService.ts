import type {
	Color,
	GameObj,
	KEventController,
	PosComp,
	ScaleComp,
} from "kaplay"
import { k, layers } from "../main"
import { tags } from "../tags"
import {
	createUiInlineReference,
	createInputPromptRow,
	formatUiInlineReferenceText,
	UI_COLORS,
	UI_FONT_SIZES,
} from "../ui/common"
import { getDroidDefinition, type DroidId } from "../npcs/droidRegistry"
import {
	getRewardDefinition,
	REWARD_RARITY_COLORS,
} from "./rewardService"
import { audioService } from "./audioService"
import { gameSoundService } from "./gameSoundService"
import {
	getDialogueVoiceProfile,
	playDialogueCharacter,
} from "./dialogueVoiceService"
import { acquireGameplayPause } from "./gameplayPauseService"
import { runtimeDebug } from "./runtimeDebugService"
import { acquireInteractionPromptSuppression } from "./interactionPromptVisibilityService"

export interface DialogueLine {
	speaker: string
	text: string | readonly DialogueTextSegment[]
	autoAdvance?: boolean
	holdAfter?: number
	disturbance?: boolean
}

export interface DialogueTextSegment {
	text: string
	reference?: DialogueReference
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

export type DialogueReference =
	| { kind: "reward"; id: string }
	| { kind: "npc"; id: DroidId }

interface ResolvedDialogueReference {
	name: string
	sprite: string
	color: Color
}

const dialogueReferenceCache = new Map<string, ResolvedDialogueReference>()
const DIALOGUE_BOTTOM_OFFSET = 132

export interface DialogueOptions {
	channel?: "modal" | "comms"
	gameplay?: "paused" | "live"
	advance?: "manual" | "auto"
	input?: "capture" | "passthrough"
	autoAdvanceDelay?: number
	blackout?: boolean
	overlayOpacity?: number
	pauseGameplay?: boolean
	pauseVisualEffects?: boolean
	resolveSpeaker?: (speaker: string) => GameObj<PosComp> | undefined
	onComplete?: () => void
	onSkip?: () => void
	skipLabel?: string
}

export type DialogueResult = "completed" | "skipped" | "cancelled"

let activeDialog: GameObj | undefined
let activeResolve: ((result: DialogueResult) => void) | undefined
let activeClose: ((result?: DialogueResult) => void) | undefined
let activeDialogShake: ((strength: number) => void) | undefined
let activeBlocksGameplay = false
let activeCapturesInput = false

export function dialogOpen() {
	return activeDialog?.exists() === true
}

export function dialogBlocksGameplay() {
	return dialogOpen() && activeBlocksGameplay
}

export function dialogCapturesInput() {
	return dialogOpen() && activeCapturesInput
}

export function showDialogue(
	lines: readonly DialogueLine[],
	options: DialogueOptions = {}
) {
	hideDialogue()
	if (lines.length === 0) {
		options.onComplete?.()
		return Promise.resolve<DialogueResult>("completed")
	}

	const gameplayMode = options.gameplay ??
		(options.pauseGameplay === false ? "live" : "paused")
	const releaseGameplayPause = gameplayMode === "paused"
		? acquireGameplayPause(
			"dialog",
			getGameplayObjects(options.pauseVisualEffects !== false)
		)
		: () => {}
	const autoFlow = options.advance === "auto"
	const acceptsManualInput = !autoFlow
	const capturesInput = options.input !== "passthrough" && acceptsManualInput
	runtimeDebug.log("dialogue", "dialogue:open", {
		lines: lines.length,
		firstSpeaker: lines[0]?.speaker,
		channel: options.channel ?? "modal",
		gameplay: gameplayMode,
		advance: autoFlow ? "auto" : "manual",
	})
	activeBlocksGameplay = gameplayMode === "paused"
	activeCapturesInput = capturesInput
	let lineIndex = 0
	let visibleCharacters = 0
	let waitRemaining = 0
	let pauseIndex = 0
	let closing = false
	let shakeStrength = 0
	let shakeRemaining = 0
	let shakeOffset = k.vec2(0, 0)
	let autoHoldRemaining: number | undefined
	let disturbanceSound: ReturnType<typeof audioService.playSound> | null | undefined
	let referenceLineIndex = -1
	let referenceObjects: GameObj[] = []
	const controllers: KEventController[] = []
	const speakerMotion = createDialogueSpeakerMotion(options.resolveSpeaker)
	const root = k.add([
		k.pos(0, 0),
		k.fixed(),
		k.layer(layers.uiEffects),
		k.z(30000),
		tags.dialog,
	])
	activeDialog = root
	const releaseInteractionPromptSuppression =
		acquireInteractionPromptSuppression()
	root.onDestroy(releaseInteractionPromptSuppression)
	activeDialogShake = (strength) => {
		shakeStrength = Math.max(shakeStrength, strength)
		shakeRemaining = Math.max(shakeRemaining, 0.18)
	}

	const overlayOpacity = options.blackout === true
		? 1
		: options.overlayOpacity ?? (options.channel === "comms" ? 0 : 0.64)
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
	const panelY = k.height() - panelHeight - DIALOGUE_BOTTOM_OFFSET
	const initialSpeakerColor = k.rgb(
		...getDialogueVoiceProfile(lines[0].speaker).color
	)
	const panel = root.add([
		k.pos(panelX, panelY),
		k.rect(panelWidth, panelHeight),
		k.color(...UI_COLORS.panel),
		k.outline(1, initialSpeakerColor),
	])
	const speakerRail = root.add([
		k.pos(panelX, panelY),
		k.rect(4, panelHeight),
		k.color(initialSpeakerColor),
	])
	const speaker = root.add([
		k.pos(panelX + 22, panelY + 18),
		k.text("", { font: "unscii", size: UI_FONT_SIZES.body }),
		k.color(initialSpeakerColor),
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
				const reference = resolveDialogueReference(segment.reference)
				return {
					pos: disturbance?.offset,
					color: segment.color
						? k.rgb(...segment.color)
						: reference?.color,
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
		panel.outline.color = speakerColor
		body.text = lineText.slice(0, Math.floor(visibleCharacters))
		syncDialogueReferences(line, lineText)
		prompt.opacity = line.autoAdvance || autoFlow
			? 0
			: dialogueLineComplete(line)
			? k.wave(0.4, 1, k.time() * 4)
			: 0.3
		syncDisturbanceSound(line)
		speakerMotion.sync(
			line.speaker,
			visibleCharacters < lineText.length && waitRemaining <= 0
		)
	}
	const advance = (automatic: boolean = false) => {
		const line = lines[lineIndex]
		if ((line.autoAdvance || autoFlow) && !automatic) return
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
			const previousSpeaker = line.speaker
			lineIndex++
			runtimeDebug.log("dialogue", "dialogue:advance", {
				fromLine: lineIndex - 1,
				toLine: lineIndex,
				previousSpeaker,
				nextSpeaker: lines[lineIndex].speaker,
				automatic,
			})
			visibleCharacters = 0
			waitRemaining = 0
			pauseIndex = 0
			autoHoldRemaining = undefined
			renderLine()
			return
		}
		finish("completed")
	}
	const finish = (result: DialogueResult) => {
		if (closing) return
		closing = true
		runtimeDebug.log("dialogue", "dialogue:close", {
			result,
			lineIndex,
			speaker: lines[lineIndex]?.speaker,
		})
		for (const controller of controllers) controller.cancel()
		speakerMotion.stop()
		releaseInteractionPromptSuppression()
		releaseGameplayPause()
		stopDisturbanceSound()
		if (root.exists()) k.destroy(root)
		if (activeDialog === root) {
			activeDialog = undefined
			activeBlocksGameplay = false
			activeCapturesInput = false
		}
		if (activeDialog === undefined) activeDialogShake = undefined
		activeClose = undefined
		const resolve = activeResolve
		activeResolve = undefined
		if (result === "completed") options.onComplete?.()
		resolve?.(result)
	}
	activeClose = (result = "cancelled") => finish(result)

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
		if (dialogueLineComplete(line) && (line.autoAdvance || autoFlow)) {
			if (autoHoldRemaining === undefined) {
				autoHoldRemaining = line.holdAfter ??
					(line.autoAdvance
						? 0
						: options.autoAdvanceDelay ?? getAutomaticHold(lineText))
			}
			autoHoldRemaining = Math.max(0, autoHoldRemaining - k.dt())
			if (autoHoldRemaining <= 0) advance(true)
		}
	})
	if (acceptsManualInput) {
		controllers.push(k.onKeyPress("enter", () => advance(false)))
		controllers.push(k.onKeyPress("space", () => advance(false)))
		controllers.push(k.onMousePress("left", () => advance(false)))
	}
	if (options.onSkip) {
		controllers.push(k.onKeyPress("escape", () => {
			finish("skipped")
			options.onSkip?.()
		}))
	}
	renderLine()

	return new Promise<DialogueResult>((resolve) => {
		activeResolve = resolve
	})

	function syncDisturbanceSound(line: DialogueLine) {
		if (!line.disturbance) {
			stopDisturbanceSound()
			return
		}
		if (disturbanceSound) return
		disturbanceSound = gameSoundService.play("dialogue_scramble", {
			volume: 0.65,
			loop: true,
		})
	}

	function stopDisturbanceSound() {
		if (!disturbanceSound) return
		audioService.stopSound(disturbanceSound, "dialogue-closed")
		disturbanceSound = undefined
	}

	function syncDialogueReferences(line: DialogueLine, lineText: string) {
		if (referenceLineIndex !== lineIndex) {
			for (const object of referenceObjects) {
				if (object.exists()) k.destroy(object)
			}
			referenceObjects = []
			referenceLineIndex = lineIndex
			if (typeof line.text === "string") return
			const formatted = k.formatText({
				text: lineText,
				font: "unscii",
				size: UI_FONT_SIZES.subheading,
				width: panelWidth - 44,
				lineSpacing: 6,
			})
			let segmentStart = 0
			for (const { segment, text: renderedText } of getRenderedDialogueSegments(line)) {
				const segmentEnd = segmentStart + renderedText.length
				const resolved = resolveDialogueReference(segment.reference)
				if (resolved) {
					const labelStart = segmentEnd - resolved.name.length
					const icon = createUiInlineReference(root, {
						bodyPos: k.vec2(panelX + 22, panelY + 50),
						formattedText: formatted,
						segmentStart,
						labelStart,
						labelEnd: segmentEnd,
						sprite: resolved.sprite,
						color: resolved.color,
						revealAt: labelStart,
					})
					if (icon) {
						referenceObjects.push(icon)
					}
				}
				segmentStart = segmentEnd
			}
		}
		for (const object of referenceObjects) {
			const revealAt = (object as GameObj & { revealAt?: number }).revealAt ?? 0
			object.hidden = visibleCharacters < revealAt
		}
	}
}

interface DialogueSpeakerActor extends GameObj<PosComp> {
	scale?: ScaleComp["scale"]
}

const MAX_DIALOGUE_STRETCH = 0.08
const MAX_DIALOGUE_SQUASH = 0.05
const DIALOGUE_BOB_SPEED_RATIO = 0.12

function createDialogueSpeakerMotion(
	resolveSpeaker: DialogueOptions["resolveSpeaker"]
) {
	let actor: DialogueSpeakerActor | undefined
	let speaker = ""
	let active = false
	let intensity = 0
	let elapsed = 0
	let appliedBob = 0
	let appliedScaleX = 1
	let appliedScaleY = 1

	const removeAppliedTransform = () => {
		if (actor?.exists()) {
			actor.pos.y -= appliedBob
			if (actor.scale && appliedScaleX !== 0 && appliedScaleY !== 0) {
				actor.scale = k.vec2(
					actor.scale.x / appliedScaleX,
					actor.scale.y / appliedScaleY
				)
			}
		}
		appliedBob = 0
		appliedScaleX = 1
		appliedScaleY = 1
	}

	const controller = k.onUpdate(() => {
		if (!actor?.exists()) {
			actor = undefined
			intensity = 0
			return
		}
		removeAppliedTransform()
		const target = active ? 1 : 0
		const response = active ? 22 : 28
		const difference = target - intensity
		intensity += Math.sign(difference) * Math.min(
			Math.abs(difference),
			k.dt() * response
		)
		if (intensity <= 0) return

		elapsed += k.dt()
		const profile = getDialogueVoiceProfile(speaker)
		const pulse = Math.max(0, Math.sin(elapsed * profile.motion.speed))
		appliedBob = Math.sin(
			elapsed * profile.motion.speed * DIALOGUE_BOB_SPEED_RATIO
		) * profile.motion.bobAmount * intensity
		const stretch = Math.min(
			MAX_DIALOGUE_STRETCH,
			profile.motion.scaleAmount * intensity * pulse
		)
		const squash = Math.min(MAX_DIALOGUE_SQUASH, stretch * 0.62)
		appliedScaleX = 1 - squash
		appliedScaleY = 1 + stretch
		actor.pos.y += appliedBob
		if (actor.scale) {
			actor.scale = k.vec2(
				actor.scale.x * appliedScaleX,
				actor.scale.y * appliedScaleY
			)
		}
	})

	return {
		sync(nextSpeaker: string, nextActive: boolean) {
			if (nextSpeaker !== speaker) {
				removeAppliedTransform()
				speaker = nextSpeaker
				actor = resolveSpeaker?.(nextSpeaker) as DialogueSpeakerActor | undefined
				intensity = 0
				elapsed = 0
			}
			active = nextActive && actor?.exists() === true
		},
		stop() {
			controller.cancel()
			removeAppliedTransform()
			actor = undefined
		},
	}
}

function getAutomaticHold(text: string) {
	return Math.max(1.4, Math.min(3.2, text.length / 18))
}

function getGameplayObjects(pauseVisualEffects: boolean) {
	return k.get<GameObj>(tags.gameLoop).filter(
		(object) => pauseVisualEffects || !isVisualEffect(object)
	)
}

function isVisualEffect(object: GameObj) {
	const objectLayer = (object as GameObj & { layer?: string }).layer
	return objectLayer === layers.bg ||
		objectLayer === layers.gameEffects ||
		objectLayer === layers.gameText
}

function getDialogueLineText(line: DialogueLine) {
	return typeof line.text === "string"
		? line.text
		: getRenderedDialogueSegments(line).map((entry) => entry.text).join("")
}

function getDialogueSegmentText(segment: DialogueTextSegment) {
	if (!segment.reference) return segment.text
	const resolved = resolveDialogueReference(segment.reference)
	return formatUiInlineReferenceText(resolved?.name ?? segment.text, {
		font: "unscii",
		fontSize: UI_FONT_SIZES.subheading,
	})
}

function getRenderedDialogueSegments(line: DialogueLine) {
	if (typeof line.text === "string") return []
	return line.text.map((segment, index) => {
		let text = getDialogueSegmentText(segment)
		if (!segment.reference && line.text[index + 1]?.reference) {
			text = text.trimEnd()
		}
		return { segment, text }
	})
}

function getDialogueLinePauses(line: DialogueLine) {
	if (typeof line.text === "string") return []
	let characterCount = 0
	return getRenderedDialogueSegments(line).flatMap(({ segment, text }) => {
		characterCount += text.length
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
	for (const { segment, text } of getRenderedDialogueSegments(line)) {
		const segmentEnd = segmentStart + text.length
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
	for (const { segment, text } of getRenderedDialogueSegments(line)) {
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
		segmentStart += text.length
	}
}

function resolveDialogueReference(reference: DialogueReference | undefined) {
	if (!reference) return undefined
	const cacheKey = `${reference.kind}:${reference.id}`
	const cached = dialogueReferenceCache.get(cacheKey)
	if (cached) return cached
	if (reference.kind === "npc") {
		const npc = getDroidDefinition(reference.id)
		if (!npc) return undefined
		const resolved = {
			name: npc.name,
			sprite: npc.sprite,
			color: k.rgb(...UI_COLORS.accent),
		}
		dialogueReferenceCache.set(cacheKey, resolved)
		return resolved
	}
	const reward = getRewardDefinition(reference.id)
	if (!reward) return undefined
	const resolved = {
		name: reward.name,
		sprite: reward.sprite,
		color: k.rgb(...REWARD_RARITY_COLORS[reward.rarity]),
	}
	dialogueReferenceCache.set(cacheKey, resolved)
	return resolved
}

export function hideDialogue() {
	activeClose?.("cancelled")
}

export function shakeDialogue(strength: number) {
	k.shake(strength)
	activeDialogShake?.(strength)
}
