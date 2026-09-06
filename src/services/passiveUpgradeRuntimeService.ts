import type { GameObj, PosComp } from "kaplay"
import { k, layers } from "../main"
import { player } from "../player"
import { spawnFlash } from "../spawn/spawnFlash"
import { spawnRing } from "../spawn/spawnRing"
import { tags } from "../tags"
import { applyDamage } from "./damageService"
import { forEachSpatialNearby } from "./runtimeSpatialIndexService"

const SAW_ORBIT_RADIUS = 42
const SAW_DAMAGE = 3
const SAW_HIT_COOLDOWN = 0.28
const RAM_DAMAGE = 6
const RAM_HIT_COOLDOWN = 0.45
const NEAR_MISS_INNER_RADIUS = 18
const NEAR_MISS_OUTER_RADIUS = 42
const NEAR_MISS_REQUIRED = 5
const NEAR_MISS_BURST_RADIUS = 180
const NEAR_MISS_BURST_DAMAGE = 8

let sawSatellite: GameObj | undefined
let sawOrbitAngle = 0
let nearMissCharge = 0
let grazedProjectiles = new WeakSet<object>()
let sawHitTimes = new WeakMap<object, number>()
let ramHitTimes = new WeakMap<object, number>()

export function resetPassiveUpgradeRuntime() {
	if (sawSatellite?.exists()) k.destroy(sawSatellite)
	sawSatellite = undefined
	sawOrbitAngle = 0
	nearMissCharge = 0
	grazedProjectiles = new WeakSet<object>()
	sawHitTimes = new WeakMap<object, number>()
	ramHitTimes = new WeakMap<object, number>()
}

export function updatePassiveUpgradeRuntime(
	playerObj: GameObj<PosComp>,
	isBoosting: boolean
) {
	updateSawSatellite(playerObj)
	updateKineticRam(playerObj, isBoosting)
	updateNearMissCapacitor(playerObj)
}

function updateSawSatellite(playerObj: GameObj<PosComp>) {
	if (player.sawSatellite === undefined) {
		if (sawSatellite?.exists()) k.destroy(sawSatellite)
		sawSatellite = undefined
		return
	}
	if (!sawSatellite?.exists()) {
		sawSatellite = k.add([
			k.pos(playerObj.pos),
			k.sprite("saw_satellite_upg1"),
			k.anchor("center"),
			k.rotate(0),
			k.color(k.WHITE),
			k.layer(layers.gameEffects),
			k.z(2),
			tags.friendly,
			tags.gameLoop,
		])
	}

	sawOrbitAngle = (sawOrbitAngle + k.dt() * 150) % 360
	sawSatellite.pos = playerObj.pos.add(
		k.Vec2.fromAngle(sawOrbitAngle).scale(SAW_ORBIT_RADIUS)
	)
	sawSatellite.angle = (sawSatellite.angle + k.dt() * 540) % 360

	forEachSpatialNearby(sawSatellite.pos, 9, {
		allTags: [tags.projectile, tags.enemy],
	}, (projectile) => {
		if (projectile.exists()) k.destroy(projectile)
	})
	forEachSpatialNearby(sawSatellite.pos, 18, {
		allTags: [tags.unit, tags.enemy],
	}, (enemy) => {
		const nextHitAt = sawHitTimes.get(enemy) ?? 0
		if (k.time() < nextHitAt) return
		if (!applyDamage(enemy, SAW_DAMAGE, { position: sawSatellite?.pos })) return
		sawHitTimes.set(enemy, k.time() + SAW_HIT_COOLDOWN)
		spawnFlash(sawSatellite!.pos.clone(), 5, k.WHITE)
	})
}

function updateKineticRam(playerObj: GameObj<PosComp>, isBoosting: boolean) {
	if (player.kineticRam === undefined || !isBoosting) return
	forEachSpatialNearby(playerObj.pos, 30, {
		allTags: [tags.unit, tags.enemy],
	}, (enemy) => {
		const nextHitAt = ramHitTimes.get(enemy) ?? 0
		if (k.time() < nextHitAt) return
		if (!applyDamage(enemy, RAM_DAMAGE, { position: enemy.pos?.clone() })) return
		ramHitTimes.set(enemy, k.time() + RAM_HIT_COOLDOWN)
		const away = enemy.pos.sub(playerObj.pos)
		if (away.len() > 0.001) enemy.pos = enemy.pos.add(away.unit().scale(18))
		spawnFlash(enemy.pos.clone(), 9, k.rgb(90, 210, 255))
	})
}

function updateNearMissCapacitor(playerObj: GameObj<PosComp>) {
	if (player.nearMissCapacitor === undefined) return
	forEachSpatialNearby(playerObj.pos, NEAR_MISS_OUTER_RADIUS, {
		allTags: [tags.projectile, tags.enemy],
	}, (projectile) => {
		if (grazedProjectiles.has(projectile)) return
		if (projectile.pos.dist(playerObj.pos) <= NEAR_MISS_INNER_RADIUS) return
		grazedProjectiles.add(projectile)
		nearMissCharge++
		spawnFlash(playerObj.pos.clone(), 4, k.rgb(80, 180, 255))
		if (nearMissCharge < NEAR_MISS_REQUIRED) return
		nearMissCharge = 0
		spawnNearMissBurst(playerObj)
	})
}

function spawnNearMissBurst(playerObj: GameObj<PosComp>) {
	forEachSpatialNearby(playerObj.pos, NEAR_MISS_BURST_RADIUS, {
		allTags: [tags.unit, tags.enemy],
	}, (enemy) => {
		applyDamage(enemy, NEAR_MISS_BURST_DAMAGE, { position: enemy.pos?.clone() })
	})
	spawnRing({
		pos: playerObj.pos.clone(),
		speed: 380,
		intensity: 0.45,
		maxRadius: NEAR_MISS_BURST_RADIUS,
		color: k.rgb(80, 180, 255),
	})
	spawnFlash(playerObj.pos.clone(), 18, k.rgb(80, 180, 255))
	k.shake(4)
}
