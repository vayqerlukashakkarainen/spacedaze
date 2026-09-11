import type { GameObj, Vec2 } from "kaplay"
import { gridCollision } from "../../comp/gridCollision"
import { jitter } from "../../comp/jitter"
import { timescale } from "../../comp/timescale"
import { playerObj } from "../../game"
import { ACTIVE_RUN_GRID_KEY } from "../../grid/gridKeys"
import { k, mainSoundVolume, velocityScale } from "../../main"
import { gameSoundService } from "../../services/audio/gameSoundService"
import { applyDamage } from "../../services/combat/damageService"
import { applyKnockbackImpulse } from "../../services/combat/projectileService"
import { registerBatchedEntityUpdate } from "../../services/core/entityUpdateService"
import { spawnMiniBossHealthBar } from "../../services/enemies/bossEncounterService"
import { getEnemyNavigationDirection } from "../../services/enemies/enemyNavigationService"
import { isEnemyEmpDisrupted } from "../../services/enemies/enemyEmpService"
import { createMiniBossDesperationRam } from "../../services/enemies/miniBossDesperationRamService"
import { createEnemySpawnProfile, type EnemySpawnOptions } from "../../services/enemies/threatService"
import { isPlayerDamageInvulnerable } from "../../services/player/playerDamageState"
import { easeDirection } from "../../shared"
import { tags } from "../../tags"
import { getEnemyVisual } from "../../visuals/enemyVisualCatalog"
import { spawnMiniBossDeathSequence } from "../spawnEnemyDeathEffect"
import { addWakeEnemyPart, composeWakeEnemy, handleWakeCompositeCombat } from "./wakeEnemyShared"

const RAILBREAKER_VISUAL = getEnemyVisual("wake-railbreaker-rig")
const APPROACH_SPEED = 54
const CHARGE_SPEED = 360
const TELEGRAPH_DURATION = 1.15
const CHARGE_DURATION = 1.15
const STUN_DURATION = 1.4
const RECOVERY_DURATION = 2.2

export interface RailbreakerRigSpawnOptions extends EnemySpawnOptions {
	onDefeated?: (pos: Vec2) => void
}

export function spawnRailbreakerRig(
	pos: Vec2,
	hp = 120,
	options: RailbreakerRigSpawnOptions = {}
) {
	const profile = createEnemySpawnProfile(hp, 3, RAILBREAKER_VISUAL.worldScale, options)
	const [coreVisual, ramVisual, leftVisual, rightVisual] = RAILBREAKER_VISUAL.parts
	const rig = k.add([
		k.pos(pos),
		k.sprite(coreVisual.sprite),
		k.color(k.WHITE),
		k.rotate(0),
		k.anchor("center"),
		k.health(profile.hp),
		k.animate(),
		k.opacity(1),
		k.scale(profile.scale),
		timescale(),
		jitter(),
		gridCollision(ACTIVE_RUN_GRID_KEY),
		...(options.persistOffscreen ? [] : [k.offscreen({ destroy: true })]),
		{
			hb: 22 * profile.scale,
			damage: profile.damage,
			moveDirection: k.vec2(0, -1),
			lockedDirection: k.vec2(0, -1),
			phase: "approach" as "approach" | "telegraph" | "charge" | "stunned" | "recover",
			phaseTimer: 0,
			attackCooldown: 1.4,
			deathSequenceActive: false,
			hitObjects: new Set<number>(),
		},
		tags.enemy,
		tags.unit,
		tags.enemyRolePressure,
		tags.miniBoss,
		...(profile.elite ? [tags.elite] : []),
		tags.gameLoop,
		...(options.tags ?? []),
	])
	const partHp = 2 * Math.max(2, Math.round(profile.hp / 2 * 0.22))
	const ram = addWakeEnemyPart(rig, ramVisual.sprite, partHp)
	const leftThruster = addWakeEnemyPart(rig, leftVisual.sprite, partHp)
	const rightThruster = addWakeEnemyPart(rig, rightVisual.sprite, partHp)
	composeWakeEnemy(rig, profile, [
		{
			obj: ram,
			hitbox: 17 * profile.scale,
			hitboxOffset: k.vec2(0, -18).scale(profile.scale),
			pullForce: 125,
			pullDuration: 1.15,
		},
		{
			obj: leftThruster,
			hitbox: 9 * profile.scale,
			hitboxOffset: k.vec2(-17, 10).scale(profile.scale),
			pullForce: 110,
			pullDuration: 1,
		},
		{
			obj: rightThruster,
			hitbox: 9 * profile.scale,
			hitboxOffset: k.vec2(17, 10).scale(profile.scale),
			pullForce: 110,
			pullDuration: 1,
		},
	], 18, 2, options.onDefeated, (finishDeath) => {
		rig.deathSequenceActive = true
		rig.unuse(tags.enemy)
		rig.unuse(tags.unit)
		spawnMiniBossDeathSequence(rig, {
			radius: 28 * profile.scale,
			color: k.rgb(255, 184, 80),
			onComplete: finishDeath,
		})
	})
	spawnMiniBossHealthBar(rig, profile.hp)
	const desperationRam = createMiniBossDesperationRam(rig, {
		name: "RAILBREAKER RIG",
		sprite: coreVisual.sprite,
		baseScale: profile.scale,
		damage: profile.damage,
		speedMultiplier: profile.speedMultiplier,
		isDisarmed: () => ram.hidden,
	})

	rig.onGridCollide((_cell, normal) => {
		if (desperationRam.onWallCollision(normal)) return
		if (rig.phase !== "charge") return
		enterStun(rig, ram.hidden ? 2.3 : STUN_DURATION)
	})

	registerBatchedEntityUpdate("enemies", rig, () => {
		if (rig.deathSequenceActive) return
		const delta = k.dt() * rig.getTimescale()
		const toPlayer = playerObj.pos.sub(rig.pos)
		const playerDirection = toPlayer.len() > 0.001 ? toPlayer.unit() : rig.moveDirection
		rig.phaseTimer -= delta
		rig.attackCooldown -= delta
		if (desperationRam.update(delta)) {
			handleWakeCompositeCombat(
				rig,
				"RAILBREAKER RIG",
				"enemy_wake_railbreaker_rig_core",
				false
			)
			return
		}

		if (!isEnemyEmpDisrupted(rig)) {
			switch (rig.phase) {
				case "approach": {
					const navigation = getEnemyNavigationDirection(rig, playerDirection, playerObj.pos)
					rig.moveDirection = easeDirection(rig.moveDirection, navigation, 3.2, delta)
					rig.move(rig.moveDirection.scale(APPROACH_SPEED * profile.speedMultiplier * velocityScale() * rig.getTimescale()))
					if (rig.attackCooldown <= 0 && toPlayer.len() < 430) {
						rig.phase = "telegraph"
						rig.phaseTimer = TELEGRAPH_DURATION
						rig.lockedDirection = playerDirection
						gameSoundService.playPositional("charge_zone_charge", rig.pos, {
							volume: mainSoundVolume * 0.6,
							detune: -120,
						})
					}
					break
				}
				case "telegraph":
					rig.lockedDirection = easeDirection(rig.lockedDirection, playerDirection, 1.4, delta)
					rig.opacity = k.wave(0.55, 1, k.time() * 12)
					if (rig.phaseTimer <= 0) {
						rig.phase = "charge"
						rig.phaseTimer = CHARGE_DURATION
						rig.opacity = 1
						rig.hitObjects.clear()
						gameSoundService.playPositional("rammer_launch", rig.pos, {
							volume: mainSoundVolume * 0.8,
						})
					}
					break
				case "charge": {
					const thrusters = Number(!leftThruster.hidden) + Number(!rightThruster.hidden)
					const speedMultiplier = 0.55 + thrusters * 0.225
					rig.move(rig.lockedDirection.scale(CHARGE_SPEED * speedMultiplier * profile.speedMultiplier * velocityScale() * rig.getTimescale()))
					damageChargeTargets(rig, ram.hidden ? profile.damage : profile.damage * 2)
					if (rig.phaseTimer <= 0) enterStun(rig, ram.hidden ? 2.1 : STUN_DURATION)
					break
				}
				case "stunned":
					rig.opacity = k.wave(0.45, 1, k.time() * 9)
					if (rig.phaseTimer <= 0) {
						rig.phase = "recover"
						rig.phaseTimer = RECOVERY_DURATION
						rig.opacity = 1
					}
					break
				case "recover":
					if (rig.phaseTimer <= 0) {
						rig.phase = "approach"
						rig.attackCooldown = 0.8
					}
					break
			}
		}
		if (rig.moveDirection.len() > 0.001) rig.angle = rig.moveDirection.angle() + 90
		if (rig.phase === "telegraph" || rig.phase === "charge") {
			rig.angle = rig.lockedDirection.angle() + 90
		}
		handleWakeCompositeCombat(
			rig,
			"RAILBREAKER RIG",
			"enemy_wake_railbreaker_rig_core",
			false
		)
	})

	return rig
}

function enterStun(rig: GameObj, duration: number) {
	rig.phase = "stunned"
	rig.phaseTimer = duration
	rig.attackCooldown = RECOVERY_DURATION
	rig.opacity = 1
	gameSoundService.playPositional("explosive_blast", rig.pos, {
		volume: mainSoundVolume * 0.45,
		detune: -260,
	})
}

function damageChargeTargets(rig: GameObj, damage: number) {
	for (const target of [
		...(k.get(tags.roomCover) as GameObj[]),
		...(k.get(tags.roomVolatile) as GameObj[]),
	]) {
		if (!target.exists() || rig.hitObjects.has(target.id)) continue
		const hitbox = typeof target.hb === "number" ? target.hb : 12
		if (target.pos.dist(rig.pos) > rig.hb + hitbox) continue
		rig.hitObjects.add(target.id)
		if (typeof target.hp === "number") applyDamage(target, damage, { position: rig.pos })
		applyKnockbackImpulse(target, rig.lockedDirection, 120)
	}
	if (
		!isPlayerDamageInvulnerable() &&
		playerObj.pos.dist(rig.pos) <= rig.hb + 9 &&
		!rig.hitObjects.has(playerObj.id)
	) {
		rig.hitObjects.add(playerObj.id)
		applyDamage(playerObj, damage, {
			position: rig.pos,
			incomingDirection: rig.lockedDirection,
			source: { name: "RAILBREAKER RIG", sprite: "enemy_wake_railbreaker_rig_ram" },
		})
		applyKnockbackImpulse(playerObj, rig.lockedDirection, 165)
		enterStun(rig, STUN_DURATION)
	}
}
