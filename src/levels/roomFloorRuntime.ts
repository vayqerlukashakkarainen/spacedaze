import type { GameObj, Vec2 } from "kaplay"
import { gridCollision } from "../comp/gridCollision"
import { generationMapToHexGrid } from "../generation/gridConversion"
import { hexNeighbors } from "../generation/hexUtils"
import {
	buildRoomTemplate,
	oppositeRoomDirection,
	type BuiltRoomTemplate,
} from "../generation/rooms/roomTemplateBuilder"
import type { RoomFloorRoom } from "../generation/rooms/roomFloorTypes"
import { playerObj } from "../game"
import { ACTIVE_RUN_GRID_KEY } from "../grid/gridKeys"
import { gridRegistry } from "../grid/gridRegistry"
import { hexToPixel } from "../grid/hexCoord"
import { CellType, type HexGrid } from "../grid/hexGrid"
import { k, layers, mainSoundVolume } from "../main"
import {
	beginRoomFloor,
	clearRoomFloor,
	enterFloorRoom,
	getActiveRoomFloor,
	getCurrentFloorRoom,
	markCurrentRoomContentCompleted,
	markCurrentFloorRoomCleared,
	markFloorEnemyDefeated,
	teleportToFloorRoom as teleportRoomState,
} from "../services/roomFloorService"
import { spawnPlannedEnemy } from "../services/enemyEncounterService"
import { audioService } from "../services/audioService"
import { getBossHealth } from "../services/bossRegistry"
import type { ProgressionEnemyId } from "../services/enemyProgressionService"
import { getHubLevel } from "../services/hubProgressService"
import { resetPlayerPath } from "../services/playerPathService"
import {
	addLocalLight,
	updateLocalLight,
} from "../services/localLightService"
import { startThreatLevel, stopThreatLevel, updateThreatLevel } from "../services/threatService"
import { spawnBoss1 } from "../spawn/spawnBoss1"
import { spawnChest } from "../spawn/spawnChest"
import { spawnFlash } from "../spawn/spawnFlash"
import { spawnGravityPull } from "../spawn/spawnGravityPull"
import { spawnImpactAce } from "../spawn/spawnImpactAce"
import { spawnRing } from "../spawn/spawnRing"
import { spawnDecorativeWormhole } from "../spawn/spawnLevel"
import { spawnRunUpgradeShop } from "../spawn/rooms/spawnRunUpgradeShop"
import { spawnHealthShrine } from "../spawn/shrine/spawnHealthShrine"
import { spawnShrine } from "../spawn/shrine/spawnShrine"
import { playPlayerRespawnTransition } from "../setupPlayer"
import { tags } from "../tags"
import type { GeneratedMapConfig } from "./levels"
import { spawnFloorExit } from "./runMap"
import {
	getRunRockTileFrame,
	RUN_ROCK_TILE_ANCHOR_Y,
	RUN_ROCK_TILE_SOURCE_RADIUS,
	RUN_ROCK_TILE_SPRITE,
} from "./runRockTiles"

const ROOM_TRANSITION_COOLDOWN = 0.45
const ROOM_ENTRY_INSET = 2
const ROOM_HEX_SIZE = 42
const ROOM_PROJECTION_Y_SCALE = 2 / Math.sqrt(3)
const HOSTILE_ARRIVAL_GHOST_DURATION = 0.48
const HOSTILE_ARRIVAL_JUMP_DURATION = 0.42
const HOSTILE_ARRIVAL_JUMP_DISTANCE = 180
const HOSTILE_ARRIVAL_STAGGER = 0.07
const HOSTILE_ARRIVAL_COLOR = [255, 75, 90] as const
const GRAVITY_ROOM_COLOR = [174, 112, 255] as const
const GRAVITY_ROOM_WORMHOLE_OFFSET_Y = -18

let active = false
let activeConfig: GeneratedMapConfig | undefined
let transitionCooldown = 0

interface HostileArrivalPart {
	sprite: string
	offset?: readonly [number, number]
}

interface HostileArrivalVisual {
	parts: readonly HostileArrivalPart[]
	scale: number
}

const HOSTILE_ARRIVAL_VISUALS: Record<ProgressionEnemyId, HostileArrivalVisual> = {
	"swarm-drone": { parts: [{ sprite: "enemy_swarm_drone" }], scale: 0.5 },
	fighter: {
		parts: [
			{ sprite: "enemy_ship1_body" },
			{ sprite: "enemy_ship1_left_wing", offset: [-6, -2] },
			{ sprite: "enemy_ship1_right_wing", offset: [6, -2] },
		],
		scale: 1,
	},
	assassin: { parts: [{ sprite: "enemy_ship1" }], scale: 1 },
	rammer: { parts: [{ sprite: "enemy_rammer" }], scale: 0.9 },
	sniper: { parts: [{ sprite: "enemy_sniper" }], scale: 0.95 },
	hivemind: { parts: [{ sprite: "enemy_swarm_hivemind" }], scale: 0.72 },
	"mine-layer": { parts: [{ sprite: "enemy_mine_layer" }], scale: 1 },
	"shield-drone": { parts: [{ sprite: "enemy_shield_drone" }], scale: 0.72 },
	"orbit-lancer": { parts: [{ sprite: "enemy_orbit_lancer" }], scale: 0.82 },
	splitter: { parts: [{ sprite: "enemy_splitter" }], scale: 1.05 },
	"siege-barge": { parts: [{ sprite: "enemy_siege_barge" }], scale: 1.15 },
	"tether-drone": { parts: [{ sprite: "enemy_tether_drone" }], scale: 0.78 },
	"repair-skiff": { parts: [{ sprite: "enemy_repair_skiff" }], scale: 0.72 },
	"gravity-warden": { parts: [{ sprite: "enemy_gravity_warden" }], scale: 0.9 },
	"phase-skirmisher": { parts: [{ sprite: "enemy_phase_skirmisher" }], scale: 0.82 },
	"salvage-scavenger": { parts: [{ sprite: "enemy_salvage_scavenger" }], scale: 0.76 },
	suppressor: { parts: [{ sprite: "enemy_suppressor" }], scale: 0.92 },
	"breach-crawler": { parts: [{ sprite: "enemy_breach_crawler" }], scale: 0.92 },
}

const IMPACT_ACE_ARRIVAL_VISUAL: HostileArrivalVisual = {
	parts: [{ sprite: "enemy_impact_ace" }],
	scale: 1,
}

const DREADNOUGHT_ARRIVAL_VISUAL: HostileArrivalVisual = {
	parts: [{ sprite: "boss1_body" }],
	scale: 1,
}

export function startGeneratedRoomFloor(
	config: GeneratedMapConfig,
	seed: number,
	depth: number
) {
	clearGeneratedRoomFloor()
	active = true
	activeConfig = config
	beginRoomFloor(seed, depth, {
		milestoneBoss: depth > 0 && depth % 3 === 0,
		hubLevel: getHubLevel(),
	})
	startThreatLevel(depth)
	spawnFloorController()
	loadCurrentRoom()
	return seed
}

export function clearGeneratedRoomFloor() {
	if (playerObj?.has("gridCollision")) playerObj.unuse("gridCollision")
	gridRegistry.unregister(ACTIVE_RUN_GRID_KEY)
	destroyTaggedObjects(tags.runRoom)
	if (active) destroyTaggedObjects(tags.runMap)
	clearRoomFloor()
	stopThreatLevel()
	active = false
	activeConfig = undefined
	transitionCooldown = 0
}

export function generatedRoomFloorActive() {
	return active
}

export function transitionToConnectedRoom(destinationRoomId: string) {
	if (!active || transitionCooldown > 0) return false
	const previousRoom = getCurrentFloorRoom()
	if (!previousRoom) return false
	const destination = enterFloorRoom(destinationRoomId)
	if (!destination) return false
	const travelDirection = getRoomTravelDirection(previousRoom, destination)
	transitionCooldown = ROOM_TRANSITION_COOLDOWN
	destroyTaggedObjects(tags.runRoom)
	loadCurrentRoom(previousRoom.id, false, travelDirection)
	k.flash(k.rgb(8, 22, 30), 0.12)
	return true
}

export function quickJumpToClearedRoom(destinationRoomId: string) {
	if (!active || transitionCooldown > 0) return false
	const floor = getActiveRoomFloor()
	const previousRoom = getCurrentFloorRoom()
	const destination = floor?.rooms.find(
		(room) => room.id === destinationRoomId
	)
	if (
		!previousRoom ||
		previousRoom.state !== "cleared" ||
		!destination ||
		destination.id === previousRoom.id ||
		destination.state !== "cleared"
	) return false
	if (!teleportRoomState(destination.id)) return false
	const travelDirection = getRoomTravelDirection(previousRoom, destination)

	transitionCooldown = ROOM_TRANSITION_COOLDOWN
	destroyTaggedObjects(tags.runRoom)
	loadCurrentRoom(previousRoom.id, false, travelDirection)
	k.flash(k.rgb(8, 22, 30), 0.12)
	return true
}

function loadCurrentRoom(
	previousRoomId?: string,
	teleportArrival = false,
	travelDirection?: Vec2
) {
	const room = getCurrentFloorRoom()
	const config = activeConfig
	if (!room || !config) return
	const template = buildRoomTemplate(room)
	const grid = generationMapToHexGrid(
		template.map,
		Math.min(config.hexSize, ROOM_HEX_SIZE),
		0,
		0,
		Math.max(config.projectionYScale ?? 1, ROOM_PROJECTION_Y_SCALE)
	)
	const uncenteredCenter = grid.hexToScreen(template.center)
	grid.config.offset = k.center().sub(uncenteredCenter)
	gridRegistry.unregister(ACTIVE_RUN_GRID_KEY)
	gridRegistry.register(ACTIVE_RUN_GRID_KEY, grid, false)
	if (playerObj.has("gridCollision")) playerObj.unuse("gridCollision")
	playerObj.use(gridCollision(ACTIVE_RUN_GRID_KEY))
	const entryPosition = teleportArrival
		? grid.hexToScreen(template.center).add(0, ROOM_HEX_SIZE * 1.35)
		: getEntryPosition(grid, template, previousRoomId)
	playerObj.pos = entryPosition
	resetPlayerPath(entryPosition)
	if (previousRoomId && !teleportArrival) {
		const entryDoor = template.doors.find(
			(door) => door.destinationRoomId === previousRoomId
		)
		playPlayerRespawnTransition(entryPosition, {
			startPosition: travelDirection
				? entryPosition.sub(travelDirection.scale(
					grid.config.hexSize * Math.sqrt(3) * 3
				))
				: entryDoor
					? grid.hexToScreen(entryDoor.coord)
					: entryPosition.add(-ROOM_HEX_SIZE * 2, 0),
		})
	}
	if (
		room.state !== "cleared" &&
		(room.contentCompleted || roomClearsOnEntry(room))
	) {
		markCurrentFloorRoomCleared()
	}
	let doorsLocked = room.state !== "cleared"
	const unlockRoom = () => {
		markCurrentFloorRoomCleared()
		if (!doorsLocked) return
		doorsLocked = false
		setDoorsLocked(grid, template, false)
		audioService.playSound("room_cleared", {
			volume: mainSoundVolume * 0.8,
		})
	}
	setDoorsLocked(grid, template, doorsLocked)
	renderRoom(grid, template, room, () => doorsLocked)
	spawnDoorController(grid, template, () => doorsLocked)
	if (room.kind === "gravity") {
		spawnRoomContent(grid, template, room, unlockRoom)
	}
	if (room.kind === "miniBoss" && doorsLocked) {
		spawnMiniBossRoom(grid, template, unlockRoom)
	} else if (roomUsesStandardEncounter(room) && doorsLocked) {
		spawnCombatRoomController(grid, template, room, unlockRoom)
	} else if (room.kind === "boss" && doorsLocked) {
		spawnBossRoom(grid, template, room, unlockRoom)
	} else if (room.kind !== "gravity") {
		spawnRoomContent(grid, template, room, unlockRoom)
	}
}

function getRoomTravelDirection(
	fromRoom: RoomFloorRoom,
	toRoom: RoomFloorRoom
) {
	if (
		fromRoom.coord.q === toRoom.coord.q &&
		fromRoom.coord.r === toRoom.coord.r
	) return undefined
	return hexToPixel(toRoom.coord, 1)
		.sub(hexToPixel(fromRoom.coord, 1))
		.unit()
}

function roomClearsOnEntry(room: RoomFloorRoom) {
	return !roomUsesStandardEncounter(room) &&
		room.kind !== "miniBoss" &&
		room.kind !== "boss"
}

function roomUsesStandardEncounter(room: RoomFloorRoom) {
	return room.kind === "combat" ||
		room.kind === "reward" ||
		room.kind === "shrine" ||
		room.kind === "gravity" ||
		room.kind === "event"
}

function getEntryPosition(
	grid: HexGrid,
	template: BuiltRoomTemplate,
	previousRoomId?: string
) {
	if (!previousRoomId) return grid.hexToScreen(template.center)
	const entryDoor = template.doors.find((door) => door.destinationRoomId === previousRoomId)
	if (!entryDoor) return grid.hexToScreen(template.center)
	const inwardDirection = oppositeRoomDirection(entryDoor.direction)
	const inwardVector = getDirectionVector(inwardDirection)
	return grid.hexToScreen({
		q: entryDoor.insideCoord.q + inwardVector.q * ROOM_ENTRY_INSET,
		r: entryDoor.insideCoord.r + inwardVector.r * ROOM_ENTRY_INSET,
	})
}

function spawnFloorController() {
	k.add([
		{
			update() {
				transitionCooldown = Math.max(0, transitionCooldown - k.dt())
				updateThreatLevel(k.dt())
			},
		},
		tags.runMap,
		tags.gameLoop,
	])
}

function spawnDoorController(
	grid: HexGrid,
	template: BuiltRoomTemplate,
	doorsLocked: () => boolean
) {
	const controller = k.add([
		{
			update() {
				if (transitionCooldown > 0 || doorsLocked()) return
				const playerCoord = grid.screenToHex(playerObj.pos)
				const door = template.doors.find((candidate) =>
					candidate.coord.q === playerCoord.q && candidate.coord.r === playerCoord.r
				)
				if (door) transitionToConnectedRoom(door.destinationRoomId)
			},
		},
		tags.runRoom,
		tags.runMap,
		tags.gameLoop,
	])
	return controller
}

function renderRoom(
	grid: HexGrid,
	template: BuiltRoomTemplate,
	room: RoomFloorRoom,
	doorsLocked: () => boolean
) {
	const walls = template.map.getAllCells()
		.filter((cell) => cell.solid)
		.map((cell) => {
			const connectionMask = hexNeighbors(cell.coord).reduce((mask, coord, index) => {
				const neighbor = template.map.getCell(coord)
				return !neighbor || neighbor.solid ? mask | (1 << index) : mask
			}, 0)
			return {
				center: grid.hexToScreen(cell.coord),
				frame: getRunRockTileFrame(
					~connectionMask & 0b111111,
					room.seed + cell.coord.q * 73 + cell.coord.r * 151
				),
			}
		})
	const tileScale = grid.config.hexSize / RUN_ROCK_TILE_SOURCE_RADIUS
	const tileScaleY = tileScale * (grid.config.projectionYScale ?? 1)
	const tileCenterOffsetY =
		(RUN_ROCK_TILE_SOURCE_RADIUS - RUN_ROCK_TILE_ANCHOR_Y) * tileScaleY
	let staticRoomPicture: ReturnType<typeof k.endPicture> | undefined
	const roomRenderer = k.add([
		k.pos(0, 0),
		k.layer(layers.game2),
		{
			draw() {
				if (!staticRoomPicture) {
					k.beginPicture()
					for (const wall of walls) {
						k.drawSprite({
							sprite: RUN_ROCK_TILE_SPRITE,
							frame: wall.frame,
							pos: wall.center.add(0, tileCenterOffsetY),
							anchor: "center",
							scale: k.vec2(tileScale, tileScaleY),
						})
					}
					staticRoomPicture = k.endPicture()
				}
				k.drawPicture(staticRoomPicture, {})
				for (const door of template.doors) {
					const center = grid.hexToScreen(door.coord)
					const direction = grid.hexToScreen(door.insideCoord).sub(center).unit()
					const tangent = k.vec2(-direction.y, direction.x)
					k.drawLine({
						p1: center.add(tangent.scale(grid.config.hexSize * 0.36)),
						p2: center.sub(tangent.scale(grid.config.hexSize * 0.36)),
						width: 3,
						color: doorsLocked() ? k.rgb(255, 55, 55) : k.rgb(0, 215, 255),
						opacity: doorsLocked() ? 1 : 0.7,
					})
				}
			},
		},
		tags.runRoom,
		tags.runMap,
		tags.gameLoop,
	])
	roomRenderer.onDestroy(() => staticRoomPicture?.free())
}

function spawnCombatRoomController(
	grid: HexGrid,
	template: BuiltRoomTemplate,
	room: RoomFloorRoom,
	onCleared: () => void
) {
	const encounter = room.encounter
	if (!encounter) {
		markCurrentFloorRoomCleared()
		onCleared()
		if (room.kind !== "gravity") {
			spawnRoomContent(grid, template, room, onCleared)
		}
		return
	}
	let wave = nextUndefeatedWave(room)
	let waveDelay = 0.65
	let waveSpawned = false
	const controller = k.add([
		{
			update() {
				if (wave === undefined) {
					markCurrentFloorRoomCleared()
					onCleared()
					if (room.kind !== "gravity") {
						spawnRoomContent(grid, template, room, onCleared)
					}
					k.destroy(controller)
					return
				}
				if (!waveSpawned) {
					waveDelay -= k.dt()
					if (waveDelay > 0) return
					spawnRoomWave(grid, template, room, wave)
					waveSpawned = true
					return
				}
				if (k.get(tags.runRoomEnemy).some((enemy) => enemy.exists())) return
				wave = nextUndefeatedWave(room)
				waveSpawned = false
				waveDelay = 0.75
			},
		},
		tags.runRoom,
		tags.runMap,
		tags.gameLoop,
	])
}

function spawnRoomWave(
	grid: HexGrid,
	template: BuiltRoomTemplate,
	room: RoomFloorRoom,
	wave: number
) {
	const entries = room.encounter?.enemies.filter((enemy) =>
		enemy.wave === wave && !enemy.defeated
	) ?? []
	for (let index = 0; index < entries.length; index++) {
		const entry = entries[index]
		const slot = template.spawnSlots[entry.spawnSlot % template.spawnSlots.length]
		if (!slot) {
			markFloorEnemyDefeated(entry.id)
			continue
		}
		const spawnPos = grid.hexToScreen(slot)
		const baseVisual = HOSTILE_ARRIVAL_VISUALS[entry.enemyId]
		const visual = {
			...baseVisual,
			scale: baseVisual.scale * (entry.elite ? 1.12 : 1),
		}
		spawnHostileArrival(spawnPos, index * HOSTILE_ARRIVAL_STAGGER, visual, () => {
			const enemy = spawnPlannedEnemy(entry.enemyId, spawnPos, {
				persistOffscreen: true,
				elite: entry.elite,
				tags: [tags.runMap, tags.runRoom, tags.runRoomEnemy],
			})
			if (!enemy) {
				markFloorEnemyDefeated(entry.id)
				return
			}
			enemy.onDestroy(() => {
				if (getCurrentFloorRoom()?.id === room.id) {
					markFloorEnemyDefeated(entry.id)
				}
			})
		})
	}
}

function nextUndefeatedWave(room: RoomFloorRoom) {
	const waves = room.encounter?.enemies
		.filter((enemy) => !enemy.defeated)
		.map((enemy) => enemy.wave) ?? []
	return waves.length > 0 ? Math.min(...waves) : undefined
}

function setDoorsLocked(
	grid: HexGrid,
	template: BuiltRoomTemplate,
	locked: boolean
) {
	for (const door of template.doors) {
		grid.setCell(door.coord, locked ? CellType.Wall : CellType.Empty)
	}
}

function spawnRoomContent(
	grid: HexGrid,
	template: BuiltRoomTemplate,
	room: RoomFloorRoom,
	onCleared: () => void
) {
	const center = grid.hexToScreen(template.center)
	const objectTags = [tags.runMap, tags.runRoom]
	const completeContent = () => {
		markCurrentRoomContentCompleted()
		onCleared()
	}
	if (room.kind === "start" || room.kind === "combat") return
	if (room.kind === "gravity") {
		spawnRoomGravityShrine(center, room)
		return
	}
	if (room.kind === "exit" || (room.kind === "boss" && room.state === "cleared")) {
		spawnFloorExit(center, objectTags)
		return
	}
	if (room.contentCompleted) return

	switch (room.kind) {
		case "shop":
			spawnRunUpgradeShop(center, room, objectTags)
			return
		case "reward":
			spawnChest(center, getActiveRoomFloor()?.depth ?? 1, {
				onOpened: completeContent,
				tags: objectTags,
			})
			return
		case "event":
			spawnChest(center, getActiveRoomFloor()?.depth ?? 1, {
				rewardType: "weapon",
				onOpened: completeContent,
				tags: objectTags,
			})
			return
		case "health":
			spawnHealthShrine({
				pos: center,
				tags: objectTags,
				onDepleted: completeContent,
			})
			return
		case "shrine":
			spawnShrine({
				pos: center,
				radius: grid.config.hexSize * 1.8,
				captureTime: 4.5,
				level: getActiveRoomFloor()?.depth ?? 1,
				onComplete: completeContent,
				tags: objectTags,
			})
			return
	}
}

function spawnMiniBossRoom(
	grid: HexGrid,
	template: BuiltRoomTemplate,
	onCleared: () => void
) {
	const center = grid.hexToScreen(template.center)
	const depth = getActiveRoomFloor()?.depth ?? 1
	spawnHostileArrival(center, 0, IMPACT_ACE_ARRIVAL_VISUAL, () => {
		spawnImpactAce(center, depth, {
			persistOffscreen: true,
			tags: [tags.runMap, tags.runRoom, tags.runRoomEnemy],
			onDefeated: () => {
				markCurrentRoomContentCompleted()
				onCleared()
			},
		})
	})
}

function spawnBossRoom(
	grid: HexGrid,
	template: BuiltRoomTemplate,
	room: RoomFloorRoom,
	onCleared: () => void
) {
	const center = grid.hexToScreen(template.center)
	const depth = getActiveRoomFloor()?.depth ?? 1
	spawnHostileArrival(center, 0, DREADNOUGHT_ARRIVAL_VISUAL, () => {
		spawnBoss1(
			center,
			10 + depth * 2,
			getBossHealth("federation-dreadnought", depth),
			1,
			{
				skipEntry: true,
				tags: [tags.runMap, tags.runRoom, tags.runRoomEnemy],
				onDefeated: () => {
					markCurrentFloorRoomCleared()
					onCleared()
					spawnRoomContent(grid, template, room, onCleared)
				},
			}
		)
	})
}

function spawnHostileArrival(
	pos: Vec2,
	delay: number,
	visual: HostileArrivalVisual,
	spawn: () => void
) {
	const color = k.rgb(...HOSTILE_ARRIVAL_COLOR)
	const outward = pos.sub(playerObj.pos)
	const arrivalDirection = outward.len() > 0.001
		? outward.unit()
		: k.vec2(0, -1)
	const start = pos.add(arrivalDirection.scale(HOSTILE_ARRIVAL_JUMP_DISTANCE))
	const angle = k.Vec2.toAngle(pos.sub(start)) + 90
	const ghost = spawnHostileArrivalSilhouette(pos, angle, visual, 0)
	let traveler: ReturnType<typeof spawnHostileArrivalSilhouette> | undefined
	const arrival = k.add([
		k.pos(pos),
		{
			elapsed: -Math.max(0, delay),
			completed: false,
			jumpStarted: false,
			update() {
				arrival.elapsed += k.dt()
				if (arrival.elapsed < 0 || arrival.completed) return
				if (arrival.elapsed < HOSTILE_ARRIVAL_GHOST_DURATION) {
					const ghostProgress = k.clamp(
						arrival.elapsed / HOSTILE_ARRIVAL_GHOST_DURATION,
						0,
						1
					)
					const flicker = Math.sin(arrival.elapsed * 38) * 0.06
					ghost.opacity = k.clamp(
						k.lerp(0.14, 0.42, ghostProgress) + flicker,
						0.08,
						0.48
					)
					const pulse = 1 + Math.sin(arrival.elapsed * 9) * 0.025
					ghost.scale = k.vec2(visual.scale * pulse)
					return
				}
				if (!arrival.jumpStarted) {
					arrival.jumpStarted = true
					traveler = spawnHostileArrivalSilhouette(
						start,
						angle,
						visual,
						0.3
					)
					spawnHostileArrivalTrail(start, pos, angle, visual)
					audioService.playSound("swap_level", {
						volume: mainSoundVolume * 0.45,
					})
				}
				const progress = k.clamp(
					(arrival.elapsed - HOSTILE_ARRIVAL_GHOST_DURATION) /
						HOSTILE_ARRIVAL_JUMP_DURATION,
					0,
					1
				)
				const easedProgress = 1 - Math.pow(1 - progress, 3)
				ghost.opacity = k.lerp(0.38, 0, progress)
				if (traveler && traveler.exists()) {
					traveler.pos = start.lerp(pos, easedProgress)
					traveler.opacity = k.lerp(0.3, 1, progress)
					traveler.scale = k.vec2(
						visual.scale * k.lerp(0.65, 1, easedProgress),
						visual.scale * k.lerp(1.7, 1, easedProgress)
					)
				}
				if (progress < 1) return
				arrival.completed = true
				spawn()
				spawnFlash(pos, 10, color)
				spawnRing({
					pos,
					speed: 420,
					intensity: 0.3,
					maxRadius: 74,
					color,
					shader: "arrivalShockwave",
				})
				if (ghost.exists()) k.destroy(ghost)
				if (traveler && traveler.exists()) k.destroy(traveler)
				k.destroy(arrival)
			},
		},
		tags.runMap,
		tags.runRoom,
		tags.runRoomEnemy,
		tags.gameLoop,
	])
	return arrival
}

function spawnHostileArrivalSilhouette(
	pos: Vec2,
	angle: number,
	visual: HostileArrivalVisual,
	opacity: number
) {
	const silhouette = k.add([
		k.pos(pos),
		k.rotate(angle),
		k.scale(visual.scale),
		k.opacity(opacity),
		k.layer(layers.gameEffects),
		k.z(8),
		tags.runMap,
		tags.runRoom,
		tags.gameLoop,
	])
	for (const part of visual.parts) {
		silhouette.add([
			k.pos(part.offset ? k.vec2(...part.offset) : k.vec2(0)),
			k.sprite(part.sprite),
			k.anchor("center"),
			k.color(...HOSTILE_ARRIVAL_COLOR),
			k.opacity(1),
		])
	}
	return silhouette
}

function spawnHostileArrivalTrail(
	start: Vec2,
	end: Vec2,
	angle: number,
	visual: HostileArrivalVisual
) {
	const delta = end.sub(start)
	k.add([
		k.pos(start),
		k.opacity(0.72),
		k.lifespan(HOSTILE_ARRIVAL_JUMP_DURATION, { fade: 0.3 }),
		k.layer(layers.gameEffects),
		{
			draw() {
				k.drawLine({
					p1: k.vec2(),
					p2: delta,
					width: 3,
					color: k.rgb(...HOSTILE_ARRIVAL_COLOR),
					opacity: this.opacity,
				})
			},
		},
		tags.runMap,
		tags.runRoom,
		tags.gameLoop,
	])
	for (let index = 0; index < 6; index++) {
		const progress = (index + 1) / 7
		const echo = spawnHostileArrivalSilhouette(
			start.lerp(end, progress),
			angle,
			visual,
			k.lerp(0.12, 0.4, progress)
		)
		echo.scale = k.vec2(visual.scale * k.lerp(0.7, 1, progress))
		echo.use(k.lifespan(HOSTILE_ARRIVAL_JUMP_DURATION, { fade: 0.28 }))
	}
}

function spawnRoomGravityShrine(center: Vec2, room: RoomFloorRoom) {
	const objectTags = [tags.runMap, tags.runRoom]
	const shrine = k.add([
		k.pos(center),
		k.sprite("shrine_gravity"),
		k.anchor("center"),
		k.scale(1.25),
		k.color(205, 185, 255),
		k.layer(layers.buildings),
		tags.props,
		tags.gameLoop,
		...objectTags,
	])
	const wormhole = spawnDecorativeWormhole({
		pos: center.add(0, GRAVITY_ROOM_WORMHOLE_OFFSET_Y),
		color: k.rgb(...GRAVITY_ROOM_COLOR),
		scale: 0.56,
		tags: objectTags,
	})
	const glow = addLocalLight(shrine, {
		size: 150,
		color: GRAVITY_ROOM_COLOR,
		opacity: 0.16,
		pulse: {
			scaleMin: 0.9,
			scaleMax: 1.12,
			scaleSpeed: 2.2,
			opacityMin: 0.1,
			opacityMax: 0.22,
			opacitySpeed: 2.7,
		},
	})
	glow.object.pos = k.vec2(0, GRAVITY_ROOM_WORMHOLE_OFFSET_Y)
	const gravity = spawnGravityPull({
		pos: center,
		radius: ROOM_HEX_SIZE * 2.4,
		strength: 54 + (getActiveRoomFloor()?.depth ?? 1) * 5,
		falloff: 0.72,
		targetTags: [tags.player, tags.enemy, tags.projectile, tags.debree],
		tagStrengthMultipliers: {
			[tags.player]: 0.72,
			[tags.projectile]: 1.4,
			[tags.debree]: 1.2,
		},
		visualizePull: true,
		tags: objectTags,
	})
	shrine.onDestroy(() => {
		if (gravity.exists()) k.destroy(gravity)
		if (wormhole.exists()) k.destroy(wormhole)
	})
	shrine.onUpdate(() => {
		updateLocalLight(glow)
		if (transitionCooldown > 0 || playerObj.pos.dist(shrine.pos) > 14) return
		const destinations = getActiveRoomFloor()?.rooms.filter((candidate) =>
			candidate.kind === "gravity" && candidate.id !== room.id
		) ?? []
		if (destinations.length === 0) return
		const destination = destinations[Math.floor(k.rand(destinations.length))]
		if (!teleportRoomState(destination.id, true)) return
		const start = playerObj.pos.clone()
		transitionCooldown = ROOM_TRANSITION_COOLDOWN
		spawnRing({
			pos: start,
			speed: 250,
			intensity: 0.42,
			maxRadius: 72,
			color: k.rgb(174, 112, 255),
		})
		destroyTaggedObjects(tags.runRoom)
		loadCurrentRoom(room.id, true)
		k.flash(k.rgb(90, 45, 130), 0.18)
	})
}

function destroyTaggedObjects(tag: string) {
	const objects = k.get<GameObj>(tag).sort((a, b) => objectDepth(b) - objectDepth(a))
	for (const object of objects) {
		if (object.exists()) k.destroy(object)
	}
}

function objectDepth(object: GameObj) {
	let depth = 0
	let parent = object.parent
	while (parent) {
		depth++
		parent = parent.parent
	}
	return depth
}

function getDirectionVector(direction: number) {
	return [
		{ q: 1, r: 0 },
		{ q: 1, r: -1 },
		{ q: 0, r: -1 },
		{ q: -1, r: 0 },
		{ q: -1, r: 1 },
		{ q: 0, r: 1 },
	][direction]
}
