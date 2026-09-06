import type { AudioPlay, GameObj, PosComp, Vec2 } from "kaplay"
import { k, layers } from "../main"
import { tags } from "../tags"
import { audioService } from "./audioService"

export const EMOTION_DEFINITIONS = {
	dialogue: { text: "..." },
	alert: { sprite: "emote_exclamation" },
	question: { sprite: "emote_question" },
	angry: { sprite: "emote_faceAngry" },
	happy: { sprite: "emote_faceHappy" },
	sad: { sprite: "emote_faceSad" },
	surprised: { sprite: "emote_exclamations" },
	idea: { sprite: "emote_idea" },
	fear: { sprite: "emote_drops" },
	sleep: { sprite: "emote_sleeps" },
	love: { sprite: "emote_heart" },
} as const

export type EmotionId = keyof typeof EMOTION_DEFINITIONS
export type EmotionPriority =
	| "ambient"
	| "interaction"
	| "combat"
	| "narrative"
	| number
export type EmotionEndReason =
	| "expired"
	| "replaced"
	| "cancelled"
	| "targetLost"

export interface EmotionSound {
	id: string
	volume?: number
	detune?: number
	speed?: number
	positional?: boolean
	minDistance?: number
	maxDistance?: number
}

export interface EmotionOptions {
	duration?: number
	priority?: EmotionPriority
	sound?: string | EmotionSound
	offset?: Vec2
	screenSize?: number
	bobAmount?: number
}

export interface EmotionHandle {
	readonly actor: GameObj<PosComp>
	readonly emotion: EmotionId
	readonly object: GameObj
	readonly completed: Promise<EmotionEndReason>
	cancel(): void
}

interface ActiveEmotion {
	handle: EmotionHandle
	priority: number
	finish(reason: EmotionEndReason, destroy?: boolean): void
}

const DEFAULT_DURATION = 2.4
const DEFAULT_SCREEN_SIZE = 68
const DEFAULT_SCREEN_OFFSET_Y = -55
const ENTER_DURATION = 0.16
const EXIT_DURATION = 0.24
const PRIORITIES: Record<Exclude<EmotionPriority, number>, number> = {
	ambient: 0,
	interaction: 10,
	combat: 20,
	narrative: 30,
}

const emotionByActor = new WeakMap<GameObj<PosComp>, ActiveEmotion>()
const activeEmotions = new Set<ActiveEmotion>()

export function showEmotion(
	actor: GameObj<PosComp>,
	emotion: EmotionId,
	options: EmotionOptions = {}
): EmotionHandle | undefined {
	if (!actor.exists()) return undefined
	const priority = emotionPriority(options.priority)
	const previous = emotionByActor.get(actor)
	if (previous && previous.priority > priority) return undefined
	previous?.finish("replaced")

	const definition = EMOTION_DEFINITIONS[emotion]
	const duration = Math.max(0, options.duration ?? DEFAULT_DURATION)
	const screenSize = Math.max(1, options.screenSize ?? DEFAULT_SCREEN_SIZE)
	const screenOffset = options.offset ?? k.vec2(0, DEFAULT_SCREEN_OFFSET_Y)
	const bobAmount = Math.max(0, options.bobAmount ?? 2.25)
	let elapsed = 0
	let ended = false
	let resolveCompleted: (reason: EmotionEndReason) => void = () => {}
	let sound: AudioPlay | null = null

	const visualContent = "sprite" in definition
		? k.sprite(definition.sprite, {
			width: screenSize,
			height: screenSize,
		})
		: k.text(definition.text, {
			font: "unscii",
			size: 18,
		})
	const visual = k.add([
		k.pos(actor.pos),
		visualContent,
		k.anchor("center"),
		k.scale(0),
		k.opacity(0),
		k.layer(layers.gameText),
		k.z(5000),
		tags.emotion,
	])
	const completed = new Promise<EmotionEndReason>((resolve) => {
		resolveCompleted = resolve
	})
	const handle: EmotionHandle = {
		actor,
		emotion,
		object: visual,
		completed,
		cancel: () => active.finish("cancelled"),
	}
	const active: ActiveEmotion = {
		handle,
		priority,
		finish(reason, destroy = true) {
			if (ended) return
			ended = true
			if (emotionByActor.get(actor) === active) {
				emotionByActor.delete(actor)
			}
			activeEmotions.delete(active)
			sound?.stop()
			sound = null
			if (destroy && visual.exists()) k.destroy(visual)
			resolveCompleted(reason)
		},
	}
	emotionByActor.set(actor, active)
	activeEmotions.add(active)

	visual.onUpdate(() => {
		if (!actor.exists()) {
			active.finish("targetLost")
			return
		}
		elapsed += k.dt()
		if (Number.isFinite(duration) && elapsed >= duration) {
			active.finish("expired")
			return
		}
		const cameraScale = Math.max(0.001, k.getCamScale().x)
		const enterProgress = k.clamp(elapsed / ENTER_DURATION, 0, 1)
		const exitProgress = Number.isFinite(duration)
			? k.clamp((duration - elapsed) / EXIT_DURATION, 0, 1)
			: 1
		const visibility = Math.min(enterProgress, exitProgress)
		const pop = 1 - Math.pow(1 - visibility, 3)
		const bob = Math.sin(elapsed * 5.5) * bobAmount
		visual.pos = actor.pos.add(k.vec2(
			screenOffset.x / cameraScale,
			(screenOffset.y + bob) / cameraScale
		))
		visual.scale = k.vec2(pop / cameraScale)
		visual.opacity = pop
	})
	visual.onDestroy(() => active.finish("cancelled", false))
	sound = playEmotionSound(actor, options.sound)
	return handle
}

export function clearEmotion(actor: GameObj<PosComp>) {
	const active = emotionByActor.get(actor)
	if (!active) return false
	active.finish("cancelled")
	return true
}

export function clearAllEmotions() {
	for (const active of [...activeEmotions]) active.finish("cancelled")
}

export function actorEmotion(actor: GameObj<PosComp>) {
	return emotionByActor.get(actor)?.handle.emotion
}

export function emotionPriority(priority: EmotionPriority = "ambient") {
	return typeof priority === "number" ? priority : PRIORITIES[priority]
}

function playEmotionSound(
	actor: GameObj<PosComp>,
	sound: string | EmotionSound | undefined
) {
	if (!sound) return null
	const config: EmotionSound = typeof sound === "string"
		? { id: sound }
		: sound
	if (config.positional === false) {
		return audioService.playSound(config.id, {
			volume: config.volume,
			detune: config.detune,
			speed: config.speed,
		})
	}
	return audioService.playPositionalSound(
		config.id,
		() => actor.exists() ? actor.pos : undefined,
		{
			volume: config.volume,
			detune: config.detune,
			speed: config.speed,
			minDistance: config.minDistance ?? 80,
			maxDistance: config.maxDistance ?? 520,
		}
	)
}
