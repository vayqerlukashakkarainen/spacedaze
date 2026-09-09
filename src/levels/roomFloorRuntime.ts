import type { GameObj, Vec2 } from "kaplay"
import { gridCollision } from "../comp/gridCollision"
import { interactable } from "../comp/interactable"
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
import { k, layers, mainSoundVolume, velocityScale } from "../main"
import {
	beginRoomFloor,
	clearRoomFloor,
	enterFloorRoom,
	getActiveRoomFloor,
	getCurrentFloorRoom,
	getFloorKeyCount,
	isFloorRoomKeyLocked,
	markCurrentRoomContentCompleted,
	markCurrentFloorRoomCleared,
	markFloorEnemyDefeated,
	rollCurrentRoomClearKeyDrop,
	rollFloorEnemyKeyDrop,
	teleportToFloorRoom as teleportRoomState,
	unlockFloorRoomWithKey,
} from "../services/roomFloorService"
import { spawnPlannedEnemy } from "../services/enemyEncounterService"
import { gameSoundService } from "../services/gameSoundService"
import { getBossHealth } from "../services/bossRegistry"
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
import { spawnBoilerHulk } from "../spawn/wake/spawnBoilerHulk"
import { spawnRing } from "../spawn/spawnRing"
import { spawnDecorativeWormhole } from "../spawn/spawnLevel"
import { spawnRunUpgradeShop } from "../spawn/rooms/spawnRunUpgradeShop"
import { spawnRoomKeyPickup } from "../spawn/rooms/spawnRoomKey"
import { spawnRoomEnvironment } from "../spawn/rooms/spawnRoomEnvironment"
import { spawnRewardPickup } from "../spawn/spawnPowerup"
import { spawnHealthShrine } from "../spawn/shrine/spawnHealthShrine"
import { spawnShrine } from "../spawn/shrine/spawnShrine"
import { getShrineLevelConfig } from "../spawn/shrine/shrineLevel"
import { playPlayerRespawnTransition } from "../setupPlayer"
import { tags } from "../tags"
import { createNpcInteractionPrompt, UI_COLORS } from "../ui/common"
import { playRequirementErrorSound } from "../services/uiSoundService"
import { rollMapEventReward } from "../services/rewardService"
import { clearRoomCoverSources } from "../services/roomCoverService"
import {
	getEnemyVisual,
} from "../visuals/enemyVisualCatalog"
import {
	scaleVisualRepresentation,
	type VisualRepresentation,
} from "../visuals/visualRepresentation"
import { getWorldVisual } from "../visuals/worldVisualCatalog"
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
const HOSTILE_ARRIVAL_COAST_DURATION = 0.55
const HOSTILE_ARRIVAL_STAGGER = 0.07
const HOSTILE_ARRIVAL_COLOR = [255, 75, 90] as const
const HOSTILE_ARRIVAL_SILHOUETTE_OPACITY = 0.4
const HOSTILE_ARRIVAL_LINE_OPACITY = 0.2
const GRAVITY_ROOM_COLOR = [174, 112, 255] as const
const GRAVITY_ROOM_WORMHOLE_OFFSET_Y = -18

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
	clearRoomCoverSources()
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
	const lockRoom = () => {
		if (doorsLocked) return
		doorsLocked = true
		syncDoorCells(grid, template, true)
	}
	const unlockRoom = (allowKeyDrop = true) => {
		markCurrentFloorRoomCleared()
		if (!doorsLocked) return
		doorsLocked = false
		syncDoorCells(grid, template, false)
		gameSoundService.play("room_cleared", {
			volume: mainSoundVolume * 0.8,
		})
		if (allowKeyDrop && rollCurrentRoomClearKeyDrop()) {
			spawnRoomKeyPickup(grid.hexToScreen(template.center))
		}
	}
	syncDoorCells(grid, template, doorsLocked)
	renderRoom(grid, template, room, () => doorsLocked)
	spawnRoomEnvironment(grid, room)
	spawnDoorController(
		grid,
		template,
		() => doorsLocked,
		() => syncDoorCells(grid, template, doorsLocked)
	)
	const previewedChest = roomHasPreviewedChest(room)
	if (previewedChest) {
		spawnRoomContent(
			grid,
			template,
			room,
			unlockRoom,
			lockRoom,
			() => !doorsLocked
		)
	}
	if (room.kind === "gravity") {
		spawnRoomContent(grid, template, room, unlockRoom)
	}
	if (room.kind === "miniBoss" && doorsLocked) {
		spawnMiniBossRoom(grid, template, unlockRoom)
	} else if (roomUsesStandardEncounter(room) && doorsLocked) {
		spawnCombatRoomController(grid, template, room, unlockRoom)
	} else if (room.kind === "boss" && doorsLocked) {
		spawnBossRoom(grid, template, room, unlockRoom, lockRoom)
	} else if (room.kind !== "gravity" && !previewedChest) {
		spawnRoomContent(grid, template, room, unlockRoom, lockRoom)
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
		room.kind !== "shrine" &&
		room.kind !== "miniBoss" &&
		room.kind !== "boss"
}

function roomUsesStandardEncounter(room: RoomFloorRoom) {
	return room.kind === "combat" ||
		room.kind === "reward" ||
		room.kind === "gravity" ||
		room.kind === "event"
}

function roomHasPreviewedChest(room: RoomFloorRoom) {
	return !room.contentCompleted &&
		(room.kind === "reward" || room.kind === "event")
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
	doorsLocked: () => boolean,
	syncDoors: () => void
) {
	for (const door of template.doors) {
		const lock = k.add([
			k.pos(grid.hexToScreen(door.coord)),
			interactable(0, () => unlockDoor(door.destinationRoomId)),
			tags.runRoom,
			tags.runMap,
			tags.gameLoop,
		])
		const prompt = createNpcInteractionPrompt({
			target: lock,
			offset: k.vec2(0, -40),
			label: () => ({
				text: "1 KEY",
				color: getFloorKeyCount() > 0
					? k.rgb(...UI_COLORS.warning)
					: k.rgb(...UI_COLORS.danger),
			}),
		})
		lock.onUpdate(() => {
			const available = !doorsLocked() &&
				isFloorRoomKeyLocked(door.destinationRoomId)
			lock.setInteractRadius(available ? 64 : 0)
			prompt.update(available && lock.isInRange)
		})

		function unlockDoor(destinationRoomId: string) {
			if (
				doorsLocked() ||
				!isFloorRoomKeyLocked(destinationRoomId) ||
				!unlockFloorRoomWithKey(destinationRoomId)
			) {
				playRequirementErrorSound()
				return
			}
			syncDoors()
			lock.setInteractRadius(0)
			prompt.update(false)
			spawnFlash(lock.pos, 8, k.rgb(...UI_COLORS.warning))
			spawnRing({
				pos: lock.pos,
				speed: 90,
				maxRadius: 30,
				intensity: 0.6,
				visualize: true,
				color: k.rgb(...UI_COLORS.warning),
			})
			gameSoundService.play("purchase1", {
				volume: mainSoundVolume * 0.7,
			})
		}
	}
	const controller = k.add([
		{
			update() {
				if (transitionCooldown > 0 || doorsLocked()) return
				const playerCoord = grid.screenToHex(playerObj.pos)
				const door = template.doors.find((candidate) =>
					candidate.coord.q === playerCoord.q && candidate.coord.r === playerCoord.r
				)
				if (
					door &&
					!isFloorRoomKeyLocked(door.destinationRoomId)
				) transitionToConnectedRoom(door.destinationRoomId)
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
		.filter((cell) =>
			cell.solid && !cell.tags.has("room_environment_structural")
		)
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
	const barricades = room.environment?.objects.filter((object) =>
		object.archetypeId === "wake-hull-barricade" && !object.destroyed
	).map((object) => ({
		center: grid.hexToScreen(object.coord),
		angle: object.orientation * 60,
	})) ?? []
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
					for (const barricade of barricades) {
						k.drawSprite({
							sprite: "wake_hull_barricade",
							pos: barricade.center,
							anchor: "center",
							angle: barricade.angle,
							color: k.rgb(145, 162, 171),
						})
					}
					staticRoomPicture = k.endPicture()
				}
				k.drawPicture(staticRoomPicture, {})
				for (const door of template.doors) {
					const center = grid.hexToScreen(door.coord)
					const direction = grid.hexToScreen(door.insideCoord).sub(center).unit()
					const tangent = k.vec2(-direction.y, direction.x)
					const keyLocked = isFloorRoomKeyLocked(door.destinationRoomId)
					const roomLocked = doorsLocked()
					k.drawLine({
						p1: center.add(tangent.scale(grid.config.hexSize * 0.36)),
						p2: center.sub(tangent.scale(grid.config.hexSize * 0.36)),
						width: 3,
						color: roomLocked
							? k.rgb(...UI_COLORS.danger)
							: keyLocked
								? k.rgb(...UI_COLORS.warning)
								: k.rgb(...UI_COLORS.accent),
						opacity: roomLocked || keyLocked ? 1 : 0.7,
					})
					if (keyLocked && !roomLocked) {
						k.drawSprite({
							sprite: "room_phase_key",
							pos: center.add(direction.scale(17)),
							anchor: "center",
							scale: k.vec2(0.55),
							color: k.rgb(...UI_COLORS.warning),
						})
					}
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
		if (room.kind !== "gravity" && !roomHasPreviewedChest(room)) {
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
					if (room.kind !== "gravity" && !roomHasPreviewedChest(room)) {
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
	const fleetJumpDirection = getFleetJumpDirection(room.seed)
	for (let index = 0; index < entries.length; index++) {
		const entry = entries[index]
		const slot = template.spawnSlots[entry.spawnSlot % template.spawnSlots.length]
		if (!slot) {
			markFloorEnemyDefeated(entry.id)
			continue
		}
		const spawnPos = grid.hexToScreen(slot)
		const visual = scaleVisualRepresentation(
			getEnemyVisual(entry.enemyId),
			entry.elite ? 1.12 : 1
		)
		spawnHostileArrival(
			spawnPos,
			index * HOSTILE_ARRIVAL_STAGGER,
			visual,
			(arrivalAngle, jumpDirection) => {
				const enemy = spawnPlannedEnemy(entry.enemyId, spawnPos, {
					persistOffscreen: true,
					elite: entry.elite,
					tags: [tags.runMap, tags.runRoom, tags.runRoomEnemy],
				})
				if (!enemy) {
					markFloorEnemyDefeated(entry.id)
					return
				}
				applyHostileArrivalMomentum(
					enemy,
					jumpDirection,
					arrivalAngle
				)
				enemy.onDeath(() => {
					if (getCurrentFloorRoom()?.id === room.id) {
						const deathPos = enemy.pos.clone()
						if (rollFloorEnemyKeyDrop(entry.id)) {
							spawnRoomKeyPickup(deathPos)
						}
						markFloorEnemyDefeated(entry.id)
					}
				})
			},
			fleetJumpDirection
		)
	}
}

function getFleetJumpDirection(roomSeed: number) {
	const fleetDirections = [0, 45, 90, 135, 180, 225, 270, 315]
	const index = Math.abs(Math.round(roomSeed)) % fleetDirections.length
	return k.Vec2.fromAngle(fleetDirections[index])
}

function nextUndefeatedWave(room: RoomFloorRoom) {
	const waves = room.encounter?.enemies
		.filter((enemy) => !enemy.defeated)
		.map((enemy) => enemy.wave) ?? []
	return waves.length > 0 ? Math.min(...waves) : undefined
}

function syncDoorCells(
	grid: HexGrid,
	template: BuiltRoomTemplate,
	roomLocked: boolean
) {
	for (const door of template.doors) {
		const locked = roomLocked || isFloorRoomKeyLocked(door.destinationRoomId)
		grid.setCell(door.coord, locked ? CellType.Wall : CellType.Empty)
	}
}

function spawnRoomContent(
	grid: HexGrid,
	template: BuiltRoomTemplate,
	room: RoomFloorRoom,
	onCleared: (allowKeyDrop?: boolean) => void,
	onExitActivated?: () => void,
	isContentAvailable: () => boolean = () => true
) {
	const center = grid.hexToScreen(template.center)
	const objectTags = [tags.runMap, tags.runRoom]
	const completeContent = () => {
		markCurrentRoomContentCompleted()
		onCleared()
	}
	const failContent = () => {
		markCurrentRoomContentCompleted()
		onCleared(false)
	}
	if (room.kind === "start" || room.kind === "combat") return
	if (room.kind === "gravity") {
		spawnRoomGravityShrine(center, room)
		return
	}
	if (room.kind === "exit" || (room.kind === "boss" && room.state === "cleared")) {
		spawnFloorExit(center, objectTags, { onActivated: onExitActivated })
		return
	}
	if (room.contentCompleted) return

	switch (room.kind) {
		case "shop":
			spawnRunUpgradeShop(center, room, objectTags)
			return
		case "reward":
			spawnChest(center, getActiveRoomFloor()?.depth ?? 1, {
				available: isContentAvailable,
				ghostWhenUnavailable: true,
				onOpened: completeContent,
				tags: objectTags,
			})
			return
		case "event":
			spawnChest(center, getActiveRoomFloor()?.depth ?? 1, {
				rewardType: "weapon",
				available: isContentAvailable,
				ghostWhenUnavailable: true,
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
			const shrineConfig = getShrineLevelConfig(
				getActiveRoomFloor()?.depth ?? 1,
				grid.config.hexSize
			)
			spawnShrine({
				pos: center,
				radius: shrineConfig.radius,
				captureTime: shrineConfig.captureTime,
				level: shrineConfig.level,
				enemySpawnDelay: shrineConfig.enemySpawnDelay,
				enemySpawnInterval: shrineConfig.enemySpawnInterval,
				enemySpawnDistance: shrineConfig.enemySpawnDistance,
				enemySpawnSpacing: shrineConfig.enemySpawnSpacing,
				enemyWaveMultiplier: 1 + (shrineConfig.level - 1) * 0.25,
				timeLimit: 20,
				onComplete: (rewardPos) => {
					completeContent()
					const reward = rollMapEventReward(2)
					if (!reward) return
					spawnRewardPickup(rewardPos, reward, {
						stationary: true,
						launch: {
							endOffset: k.vec2(0, -48),
							height: 34,
							duration: 0.52,
						},
						tags: objectTags,
						telemetrySource: "challenge",
					})
				},
				onExpired: failContent,
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
	const floor = getActiveRoomFloor()
	const depth = floor?.depth ?? 1
	const wakeFloor = floor?.themeId === "wake-scrap-district"
	const visual = wakeFloor
		? getEnemyVisual("wake-boiler-hulk")
		: getEnemyVisual("impact-ace")
	spawnHostileArrival(center, 0, visual, (
		arrivalAngle,
		jumpDirection
	) => {
		const onDefeated = () => {
			markCurrentRoomContentCompleted()
			onCleared()
		}
		const enemy = wakeFloor
			? spawnBoilerHulk(center, 20 + depth * 2, {
				persistOffscreen: true,
				tags: [tags.runMap, tags.runRoom, tags.runRoomEnemy],
				onDefeated,
			})
			: spawnImpactAce(center, depth, {
				persistOffscreen: true,
				tags: [tags.runMap, tags.runRoom, tags.runRoomEnemy],
				onDefeated,
			})
		applyHostileArrivalMomentum(enemy, jumpDirection, arrivalAngle)
	})
}

function spawnBossRoom(
	grid: HexGrid,
	template: BuiltRoomTemplate,
	room: RoomFloorRoom,
	onCleared: () => void,
	onExitActivated: () => void
) {
	const center = grid.hexToScreen(template.center)
	const depth = getActiveRoomFloor()?.depth ?? 1
	spawnHostileArrival(center, 0, getEnemyVisual("federation-dreadnought"), (
		arrivalAngle,
		jumpDirection
	) => {
		const boss = spawnBoss1(
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
					spawnRoomContent(
						grid,
						template,
						room,
						onCleared,
						onExitActivated
					)
				},
			}
		)
		applyHostileArrivalMomentum(boss, jumpDirection, arrivalAngle)
	})
}

function spawnHostileArrival(
	pos: Vec2,
	delay: number,
	visual: VisualRepresentation,
	spawn: (arrivalAngle: number, jumpDirection: Vec2) => void,
	fleetJumpDirection?: Vec2
) {
	const color = k.rgb(...HOSTILE_ARRIVAL_COLOR)
	const towardPlayer = playerObj.pos.sub(pos)
	const jumpDirection = fleetJumpDirection && fleetJumpDirection.len() > 0.001
		? fleetJumpDirection.unit()
		: towardPlayer.len() > 0.001
			? towardPlayer.unit()
		: k.vec2(0, -1)
	const start = pos.sub(jumpDirection.scale(HOSTILE_ARRIVAL_JUMP_DISTANCE))
	const angle = jumpDirection.angle() + 90
	const ghost = spawnHostileArrivalSilhouette(
		pos,
		angle,
		visual,
		HOSTILE_ARRIVAL_SILHOUETTE_OPACITY
	)
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
					ghost.opacity = HOSTILE_ARRIVAL_SILHOUETTE_OPACITY
					const pulse = 1 + Math.sin(arrival.elapsed * 9) * 0.025
					ghost.scale = k.vec2(visual.worldScale * pulse)
					return
				}
				if (!arrival.jumpStarted) {
					arrival.jumpStarted = true
					traveler = spawnHostileArrivalSilhouette(
						start,
						angle,
						visual,
						HOSTILE_ARRIVAL_SILHOUETTE_OPACITY
					)
					spawnHostileArrivalTrail(start, pos, angle, visual)
					playHostileArrivalSound(pos)
				}
				const progress = k.clamp(
					(arrival.elapsed - HOSTILE_ARRIVAL_GHOST_DURATION) /
						HOSTILE_ARRIVAL_JUMP_DURATION,
					0,
					1
				)
				ghost.opacity = k.lerp(
					HOSTILE_ARRIVAL_SILHOUETTE_OPACITY,
					0,
					progress
				)
				if (traveler && traveler.exists()) {
					traveler.pos = start.lerp(pos, progress)
					traveler.opacity = HOSTILE_ARRIVAL_SILHOUETTE_OPACITY
					traveler.scale = k.vec2(
						visual.worldScale * k.lerp(0.65, 1, progress),
						visual.worldScale * k.lerp(1.7, 1, progress)
					)
				}
				if (progress < 1) return
				arrival.completed = true
				spawn(angle, jumpDirection)
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

function playHostileArrivalSound(pos: Vec2) {
	gameSoundService.playPositional(
		"hostile_phase_arrival",
		pos,
		{
			volume: mainSoundVolume * 0.58,
			minDistance: 100,
			maxDistance: 680,
			voiceLimit: 1,
		}
	)
}

function applyHostileArrivalMomentum(
	target: GameObj,
	direction: Vec2,
	arrivalAngle: number
) {
	const coastDirection = direction.unit()
	const initialSpeed =
		HOSTILE_ARRIVAL_JUMP_DISTANCE / HOSTILE_ARRIVAL_JUMP_DURATION
	target.angle = arrivalAngle
	for (const directionKey of ["vel", "moveDirection", "facingDirection"]) {
		const currentDirection = target[directionKey]
		if (currentDirection && typeof currentDirection.len === "function") {
			target[directionKey] = coastDirection.clone()
		}
	}
	let elapsed = 0
	const controller = target.onUpdate(() => {
		if (!target.exists()) return
		const timescaleMultiplier = typeof target.getTimescale === "function"
			? target.getTimescale()
			: 1
		elapsed = Math.min(
			HOSTILE_ARRIVAL_COAST_DURATION,
			elapsed + k.dt() * timescaleMultiplier
		)
		const progress = elapsed / HOSTILE_ARRIVAL_COAST_DURATION
		const remainingMomentum = Math.pow(1 - progress, 2)
		target.move(coastDirection.scale(
			initialSpeed * remainingMomentum * velocityScale() * timescaleMultiplier
		))
		if (progress >= 1) controller.cancel()
	})
}

function spawnHostileArrivalSilhouette(
	pos: Vec2,
	angle: number,
	visual: VisualRepresentation,
	opacity: number
) {
	const silhouette = k.add([
		k.pos(pos),
		k.rotate(angle),
		k.scale(visual.worldScale),
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
	visual: VisualRepresentation
) {
	const delta = end.sub(start)
	k.add([
		k.pos(start),
		k.opacity(HOSTILE_ARRIVAL_LINE_OPACITY),
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
			HOSTILE_ARRIVAL_SILHOUETTE_OPACITY
		)
		echo.scale = k.vec2(visual.worldScale * k.lerp(0.7, 1, progress))
		echo.use(k.lifespan(HOSTILE_ARRIVAL_JUMP_DURATION, { fade: 0.28 }))
	}
}

function spawnRoomGravityShrine(center: Vec2, room: RoomFloorRoom) {
	const objectTags = [tags.runMap, tags.runRoom]
	const visual = getWorldVisual("gravity-shrine")
	const shrine = k.add([
		k.pos(center),
		k.sprite(visual.parts[0].sprite),
		k.anchor("center"),
		k.scale(visual.worldScale),
		k.color(205, 185, 255),
		k.layer(layers.buildings),
		interactable(60, enterShrine),
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
	const prompt = createNpcInteractionPrompt({
		target: shrine,
		offset: k.vec2(0, -50),
		label: { text: "ENTER" },
	})
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
		prompt.update(shrine.isInRange && transitionCooldown <= 0)
	})

	function enterShrine() {
		if (transitionCooldown > 0) return
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
	}
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
