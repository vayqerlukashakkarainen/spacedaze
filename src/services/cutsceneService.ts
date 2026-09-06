import type { GameObj, PosComp, Vec2 } from "kaplay"
import { k, layers } from "../main"
import { tags } from "../tags"
import {
	hideDialogue,
	showDialogue,
	type DialogueLine,
	type DialogueOptions,
} from "./dialogService"
import {
	showEmotion,
	type EmotionId,
	type EmotionOptions,
} from "./emotionService"
import { acquireGameplayPause } from "./gameplayPauseService"
import { runtimeDebug } from "./runtimeDebugService"

export type CutsceneResult = "completed" | "skipped" | "cancelled"
export type CutsceneEasing =
	| "linear"
	| "easeInCubic"
	| "easeOutCubic"
	| "easeInOutCubic"

export type CutscenePosition =
	| Vec2
	| string
	| (() => Vec2 | undefined)

interface CutsceneWaitStep {
	type: "wait"
	duration: number
}

interface CutsceneDialogueStep {
	type: "dialogue"
	lines: readonly DialogueLine[]
	options?: Omit<
		DialogueOptions,
		"onComplete" | "onSkip" | "pauseGameplay" | "resolveSpeaker"
	>
	skippable?: boolean
}

interface CutsceneParallelStep {
	type: "parallel"
	steps: readonly CutsceneStep[]
}

interface CutsceneActionStep {
	type: "action"
	run: (
		context: CutsceneContext
	) => void | (() => void) | Promise<void | (() => void)>
}

interface CutsceneMoveStep {
	type: "move"
	actor: string
	target: CutscenePosition
	duration: number
	easing?: CutsceneEasing
	finalizeOnSkip?: boolean
}

interface CutsceneRotateStep {
	type: "rotate"
	actor: string
	target: CutscenePosition
	duration: number
	easing?: CutsceneEasing
	finalizeOnSkip?: boolean
}

interface CutsceneCameraStep {
	type: "camera"
	target?: CutscenePosition
	zoom?: number
	duration: number
	easing?: CutsceneEasing
	finalizeOnSkip?: boolean
}

interface CutsceneRestoreCameraStep {
	type: "restoreCamera"
	duration: number
	easing?: CutsceneEasing
}

interface CutsceneEmotionStep {
	type: "emotion"
	actor: string
	emotion: EmotionId
	options?: EmotionOptions
}

export type CutsceneStep =
	| CutsceneWaitStep
	| CutsceneDialogueStep
	| CutsceneParallelStep
	| CutsceneActionStep
	| CutsceneMoveStep
	| CutsceneRotateStep
	| CutsceneCameraStep
	| CutsceneRestoreCameraStep
	| CutsceneEmotionStep

export interface CutsceneDefinition {
	id: string
	steps: readonly CutsceneStep[]
	speakerActors?: Readonly<Record<string, string>>
	pauseGameplay?: boolean
	pauseVisualEffects?: boolean
	restoreCameraOnEnd?: boolean
}

export interface CutscenePlayOptions {
	resolveActor?: (id: string) => GameObj<PosComp> | undefined
	onComplete?: () => void
	onSkip?: () => void
	onCancel?: () => void
}

export interface CutsceneContext {
	readonly id: string
	readonly cancelled: boolean
	resolveActor(id: string): GameObj<PosComp> | undefined
	resolvePosition(target: CutscenePosition): Vec2 | undefined
	defer(cleanup: () => void): () => void
	skip(): void
	cancel(): void
}

interface CameraSnapshot {
	pos: Vec2
	scale: Vec2
}

class CutsceneRuntime implements CutsceneContext {
	readonly id: string
	readonly initialCamera: CameraSnapshot
	readonly blocksGameplay: boolean
	result: CutsceneResult | undefined
	private readonly resolveActorFn?: CutscenePlayOptions["resolveActor"]
	private readonly speakerActors: Readonly<Record<string, string>>
	private readonly cancelListeners = new Set<() => void>()
	private readonly cleanups = new Set<() => void>()

	constructor(
		id: string,
		blocksGameplay: boolean,
		resolveActor?: CutscenePlayOptions["resolveActor"],
		speakerActors: Readonly<Record<string, string>> = {}
	) {
		this.id = id
		this.blocksGameplay = blocksGameplay
		this.resolveActorFn = resolveActor
		this.speakerActors = speakerActors
		this.initialCamera = {
			pos: k.getCamPos().clone(),
			scale: k.getCamScale().clone(),
		}
	}

	get cancelled() {
		return this.result !== undefined
	}

	resolveActor(id: string) {
		const actor = this.resolveActorFn?.(id)
		return actor?.exists() ? actor : undefined
	}

	resolveSpeaker(speaker: string) {
		const actorId = this.speakerActors[speaker.toUpperCase()]
		return actorId ? this.resolveActor(actorId) : undefined
	}

	resolvePosition(target: CutscenePosition) {
		if (typeof target === "string") {
			return this.resolveActor(target)?.pos.clone()
		}
		if (typeof target === "function") return target()?.clone()
		return target.clone()
	}

	defer(cleanup: () => void) {
		let active = true
		this.cleanups.add(cleanup)
		return () => {
			if (!active) return
			active = false
			this.cleanups.delete(cleanup)
			cleanup()
		}
	}

	onCancel(listener: () => void) {
		if (this.cancelled) {
			listener()
			return () => {}
		}
		this.cancelListeners.add(listener)
		return () => this.cancelListeners.delete(listener)
	}

	skip() {
		this.stop("skipped")
	}

	cancel() {
		this.stop("cancelled")
	}

	stop(result: CutsceneResult) {
		if (this.cancelled) return
		this.result = result
		for (const listener of [...this.cancelListeners]) listener()
		this.cancelListeners.clear()
	}

	cleanup() {
		for (const cleanup of [...this.cleanups].reverse()) cleanup()
		this.cleanups.clear()
	}
}

let activeCutscene: CutsceneRuntime | undefined

export function cutsceneActive(id?: string) {
	return activeCutscene !== undefined &&
		(id === undefined || activeCutscene.id === id)
}

export function activeCutsceneId() {
	return activeCutscene?.id
}

export function cutsceneBlocksGameplay() {
	return activeCutscene?.blocksGameplay === true
}

export function skipActiveCutscene() {
	if (!activeCutscene) return false
	activeCutscene.skip()
	return true
}

export function cancelActiveCutscene(id?: string) {
	if (!activeCutscene || (id !== undefined && activeCutscene.id !== id)) {
		return false
	}
	runtimeDebug.log("cutscene", "cutscene:cancel-request", {
		id: activeCutscene.id,
		requestedId: id,
	})
	activeCutscene.cancel()
	return true
}

export async function playCutscene(
	definition: CutsceneDefinition,
	options: CutscenePlayOptions = {}
): Promise<CutsceneResult> {
	runtimeDebug.log("cutscene", "cutscene:start", {
		id: definition.id,
		pauseGameplay: definition.pauseGameplay !== false,
		steps: definition.steps.length,
	})
	activeCutscene?.cancel()
	const runtime = new CutsceneRuntime(
		definition.id,
		definition.pauseGameplay !== false,
		options.resolveActor,
		definition.speakerActors
	)
	activeCutscene = runtime
	if (definition.restoreCameraOnEnd !== false) {
		runtime.defer(() => {
			k.setCamPos(runtime.initialCamera.pos)
			k.setCamScale(runtime.initialCamera.scale)
		})
	}
	if (definition.pauseGameplay !== false) {
		const resume = acquireGameplayPause(
			`cutscene:${definition.id}`,
			getGameplayObjects(definition.pauseVisualEffects !== false)
		)
		runtime.defer(resume)
	}

	let result: CutsceneResult = "cancelled"
	try {
		await runSteps(definition.steps, runtime)
		result = runtime.result ?? "completed"
	} finally {
		if (activeCutscene === runtime) hideDialogue()
		runtime.cleanup()
		if (activeCutscene === runtime) activeCutscene = undefined
	}
	if (result === "completed") options.onComplete?.()
	if (result === "skipped") options.onSkip?.()
	if (result === "cancelled") options.onCancel?.()
	runtimeDebug.log("cutscene", "cutscene:complete", {
		id: definition.id,
		result,
	})
	return result
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

async function runSteps(
	steps: readonly CutsceneStep[],
	runtime: CutsceneRuntime
) {
	for (const step of steps) {
		if (runtime.cancelled) return
		await runStep(step, runtime)
	}
}

async function runStep(step: CutsceneStep, runtime: CutsceneRuntime) {
	if (runtime.cancelled) return
	runtimeDebug.log("cutscene", "cutscene:step", {
		id: runtime.id,
		type: step.type,
	})
	switch (step.type) {
		case "wait":
			await waitFor(step.duration, runtime)
			return
		case "dialogue": {
			const dialogue = showDialogue(step.lines, {
				...step.options,
				pauseGameplay: false,
				resolveSpeaker: (speaker) => runtime.resolveSpeaker(speaker),
				onSkip: step.skippable ? () => runtime.skip() : undefined,
			})
			const removeCancelListener = runtime.onCancel(hideDialogue)
			const result = await dialogue
			removeCancelListener()
			if (result === "cancelled" && !runtime.cancelled) runtime.cancel()
			return
		}
		case "parallel":
			await Promise.all(step.steps.map((child) => runStep(child, runtime)))
			return
		case "action": {
			const cleanup = await step.run(runtime)
			if (typeof cleanup === "function") runtime.defer(cleanup)
			return
		}
		case "move":
			await moveActor(step, runtime)
			return
		case "rotate":
			await rotateActor(step, runtime)
			return
		case "camera":
			await moveCamera(step, runtime)
			return
		case "restoreCamera":
			await moveCamera({
				type: "camera",
				target: runtime.initialCamera.pos,
				zoom: runtime.initialCamera.scale.x,
				duration: step.duration,
				easing: step.easing,
			}, runtime)
			return
		case "emotion": {
			const actor = runtime.resolveActor(step.actor)
			if (!actor) return
			const emotion = showEmotion(actor, step.emotion, step.options)
			if (emotion) runtime.defer(emotion.cancel)
			return
		}
	}
}

function waitFor(duration: number, runtime: CutsceneRuntime) {
	return new Promise<void>((resolve) => {
		let settled = false
		let timer: ReturnType<typeof k.wait> | undefined
		let removeCancelListener = () => {}
		const finish = () => {
			if (settled) return
			settled = true
			timer?.cancel()
			removeCancelListener()
			resolve()
		}
		timer = k.wait(Math.max(0, duration), finish)
		removeCancelListener = runtime.onCancel(finish)
	})
}

function moveActor(step: CutsceneMoveStep, runtime: CutsceneRuntime) {
	const actor = runtime.resolveActor(step.actor)
	const target = runtime.resolvePosition(step.target)
	if (!actor || !target) return Promise.resolve()
	const start = actor.pos.clone()
	return tweenValue(
		step.duration,
		step.easing,
		runtime,
		(progress) => {
			if (actor.exists()) actor.pos = start.lerp(target, progress)
		},
		() => {
			if (
				runtime.result === "skipped" &&
				step.finalizeOnSkip !== false &&
				actor.exists()
			) {
				actor.pos = target.clone()
			}
		}
	)
}

function rotateActor(step: CutsceneRotateStep, runtime: CutsceneRuntime) {
	const actor = runtime.resolveActor(step.actor) as
		| (GameObj<PosComp> & { angle?: number })
		| undefined
	const target = runtime.resolvePosition(step.target)
	if (!actor || !target || typeof actor.angle !== "number") {
		return Promise.resolve()
	}
	const direction = target.sub(actor.pos)
	if (direction.len() <= 0.001) return Promise.resolve()
	const startAngle = actor.angle
	const targetAngle = direction.angle() + 90
	const angleDelta = ((targetAngle - startAngle + 540) % 360) - 180
	return tweenValue(
		step.duration,
		step.easing,
		runtime,
		(progress) => {
			if (actor.exists()) actor.angle = startAngle + angleDelta * progress
		},
		() => {
			if (
				runtime.result === "skipped" &&
				step.finalizeOnSkip !== false &&
				actor.exists()
			) {
				actor.angle = targetAngle
			}
		}
	)
}

function moveCamera(step: CutsceneCameraStep, runtime: CutsceneRuntime) {
	const startPos = k.getCamPos().clone()
	const startZoom = k.getCamScale().x
	const targetPos = step.target
		? runtime.resolvePosition(step.target)
		: startPos
	const targetZoom = step.zoom ?? startZoom
	if (!targetPos) return Promise.resolve()
	return tweenValue(
		step.duration,
		step.easing,
		runtime,
		(progress) => {
			k.setCamPos(startPos.lerp(targetPos, progress))
			k.setCamScale(k.lerp(startZoom, targetZoom, progress))
		},
		() => {
			if (
				runtime.result === "skipped" &&
				step.finalizeOnSkip === true
			) {
				k.setCamPos(targetPos)
				k.setCamScale(targetZoom)
			}
		}
	)
}

function tweenValue(
	duration: number,
	easing: CutsceneEasing | undefined,
	runtime: CutsceneRuntime,
	apply: (progress: number) => void,
	onCancel?: () => void
) {
	return new Promise<void>((resolve) => {
		let elapsed = 0
		let settled = false
		let controller: ReturnType<typeof k.onUpdate> | undefined
		let removeCancelListener = () => {}
		const finish = (cancelled: boolean) => {
			if (settled) return
			settled = true
			controller?.cancel()
			removeCancelListener()
			if (cancelled) onCancel?.()
			resolve()
		}
		controller = k.onUpdate(() => {
			elapsed += k.dt()
			const progress = duration <= 0
				? 1
				: k.clamp(elapsed / duration, 0, 1)
			apply(ease(progress, easing))
			if (progress >= 1) finish(false)
		})
		removeCancelListener = runtime.onCancel(() => finish(true))
	})
}

function ease(value: number, easing: CutsceneEasing = "easeInOutCubic") {
	switch (easing) {
		case "linear":
			return value
		case "easeInCubic":
			return value * value * value
		case "easeOutCubic":
			return 1 - Math.pow(1 - value, 3)
		case "easeInOutCubic":
			return value < 0.5
				? 4 * value * value * value
				: 1 - Math.pow(-2 * value + 2, 3) / 2
	}
}
