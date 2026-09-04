import type { GameObj, Vec2 } from "kaplay"
import { checkProjectileIntersection, playerObj } from "../../game"
import { k, layers, mainSoundVolume } from "../../main"
import { audioService } from "../../services/audioService"
import { applyDamage } from "../../services/damageService"
import { tags } from "../../tags"
import { spawnExplosionEffect } from "../spawnFlash"
import { registerBatchedEntityUpdate } from "../../services/entityUpdateService"
import { querySpatialNearby } from "../../services/runtimeSpatialIndexService"

const MINE_WARNING_RADIUS = 90
const MINE_TRIGGER_RADIUS = 28

interface MinefieldProps {
	pos: Vec2
	radius: number
	count: number
	damage: number
	seed: number
	tags?: string[]
}

export function spawnMinefield(props: MinefieldProps) {
	for (let index = 0; index < props.count; index++) {
		const angle = seededUnit(props.seed, index, 1) * 360
		const distance = props.radius * (0.28 + seededUnit(props.seed, index, 2) * 0.72)
		spawnProximityMine(
			props.pos.add(k.Vec2.fromAngle(angle).scale(distance)),
			props.damage,
			props.tags
		)
	}
}

function spawnProximityMine(pos: Vec2, damage: number, extraTags?: string[]) {
	let triggered = false
	let armedElapsed = 0
	let triggerElapsed = 0
	const mine = k.add([
		k.pos(pos),
		k.sprite("room_proximity_mine"),
		k.anchor("center"),
		k.layer(layers.gameEffects),
		k.rotate(k.rand(360)),
		k.scale(0.82),
		k.color(150, 150, 150),
		k.opacity(0.9),
		tags.props,
		tags.gameLoop,
		...(extraTags ?? []),
	])

		registerBatchedEntityUpdate("world", mine, () => {
		mine.angle += k.dt() * 18
		armedElapsed += k.dt()
		if (armedElapsed < 0.7) return
		const playerDistance = mine.pos.dist(playerObj.pos)
		const warningProgress = k.clamp(
			(MINE_WARNING_RADIUS - playerDistance) /
				(MINE_WARNING_RADIUS - MINE_TRIGGER_RADIUS),
			0,
			1
		)
		mine.color = triggered
			? k.rgb(255, 65, 65)
			: k.rgb(
				k.lerp(210, 255, warningProgress),
				k.lerp(210, 65, warningProgress),
				k.lerp(210, 65, warningProgress)
			)
		mine.opacity = triggered
			? k.wave(0.35, 1, k.time() * 12)
			: k.wave(
				k.lerp(0.65, 0.42, warningProgress),
				1,
				k.time() * k.lerp(3, 10, warningProgress)
			)

		if (!triggered && playerDistance < MINE_TRIGGER_RADIUS) triggered = true
		checkProjectileIntersection(mine.pos, 10, tags.friendly, (projectile) => {
			if (projectile.exists()) k.destroy(projectile)
			triggered = true
			triggerElapsed = 0.3
		})
		if (!triggered) return
		triggerElapsed += k.dt()
		if (triggerElapsed < 0.3) return
		detonateMine(mine, damage)
	})
}

function detonateMine(mine: GameObj, damage: number) {
	const explosionPos = mine.pos.clone()
	const enemies = querySpatialNearby(mine.pos, 52, {
		allTags: [tags.enemy, tags.unit],
	})
	for (const target of [playerObj, ...enemies]) {
		if (!target.exists() || target.pos.dist(mine.pos) > 52) continue
		applyDamage(target, damage, {
			position: mine.pos,
			source: {
				name: "PROXIMITY MINE",
				sprite: "room_proximity_mine",
			},
		})
	}
	spawnExplosionEffect(explosionPos, 52)
	audioService.playPositionalSound("explosion2", explosionPos, {
		volume: mainSoundVolume * 0.8,
		maxDistance: 650,
	})
	k.destroy(mine)
}

function seededUnit(seed: number, index: number, salt: number) {
	let hash = seed ^ Math.imul(index + 1, 73856093) ^ Math.imul(salt, 19349663)
	hash = Math.imul(hash ^ (hash >>> 16), 2246822519)
	return ((hash ^ (hash >>> 13)) >>> 0) / 0x100000000
}
