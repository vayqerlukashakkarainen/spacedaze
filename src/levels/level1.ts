import type { Vec2 } from "kaplay"
import { playerObj } from "../game"
import { dt, k } from "../main"
import { ASTEROID_SPRITES } from "../asteroidSprites"
import { spawnBackgroundObject } from "../spawn/spawnBackgroundObject"
import { clearGeneratedRunMap, startGeneratedRunMap } from "./runMap"
import { getCurrentRunFloor } from "../services/runDirectorService"
import type { Level } from "./levels"

let bgAsteroidTimer = 0

export const level1: Level = {
	mapGeneration: {
		width: 60,
		height: 45,
		hexSize: 48,
		generator: {
			fill: { percentage: 0.48 },
			ca: { iterations: 5 },
			features: {
				resourceNodeCount: 5,
				hazardCount: 3,
				minPoiSpacing: 6,
			},
		},
	},
	reset: () => {
		clearGeneratedRunMap()
		bgAsteroidTimer = 0
	},
	onStart: () => {
		startGeneratedRunMap(
			level1.mapGeneration!,
			getCurrentRunFloor()?.mapSeed
		)
	},
	lvlUpd: () => {
		bgAsteroidTimer += dt()
		if (bgAsteroidTimer < k.rand(1.5, 3)) return
		bgAsteroidTimer = 0

		const side = k.rand(0, 4)
		let startPos: Vec2
		let endPos: Vec2
		if (side < 1) {
			startPos = getPlayerViewportPos(k.vec2(-50, k.rand(0, k.height())))
			endPos = getPlayerViewportPos(
				k.vec2(k.width() + 50, k.rand(0, k.height()))
			)
		} else if (side < 2) {
			startPos = getPlayerViewportPos(
				k.vec2(k.width() + 50, k.rand(0, k.height()))
			)
			endPos = getPlayerViewportPos(k.vec2(-50, k.rand(0, k.height())))
		} else if (side < 3) {
			startPos = getPlayerViewportPos(k.vec2(k.rand(0, k.width()), -50))
			endPos = getPlayerViewportPos(
				k.vec2(k.rand(0, k.width()), k.height() + 50)
			)
		} else {
			startPos = getPlayerViewportPos(
				k.vec2(k.rand(0, k.width()), k.height() + 50)
			)
			endPos = getPlayerViewportPos(k.vec2(k.rand(0, k.width()), -50))
		}

		spawnBackgroundObject({
			pos: startPos,
			moveTo: endPos,
			speed: k.rand(1, 2),
			sprite:
				ASTEROID_SPRITES[
					Math.floor(k.rand(0, ASTEROID_SPRITES.length))
				],
			scale: k.rand(0.5, 1.5),
			color: k.rgb(k.rand(80, 120), k.rand(80, 120), k.rand(80, 120)),
			parallaxLevel: k.rand(4, 10),
			opacity: k.rand(0.3, 0.7),
			rotation: k.rand(0, 360),
			rotationSpeed: k.rand(-0.5, 0.5),
		})
	},
}

function getPlayerViewportPos(screenPos: Vec2) {
	return playerObj.pos.add(screenPos.sub(k.center()))
}
