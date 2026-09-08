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
import { CellType, type HexGrid } from "../grid/hexGrid"
import { k, layers } from "../main"
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
import { getBossHealth } from "../services/bossRegistry"
import { getHubLevel } from "../services/hubProgressService"
import { resetPlayerPath } from "../services/playerPathService"
import { startThreatLevel, stopThreatLevel, updateThreatLevel } from "../services/threatService"
import { spawnBoss1 } from "../spawn/spawnBoss1"
import { spawnChest } from "../spawn/spawnChest"
import { spawnGravityPull } from "../spawn/spawnGravityPull"
import { spawnRing } from "../spawn/spawnRing"
import { spawnDroneRepairZone } from "../spawn/rooms/spawnDroneRepairZone"
import { spawnHealthShrine } from "../spawn/shrine/spawnHealthShrine"
import { spawnShrine } from "../spawn/shrine/spawnShrine"
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
const ROOM_HEX_SIZE = 56
const ROOM_PROJECTION_Y_SCALE = 2 / Math.sqrt(3)

let active = false
let activeConfig: GeneratedMapConfig | undefined
let transitionCooldown = 0

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
	transitionCooldown = ROOM_TRANSITION_COOLDOWN
	destroyTaggedObjects(tags.runRoom)
	loadCurrentRoom(previousRoom.id)
	k.flash(k.rgb(8, 22, 30), 0.12)
	return true
}

function loadCurrentRoom(previousRoomId?: string, teleportArrival = false) {
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
	playerObj.pos = teleportArrival
		? grid.hexToScreen(template.center).add(0, ROOM_HEX_SIZE * 1.35)
		: getEntryPosition(grid, template, previousRoomId)
	resetPlayerPath(playerObj.pos)
	const roomLocked = (room.kind === "combat" || room.kind === "boss") &&
		room.state !== "cleared"
	let doorsLocked = roomLocked
	setDoorsLocked(grid, template, doorsLocked)
	renderRoom(grid, template, room, () => doorsLocked)
	spawnDoorController(grid, template, () => doorsLocked)
	if (room.kind === "combat" && roomLocked) {
		spawnCombatRoomController(grid, template, room, () => {
			doorsLocked = false
			setDoorsLocked(grid, template, false)
		})
	} else if (room.kind === "boss" && roomLocked) {
		spawnBossRoom(grid, template, room, () => {
			doorsLocked = false
			setDoorsLocked(grid, template, false)
		})
	} else {
		spawnRoomContent(grid, template, room)
	}
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
				corners: grid.getHexScreenCorners(cell.coord),
				frame: getRunRockTileFrame(
					~connectionMask & 0b111111,
					room.seed + cell.coord.q * 73 + cell.coord.r * 151
				),
			}
		})
	const floorCells = template.map.getAllCells()
		.filter((cell) => !cell.solid)
		.map((cell) => grid.getHexScreenCorners(cell.coord))
	const tileScale = grid.config.hexSize / RUN_ROCK_TILE_SOURCE_RADIUS
	const tileCenterOffsetY =
		(RUN_ROCK_TILE_SOURCE_RADIUS - RUN_ROCK_TILE_ANCHOR_Y) * tileScale
	k.add([
		k.pos(0, 0),
		k.layer(layers.game2),
		{
			draw() {
				for (const corners of floorCells) {
					k.drawPolygon({
						pts: corners,
						color: k.rgb(8, 20, 28),
						outline: {
							width: 1,
							color: k.rgb(20, 52, 66),
						},
					})
				}
				for (const wall of walls) {
					k.drawPolygon({
						pts: wall.corners,
						color: k.rgb(18, 34, 44),
						outline: {
							width: 1,
							color: k.rgb(88, 108, 120),
						},
					})
					k.drawSprite({
						sprite: RUN_ROCK_TILE_SPRITE,
						frame: wall.frame,
						pos: wall.center.add(0, tileCenterOffsetY),
						anchor: "center",
						scale: k.vec2(tileScale),
					})
				}
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
		const enemy = spawnPlannedEnemy(entry.enemyId, grid.hexToScreen(slot), {
			persistOffscreen: true,
			elite: entry.elite,
			tags: [tags.runMap, tags.runRoom, tags.runRoomEnemy],
		})
		if (!enemy) {
			markFloorEnemyDefeated(entry.id)
			continue
		}
		enemy.onDestroy(() => markFloorEnemyDefeated(entry.id))
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
	room: RoomFloorRoom
) {
	const center = grid.hexToScreen(template.center)
	const objectTags = [tags.runMap, tags.runRoom]
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
		case "reward":
			spawnChest(center, getActiveRoomFloor()?.depth ?? 1, {
				onOpened: markCurrentRoomContentCompleted,
				tags: objectTags,
			})
			return
		case "event":
			spawnChest(center, getActiveRoomFloor()?.depth ?? 1, {
				rewardType: "weapon",
				onOpened: markCurrentRoomContentCompleted,
				tags: objectTags,
			})
			return
		case "health":
			spawnHealthShrine({
				pos: center,
				tags: objectTags,
				onDepleted: markCurrentRoomContentCompleted,
			})
			return
		case "repair":
			spawnDroneRepairZone({
				pos: center,
				depth: getActiveRoomFloor()?.depth ?? 1,
				hexSize: grid.config.hexSize,
				tags: objectTags,
				spawnDefenders: false,
				onComplete: markCurrentRoomContentCompleted,
			})
			return
		case "shrine":
			spawnShrine({
				pos: center,
				radius: grid.config.hexSize * 1.8,
				captureTime: 4.5,
				level: getActiveRoomFloor()?.depth ?? 1,
				onComplete: markCurrentRoomContentCompleted,
				tags: objectTags,
			})
			return
	}
}

function spawnBossRoom(
	grid: HexGrid,
	template: BuiltRoomTemplate,
	room: RoomFloorRoom,
	onCleared: () => void
) {
	const center = grid.hexToScreen(template.center)
	const depth = getActiveRoomFloor()?.depth ?? 1
	spawnBoss1(
		center,
		10 + depth * 2,
		getBossHealth("federation-dreadnought", depth),
		1,
		{
			tags: [tags.runMap, tags.runRoom, tags.runRoomEnemy],
			onDefeated: () => {
				markCurrentFloorRoomCleared()
				onCleared()
				spawnRoomContent(grid, template, room)
			},
		}
	)
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
	})
	shrine.onUpdate(() => {
		if (transitionCooldown > 0 || playerObj.pos.dist(shrine.pos) > 14) return
		const destinations = getActiveRoomFloor()?.rooms.filter((candidate) =>
			candidate.kind === "gravity" && candidate.id !== room.id
		) ?? []
		if (destinations.length === 0) return
		const destination = destinations[Math.floor(k.rand(destinations.length))]
		if (!teleportRoomState(destination.id)) return
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
