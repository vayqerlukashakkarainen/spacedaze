import type { GameObj } from "kaplay"
import { k, layers } from "../main"

export interface SpaceJumpStreak {
	angle: number
	phase: number
	speed: number
	width: number
	cyan: boolean
}

interface SpaceJumpBackdropOptions {
	tags?: string[]
	z?: number
	onSpeedChange?: (progress: number, speedMultiplier: number) => void
}

export type SpaceJumpBackdrop = GameObj & {
	coverOpacity: number
	washOpacity: number
	speedProgress: number
}

export function spawnSpaceJumpBackdrop(
	options: SpaceJumpBackdropOptions = {}
) {
	const streaks = createSpaceJumpStreaks(120)
	let elapsed = 0
	let visualTime = 0
	return k.add([
		k.pos(0, 0),
		k.fixed(),
		k.layer(layers.gameText),
		k.z(options.z ?? 9000),
		...(options.tags ?? []),
		{
			coverOpacity: 1,
			washOpacity: 1,
			speedProgress: 0,
			update() {
				elapsed += k.dt()
				this.speedProgress = k.clamp(elapsed / 5, 0, 1)
				const easedSpeed = this.speedProgress * this.speedProgress *
					(3 - 2 * this.speedProgress)
				const speedMultiplier = k.lerp(2.6, 6.5, easedSpeed)
				visualTime += k.dt() * speedMultiplier
				options.onSpeedChange?.(this.speedProgress, speedMultiplier)
			},
			draw() {
				k.drawRect({
					pos: k.vec2(0, 0),
					width: k.width(),
					height: k.height(),
					color: k.rgb(0, 4, 8),
					opacity: this.coverOpacity,
				})
				drawSpaceJump(streaks, visualTime, 1, this.washOpacity)
			},
		},
	]) as SpaceJumpBackdrop
}

export function drawSpaceJump(
	streaks: readonly SpaceJumpStreak[],
	elapsed: number,
	intensity: number,
	washOpacity: number = 1
) {
	if (intensity <= 0) return
	const center = k.center()
	const maxRadius = Math.hypot(k.width(), k.height()) * 0.72
	k.drawRect({
		pos: k.vec2(0, 0),
		width: k.width(),
		height: k.height(),
		color: k.rgb(0, 34, 48),
		opacity: intensity * 0.24 * washOpacity,
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

export function createSpaceJumpStreaks(count: number): SpaceJumpStreak[] {
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

export function destroySpaceJumpBackdrop(backdrop: GameObj | undefined) {
	if (backdrop?.exists()) k.destroy(backdrop)
}

export function revealWorldBehindSpaceJump(backdrop: SpaceJumpBackdrop | undefined) {
	if (!backdrop?.exists()) return
	backdrop.coverOpacity = 0
	backdrop.washOpacity = 0
}
