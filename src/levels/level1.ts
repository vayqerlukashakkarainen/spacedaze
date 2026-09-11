import type { Vec2 } from "kaplay"
import { playerObj } from "../game"
import { dt, k } from "../main"
import { ASTEROID_SPRITES } from "../asteroidSprites"
import { spawnBackgroundObject } from "../spawn/spawnBackgroundObject"
import { getCurrentRunFloor } from "../services/runs/runDirectorService"
import { shouldStartPrologue } from "../services/narrative/narrativeService"
import type { Level } from "./levels"
import {
	clearGeneratedRoomFloor,
	startGeneratedRoomFloor,
} from "./roomFloorRuntime"

let bgAsteroidTimer = 0
const PROLOGUE_ROOM_COUNT = 100

export const level1: Level = {
	mapGeneration: {
		width: 48,
		height: 36,
		hexSize: 96,
	},
	reset: () => {
		clearGeneratedRoomFloor()
		bgAsteroidTimer = 0
	},
	onStart: () => {
		const runFloor = getCurrentRunFloor()
		const prologueFloor = runFloor === undefined && shouldStartPrologue()
		startGeneratedRoomFloor(
			level1.mapGeneration!,
			runFloor?.mapSeed ?? Math.floor(k.rand(1, 1000000)),
			1,
			{
				endless: prologueFloor,
				roomCount: prologueFloor ? PROLOGUE_ROOM_COUNT : undefined,
				maxRoomCount: prologueFloor ? PROLOGUE_ROOM_COUNT : undefined,
			}
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
			color: k.rgb(k.rand(28, 52), k.rand(34, 60), k.rand(40, 68)),
			parallaxLevel: k.rand(4, 10),
			rotation: k.rand(0, 360),
			rotationSpeed: k.rand(-0.5, 0.5),
		})
	},
}

function getPlayerViewportPos(screenPos: Vec2) {
	return playerObj.pos.add(screenPos.sub(k.center()))
}
