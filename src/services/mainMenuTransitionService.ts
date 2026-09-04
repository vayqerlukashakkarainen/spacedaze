import type {
	GameObj,
	OpacityComp,
	PosComp,
	ScaleComp,
	Vec2,
} from "kaplay"
import { k, layers, mainSoundVolume } from "../main"
import { tags } from "../tags"
import { audioService } from "./audioService"

type AnimatedMenuObject = GameObj<PosComp | OpacityComp>
type AnimatedPlanet = GameObj<PosComp | ScaleComp | OpacityComp>

interface MainMenuSpaceJumpOptions {
	interfaceRoot: AnimatedMenuObject
	planet: AnimatedPlanet
	planetTargetPos: Vec2
	onJump: () => void
}

interface JumpStreak {
	angle: number
	phase: number
	speed: number
	width: number
	cyan: boolean
}

const FADE_DURATION = 0.5
const PLANET_ALIGN_DURATION = 0.58
const JUMP_START = 0.64
const PLANET_ZOOM_START = JUMP_START + 1
const FLASH_START = JUMP_START + 2.84
const FLASH_PEAK = JUMP_START + 2.9
const FLASH_END = JUMP_START + 2.96
const PLANET_JUMP_ZOOM = 1.04

export function startMainMenuSpaceJump(
	options: MainMenuSpaceJumpOptions
) {
	const interfaceStartPos = options.interfaceRoot.pos.clone()
	const fadingObjects = collectFadingObjects(options.interfaceRoot)
	const planetStartPos = options.planet.pos.clone()
	const planetStartScale = options.planet.scale.clone()
	const planetStartOpacity = options.planet.opacity
	const streaks = createJumpStreaks(120)
	let elapsed = 0
	let jumped = false
	let warpSoundStarted = false
	let shakeTimer = 0

	const effect = k.add([
		k.pos(0, 0),
		k.fixed(),
		k.layer(layers.uiEffects),
		k.z(10000),
		tags.mainMenuTransition,
		{
			update() {
				elapsed += k.dt()
				if (!warpSoundStarted && elapsed >= JUMP_START) {
					warpSoundStarted = true
					audioService.playSound("menu_spacejump_warp", {
						volume: mainSoundVolume * 0.9,
					})
				}
				const fade = easeOutCubic(k.clamp(elapsed / FADE_DURATION, 0, 1))
				if (options.interfaceRoot.exists()) {
					options.interfaceRoot.pos = interfaceStartPos.add(-34 * fade, 0)
					options.interfaceRoot.hidden = fade >= 0.99
				}
				for (const fadingObject of fadingObjects) {
					if (fadingObject.object.exists()) {
						fadingObject.object.opacity = fadingObject.startOpacity * (1 - fade)
					}
				}
				if (options.planet.exists()) {
					const alignment = easeInOutCubic(
						k.clamp(elapsed / PLANET_ALIGN_DURATION, 0, 1)
					)
					options.planet.pos = planetStartPos.lerp(
						options.planetTargetPos,
						alignment
					)
					options.planet.opacity = k.lerp(
						planetStartOpacity,
						0.92,
						alignment
					)
			const jumpAcceleration = easeInQuad(
				k.clamp(
					(elapsed - PLANET_ZOOM_START) /
						(FLASH_PEAK - PLANET_ZOOM_START),
					0,
					1
						)
					)
					options.planet.scale = planetStartScale.scale(
						k.lerp(1, PLANET_JUMP_ZOOM, jumpAcceleration)
					)
				}

				if (elapsed > JUMP_START && elapsed < FLASH_PEAK) {
					shakeTimer -= k.dt()
					if (shakeTimer <= 0) {
						const acceleration = easeInQuad(
							k.clamp(
								(elapsed - JUMP_START) / (FLASH_PEAK - JUMP_START),
								0,
								1
							)
						)
						k.shake(k.lerp(0.15, 7, acceleration))
						shakeTimer = k.lerp(0.12, 0.05, acceleration)
					}
				}

				if (!jumped && elapsed >= FLASH_PEAK) {
					jumped = true
					options.onJump()
				}
				if (elapsed >= FLASH_END) k.destroy(this)
			},
			draw() {
				const jumpRamp = easeInQuad(
					k.clamp((elapsed - JUMP_START) / (FLASH_PEAK - JUMP_START), 0, 1)
				)
				const jump = elapsed <= FLASH_PEAK
					? jumpRamp
					: k.clamp(1 - (elapsed - FLASH_PEAK) / (FLASH_END - FLASH_PEAK), 0, 1)
				drawSpaceJump(streaks, elapsed, jump)
				const flashOpacity = elapsed < FLASH_PEAK
					? k.clamp((elapsed - FLASH_START) / (FLASH_PEAK - FLASH_START), 0, 1)
					: k.clamp(1 - (elapsed - FLASH_PEAK) / (FLASH_END - FLASH_PEAK), 0, 1)
				if (flashOpacity > 0) {
					k.drawRect({
						pos: k.vec2(0, 0),
						width: k.width(),
						height: k.height(),
						color: k.WHITE,
						opacity: flashOpacity,
					})
				}
			},
		},
	])
	return effect
}

function drawSpaceJump(
	streaks: readonly JumpStreak[],
	elapsed: number,
	intensity: number
) {
	if (intensity <= 0) return
	const center = k.center()
	const maxRadius = Math.hypot(k.width(), k.height()) * 0.72
	k.drawRect({
		pos: k.vec2(0, 0),
		width: k.width(),
		height: k.height(),
		color: k.rgb(0, 34, 48),
		opacity: intensity * 0.24,
	})
	for (const streak of streaks) {
		const acceleration = elapsed * 0.2 + intensity * intensity * 5.2
		const progress = (streak.phase + acceleration * streak.speed) % 1
		const distance = 16 + progress * progress * maxRadius
		const length = (12 + progress * 280) * intensity
		const direction = k.Vec2.fromAngle(streak.angle)
		k.drawLine({
			p1: center.add(direction.scale(distance)),
			p2: center.add(direction.scale(distance + length)),
			width: streak.width,
			color: streak.cyan ? k.rgb(0, 207, 255) : k.WHITE,
			opacity: intensity * (0.42 + progress * 0.58),
		})
	}
}

function collectFadingObjects(root: GameObj) {
	return [root, ...root.get("*", { recursive: true })].map((object) => {
		if (!object.has("opacity")) object.use(k.opacity(1))
		const fadingObject = object as GameObj<OpacityComp>
		return {
			object: fadingObject,
			startOpacity: fadingObject.opacity,
		}
	})
}

function createJumpStreaks(count: number): JumpStreak[] {
	let state = 41
	const random = () => {
		state = (state * 1664525 + 1013904223) >>> 0
		return state / 0x100000000
	}
	return Array.from({ length: count }, () => ({
		angle: random() * 360,
		phase: random(),
		speed: 0.55 + random() * 1.6,
		width: random() > 0.9 ? 3 : random() > 0.72 ? 2 : 1,
		cyan: random() > 0.8,
	}))
}

function easeInQuad(value: number) {
	return value * value
}

function easeInOutCubic(value: number) {
	return value < 0.5
		? 4 * value * value * value
		: 1 - Math.pow(-2 * value + 2, 3) / 2
}

function easeOutCubic(value: number) {
	return 1 - Math.pow(1 - value, 3)
}
