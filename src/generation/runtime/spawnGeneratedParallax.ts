import type { Vec2 } from "kaplay"
import { ASTEROID_SPRITES } from "../../asteroidSprites"
import type { HexGrid } from "../../grid/hexGrid"
import { k } from "../../main"
import { spawnBackgroundObject } from "../../spawn/spawnBackgroundObject"
import { SeededRNG } from "../seededRng"

const FOLIAGE_SPRITES = [
	"foliage_void_fern",
	"foliage_space_coral",
	"foliage_spore_cluster",
	"foliage_crystal_grass",
] as const

export function spawnGeneratedParallax(
	grid: HexGrid,
	width: number,
	height: number,
	seed: number
) {
	const rng = new SeededRNG(seed ^ 0x51a7f00d)
	const initialCameraPos = k.getCamPos().clone()
	const decorationCount = Math.max(
		28,
		Math.min(52, Math.round((width * height) / 70))
	)

	for (let index = 0; index < decorationCount; index++) {
		const targetPosition = randomMapPosition(grid, width, height, rng)
		const roll = rng.nextFloat()

		if (index < 2) {
			spawnDecoration({
				targetPosition,
				initialCameraPos,
				parallaxLevel: randomRange(rng, 13, 20),
				sprite: index === 0
					? "bg_destroyed_planet"
					: "bg_destroyed_planet_sliced",
				scale: randomRange(rng, 0.2, 0.36),
				shade: rng.nextInt(18, 31),
				opacity: randomRange(rng, 0.48, 0.72),
				rotation: randomRange(rng, 0, 360),
				rotationSpeed: randomRange(rng, -0.006, 0.006),
			})
			continue
		}

		if (roll < 0.28) {
			spawnDecoration({
				targetPosition,
				initialCameraPos,
				parallaxLevel: randomRange(rng, 7, 12),
				sprite: rng.choice([...FOLIAGE_SPRITES]),
				scale: randomRange(rng, 0.25, 0.55),
				shade: rng.nextInt(24, 47),
				opacity: randomRange(rng, 0.38, 0.64),
				rotation: randomRange(rng, 0, 360),
				rotationSpeed: randomRange(rng, -0.012, 0.012),
			})
			continue
		}

		if (roll < 0.5) {
			const moon = rng.nextBool(0.38)
			spawnDecoration({
				targetPosition,
				initialCameraPos,
				parallaxLevel: randomRange(rng, 5, 10),
				sprite: moon ? "bg_moon1" : "bg_building1",
				scale: moon
					? randomRange(rng, 1.1, 2.4)
					: randomRange(rng, 0.7, 1.6),
				shade: rng.nextInt(28, 55),
				opacity: randomRange(rng, 0.4, 0.7),
				rotation: randomRange(rng, 0, 360),
				rotationSpeed: randomRange(rng, -0.018, 0.018),
			})
			continue
		}

		spawnDecoration({
			targetPosition,
			initialCameraPos,
			parallaxLevel: randomRange(rng, 3, 8),
			sprite: rng.choice([...ASTEROID_SPRITES]),
			scale: randomRange(rng, 0.65, 2.1),
			shade: rng.nextInt(38, 74),
			opacity: randomRange(rng, 0.34, 0.68),
			rotation: randomRange(rng, 0, 360),
			rotationSpeed: randomRange(rng, -0.025, 0.025),
		})
	}
}

interface DecorationProps {
	targetPosition: Vec2
	initialCameraPos: Vec2
	parallaxLevel: number
	sprite: string
	scale: number
	shade: number
	opacity: number
	rotation: number
	rotationSpeed: number
}

function spawnDecoration(props: DecorationProps) {
	const spawnPosition = props.initialCameraPos.add(
		props.targetPosition
			.sub(props.initialCameraPos)
			.scale(1 / props.parallaxLevel)
	)
	spawnBackgroundObject({
		pos: spawnPosition,
		sprite: props.sprite,
		scale: props.scale,
		color: k.rgb(props.shade, props.shade, props.shade),
		parallaxLevel: props.parallaxLevel,
		opacity: props.opacity,
		rotation: props.rotation,
		rotationSpeed: props.rotationSpeed,
	})
}

function randomMapPosition(
	grid: HexGrid,
	width: number,
	height: number,
	rng: SeededRNG
) {
	const coord = {
		q: rng.nextInt(0, width),
		r: rng.nextInt(0, height),
	}
	const jitter = k.vec2(
		randomRange(rng, -grid.config.hexSize, grid.config.hexSize),
		randomRange(rng, -grid.config.hexSize, grid.config.hexSize)
	)
	return grid.hexToScreen(coord).add(jitter)
}

function randomRange(rng: SeededRNG, min: number, max: number) {
	return min + (max - min) * rng.nextFloat()
}
