import type { GameObj, Vec2 } from "kaplay"
import { k, layers } from "../main"
import { tags } from "../tags"

interface SpaceStar {
	u: number
	v: number
	size: number
	phase: number
	speed: number
	depth: number
	cyan: boolean
}

interface SpaceAmbienceProps {
	parent?: GameObj
	size?: Vec2
	starCount?: number
	seed?: number
	parallax?: boolean
	tags?: string[]
	backgroundOpacity?: number
	glowOpacity?: number
}

export function createSpaceAmbience({
	parent,
	size = k.vec2(k.width(), k.height()),
	starCount = 70,
	seed = 7,
	parallax = false,
	tags: ambienceTags = [],
	backgroundOpacity = 1,
	glowOpacity = 1,
}: SpaceAmbienceProps = {}) {
	const stars = createStars(starCount, seed)
	const components = [
		k.pos(0, 0),
		{
			draw() {
				drawAmbientBackground(size, backgroundOpacity)
				drawStars(stars, size, parallax)
				if (glowOpacity > 0) {
					drawAmbientGlow(size, backgroundOpacity * glowOpacity)
				}
			},
		},
		...ambienceTags,
	]
	if (parent) {
		return parent.add([
			...components,
			k.layer(layers.bg),
			k.z(-10000),
		])
	}
	return k.add([
		...components,
		k.fixed(),
		k.layer(layers.bg),
		k.z(-10000),
	])
}

export function spawnGameplaySpaceAmbience() {
	return createSpaceAmbience({
		starCount: 82,
		seed: 31,
		parallax: true,
		backgroundOpacity: 0.92,
		glowOpacity: 0,
		tags: [tags.levelBg, tags.gameLoop],
	})
}

function drawAmbientBackground(size: Vec2, opacity: number) {
	k.drawRect({
		pos: k.vec2(0, 0),
		width: size.x,
		height: size.y,
		color: k.rgb(2, 7, 11),
		opacity,
	})
}

function drawAmbientGlow(size: Vec2, opacity: number) {
	const glowCenter = k.vec2(size.x * 0.74, size.y * 0.43)
	const glowRadius = Math.max(size.x, size.y) * 0.48
	for (let band = 5; band >= 1; band--) {
		k.drawCircle({
			pos: glowCenter,
			radius: glowRadius * (band / 5),
			color: k.rgb(0, 82, 104),
			opacity: 0.012 * opacity,
			anchor: "center",
		})
	}
}

function drawStars(stars: readonly SpaceStar[], size: Vec2, parallax: boolean) {
	const camera = parallax ? k.getCamPos() : k.vec2(0, 0)
	for (const star of stars) {
		const x = wrap(star.u * size.x - camera.x / star.depth, size.x)
		const y = wrap(star.v * size.y - camera.y / star.depth, size.y)
		const shimmer = (Math.sin(k.time() * star.speed + star.phase) + 1) / 2
		const brightness = 0.22 + shimmer * 0.72
		k.drawRect({
			pos: k.vec2(Math.round(x), Math.round(y)),
			width: star.size,
			height: star.size,
			color: star.cyan ? k.rgb(0, 207, 255) : k.rgb(234, 247, 250),
			opacity: brightness,
		})
	}
}

function createStars(count: number, seed: number): SpaceStar[] {
	let state = seed >>> 0
	const random = () => {
		state = (state * 1664525 + 1013904223) >>> 0
		return state / 0x100000000
	}
	return Array.from({ length: count }, () => ({
		u: random(),
		v: random(),
		size: random() > 0.84 ? 2 : 1,
		phase: random() * Math.PI * 2,
		speed: 0.65 + random() * 1.8,
		depth: 9 + random() * 24,
		cyan: random() > 0.86,
	}))
}

function wrap(value: number, max: number) {
	return ((value % max) + max) % max
}
