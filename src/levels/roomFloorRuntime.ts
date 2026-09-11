import type { GameObj, PosComp, Vec2 } from "kaplay"
import { dialogue } from "../content/dialogue/dialogueCatalog"
import { shouldSpawnBossRoomForDepth } from "./floorThemes/floorThemeDirectory"
import { gridCollision } from "../comp/gridCollision"
import { interactable } from "../comp/interactable"
import { generationMapToHexGrid } from "../generation/gridConversion"
import { hexDistance, hexNeighbors } from "../generation/hexUtils"
import {
	buildRoomTemplate,
	oppositeRoomDirection,
	type BuiltRoomTemplate,
	type RoomDoor,
} from "../generation/rooms/roomTemplateBuilder"
import type {
	RoomEnemyPlan,
	RoomFloorRoom,
} from "../generation/rooms/roomFloorTypes"
import { playerObj } from "../game"
import { ACTIVE_RUN_GRID_KEY } from "../grid/gridKeys"
import { gridRegistry } from "../grid/gridRegistry"
import { hexToPixel } from "../grid/hexCoord"
import { CellType, type HexGrid } from "../grid/hexGrid"
import {
	k,
	layers,
	mainSoundVolume,
	musicVolume,
	velocityScale,
	WORLD_CAMERA_SCALE,
} from "../main"
import {
	beginRoomFloor,
	activateFloorCargoPuzzle,
	clearRoomFloor,
	enterFloorRoom,
	extendCurrentEndlessRoomFloor,
	getActiveRoomFloor,
	getCurrentFloorRoom,
	getFloorCargoPuzzleForRoom,
	getFloorKeyCount,
	isFloorRoomConnectionSealed,
	isFloorRoomKeyLocked,
	markCurrentRoomContentCompleted,
	markCurrentFloorRoomCleared,
	markFloorEnemyDefeated,
	rollCurrentRoomClearKeyDrop,
	rollFloorEnemyKeyDrop,
	sealFloorStartRoomExit,
	teleportToFloorRoom as teleportRoomState,
	unlockFloorRoomWithKey,
} from "../services/world/roomFloorService"
import { spawnPlannedEnemy } from "../services/enemies/enemyEncounterService"
import { gameSoundService } from "../services/audio/gameSoundService"
import { audioService } from "../services/audio/audioService"
import { setFloorMusicRoomState } from "../services/audio/explorationMusicService"
import {
	getBossDefinition,
	getBossHealth,
} from "../services/enemies/bossRegistry"
import {
	getActiveBossEncounter,
	type BossEncounterController,
} from "../services/enemies/bossEncounterService"
import { getHubLevel } from "../services/hub/hubProgressService"
import { resetPlayerPath } from "../services/player/playerPathService"
import {
	addLocalLight,
	updateLocalLight,
} from "../services/world/localLightService"
import { startThreatLevel, stopThreatLevel, updateThreatLevel } from "../services/enemies/threatService"
import { spawnBoss1 } from "../spawn/spawnBoss1"
import { spawnPhaseCorePickup } from "../spawn/spawnPhaseCore"
import { spawnPsionicPlatePickup } from "../spawn/spawnPsionicPlate"
import { spawnChest } from "../spawn/spawnChest"
import { spawnDebree } from "../spawn/spawnDebree"
import { spawnDebreeDeposit } from "../spawn/spawnDebreeDeposit"
import { spawnFlash } from "../spawn/spawnFlash"
import { spawnGravityPull } from "../spawn/spawnGravityPull"
import { spawnImpactAce } from "../spawn/spawnImpactAce"
import { spawnBoilerHulk } from "../spawn/wake/spawnBoilerHulk"
import { spawnMagnetMaw } from "../spawn/wake/spawnMagnetMaw"
import { spawnRailbreakerRig } from "../spawn/wake/spawnRailbreakerRig"
import { spawnYardmaster } from "../spawn/wake/spawnYardmaster"
import { spawnLastBeacon } from "../spawn/wake/spawnLastBeacon"
import { spawnRing } from "../spawn/spawnRing"
import { spawnDecorativeWormhole } from "../spawn/spawnLevel"
import {
	spawnRunDroneShop,
	spawnRunUpgradeShop,
} from "../spawn/rooms/spawnRunUpgradeShop"
import { spawnLassoComponent } from "../spawn/rooms/spawnLassoComponent"
import {
	spawnCargoPuzzleCrate,
	spawnCargoPuzzleSocket,
} from "../spawn/rooms/spawnCargoPuzzle"
import { spawnRoomKeyPickup } from "../spawn/rooms/spawnRoomKey"
import { spawnRoomEnvironment } from "../spawn/rooms/spawnRoomEnvironment"
import { spawnScrapCircuitPuzzle } from "../spawn/rooms/spawnScrapCircuitPuzzle"
import { spawnThrusterCalibrationPuzzle } from "../spawn/rooms/spawnThrusterCalibrationPuzzle"
import { spawnLassoTrialPuzzle } from "../spawn/rooms/spawnLassoTrialPuzzle"
import { spawnRewardPickup } from "../spawn/spawnPowerup"
import { spawnHealthShrine } from "../spawn/shrine/spawnHealthShrine"
import { spawnShrine } from "../spawn/shrine/spawnShrine"
import { getShrineLevelConfig } from "../spawn/shrine/shrineLevel"
import { playPlayerRespawnTransition } from "../setupPlayer"
import { tags } from "../tags"
import { createNpcInteractionPrompt, UI_COLORS } from "../ui/common"
import { playRequirementErrorSound } from "../services/audio/uiSoundService"
import { rollMapEventReward } from "../services/economy/rewardService"
import { getPermanentUpgradeLevel } from "../upg"
import { loadSongData } from "../web"
import { getLifetimeStats } from "../services/runs/runStatsService"
import {
	consumeEmergencyNaniteShrine,
	getExpeditionSupportValue,
	queueEmergencyNaniteShrine,
} from "../services/hub/expeditionSupportService"
import { canDiscoverLassoComponent } from "../services/narrative/narrativeService"
import { getWakeMiniBossForDepth } from "../services/enemies/wakeMiniBossService"
import {
	rollPsionicPlateDrop,
	type PsionicPlateMiniBossId,
} from "../services/economy/psionicPlateService"
import { clearRoomCoverSources } from "../services/world/roomCoverService"
import { clearDestructibleWalls } from "../services/world/destructibleWallService"
import {
	playCutscene,
	type CutsceneContext,
} from "../services/narrative/cutsceneService"
import { hasUndiscoveredAbilities } from "../services/abilities/abilityRegistry"
import {
	activatePersistentShipPartRoom,
	clearPersistentShipParts,
} from "../services/combat/persistentShipPartService"
import {
	placePlayerLassoRoomTransfer,
	preparePlayerLassoRoomTransfer,
} from "../services/player/playerLassoService"
import {
	getEnemyVisual,
} from "../visuals/enemyVisualCatalog"
import {
	scaleVisualRepresentation,
	type VisualRepresentation,
} from "../visuals/visualRepresentation"
import { getWorldVisual } from "../visuals/worldVisualCatalog"
import {
	getRoomIntelLevel,
	getRoomSignalFrame,
	getRoomSignalFamily,
	getRoomThreatRating,
	getRouteResonanceFrame,
	ROOM_SIGNAL_SPRITE,
} from "../services/world/roomIntelService"
import type { GeneratedMapConfig } from "./levels"
import { spawnFloorExit } from "./runMap"
import {
	getRunRockTileFrame,
	RUN_ROCK_TILE_ANCHOR_Y,
	RUN_ROCK_TILE_SOURCE_RADIUS,
	RUN_ROCK_TILE_SPRITE,
} from "./runRockTiles"
import { createRoomGroundPlatformCells } from "./roomGroundPlatforms"
import {
	getRunRockGroundTileFrame,
	RUN_ROCK_GROUND_TILE_ANCHOR_Y,
	RUN_ROCK_GROUND_TILE_SOURCE_RADIUS,
	RUN_ROCK_GROUND_TILE_SPRITE,
} from "./runRockGroundTiles"

const ROOM_TRANSITION_COOLDOWN = 0.45
const ROOM_ENTRY_INSET = 2
const ROOM_HEX_SIZE = 42
const ROOM_PROJECTION_Y_SCALE = 2 / Math.sqrt(3)
const HOSTILE_ARRIVAL_GHOST_DURATION = 0.6
const HOSTILE_ARRIVAL_JUMP_DURATION = 0.18
const HOSTILE_ARRIVAL_JUMP_DISTANCE = 320
const HOSTILE_ARRIVAL_COAST_SPEED = 220
const HOSTILE_ARRIVAL_COAST_DURATION = 0.42
const HOSTILE_ARRIVAL_STAGGER = 0.09
const BOSS_INTRO_ARRIVAL_DURATION = HOSTILE_ARRIVAL_GHOST_DURATION +
	HOSTILE_ARRIVAL_JUMP_DURATION + 0.1
const BOSS_INTRO_ZOOM_MULTIPLIER = 1.16
const BOSS_INTRO_MUSIC_MULTIPLIER = 0.22
const BOSS_INTRO_HOLD_DURATION = 2
const HOSTILE_ARRIVAL_COLOR = [255, 75, 90] as const
const HOSTILE_ARRIVAL_SILHOUETTE_OPACITY = 0.7
const HOSTILE_ARRIVAL_LINE_OPACITY = 0.5
const GRAVITY_ROOM_COLOR = [174, 112, 255] as const
const GRAVITY_ROOM_WORMHOLE_OFFSET_Y = -18
const OPENING_TRANSITION_DEPTH = 1
const ROOM_CONNECTION_LINK_LENGTH = 1800
const ROOM_CONNECTION_LINK_WIDTH = 3
const ROOM_CONNECTION_LINK_WAVE_LENGTH = 92
const ROOM_CONNECTION_LINK_WAVE_AMPLITUDE = 13
const ROOM_CONNECTION_LINK_SEGMENT_LENGTH = 28
const ROOM_CONNECTION_SIGNAL_OFFSET = 28
const ROOM_CONNECTION_SIGNAL_SIZE = 16
const ROOM_CONNECTION_LINK_ICON_GAP = 8
const BOSS_DOOR_SKULL_SPRITE = "boss_room_skull"
const BOSS_DOOR_PARTICLE_RATE = 7

let active = false
let activeConfig: GeneratedMapConfig | undefined
let transitionCooldown = 0
let activeEmergencyNaniteRecovery = 0
let activeEmergencyNaniteShrineSpawned = false

export function startGeneratedRoomFloor(
	config: GeneratedMapConfig,
	seed: number,
	depth: number,
	options: {
		endless?: boolean
		roomCount?: number
		maxRoomCount?: number
	} = {}
) {
	clearGeneratedRoomFloor()
	active = true
	activeConfig = config
	activeEmergencyNaniteRecovery = consumeEmergencyNaniteShrine()
	activeEmergencyNaniteShrineSpawned = false
	beginRoomFloor(seed, depth, {
		milestoneBoss: !options.endless && shouldSpawnBossRoomForDepth(depth),
		hubLevel: getHubLevel(),
		endless: options.endless,
		roomCount: options.roomCount,
		maxRoomCount: options.maxRoomCount,
		lassoComponentAvailable:
			getLifetimeStats().completedRuns >= 5 &&
			canDiscoverLassoComponent() &&
			getPermanentUpgradeLevel("salvageLasso") === undefined,
		lassoTrialAvailable:
			getPermanentUpgradeLevel("salvageLasso") !== undefined,
		scrapCircuitAvailable:
			getPermanentUpgradeLevel("salvageLasso") !== undefined,
		thrusterPuzzleAvailable:
			getPermanentUpgradeLevel("salvageLasso") !== undefined,
		cargoPuzzleAvailable:
			getPermanentUpgradeLevel("salvageLasso") !== undefined,
	})
	startThreatLevel(depth)
	spawnFloorController()
	loadCurrentRoom()
	return seed
}

export function clearGeneratedRoomFloor() {
	clearRoomCoverSources()
	clearDestructibleWalls(ACTIVE_RUN_GRID_KEY)
	clearPersistentShipParts()
	if (playerObj?.has("gridCollision")) playerObj.unuse("gridCollision")
	gridRegistry.unregister(ACTIVE_RUN_GRID_KEY)
	destroyTaggedObjects(tags.runRoom)
	if (active) destroyTaggedObjects(tags.runMap)
	clearRoomFloor()
	stopThreatLevel()
	active = false
	activeConfig = undefined
	transitionCooldown = 0
	activeEmergencyNaniteRecovery = 0
	activeEmergencyNaniteShrineSpawned = false
}

export function generatedRoomFloorActive() {
	return active
}

export function transitionToConnectedRoom(destinationRoomId: string) {
	if (!active || transitionCooldown > 0) return false
	const floor = getActiveRoomFloor()
	const previousRoom = getCurrentFloorRoom()
	if (!previousRoom) return false
	const destination = enterFloorRoom(destinationRoomId)
	if (!destination) return false
	if (previousRoom.id === floor?.startRoomId) sealFloorStartRoomExit()
	const travelDirection = getRoomTravelDirection(previousRoom, destination)
	transitionCooldown = ROOM_TRANSITION_COOLDOWN
	const carriedTarget = preparePlayerLassoRoomTransfer()
	destroyTaggedObjects(tags.runRoom, carriedTarget)
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
	const carriedTarget = preparePlayerLassoRoomTransfer()
	destroyTaggedObjects(tags.runRoom, carriedTarget)
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
	extendCurrentEndlessRoomFloor()
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
	clearDestructibleWalls(ACTIVE_RUN_GRID_KEY)
	gridRegistry.unregister(ACTIVE_RUN_GRID_KEY)
	gridRegistry.register(ACTIVE_RUN_GRID_KEY, grid, false)
	activatePersistentShipPartRoom(room.id)
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
		const arrivalAnimating = playPlayerRespawnTransition(entryPosition, {
			startPosition: travelDirection
				? entryPosition.sub(travelDirection.scale(
					grid.config.hexSize * Math.sqrt(3) * 3
				))
				: entryDoor
					? grid.hexToScreen(entryDoor.coord)
					: entryPosition.add(-ROOM_HEX_SIZE * 2, 0),
		})
		placePlayerLassoRoomTransfer(playerObj.pos, room.id, arrivalAnimating)
	} else {
		placePlayerLassoRoomTransfer(playerObj.pos, room.id, false)
	}
	if (
		room.state !== "cleared" &&
		(room.contentCompleted || roomClearsOnEntry(room))
	) {
		markCurrentFloorRoomCleared()
	}
	let doorsLocked = room.state !== "cleared"
	setFloorMusicRoomState(getRoomMusicState(room))
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
	spawnBossDoorWarnings(grid, template)
	spawnRoomEnvironment(grid, room)
	if (
		room.id === getActiveRoomFloor()?.startRoomId &&
		activeEmergencyNaniteRecovery > 0 &&
		!activeEmergencyNaniteShrineSpawned
	) {
		activeEmergencyNaniteShrineSpawned = true
		spawnHealthShrine({
			pos: getStartRoomShrinePosition(grid, template),
			totalRecovery: activeEmergencyNaniteRecovery,
			tags: [tags.runMap, tags.runRoom],
		})
	}
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

function getStartRoomShrinePosition(
	grid: HexGrid,
	template: BuiltRoomTemplate
) {
	const slot = [...template.contentSlots].sort((a, b) =>
		hexDistance(b, template.center) - hexDistance(a, template.center)
	)[0]
	return grid.hexToScreen(slot ?? template.center)
}

function roomClearsOnEntry(room: RoomFloorRoom) {
	return !roomUsesStandardEncounter(room) &&
		room.kind !== "lassoTrial" &&
		room.kind !== "shrine" &&
		room.kind !== "miniBoss" &&
		room.kind !== "boss"
}

function roomUsesStandardEncounter(room: RoomFloorRoom) {
	return room.kind === "combat" ||
		room.kind === "reward" ||
		room.kind === "gravity" ||
		room.kind === "event" ||
		room.kind === "lassoComponent" ||
		room.kind === "cargoPuzzleSource"
}

function roomUsesCombatMusic(room: RoomFloorRoom) {
	return roomUsesStandardEncounter(room) ||
		room.kind === "shrine" ||
		room.kind === "miniBoss" ||
		room.kind === "boss"
}

function getRoomMusicState(room: RoomFloorRoom) {
	if (room.state === "cleared") return "safe" as const
	if (room.kind === "boss") return "chill" as const
	if (room.kind === "chill" || room.kind === "start") return "chill" as const
	return roomUsesCombatMusic(room) ? "combat" as const : "safe" as const
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
				text: "UNLOCK // 1 KEY",
				color: getFloorKeyCount() > 0
					? k.rgb(...UI_COLORS.warning)
					: k.rgb(...UI_COLORS.danger),
			}),
		})
		lock.onUpdate(() => {
			const available = !doorsLocked() &&
				isFloorRoomKeyLocked(door.destinationRoomId) &&
				!isCurrentRoomDoorSealed(door.destinationRoomId)
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
					!isFloorRoomKeyLocked(door.destinationRoomId) &&
					!isCurrentRoomDoorSealed(door.destinationRoomId)
				) transitionToConnectedRoom(door.destinationRoomId)
			},
		},
		tags.runRoom,
		tags.runMap,
		tags.gameLoop,
	])
	return controller
}

function spawnBossDoorWarnings(
	grid: HexGrid,
	template: BuiltRoomTemplate
) {
	const floor = getActiveRoomFloor()
	if (!floor) return

	for (const door of template.doors) {
		const destination = floor.rooms.find(
			(room) => room.id === door.destinationRoomId
		)
		if (destination?.kind !== "boss") continue

		const position = grid.hexToScreen(door.coord)
		const phase = door.coord.q * 0.73 + door.coord.r * 1.19
		const marker = k.add([
			k.pos(position),
			k.sprite(BOSS_DOOR_SKULL_SPRITE),
			k.anchor("center"),
			k.color(...UI_COLORS.danger),
			k.opacity(1),
			k.layer(layers.gameEffects),
			k.z(2),
			{
				update() {
					marker.opacity = k.wave(0.78, 1, k.time() * 3.4 + phase)
				},
			},
			tags.runRoom,
			tags.runMap,
			tags.gameLoop,
		])
		k.add([
			k.pos(position),
			k.particles(
				{
					max: 24,
					speed: [8, 24],
					acceleration: [k.vec2(-5, -15), k.vec2(5, -32)],
					angle: [0, 360],
					lifeTime: [0.65, 1.25],
					colors: [
						k.rgb(...UI_COLORS.danger),
						k.rgb(78, 5, 10),
						k.BLACK,
					],
					opacities: [0.9, 0.62, 0],
					scales: [0.55, 1.25, 0.15],
					angularVelocity: [-90, 90],
					texture: k.getSprite("particle3")!.data!.frames[0].tex,
					quads: [k.getSprite("particle3")!.data!.frames[0].q],
				},
				{
					rate: BOSS_DOOR_PARTICLE_RATE,
					direction: -90,
					spread: 120,
					position: k.vec2(),
				}
			),
			k.layer(layers.gameEffects),
			k.z(1),
			tags.runRoom,
			tags.runMap,
			tags.gameLoop,
		])
	}
}

function renderRoom(
	grid: HexGrid,
	template: BuiltRoomTemplate,
	room: RoomFloorRoom,
	doorsLocked: () => boolean
) {
	const groundPlatforms = createRoomGroundPlatformCells(template, room).map(
		(platform) => ({
			center: grid.hexToScreen(platform.coord),
			frame: getRunRockGroundTileFrame(
				platform.exposedMask,
				platform.variation
			),
		})
	)
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
	const tileScale = grid.config.hexSize / RUN_ROCK_TILE_SOURCE_RADIUS
	const tileScaleY = tileScale * (grid.config.projectionYScale ?? 1)
	const tileCenterOffsetY =
		(RUN_ROCK_TILE_SOURCE_RADIUS - RUN_ROCK_TILE_ANCHOR_Y) * tileScaleY
	const groundTileScale = grid.config.hexSize / RUN_ROCK_GROUND_TILE_SOURCE_RADIUS
	const groundTileScaleY = groundTileScale * (grid.config.projectionYScale ?? 1)
	const groundTileCenterOffsetY = (
		RUN_ROCK_GROUND_TILE_SOURCE_RADIUS - RUN_ROCK_GROUND_TILE_ANCHOR_Y
	) * groundTileScaleY
	let staticRoomPicture: ReturnType<typeof k.endPicture> | undefined
	const roomRenderer = k.add([
		k.pos(0, 0),
		k.layer(layers.game2),
		{
			draw() {
				if (!staticRoomPicture) {
					k.beginPicture()
					for (const platform of groundPlatforms) {
						k.drawSprite({
							sprite: RUN_ROCK_GROUND_TILE_SPRITE,
							frame: platform.frame,
							pos: platform.center.add(0, groundTileCenterOffsetY),
							anchor: "center",
							scale: k.vec2(groundTileScale, groundTileScaleY),
							color: k.rgb(112, 92, 88),
							opacity: 0.82,
						})
					}
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
				const roomCleared = room.state === "cleared" && !doorsLocked()
				if (roomCleared) {
					for (const door of template.doors) {
						if (
							isFloorRoomKeyLocked(door.destinationRoomId) ||
							isCurrentRoomDoorSealed(door.destinationRoomId)
						) continue
						drawRoomConnectionLink(grid, door)
					}
				}
				k.drawPicture(staticRoomPicture, {})
				for (const door of template.doors) {
					const center = grid.hexToScreen(door.coord)
					const direction = grid.hexToScreen(door.insideCoord).sub(center).unit()
					const tangent = k.vec2(-direction.y, direction.x)
					const keyLocked = isFloorRoomKeyLocked(door.destinationRoomId)
					const sealed = isCurrentRoomDoorSealed(door.destinationRoomId)
					const roomLocked = doorsLocked() || sealed
					const destinationVisited = getActiveRoomFloor()?.rooms.some(
						(destination) =>
							destination.id === door.destinationRoomId &&
							destination.state === "cleared"
					) === true
					const destination = getActiveRoomFloor()?.rooms.find(
						(candidate) => candidate.id === door.destinationRoomId
					)
					k.drawLine({
						p1: center.add(tangent.scale(grid.config.hexSize * 0.36)),
						p2: center.sub(tangent.scale(grid.config.hexSize * 0.36)),
						width: 3,
						color: roomLocked
							? k.rgb(...UI_COLORS.danger)
							: keyLocked
								? k.rgb(...UI_COLORS.warning)
								: k.rgb(...UI_COLORS.accent),
						opacity: roomLocked || keyLocked
							? 1
							: destinationVisited
								? 0.18
								: 0.7,
					})
					if (keyLocked && !roomLocked && !sealed) {
						k.drawSprite({
							sprite: "room_phase_key",
							pos: center.add(direction.scale(17)),
							anchor: "center",
							scale: k.vec2(0.55),
							color: k.rgb(...UI_COLORS.warning),
						})
					}
					if (destination && getRoomIntelLevel(destination) >= 1 && !destinationVisited) {
						const markerPos = center.sub(
							direction.scale(ROOM_CONNECTION_SIGNAL_OFFSET)
						)
						const markerColor = destination.dangerLevel === 3
							? k.rgb(...UI_COLORS.danger)
							: k.rgb(...UI_COLORS.accent)
						k.drawSprite({
							sprite: ROOM_SIGNAL_SPRITE,
							frame: getRoomSignalFrame(destination),
							pos: markerPos,
							anchor: "center",
							width: ROOM_CONNECTION_SIGNAL_SIZE,
							height: ROOM_CONNECTION_SIGNAL_SIZE,
							color: markerColor,
							opacity: roomLocked ? 0.45 : 0.95,
						})
						if (getRoomSignalFamily(destination.kind) === "threat") {
							const rating = getRoomThreatRating(destination)
							for (let index = 0; index < rating; index++) {
								k.drawRect({
									width: 2,
									height: 2,
									pos: markerPos.add((index - (rating - 1) / 2) * 4, 11),
									anchor: "center",
									color: markerColor,
									opacity: roomLocked ? 0.45 : 0.95,
								})
							}
						}
						if (destination.resonanceState === "available" ||
							destination.resonanceState === "claimed") {
							k.drawSprite({
								sprite: ROOM_SIGNAL_SPRITE,
								frame: getRouteResonanceFrame(k.time()),
								pos: markerPos.add(tangent.scale(13)),
								anchor: "center",
								width: 10,
								height: 10,
								color: k.rgb(...UI_COLORS.accent),
								opacity: destination.resonanceState === "claimed" ? 0.38 : 1,
							})
						}
						if (destination.dangerReward) {
							k.drawSprite({
								sprite: ROOM_SIGNAL_SPRITE,
								frame: destination.dangerReward === "doubleChest" ? 1 : 3,
								pos: markerPos.sub(tangent.scale(13)),
								anchor: "center",
								width: 9,
								height: 9,
								color: k.rgb(...UI_COLORS.warning),
								opacity: roomLocked ? 0.45 : 0.95,
							})
						}
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

function drawRoomConnectionLink(grid: HexGrid, door: RoomDoor) {
	const center = grid.hexToScreen(door.coord)
	const inside = grid.hexToScreen(door.insideCoord)
	const outward = center.sub(inside).unit()
	const tangent = k.vec2(-outward.y, outward.x)
	const start = center.add(outward.scale(
		ROOM_CONNECTION_SIGNAL_OFFSET +
		ROOM_CONNECTION_SIGNAL_SIZE / 2 +
		ROOM_CONNECTION_LINK_ICON_GAP
	))
	const end = center.add(outward.scale(ROOM_CONNECTION_LINK_LENGTH))
	const destination = getActiveRoomFloor()?.rooms.find(
		(room) => room.id === door.destinationRoomId
	)
	const color = getRoomConnectionThreatColor(destination)
	const opacity = destination?.state === "cleared" ? 0.22 : 0.72
	const points: Vec2[] = []
	const linkLength = start.dist(end)
	const segmentCount = Math.ceil(linkLength / ROOM_CONNECTION_LINK_SEGMENT_LENGTH)
	const phase = k.time() * 2.4 + door.coord.q * 0.71 + door.coord.r * 1.13
	for (let index = 0; index <= segmentCount; index++) {
		const progress = index / segmentCount
		const distance = linkLength * progress
		const endpointFade = Math.sin(progress * Math.PI)
		const primaryWave = Math.sin(
			distance / ROOM_CONNECTION_LINK_WAVE_LENGTH * Math.PI * 2 + phase
		)
		const secondaryWave = Math.sin(
			distance / (ROOM_CONNECTION_LINK_WAVE_LENGTH * 0.47) * Math.PI * 2 - phase * 1.35
		) * 0.28
		points.push(
			start
				.add(outward.scale(distance))
				.add(tangent.scale(
					(primaryWave + secondaryWave) *
					ROOM_CONNECTION_LINK_WAVE_AMPLITUDE * endpointFade
				))
		)
	}
	k.drawLines({
		pts: points,
		width: ROOM_CONNECTION_LINK_WIDTH * 5,
		color,
		opacity: opacity * 0.1,
		join: "round",
	})
	k.drawLines({
		pts: points,
		width: ROOM_CONNECTION_LINK_WIDTH,
		color,
		opacity,
		join: "round",
	})
}

function getRoomConnectionThreatColor(room: RoomFloorRoom | undefined) {
	if (!room || getRoomIntelLevel(room) < 1) {
		return k.rgb(...UI_COLORS.border)
	}
	const threat = getRoomThreatRating(room)
	if (threat === 3) return k.rgb(...UI_COLORS.danger)
	if (threat === 2) return k.rgb(...UI_COLORS.warning)
	return k.rgb(...UI_COLORS.accent)
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
	let residentsSpawned = false
	const controller = k.add([
		{
			update() {
				if (!playerObj.exists()) return
				if (wave === undefined) {
					markCurrentFloorRoomCleared()
					onCleared()
					if (room.kind !== "gravity" && !roomHasPreviewedChest(room)) {
						spawnRoomContent(grid, template, room, onCleared)
					}
					k.destroy(controller)
					return
				}
				if (!residentsSpawned) {
					spawnResidentRoomEnemies(grid, template, room, wave)
					residentsSpawned = true
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
				residentsSpawned = false
				waveDelay = 0.75
			},
		},
		tags.runRoom,
		tags.runMap,
		tags.gameLoop,
	])
}

function spawnResidentRoomEnemies(
	grid: HexGrid,
	template: BuiltRoomTemplate,
	room: RoomFloorRoom,
	wave: number
) {
	const entries = room.encounter?.enemies.filter((enemy) =>
		enemy.wave === wave &&
		!enemy.defeated &&
		enemy.arrivalMode === "resident"
	) ?? []
	for (const entry of entries) {
		const slot = template.spawnSlots[entry.spawnSlot % template.spawnSlots.length]
		if (!slot) {
			markFloorEnemyDefeated(entry.id)
			continue
		}
		spawnPlannedRoomEnemy(entry, grid.hexToScreen(slot), room)
	}
}

function spawnRoomWave(
	grid: HexGrid,
	template: BuiltRoomTemplate,
	room: RoomFloorRoom,
	wave: number
) {
	const entries = room.encounter?.enemies.filter((enemy) =>
		enemy.wave === wave &&
		!enemy.defeated &&
		enemy.arrivalMode !== "resident"
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
				spawnPlannedRoomEnemy(
					entry,
					spawnPos,
					room,
					arrivalAngle,
					jumpDirection
				)
			},
			fleetJumpDirection,
			index === 0
		)
	}
}

function spawnPlannedRoomEnemy(
	entry: RoomEnemyPlan,
	spawnPos: Vec2,
	room: RoomFloorRoom,
	arrivalAngle?: number,
	jumpDirection?: Vec2
) {
	const enemy = spawnPlannedEnemy(entry.enemyId, spawnPos, {
		persistOffscreen: true,
		elite: entry.elite,
		tags: [tags.runMap, tags.runRoom, tags.runRoomEnemy],
	})
	if (!enemy) {
		markFloorEnemyDefeated(entry.id)
		return
	}
	if (arrivalAngle !== undefined && jumpDirection) {
		applyHostileArrivalMomentum(enemy, jumpDirection, arrivalAngle)
	}
	enemy.onDeath(() => {
		if (getCurrentFloorRoom()?.id !== room.id) return
		const deathPos = enemy.pos.clone()
		if (rollFloorEnemyKeyDrop(entry.id)) {
			spawnRoomKeyPickup(deathPos)
		}
		markFloorEnemyDefeated(entry.id)
	})
	return enemy
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
		const locked = roomLocked ||
			isFloorRoomKeyLocked(door.destinationRoomId) ||
			isCurrentRoomDoorSealed(door.destinationRoomId)
		grid.setCell(door.coord, locked ? CellType.Wall : CellType.Empty)
	}
}

function isCurrentRoomDoorSealed(destinationRoomId: string) {
	const currentRoomId = getCurrentFloorRoom()?.id
	return currentRoomId !== undefined &&
		isFloorRoomConnectionSealed(currentRoomId, destinationRoomId)
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
	if (room.kind === "combat" && room.state === "cleared" && !room.contentCompleted) {
		spawnCombatRoomReward(grid, template, room, completeContent, objectTags)
		return
	}
	if (
		room.kind === "chill" ||
		room.kind === "start" ||
		room.kind === "combat"
	) return
	if (room.kind === "scrapCircuit") {
		spawnScrapCircuitPuzzle(center, {
			difficulty: getActiveRoomFloor()?.depth ?? 1,
			tags: objectTags,
			onCompleted: completeContent,
		})
		return
	}
	if (room.kind === "thrusterPuzzle") {
		if (room.contentCompleted) return
		spawnThrusterCalibrationPuzzle(center, {
			tags: objectTags,
			onCompleted: completeContent,
		})
		return
	}
	if (room.kind === "lassoTrial") {
		if (room.contentCompleted) return
		spawnLassoTrialPuzzle(center, {
			tags: objectTags,
			onCompleted: completeContent,
		})
		return
	}
	if (room.kind === "gravity") {
		spawnRoomGravityShrine(center, room)
		return
	}
	if (room.kind === "exit" || (room.kind === "boss" && room.state === "cleared")) {
		spawnFloorExit(center, objectTags, {
			onActivated: onExitActivated,
			finaleRequired:
				getActiveRoomFloor()?.depth !== OPENING_TRANSITION_DEPTH,
		})
		return
	}
	if (room.kind === "deposit") {
		spawnDebreeDeposit(center, {
			available: () => !room.contentCompleted,
			onDeposit: () => markCurrentRoomContentCompleted(),
			tags: objectTags,
		})
		return
	}
	if (room.contentCompleted) return

	switch (room.kind) {
		case "cargoPuzzleSource": {
			const puzzle = getFloorCargoPuzzleForRoom(room.id)
			if (!puzzle) {
				completeContent()
				return
			}
			const crateCoord = template.contentSlots[0] ?? template.center
			spawnCargoPuzzleCrate(grid.hexToScreen(crateCoord), puzzle.id)
			return
		}
		case "cargoPuzzleTarget": {
			const puzzle = getFloorCargoPuzzleForRoom(room.id)
			if (!puzzle) {
				completeContent()
				return
			}
			const socketCoord = template.contentSlots[0] ?? template.center
			const chestCoord = template.contentSlots[1] ?? {
				q: template.center.q + 1,
				r: template.center.r,
			}
			spawnCargoPuzzleSocket(grid.hexToScreen(socketCoord), puzzle.id, {
				activated: puzzle.socketActivated,
				onActivate: () => activateFloorCargoPuzzle(puzzle.id),
			})
			spawnChest(
				grid.hexToScreen(chestCoord),
				getActiveRoomFloor()?.depth ?? 1,
				{
					available: () => puzzle.socketActivated,
					ghostWhenUnavailable: true,
					revealWhenAvailable: true,
					onOpened: completeContent,
					tags: objectTags,
				}
			)
			return
		}
		case "shop":
			spawnRunUpgradeShop(center, room, objectTags)
			return
		case "droneShop":
			spawnRunDroneShop(center, room, objectTags)
			return
		case "lassoComponent":
			spawnLassoComponent(center, {
				tags: objectTags,
				onCollected: completeContent,
			})
			return
		case "reward":
			spawnRewardRoomChests(grid, template, room, completeContent, isContentAvailable, objectTags)
			return
		case "event":
			spawnChest(center, getActiveRoomFloor()?.depth ?? 1, {
				rewardType: hasUndiscoveredAbilities() ? "weapon" : "salvage",
				available: isContentAvailable,
				ghostWhenUnavailable: true,
				revealWhenAvailable: true,
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

function spawnRewardRoomChests(
	grid: HexGrid,
	template: BuiltRoomTemplate,
	room: RoomFloorRoom,
	onComplete: () => void,
	isAvailable: () => boolean,
	objectTags: string[]
) {
	const depth = getActiveRoomFloor()?.depth ?? 1
	const chestCount = room.resonanceState === "claimed" && room.resonanceBonus === "rewardCache"
		? 2
		: 1
	let opened = room.rewardClaims ?? 0
	for (let index = opened; index < chestCount; index++) {
		const fallback = template.center
		const slot = template.contentSlots[index] ?? fallback
		const offset = chestCount === 1 ? k.vec2(0, 0) : k.vec2(index === 0 ? -34 : 34, 0)
		spawnChest(grid.hexToScreen(slot).add(offset), depth + (chestCount > 1 ? 1 : 0), {
			available: isAvailable,
			ghostWhenUnavailable: true,
			revealWhenAvailable: true,
			revealDelay: index * 0.12,
			onOpened: () => {
				opened++
				room.rewardClaims = opened
				if (opened >= chestCount) onComplete()
			},
			tags: objectTags,
		})
	}
}

function spawnCombatRoomReward(
	grid: HexGrid,
	template: BuiltRoomTemplate,
	room: RoomFloorRoom,
	onComplete: () => void,
	objectTags: string[]
) {
	const center = grid.hexToScreen(template.center)
	const resonance = room.resonanceState === "claimed" ? room.resonanceBonus : undefined
	if (room.dangerReward === "doubleChest" || resonance === "rewardCache") {
		let opened = room.rewardClaims ?? 0
		const offsets = [k.vec2(-42, 0), k.vec2(42, 0)]
		for (let index = opened; index < offsets.length; index++) {
			const offset = offsets[index]
			spawnChest(center.add(offset), (getActiveRoomFloor()?.depth ?? 1) + 2, {
				revealOnSpawn: true,
				revealDelay: index * 0.12,
				onOpened: () => {
					opened++
					room.rewardClaims = opened
					if (opened === 2) onComplete()
				},
				tags: objectTags,
			})
		}
		return
	}
	if (room.dangerReward === "salvageBurst" || resonance === "salvageSurge") {
		spawnDebree(center, room.dangerReward === "salvageBurst" ? 72 : 30, {
			pattern: "radial",
			source: "world",
			tags: objectTags,
		})
		onComplete()
		return
	}
	if (resonance === "keyEcho") {
		spawnRoomKeyPickup(center, objectTags)
		onComplete()
		return
	}
	onComplete()
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
	const wakeMiniBoss = wakeFloor ? getWakeMiniBossForDepth(depth) : undefined
	const miniBossId: PsionicPlateMiniBossId = wakeMiniBoss ?? "impact-ace"
	const visual = wakeFloor
		? getEnemyVisual(wakeMiniBoss!)
		: getEnemyVisual("impact-ace")
	const onDefeated = (defeatedAt: Vec2) => {
		if (k.chance(0.2)) {
			spawnPhaseCorePickup(defeatedAt, { source: "boss" })
		}
		const plateDrop = rollPsionicPlateDrop(miniBossId, k.rand())
		if (plateDrop.drops) {
			spawnPsionicPlatePickup(defeatedAt, {
				miniBossId,
				guaranteed: plateDrop.guaranteed,
			})
		}
		markCurrentRoomContentCompleted()
		onCleared()
	}
	if (wakeMiniBoss === "wake-magnet-maw") {
		spawnMagnetMaw(center, (20 + depth * 2) * 20, {
			persistOffscreen: true,
			tags: [tags.runMap, tags.runRoom, tags.runRoomEnemy],
			onDefeated,
		})
		return
	}
	spawnHostileArrival(center, 0, visual, (
		arrivalAngle,
		jumpDirection
	) => {
		const enemy = wakeMiniBoss === "wake-railbreaker-rig"
			? spawnRailbreakerRig(center, (20 + depth * 2) * 20, {
				persistOffscreen: true,
				tags: [tags.runMap, tags.runRoom, tags.runRoomEnemy],
				onDefeated,
			})
			: wakeFloor
				? spawnBoilerHulk(center, (20 + depth * 2) * 20, {
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
	const bossId = room.bossId ?? (
		getActiveRoomFloor()?.themeId === "wake-scrap-district"
			? ["federation-dreadnought", "wake-yardmaster", "wake-last-beacon"][
				Math.abs(room.seed) % 3
			] as "federation-dreadnought" | "wake-yardmaster" | "wake-last-beacon"
			: "federation-dreadnought"
	)
	room.bossId = bossId
	audioService.fadeMusicBaseVolume(
		musicVolume * BOSS_INTRO_MUSIC_MULTIPLIER,
		0.8
	)
	const finishBossRoom = (defeatedAt: Vec2) => {
		setFloorMusicRoomState("safe")
		spawnPhaseCorePickup(defeatedAt, { source: "boss" })
		queueEmergencyNaniteShrine(
			getExpeditionSupportValue("emergencyNanites")
		)
		markCurrentFloorRoomCleared()
		onCleared()
		spawnRoomContent(
			grid,
			template,
			room,
			onCleared,
			onExitActivated
		)
	}
	let boss: GameObj | undefined
	let bossEncounter: BossEncounterController | undefined
	let fightStartSignaled = false
	const signalBossFightStart = () => {
		if (fightStartSignaled) return
		fightStartSignaled = true
		const fightStartSound = getBossDefinition(bossId).fightStartSound
		if (!fightStartSound) return
		gameSoundService.play(fightStartSound, {
			volume: mainSoundVolume * 0.62,
			detune: -300,
		})
		gameSoundService.play("warp_landing_bass", {
			volume: mainSoundVolume * 0.7,
		})
		k.shake(16)
	}
	void playCutscene({
		id: `boss-introduction:${room.id}:${bossId}`,
		pauseGameplay: true,
		pauseVisualEffects: false,
		steps: [
			{
				type: "action",
				run: (context) => spawnBossIntroductionArrival(
					context,
					center,
					bossId,
					depth,
					finishBossRoom,
					(spawnedBoss) => {
						boss = spawnedBoss
						bossEncounter = getActiveBossEncounter()
						bossEncounter?.setHudVisible(false)
					}
				),
			},
			{
				type: "wait",
				duration: bossId === "wake-last-beacon"
					? 0.24
					: BOSS_INTRO_ARRIVAL_DURATION,
			},
			{
				type: "parallel",
				steps: [
					{
						type: "camera",
						target: "boss",
						zoom: WORLD_CAMERA_SCALE * BOSS_INTRO_ZOOM_MULTIPLIER,
						duration: 0.55,
						easing: "easeOutCubic",
					},
					{ type: "wait", duration: BOSS_INTRO_HOLD_DURATION },
				],
			},
			{
				type: "dialogue",
				lines: dialogue.bossIntroductions[bossId],
				options: {
					advance: "auto",
					input: "capture",
					overlayOpacity: 0.18,
				},
				skippable: true,
			},
			{
				type: "action",
				run: () => {
					if (getActiveBossEncounter() === bossEncounter) {
						bossEncounter?.setHudVisible(true)
					}
					signalBossFightStart()
				},
			},
		],
	}, {
		resolveActor: (id) => id === "boss"
			? boss as GameObj<PosComp> | undefined
			: undefined,
		onSkip: signalBossFightStart,
	}).then(() => {
		if (
			!boss?.exists() ||
			getCurrentFloorRoom()?.id !== room.id ||
			room.state === "cleared"
		) return
		audioService.playMusic("boss_k_o", {
			volume: musicVolume,
			loop: true,
		})
		loadSongData("K.O.", "Lupus Nocte", "")
	})
}

function spawnBossIntroductionArrival(
	context: CutsceneContext,
	spawnPosition: Vec2,
	bossId: NonNullable<RoomFloorRoom["bossId"]>,
	depth: number,
	onDefeated: (pos: Vec2) => void,
	onSpawned: (boss: GameObj) => void
) {
	const holdBoss = (spawnedBoss: GameObj) => {
		onSpawned(spawnedBoss)
		const encounter = getActiveBossEncounter()
		const wasPaused = spawnedBoss.paused
		spawnedBoss.paused = true
		context.defer(() => {
			if (spawnedBoss.exists()) {
				spawnedBoss.paused = wasPaused
			}
			if (getActiveBossEncounter() === encounter) {
				encounter?.setHudVisible(true)
			}
		})
	}
	if (bossId === "wake-last-beacon") {
		spawnFlash(spawnPosition, 72, k.rgb(90, 225, 255))
		spawnRing({
			pos: spawnPosition,
			speed: 380,
			intensity: 0.9,
			maxRadius: 340,
			visualize: true,
			color: k.rgb(90, 225, 255),
			effectWidth: 36,
		})
		gameSoundService.playPositional("wormhole_rampup", spawnPosition, {
			volume: mainSoundVolume * 0.75,
			detune: 180,
		})
		k.shake(8)
		holdBoss(spawnLastBeacon(spawnPosition, getBossHealth(bossId, depth), {
			tags: [tags.runMap, tags.runRoom, tags.runRoomEnemy],
			rewardAmount: 10 + depth * 2,
			onDefeated,
		}))
		return
	}
	const arrival = spawnHostileArrival(
		spawnPosition,
		0,
		getEnemyVisual(bossId),
		() => {
			const spawnedBoss = bossId === "wake-yardmaster"
				? spawnYardmaster(spawnPosition, getBossHealth(bossId, depth), {
					tags: [tags.runMap, tags.runRoom, tags.runRoomEnemy],
					rewardAmount: 10 + depth * 2,
					onDefeated,
				})
				: spawnBoss1(
					spawnPosition,
					10 + depth * 2,
					getBossHealth(bossId, depth),
					1,
					{
						skipEntry: true,
						tags: [tags.runMap, tags.runRoom, tags.runRoomEnemy],
						onDefeated,
					}
				)
			holdBoss(spawnedBoss)
		}
	)
	return () => {
		if (context.cancelled && arrival.exists()) k.destroy(arrival)
	}
}

function spawnHostileArrival(
	pos: Vec2,
	delay: number,
	visual: VisualRepresentation,
	spawn: (arrivalAngle: number, jumpDirection: Vec2) => void,
	fleetJumpDirection?: Vec2,
	triggerFleetImpact = true
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
	if (triggerFleetImpact) spawnHostileFleetRift(start, jumpDirection)
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
				if (!playerObj.exists()) {
					k.destroy(arrival)
					return
				}
				arrival.elapsed += k.dt()
				if (arrival.elapsed < 0 || arrival.completed) return
				if (arrival.elapsed < HOSTILE_ARRIVAL_GHOST_DURATION) {
					const flicker = Math.pow(
						0.5 + Math.sin(arrival.elapsed * 34) * 0.5,
						2
					)
					ghost.opacity = k.lerp(
						0.16,
						HOSTILE_ARRIVAL_SILHOUETTE_OPACITY,
						flicker
					)
					const pulse = 1 + Math.sin(arrival.elapsed * 13) * 0.045
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
				const travelProgress = 1 - Math.pow(1 - progress, 3)
				ghost.opacity = k.lerp(
					HOSTILE_ARRIVAL_SILHOUETTE_OPACITY,
					0,
					progress
				)
				if (traveler && traveler.exists()) {
					traveler.pos = start.lerp(pos, travelProgress)
					traveler.opacity = HOSTILE_ARRIVAL_SILHOUETTE_OPACITY
					traveler.scale = k.vec2(
						visual.worldScale * k.lerp(0.42, 1, travelProgress),
						visual.worldScale * k.lerp(2.6, 1, travelProgress)
					)
				}
				if (progress < 1) return
				arrival.completed = true
				spawn(angle, jumpDirection)
				spawnFlash(pos, 24, color)
				spawnFlash(pos, 15, k.WHITE)
				spawnHostileArrivalImpactStreaks(pos, jumpDirection)
				if (triggerFleetImpact) {
					k.shake(6)
					k.flash(k.WHITE, 0.055)
				}
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
	arrival.onDestroy(() => {
		if (ghost.exists()) k.destroy(ghost)
		if (traveler?.exists()) k.destroy(traveler)
	})
	return arrival
}

function playHostileArrivalSound(pos: Vec2) {
	gameSoundService.playPositional(
		"hostile_phase_arrival",
		pos,
		{
			volume: mainSoundVolume * 0.82,
			minDistance: 100,
			maxDistance: 680,
			voiceLimit: 1,
		}
	)
}

function spawnHostileFleetRift(pos: Vec2, direction: Vec2) {
	const forward = direction.unit()
	const side = k.vec2(-forward.y, forward.x)
	const rift = k.add([
		k.pos(pos),
		k.opacity(1),
		k.lifespan(
			HOSTILE_ARRIVAL_GHOST_DURATION + HOSTILE_ARRIVAL_JUMP_DURATION,
			{ fade: 0.12 }
		),
		k.layer(layers.gameEffects),
		{
			elapsed: 0,
			update() {
				rift.elapsed += k.dt()
			},
			draw() {
				const charge = k.clamp(
					rift.elapsed / HOSTILE_ARRIVAL_GHOST_DURATION,
					0,
					1
				)
				const eased = charge * charge * (3 - 2 * charge)
				const halfWidth = k.lerp(5, 42, eased)
				const flicker = 0.55 + Math.sin(rift.elapsed * 38) * 0.25
				k.drawLine({
					p1: side.scale(-halfWidth),
					p2: side.scale(halfWidth),
					width: k.lerp(1, 4, eased),
					color: k.WHITE,
					opacity: flicker * rift.opacity,
				})
				k.drawLine({
					p1: side.scale(-halfWidth * 0.72).sub(forward.scale(3)),
					p2: side.scale(halfWidth * 0.72).sub(forward.scale(3)),
					width: 2,
					color: k.rgb(...HOSTILE_ARRIVAL_COLOR),
					opacity: 0.78 * rift.opacity,
				})
				k.drawLine({
					p1: forward.scale(-54 * eased),
					p2: forward.scale(20),
					width: 1.5,
					color: k.rgb(...HOSTILE_ARRIVAL_COLOR),
					opacity: 0.48 * rift.opacity,
				})
			},
		},
		tags.runMap,
		tags.runRoom,
		tags.runRoomEnemy,
		tags.gameLoop,
	])
}

function spawnHostileArrivalImpactStreaks(pos: Vec2, direction: Vec2) {
	const forward = direction.unit()
	const side = k.vec2(-forward.y, forward.x)
	for (let index = -3; index <= 3; index++) {
		const sideOffset = side.scale(index * 5)
		const start = pos
			.sub(forward.scale(44 + Math.abs(index) * 6))
			.add(sideOffset)
		const end = pos
			.add(forward.scale(18 - Math.abs(index) * 2))
			.add(sideOffset.scale(0.35))
		const streak = k.add([
			k.pos(start),
			k.opacity(index === 0 ? 0.95 : 0.62),
			k.lifespan(0.22, { fade: 0.18 }),
			k.layer(layers.gameEffects),
			{
				update() {
					streak.pos = streak.pos.add(forward.scale(260 * k.dt()))
				},
				draw() {
					k.drawLine({
						p1: k.vec2(0),
						p2: end.sub(start),
						width: index === 0 ? 3 : 1.5,
						color: index % 2 === 0 ? k.WHITE : k.rgb(...HOSTILE_ARRIVAL_COLOR),
						opacity: streak.opacity,
					})
				},
			},
			tags.runMap,
			tags.runRoom,
			tags.gameLoop,
		])
	}
}

function applyHostileArrivalMomentum(
	target: GameObj,
	direction: Vec2,
	arrivalAngle: number
) {
	const coastDirection = direction.unit()
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
			HOSTILE_ARRIVAL_COAST_SPEED *
			remainingMomentum *
			velocityScale() *
			timescaleMultiplier
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
		label: { text: "ENTER SHRINE" },
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
		const carriedTarget = preparePlayerLassoRoomTransfer()
		destroyTaggedObjects(tags.runRoom, carriedTarget)
		loadCurrentRoom(room.id, true)
		k.flash(k.rgb(90, 45, 130), 0.18)
	}
}

function destroyTaggedObjects(tag: string, preservedObject?: GameObj) {
	const objects = k.get(tag).sort((a, b) => objectDepth(b) - objectDepth(a))
	for (const object of objects) {
		if (object.id === preservedObject?.id) continue
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
