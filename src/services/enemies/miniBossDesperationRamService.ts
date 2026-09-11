import type { GameObj, Vec2 } from "kaplay"
import { playerObj } from "../../game"
import { k, layers, mainSoundVolume, velocityScale } from "../../main"
import { spawnFlash } from "../../spawn/spawnFlash"
import { spawnRing } from "../../spawn/spawnRing"
import { emitImpactChips } from "../../particles"
import { spawnRockDestructionFragments } from "../combat/rockDestructionEffectService"
import { tags } from "../../tags"
import { gameSoundService } from "../audio/gameSoundService"
import { applyDamage } from "../combat/damageService"
import {
	emitMechanicalAccelerationSmoke,
	emitMechanicalDamageSmokeBurst,
} from "../combat/enemyDamageEffectService"
import { applyKnockbackImpulse } from "../combat/projectileService"
import { easeDirection } from "../../shared"
import { spawnLineTelegraph } from "./enemyTelegraphService"
import { isEnemyEmpDisrupted } from "./enemyEmpService"
import { resolveMiniBossWallRecoilDirection } from "./miniBossRamPhysics"

type DesperationRamPhase =
	| "idle"
	| "charging"
	| "rushing"
	| "stunned"
	| "recovering"

interface MiniBossDesperationRamOptions {
	name: string
	sprite: string
	baseScale: number
	damage: number
	speedMultiplier: number
	isDisarmed: () => boolean
}

export interface MiniBossDesperationRamController {
	update(delta: number): boolean
	onWallCollision(collisionNormal?: Vec2): boolean
	isRushing(): boolean
}

const CHARGE_DURATION = 1.2
const RUSH_DURATION = 1.35
const STUN_DURATION = 2.5
const RECOVERY_DURATION = 0.85
const RUSH_SPEED = 520
const WALL_DAMAGE_RATIO = 0.09
const WALL_RECOIL_DURATION = 0.38
const WALL_RECOIL_SPEED = 260

export function createMiniBossDesperationRam(
	body: GameObj,
	options: MiniBossDesperationRamOptions
): MiniBossDesperationRamController {
	let phase: DesperationRamPhase = "idle"
	let timer = 0
	let lockedDirection = k.vec2(0, 1)
	let smokeTimer = 0
	let pulseTimer = 0
	let hitPlayer = false
	let recoilTimer = 0
	let recoilDirection = k.vec2(0, -1)
	const hitObjects = new Set<number>()
	const chargeCore = body.add([
		k.pos(0, 0),
		k.circle(Math.max(12, body.hb * 0.78), { fill: false }),
		k.anchor("center"),
		k.outline(2, k.WHITE),
		k.opacity(0),
		k.scale(1),
		k.layer(layers.gameEffects),
		k.z(5),
	])

	const beginCharge = () => {
		phase = "charging"
		timer = CHARGE_DURATION
		pulseTimer = 0
		const toPlayer = playerObj.pos.sub(body.pos)
		lockedDirection = toPlayer.len() > 0.001
			? toPlayer.unit()
			: k.vec2(0, 1)
		spawnLineTelegraph(body.pos, playerObj.pos, {
			duration: CHARGE_DURATION,
			getStart: () => body.exists() ? body.pos : undefined,
			getEnd: () => playerObj.exists() ? playerObj.pos : undefined,
		})
		gameSoundService.playPositional(
			"charge_zone_charge",
			() => body.exists() ? body.pos : undefined,
			{
				volume: mainSoundVolume * 0.72,
				detune: -260,
				voiceLimit: 2,
			}
		)
	}

	const beginRush = () => {
		phase = "rushing"
		timer = RUSH_DURATION
		smokeTimer = 0
		hitPlayer = false
		hitObjects.clear()
		body.opacity = 1
		body.scale = k.vec2(options.baseScale)
		chargeCore.opacity = 0
		spawnFlash(body.pos.clone(), Math.max(16, body.hb), k.WHITE)
		spawnRing({
			pos: body.pos.clone(),
			speed: 280,
			intensity: 0.65,
			maxRadius: Math.max(70, body.hb * 3.2),
			color: k.WHITE,
			visualOpacity: 0.8,
			excludeIds: [body.id],
		})
		emitMechanicalAccelerationSmoke(
			body.pos.sub(lockedDirection.scale(body.hb)),
			body,
			lockedDirection.angle() + 180,
			12
		)
		gameSoundService.playPositional("rammer_launch", body.pos, {
			volume: mainSoundVolume,
			voiceLimit: 3,
		})
		k.shake(3.5)
	}

	const enterStun = (wallImpact: boolean, collisionNormal?: Vec2) => {
		if (phase === "stunned") return
		phase = "stunned"
		timer = wallImpact ? STUN_DURATION : STUN_DURATION * 0.55
		recoilTimer = wallImpact ? WALL_RECOIL_DURATION : 0
		body.opacity = 1
		body.scale = k.vec2(options.baseScale)
		chargeCore.opacity = 0
		if (typeof body.jitter === "function") body.jitter(wallImpact ? 18 : 8)
		if (!wallImpact) return

		const resolvedRecoil = resolveMiniBossWallRecoilDirection(
			collisionNormal,
			lockedDirection
		)
		recoilDirection = k.vec2(resolvedRecoil.x, resolvedRecoil.y)
		body.scale = k.vec2(
			options.baseScale * 1.18,
			options.baseScale * 0.78
		)
		const position = body.pos.sub(
			recoilDirection.scale(body.hb * 0.72)
		)
		const impactRadius = Math.max(34, body.hb * 1.9)
		spawnFlash(position, impactRadius * 0.72, k.WHITE)
		spawnRing({
			pos: position.clone(),
			speed: 340,
			intensity: 0.85,
			maxRadius: impactRadius * 2.25,
			color: k.WHITE,
			visualOpacity: 0.9,
			excludeIds: [body.id],
		})
		emitMechanicalDamageSmokeBurst(position, body, 18)
		spawnRockDestructionFragments(position, 0.95)
		emitImpactChips(
			position,
			body.pos,
			recoilDirection,
			RUSH_SPEED,
			true
		)
		gameSoundService.playPositional("ship_part_destroyed", position, {
			volume: mainSoundVolume,
			detune: -320,
			maxDistance: 820,
			voiceLimit: 3,
		})
		k.shake(13)
		k.flash(k.WHITE, 0.07)
		const maxHealth = typeof body.maxHP === "number"
			? body.maxHP
			: Math.max(1, body.hp)
		applyDamage(body, Math.max(1, maxHealth * WALL_DAMAGE_RATIO), {
			position,
			visualForceOrigin: position.sub(lockedDirection),
		})
	}

	const updateCharge = (delta: number) => {
		const toPlayer = playerObj.pos.sub(body.pos)
		if (toPlayer.len() > 0.001) {
			lockedDirection = easeDirection(
				lockedDirection,
				toPlayer.unit(),
				2.6,
				delta
			)
		}
		const progress = k.clamp(1 - timer / CHARGE_DURATION, 0, 1)
		body.angle = lockedDirection.angle() + 90
		body.opacity = k.wave(0.48, 1, k.time() * (8 + progress * 14))
		body.scale = k.vec2(
			options.baseScale * k.lerp(1, 1.2, progress * progress),
			options.baseScale * k.lerp(1, 0.78, progress * progress)
		)
		chargeCore.opacity = k.wave(0.25, 0.95, k.time() * (7 + progress * 15))
		chargeCore.scale = k.vec2(k.lerp(1.8, 0.55, progress))
		pulseTimer -= delta
		if (pulseTimer <= 0) {
			spawnFlash(
				body.pos.sub(lockedDirection.scale(body.hb * 0.55)),
				k.lerp(4, 9, progress),
				k.WHITE
			)
			pulseTimer = k.lerp(0.24, 0.07, progress)
		}
		if (timer <= 0) beginRush()
	}

	const updateRush = (delta: number) => {
		body.angle = lockedDirection.angle() + 90
		body.move(lockedDirection.scale(
			RUSH_SPEED * options.speedMultiplier * velocityScale() *
				body.getTimescale()
		))
		smokeTimer -= delta
		if (smokeTimer <= 0) {
			emitMechanicalAccelerationSmoke(
				body.pos.sub(lockedDirection.scale(body.hb * 0.8)),
				body,
				lockedDirection.angle() + 180,
				3
			)
			smokeTimer = 0.045
		}
		damageRammedObjects(
			body,
			lockedDirection,
			options.damage,
			hitObjects
		)
		if (
			!hitPlayer &&
			playerObj.exists() &&
			body.pos.dist(playerObj.pos) <= body.hb + 10
		) {
			hitPlayer = true
			applyDamage(playerObj, options.damage * 1.6, {
				position: body.pos.clone(),
				incomingDirection: lockedDirection,
				source: {
					name: `${options.name} DESPERATION RAM`,
					sprite: options.sprite,
				},
			})
			applyKnockbackImpulse(playerObj, lockedDirection, 190)
			enterStun(false)
		}
		if (timer <= 0) enterStun(false)
	}

	return {
		update(delta: number) {
			if (!options.isDisarmed()) return false
			if (phase === "idle") beginCharge()
			if (isEnemyEmpDisrupted(body)) return true
			timer -= delta
			if (phase === "charging") updateCharge(delta)
			else if (phase === "rushing") updateRush(delta)
			else if (phase === "stunned") {
				updateWallRecoil(delta)
				body.opacity = k.wave(0.38, 1, k.time() * 10)
				if (timer <= 0) {
					phase = "recovering"
					timer = RECOVERY_DURATION
					body.opacity = 1
				}
			} else if (phase === "recovering" && timer <= 0) {
				beginCharge()
			}
			return true
		},
		onWallCollision(collisionNormal?: Vec2) {
			if (phase !== "rushing") return false
			enterStun(true, collisionNormal)
			return true
		},
		isRushing() {
			return phase === "rushing"
		},
	}

	function updateWallRecoil(delta: number) {
		if (recoilTimer <= 0) return
		const progress = k.clamp(
			1 - recoilTimer / WALL_RECOIL_DURATION,
			0,
			1
		)
		body.move(recoilDirection.scale(
			k.lerp(WALL_RECOIL_SPEED, 42, progress) *
				options.speedMultiplier * velocityScale() * body.getTimescale()
		))
		body.scale = k.vec2(
			options.baseScale * k.lerp(1.18, 1, progress),
			options.baseScale * k.lerp(0.78, 1, progress)
		)
		recoilTimer = Math.max(0, recoilTimer - delta)
		if (recoilTimer <= 0) body.scale = k.vec2(options.baseScale)
	}
}

function damageRammedObjects(
	body: GameObj,
	direction: Vec2,
	damage: number,
	hitObjects: Set<number>
) {
	for (const target of [
		...(k.get(tags.roomCover) as GameObj[]),
		...(k.get(tags.roomVolatile) as GameObj[]),
	]) {
		if (!target.exists()) continue
		const hitbox = typeof target.hb === "number" ? target.hb : 12
		if (target.pos.dist(body.pos) > body.hb + hitbox) continue
		if (hitObjects.has(target.id)) continue
		hitObjects.add(target.id)
		if (typeof target.hp === "number") {
			applyDamage(target, damage * 1.5, { position: body.pos })
		}
		applyKnockbackImpulse(target, direction, 165)
	}
}
