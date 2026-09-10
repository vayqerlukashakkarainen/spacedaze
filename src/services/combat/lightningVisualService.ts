import type { Color, Vec2 } from "kaplay"
import { k } from "../../main"

export interface DrawLightningOptions {
	start: Vec2
	end: Vec2
	color: Color
	opacity?: number
	width?: number
	segmentLength?: number
	amplitude?: number
	waveCount?: number
	smoothness?: number
	flickerRate?: number
	seed?: number
	branchChance?: number
	branchLength?: number
	branchColor?: Color
}

/**
 * Draws a deterministic, animated lightning strand in the current draw space.
 * Smoothness ranges from angular electrical zigzags (0) to a flowing tether (1).
 */
export function drawLightning(options: DrawLightningOptions) {
	const delta = options.end.sub(options.start)
	const distance = delta.len()
	if (distance <= 0.001) return
	const direction = delta.unit()
	const normal = direction.normal()
	const segmentLength = Math.max(3, options.segmentLength ?? 12)
	const segmentCount = Math.max(2, Math.ceil(distance / segmentLength))
	const amplitude = options.amplitude ?? 7
	const waveCount = options.waveCount ?? 1.5
	const smoothness = k.clamp(options.smoothness ?? 0.35, 0, 1)
	const opacity = options.opacity ?? 1
	const width = options.width ?? 1
	const seed = options.seed ?? 0
	const flickerFrame = Math.floor(k.time() * (options.flickerRate ?? 18))
	const branchChance = k.clamp(options.branchChance ?? 0, 0, 1)
	const branchLength = options.branchLength ?? 12
	let previous = options.start

	for (let index = 1; index <= segmentCount; index++) {
		const progress = index / segmentCount
		const envelope = Math.sin(progress * Math.PI)
		const raw = signedNoise(index, flickerFrame, seed)
		const neighborAverage = (
			signedNoise(index - 1, flickerFrame, seed) +
			raw * 2 +
			signedNoise(index + 1, flickerFrame, seed)
		) / 4
		const jitter = k.lerp(raw, neighborAverage, smoothness)
		const wave = Math.sin(
			progress * Math.PI * 2 * waveCount + seed * 1.71
		)
		const offset = (jitter * k.lerp(1, 0.28, smoothness) + wave * smoothness) *
			amplitude * envelope
		const next = index === segmentCount
			? options.end
			: options.start
				.add(direction.scale(distance * progress))
				.add(normal.scale(offset))
		k.drawLine({
			p1: previous,
			p2: next,
			width,
			color: options.color,
			opacity,
		})

		if (
			index < segmentCount &&
			unsignedNoise(index, flickerFrame, seed + 19.3) < branchChance
		) {
			const branchSide = signedNoise(index, flickerFrame, seed + 31.7) < 0
				? -1
				: 1
			const branchDirection = direction
				.add(normal.scale(branchSide * k.lerp(0.65, 1.4, 1 - smoothness)))
				.unit()
			const branchEnd = next.add(branchDirection.scale(
				branchLength * k.lerp(0.55, 1, unsignedNoise(index, flickerFrame, seed + 47.1))
			))
			k.drawLine({
				p1: next,
				p2: branchEnd,
				width: Math.max(0.7, width * 0.65),
				color: options.branchColor ?? options.color,
				opacity: opacity * 0.72,
			})
		}
		previous = next
	}
}

function signedNoise(index: number, frame: number, seed: number) {
	return unsignedNoise(index, frame, seed) * 2 - 1
}

function unsignedNoise(index: number, frame: number, seed: number) {
	const value = Math.sin(
		index * 127.1 + frame * 311.7 + seed * 74.7
	) * 43758.5453
	return value - Math.floor(value)
}
