import type { GameObj, Vec2 } from "kaplay"
import { snareable } from "../../comp/snareable"
import { gridRegistry } from "../../grid/gridRegistry"
import { ACTIVE_RUN_GRID_KEY } from "../../grid/gridKeys"
import { k, layers } from "../../main"
import {
	emitDirectionalParticles,
	emitEnemyTrail,
	sparkEmitter,
} from "../../particles"
import { spawnFlash } from "../../spawn/spawnFlash"
import { tags } from "../../tags"
import { registerBatchedEntityUpdate } from "../core/entityUpdateService"
import { setPerformanceCounter } from "../debug/frameProfilerService"
import { getCurrentFloorRoom } from "../world/roomFloorService"

const MAX_ACTIVE_PARTS = 64
const MAX_DRAWN_PARTS = 256
const SPATIAL_CELL_SIZE = 96
const DRAW_PADDING = 48
const MIN_FLIGHT_TIME = 0.9
const MAX_FLIGHT_TIME = 3.2
const SLEEP_SPEED = 7
const SLEEP_ANGULAR_SPEED = 14
const PART_SHADOW_HEIGHT = 14
const PART_SHADOW_OPACITY = 0.48
const PART_SHADOW_SCALE = 0.85
const ENEMY_DEATH_WRECKAGE_SPRITES = [
	"enemy_fighter_core",
	"enemy_fighter_left_wing",
	"enemy_fighter_right_wing",
	"enemy_hunter_standard_core",
	"enemy_hunter_talon_left_wing",
	"enemy_hunter_carapace_right_wing",
	"enemy_wake_scrap_nipper_left_cutter",
	"enemy_wake_rivet_gunner_weapon",
] as const

export interface PersistentShipPartRecord {
	id: number
	roomId: string
	sprite: string
	position: Vec2
	angle: number
	scale: number
	salvageValue: number
	material: "light" | "heavy"
	active: boolean
	bucketKey: string
}

export interface PersistentShipPartLaunchOptions {
	force: number
	direction?: Vec2
	inheritedVelocity?: Vec2
	angle?: number
	scale?: number
	secondaryBurst?: boolean
	salvageValue?: number
	material?: "light" | "heavy"
}

export interface EnemyDeathWreckageOptions {
	count?: number
	force?: number
	inheritedVelocity?: Vec2
	scale?: number
	sprites?: readonly string[]
}

interface ActivePartState {
	record?: PersistentShipPartRecord
	secondaryBurst: boolean
	lassoControlled: boolean
}

const recordsByRoom = new Map<string, Map<number, PersistentShipPartRecord>>()
const spatialBucketsByRoom = new Map<string, Map<string, Set<number>>>()
const activeParts = new Map<number, GameObj>()
let activeRoomId: string | undefined
let roomRenderer: GameObj | undefined
let roomShadowRenderer: GameObj | undefined
let nextPartId = 1
let clearing = false

export function activatePersistentShipPartRoom(roomId: string) {
	activeRoomId = roomId
	if (roomRenderer?.exists()) k.destroy(roomRenderer)
	if (roomShadowRenderer?.exists()) k.destroy(roomShadowRenderer)
	const shadowRenderer = k.add([
		k.pos(),
		k.layer(layers.game2),
		k.z(2),
		{
			draw() {
				drawSleepingPartShadows(roomId)
			},
		},
		tags.runRoom,
		tags.runMap,
		tags.gameLoop,
	])
	roomShadowRenderer = shadowRenderer
	shadowRenderer.onDestroy(() => {
		if (roomShadowRenderer?.id === shadowRenderer.id) {
			roomShadowRenderer = undefined
		}
	})
	const renderer = k.add([
		k.pos(),
		k.layer(layers.gameEffects),
		{
			draw() {
				drawSleepingParts(roomId)
			},
		},
		tags.runRoom,
		tags.runMap,
		tags.gameLoop,
	])
	roomRenderer = renderer
	renderer.onDestroy(() => {
		if (roomRenderer?.id === renderer.id) roomRenderer = undefined
	})
}

export function clearPersistentShipParts() {
	clearing = true
	for (const part of activeParts.values()) {
		if (part.exists()) k.destroy(part)
	}
	activeParts.clear()
	recordsByRoom.clear()
	spatialBucketsByRoom.clear()
	activeRoomId = undefined
	if (roomRenderer?.exists()) k.destroy(roomRenderer)
	roomRenderer = undefined
	if (roomShadowRenderer?.exists()) k.destroy(roomShadowRenderer)
	roomShadowRenderer = undefined
	nextPartId = 1
	clearing = false
	updateCounters()
}

export function spawnPersistentShipPart(
	position: Vec2,
	sprite: string,
	options: PersistentShipPartLaunchOptions
) {
	const roomId = getCurrentFloorRoom()?.id ?? activeRoomId
	const record = roomId
		? createRecord(roomId, position, sprite, options)
		: undefined
	if (record && activeParts.size >= MAX_ACTIVE_PARTS) {
		record.active = false
		updateCounters()
		return undefined
	}
	return spawnActivePart(position, sprite, options, record)
}

export function spawnEnemyDeathWreckage(
	position: Vec2,
	options: EnemyDeathWreckageOptions = {}
) {
	const count = Math.max(1, Math.min(3, options.count ?? k.randi(1, 4)))
	const sprites = options.sprites?.length
		? options.sprites
		: ENEMY_DEATH_WRECKAGE_SPRITES
	const baseForce = options.force ?? 72
	const baseScale = options.scale ?? 1
	const spawned: GameObj[] = []

	for (let index = 0; index < count; index++) {
		const direction = k.Vec2.fromAngle(k.rand(0, 360))
		const part = spawnPersistentShipPart(
			position.add(direction.scale(k.rand(2, 8))),
			sprites[k.randi(0, sprites.length)],
			{
				force: baseForce * k.rand(0.72, 1.28),
				direction,
				inheritedVelocity: options.inheritedVelocity,
				angle: k.rand(0, 360),
				scale: baseScale * k.rand(0.48, 0.78),
				secondaryBurst: index === 0,
				material: "light",
			}
		)
		if (part) spawned.push(part)
	}

	return spawned
}

export function queryPersistentShipParts(
	position: Vec2,
	radius: number,
	roomId = activeRoomId
) {
	if (!roomId || radius <= 0) return []
	const records = recordsByRoom.get(roomId)
	const buckets = spatialBucketsByRoom.get(roomId)
	if (!records || !buckets) return []
	const found: Array<{ record: PersistentShipPartRecord; distance: number }> = []
	const minX = Math.floor((position.x - radius) / SPATIAL_CELL_SIZE)
	const maxX = Math.floor((position.x + radius) / SPATIAL_CELL_SIZE)
	const minY = Math.floor((position.y - radius) / SPATIAL_CELL_SIZE)
	const maxY = Math.floor((position.y + radius) / SPATIAL_CELL_SIZE)
	for (let x = minX; x <= maxX; x++) {
		for (let y = minY; y <= maxY; y++) {
			const ids = buckets.get(`${x}:${y}`)
			if (!ids) continue
			for (const id of ids) {
				const record = records.get(id)
				if (!record) continue
				const distance = record.position.dist(position)
				if (distance <= radius) found.push({ record, distance })
			}
		}
	}
	return found
		.sort((a, b) => a.distance - b.distance)
		.map((entry) => entry.record)
}

export function consumePersistentShipPart(id: number, roomId = activeRoomId) {
	if (!roomId) return undefined
	const records = recordsByRoom.get(roomId)
	const record = records?.get(id)
	if (!record) return undefined
	const active = activeParts.get(id)
	if (active?.exists()) k.destroy(active)
	removeFromBucket(record)
	records?.delete(id)
	activeParts.delete(id)
	updateCounters()
	return record
}

export function wakePersistentShipPart(
	id: number,
	direction: Vec2,
	force: number,
	roomId = activeRoomId
) {
	if (!roomId || activeParts.size >= MAX_ACTIVE_PARTS) return undefined
	const record = recordsByRoom.get(roomId)?.get(id)
	if (!record || record.active) return undefined
	return spawnActivePart(record.position, record.sprite, {
		force,
		direction,
		angle: record.angle,
		scale: record.scale,
		salvageValue: record.salvageValue,
		material: record.material,
	}, record)
}

export function getPersistentShipPartStats() {
	let stored = 0
	for (const records of recordsByRoom.values()) stored += records.size
	return {
		stored,
		active: activeParts.size,
		rooms: recordsByRoom.size,
	}
}

export function transferPersistentShipPartToRoom(
	part: GameObj,
	roomId: string,
	position: Vec2
) {
	let record: PersistentShipPartRecord | undefined
	for (const [recordId, activePart] of activeParts) {
		if (activePart.id !== part.id) continue
		record = recordsByRoom.get(activeRoomId ?? "")?.get(recordId)
		if (!record) {
			for (const records of recordsByRoom.values()) {
				record = records.get(recordId)
				if (record) break
			}
		}
		break
	}
	if (!record) return false

	removeFromBucket(record)
	recordsByRoom.get(record.roomId)?.delete(record.id)
	record.roomId = roomId
	record.position = position.clone()
	record.bucketKey = getBucketKey(position)
	record.active = true
	getRoomRecords(roomId).set(record.id, record)
	addToBucket(record)
	updateCounters()
	return true
}

function createRecord(
	roomId: string,
	position: Vec2,
	sprite: string,
	options: PersistentShipPartLaunchOptions
) {
	const record: PersistentShipPartRecord = {
		id: nextPartId++,
		roomId,
		sprite,
		position: position.clone(),
		angle: options.angle ?? 0,
		scale: Math.max(0.05, Math.abs(options.scale ?? 1)),
		salvageValue: Math.max(1, options.salvageValue ?? 1),
		material: options.material ?? "light",
		active: true,
		bucketKey: getBucketKey(position),
	}
	getRoomRecords(roomId).set(record.id, record)
	addToBucket(record)
	return record
}

function spawnActivePart(
	position: Vec2,
	sprite: string,
	options: PersistentShipPartLaunchOptions,
	record?: PersistentShipPartRecord
) {
	const direction = normalizedOrUndefined(options.direction) ??
		k.Vec2.fromAngle(k.rand(0, 360))
	const scale = record?.scale ?? Math.max(0.05, Math.abs(options.scale ?? 1))
	const inheritedVelocity = options.inheritedVelocity ?? k.vec2()
	const velocity = direction.scale(options.force).add(inheritedVelocity)
	const spinDirection = k.chance(0.5) ? -1 : 1
	const state: ActivePartState = {
		record,
		secondaryBurst: options.secondaryBurst === true,
		lassoControlled: false,
	}
	if (record) record.active = true
	const part = k.add([
		k.pos(position),
		k.sprite(sprite),
		k.anchor("center"),
		k.scale(scale),
		k.rotate(record?.angle ?? options.angle ?? 0),
		k.layer(layers.gameEffects),
		snareable({
			mass: (record?.material ?? options.material) === "heavy" ? 0.8 : 0.45,
			radius: k.clamp(8 * scale, 5, 16),
			releaseDrag: 1.35,
			onSnareStart: () => {
				state.lassoControlled = true
				part.velocity = k.vec2(0)
				part.angularVelocity = 0
			},
		}),
		{
			velocity,
			angularVelocity: spinDirection * k.rand(65, 155),
			elapsed: 0,
			trailTimer: 0,
			bounced: false,
			groundShadowHeight: PART_SHADOW_HEIGHT,
			groundShadowOpacity: PART_SHADOW_OPACITY,
			groundShadowScale: PART_SHADOW_SCALE,
		},
		tags.props,
		tags.runRoom,
		tags.runMap,
		tags.persistentShipPart,
		tags.runtimeCullable,
		tags.gameLoop,
	])
	if (record) activeParts.set(record.id, part)

	registerBatchedEntityUpdate("effects", part, () => {
		const delta = k.dt()
		part.elapsed += delta
		part.trailTimer -= delta
		if (state.lassoControlled) {
			part.velocity = k.vec2(0)
			if (record) updateRecordTransform(record, part.pos, part.angle)
			if (
				part.snared ||
				part.snareVelocity.len() > SLEEP_SPEED ||
				Math.abs(part.snareAngularVelocity) > SLEEP_ANGULAR_SPEED ||
				part.elapsed < MIN_FLIGHT_TIME
			) return
			sleepActivePart(part, state)
			return
		}
		const nextPos = part.pos.add(part.velocity.scale(delta))
		const grid = gridRegistry.get(ACTIVE_RUN_GRID_KEY)
		if (grid && !grid.isWalkable(grid.screenToHex(nextPos))) {
			if (!part.bounced) {
				part.bounced = true
				part.velocity = part.velocity.scale(-0.38)
				part.angularVelocity *= 0.62
				spawnPartWallImpact(part.pos, part.velocity)
			} else {
				part.velocity = part.velocity.scale(0.15)
			}
		} else {
			part.pos = nextPos
		}
		part.velocity = part.velocity.scale(Math.pow(0.982, delta * 60))
		part.angle += part.angularVelocity * delta
		part.angularVelocity *= Math.pow(0.987, delta * 60)
		if (part.trailTimer <= 0 && part.elapsed < 0.38) {
			part.trailTimer = 0.065
			emitEnemyTrail(part, part.pos, part.velocity.angle() + 180, 1)
		}
		if (record) updateRecordTransform(record, part.pos, part.angle)
		if (!shouldSleepPart(part)) return
		sleepActivePart(part, state)
	})
	part.onDestroy(() => {
		if (!record) return
		activeParts.delete(record.id)
		if (!clearing && recordsByRoom.get(record.roomId)?.has(record.id)) {
			updateRecordTransform(record, part.pos, part.angle)
			record.active = false
		}
		updateCounters()
	})
	updateCounters()
	return part
}

function shouldSleepPart(part: GameObj) {
	if (part.elapsed >= MAX_FLIGHT_TIME) return true
	return part.elapsed >= MIN_FLIGHT_TIME &&
		part.velocity.len() <= SLEEP_SPEED &&
		Math.abs(part.angularVelocity) <= SLEEP_ANGULAR_SPEED
}

function sleepActivePart(part: GameObj, state: ActivePartState) {
	const record = state.record
	if (record) {
		updateRecordTransform(record, part.pos, part.angle)
		record.active = false
		activeParts.delete(record.id)
	}
	if (state.secondaryBurst) spawnPartSecondaryBurst(part.pos, part.scale.x)
	k.destroy(part)
}

function drawSleepingParts(roomId: string) {
	const drawn = visitVisibleSleepingParts(roomId, (record) => {
		k.drawSprite({
			sprite: record.sprite,
			pos: record.position,
			angle: record.angle,
			anchor: "center",
			scale: k.vec2(record.scale),
		})
	})
	updateCounters(drawn)
}

function drawSleepingPartShadows(roomId: string) {
	visitVisibleSleepingParts(roomId, (record) => {
		const sprite = k.getSprite(record.sprite)?.data
		if (!sprite) return
		const diameter = Math.max(sprite.width, sprite.height) * record.scale
		const heightScale = k.clamp(1 - PART_SHADOW_HEIGHT * 0.012, 0.6, 1)
		const radiusX = k.clamp(
			diameter * 0.325 * heightScale * PART_SHADOW_SCALE,
			3,
			18
		)
		k.drawEllipse({
			pos: record.position.add(
				0,
				k.clamp(radiusX * 1.15 + PART_SHADOW_HEIGHT, 8, 28)
			),
			radiusX,
			radiusY: Math.max(1.5, radiusX * 0.39),
			anchor: "center",
			color: k.BLACK,
			opacity: PART_SHADOW_OPACITY *
				k.clamp(1 - PART_SHADOW_HEIGHT * 0.01, 0.65, 1),
		})
	})
}

function visitVisibleSleepingParts(
	roomId: string,
	visitor: (record: PersistentShipPartRecord) => void
) {
	const records = recordsByRoom.get(roomId)
	const buckets = spatialBucketsByRoom.get(roomId)
	if (!records || !buckets) {
		return 0
	}
	const camera = k.getCamPos()
	const cameraScale = k.getCamScale()
	const halfWidth = k.width() / (2 * cameraScale.x) + DRAW_PADDING
	const halfHeight = k.height() / (2 * cameraScale.y) + DRAW_PADDING
	const minX = camera.x - halfWidth
	const maxX = camera.x + halfWidth
	const minY = camera.y - halfHeight
	const maxY = camera.y + halfHeight
	const minCellX = Math.floor(minX / SPATIAL_CELL_SIZE)
	const maxCellX = Math.floor(maxX / SPATIAL_CELL_SIZE)
	const minCellY = Math.floor(minY / SPATIAL_CELL_SIZE)
	const maxCellY = Math.floor(maxY / SPATIAL_CELL_SIZE)
	let drawn = 0
	for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
		for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
			const ids = buckets.get(`${cellX}:${cellY}`)
			if (!ids) continue
			for (const id of ids) {
				if (drawn >= MAX_DRAWN_PARTS) break
				const record = records.get(id)
				if (
					!record ||
					record.active ||
					record.position.x < minX ||
					record.position.x > maxX ||
					record.position.y < minY ||
					record.position.y > maxY
				) continue
				visitor(record)
				drawn++
			}
			if (drawn >= MAX_DRAWN_PARTS) break
		}
		if (drawn >= MAX_DRAWN_PARTS) break
	}
	return drawn
}

function updateRecordTransform(
	record: PersistentShipPartRecord,
	position: Vec2,
	angle: number
) {
	const previousBucket = record.bucketKey
	record.position = position.clone()
	record.angle = angle
	record.bucketKey = getBucketKey(position)
	if (record.bucketKey === previousBucket) return
	removeFromBucket(record, previousBucket)
	addToBucket(record)
}

function getRoomRecords(roomId: string) {
	let records = recordsByRoom.get(roomId)
	if (!records) {
		records = new Map()
		recordsByRoom.set(roomId, records)
	}
	return records
}

function getRoomBuckets(roomId: string) {
	let buckets = spatialBucketsByRoom.get(roomId)
	if (!buckets) {
		buckets = new Map()
		spatialBucketsByRoom.set(roomId, buckets)
	}
	return buckets
}

function addToBucket(record: PersistentShipPartRecord) {
	const buckets = getRoomBuckets(record.roomId)
	let ids = buckets.get(record.bucketKey)
	if (!ids) {
		ids = new Set()
		buckets.set(record.bucketKey, ids)
	}
	ids.add(record.id)
}

function removeFromBucket(
	record: PersistentShipPartRecord,
	bucketKey = record.bucketKey
) {
	const buckets = spatialBucketsByRoom.get(record.roomId)
	const ids = buckets?.get(bucketKey)
	if (!ids) return
	ids.delete(record.id)
	if (ids.size === 0) buckets?.delete(bucketKey)
}

function getBucketKey(position: Vec2) {
	return `${Math.floor(position.x / SPATIAL_CELL_SIZE)}:${Math.floor(
		position.y / SPATIAL_CELL_SIZE
	)}`
}

function normalizedOrUndefined(direction?: Vec2) {
	if (!direction || direction.len() <= 0.001) return undefined
	return direction.unit()
}

function spawnPartWallImpact(position: Vec2, velocity: Vec2) {
	spawnFlash(position, 2.5, k.rgb(130, 205, 235))
	emitPartSparks(position, velocity.angle(), 80, 3)
}

function spawnPartSecondaryBurst(position: Vec2, scale: number) {
	spawnFlash(position, k.clamp(3.5 * scale, 2.5, 7), k.rgb(135, 210, 240))
	emitPartSparks(position, 0, 150, 3)
}

function emitPartSparks(
	position: Vec2,
	direction: number,
	spread: number,
	count: number
) {
	emitDirectionalParticles(sparkEmitter, position, direction, spread, count)
}

function updateCounters(drawn?: number) {
	let stored = 0
	for (const records of recordsByRoom.values()) stored += records.size
	setPerformanceCounter("persistentShipParts", stored)
	setPerformanceCounter("persistentShipPartsActive", activeParts.size)
	setPerformanceCounter("persistentShipPartRooms", recordsByRoom.size)
	if (drawn !== undefined) {
		setPerformanceCounter("persistentShipPartsDrawn", drawn)
	}
}
