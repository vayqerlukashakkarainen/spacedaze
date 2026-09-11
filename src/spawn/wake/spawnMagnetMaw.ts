import type { GameObj, Vec2 } from "kaplay"
import { gridCollision } from "../../comp/gridCollision"
import { jitter } from "../../comp/jitter"
import { timescale } from "../../comp/timescale"
import { playerObj } from "../../game"
import { ACTIVE_RUN_GRID_KEY } from "../../grid/gridKeys"
import { k, layers, mainSoundVolume, velocityScale } from "../../main"
import { gameSoundService } from "../../services/audio/gameSoundService"
import { applyKnockbackImpulse } from "../../services/combat/projectileService"
import { registerBatchedEntityUpdate } from "../../services/core/entityUpdateService"
import { spawnMiniBossHealthBar } from "../../services/enemies/bossEncounterService"
import { createMiniBossDesperationRam } from "../../services/enemies/miniBossDesperationRamService"
import { createEnemySpawnProfile, type EnemySpawnOptions } from "../../services/enemies/threatService"
import { tags } from "../../tags"
import { getEnemyVisual } from "../../visuals/enemyVisualCatalog"
import { spawnMiniBossDeathSequence } from "../spawnEnemyDeathEffect"
import { addWakeEnemyPart, composeWakeEnemy, handleWakeCompositeCombat } from "./wakeEnemyShared"

const MAGNET_MAW_VISUAL = getEnemyVisual("wake-magnet-maw")
const FIELD_RADIUS = 360
const CHARGE_DURATION = 1.1
const PULL_DURATION = 2.6
const RELEASE_DURATION = 0.35
const COOLDOWN_DURATION = 3.2

export interface MagnetMawSpawnOptions extends EnemySpawnOptions {
	onDefeated?: (pos: Vec2) => void
}

export function spawnMagnetMaw(
	pos: Vec2,
	hp = 120,
	options: MagnetMawSpawnOptions = {}
) {
	const profile = createEnemySpawnProfile(hp, 2, MAGNET_MAW_VISUAL.worldScale, options)
	const [coreVisual, craneVisual, leftVisual, rightVisual] = MAGNET_MAW_VISUAL.parts
	const maw = k.add([
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
			hb: 25 * profile.scale,
			damage: profile.damage,
			groundShadowMode: "ground" as const,
			fieldPhase: "cooldown" as "charge" | "pull" | "release" | "cooldown" | "disabled",
			fieldTimer: 1.5,
			deathSequenceActive: false,
		},
		tags.enemy,
		tags.unit,
		tags.enemyRoleController,
		tags.miniBoss,
		...(profile.elite ? [tags.elite] : []),
		tags.gameLoop,
		...(options.tags ?? []),
	])
	const partHp = 2 * Math.max(2, Math.round(profile.hp / 2 * 0.24))
	const crane = addWakeEnemyPart(maw, craneVisual.sprite, partHp)
	crane.pos = k.vec2(16, -18)
	crane.play("sweep")
	const leftCoil = addWakeEnemyPart(maw, leftVisual.sprite, partHp)
	const rightCoil = addWakeEnemyPart(maw, rightVisual.sprite, partHp)
	const fieldRing = maw.add([
		k.circle(FIELD_RADIUS, { fill: false }),
		k.anchor("center"),
		k.outline(2, k.rgb(95, 225, 255)),
		k.opacity(0),
		k.scale(1),
		k.layer(layers.gameEffects),
		k.z(-1),
	])
	composeWakeEnemy(maw, profile, [
		{
			obj: crane,
			hitbox: 13 * profile.scale,
			hitboxOffset: k.vec2(9, -20).scale(profile.scale),
			pullForce: 125,
			pullDuration: 1.15,
			onDestroyed: () => {
				maw.fieldPhase = "disabled"
			},
		},
		{
			obj: leftCoil,
			hitbox: 11 * profile.scale,
			hitboxOffset: k.vec2(-15, 1).scale(profile.scale),
			pullForce: 110,
			pullDuration: 1,
		},
		{
			obj: rightCoil,
			hitbox: 11 * profile.scale,
			hitboxOffset: k.vec2(15, 1).scale(profile.scale),
			pullForce: 110,
			pullDuration: 1,
		},
	], 16, 2, options.onDefeated, (finishDeath) => {
		maw.deathSequenceActive = true
		maw.unuse(tags.enemy)
		maw.unuse(tags.unit)
		fieldRing.opacity = 0
		spawnMiniBossDeathSequence(maw, {
			radius: 28 * profile.scale,
			color: k.rgb(95, 225, 255),
			onComplete: finishDeath,
		})
	})
	spawnMiniBossHealthBar(maw, profile.hp)
	const desperationRam = createMiniBossDesperationRam(maw, {
		name: "MAGNET MAW",
		sprite: coreVisual.sprite,
		baseScale: profile.scale,
		damage: profile.damage,
		speedMultiplier: profile.speedMultiplier,
		isDisarmed: () => maw.fieldPhase === "disabled",
	})
	maw.onGridCollide((_cell, normal) => {
		desperationRam.onWallCollision(normal)
	})

	registerBatchedEntityUpdate("enemies", maw, () => {
		if (maw.deathSequenceActive) return
		const delta = k.dt() * maw.getTimescale()
		const activeCoils = Number(!leftCoil.hidden) + Number(!rightCoil.hidden)
		if (activeCoils === 0 || crane.hidden) maw.fieldPhase = "disabled"
		if (desperationRam.update(delta)) {
			fieldRing.opacity = 0
			handleWakeCompositeCombat(
				maw,
				"MAGNET MAW",
				"enemy_wake_magnet_maw_platform_core",
				false
			)
			return
		}

		maw.fieldTimer -= delta
		switch (maw.fieldPhase) {
			case "cooldown":
				fieldRing.opacity = 0
				if (maw.fieldTimer <= 0) {
					maw.fieldPhase = "charge"
					maw.fieldTimer = CHARGE_DURATION
					gameSoundService.playPositional("charge_zone_charge", maw.pos, {
						volume: mainSoundVolume * 0.55,
						detune: -240,
					})
				}
				break
			case "charge": {
				const progress = 1 - maw.fieldTimer / CHARGE_DURATION
				fieldRing.opacity = k.wave(0.18, 0.7, k.time() * (6 + progress * 8))
				fieldRing.scale = k.vec2(k.lerp(0.25, 1, progress))
				if (maw.fieldTimer <= 0) {
					maw.fieldPhase = "pull"
					maw.fieldTimer = PULL_DURATION
				}
				break
			}
			case "pull":
				fieldRing.opacity = 0.55
				fieldRing.scale = k.vec2(1)
				pullTargetsTowardMaw(maw, activeCoils, delta)
				if (maw.fieldTimer <= 0) {
					maw.fieldPhase = "release"
					maw.fieldTimer = RELEASE_DURATION
					releaseMagnetizedTargets(maw, activeCoils)
					gameSoundService.playPositional("explosive_blast", maw.pos, {
						volume: mainSoundVolume * 0.55,
						detune: -360,
					})
				}
				break
			case "release":
				fieldRing.opacity = k.lerp(0.6, 0, 1 - maw.fieldTimer / RELEASE_DURATION)
				if (maw.fieldTimer <= 0) {
					maw.fieldPhase = "cooldown"
					maw.fieldTimer = COOLDOWN_DURATION
				}
				break
			case "disabled":
				fieldRing.opacity = 0
				break
		}
		handleWakeCompositeCombat(
			maw,
			"MAGNET MAW",
			"enemy_wake_magnet_maw_platform_core",
			false
		)
	})

	return maw
}

function pullTargetsTowardMaw(maw: GameObj, activeCoils: number, delta: number) {
	const pullSpeed = 34 + activeCoils * 23
	pullTarget(maw, playerObj, pullSpeed, delta)
	for (const target of k.get(tags.snareable) as GameObj[]) {
		if (!target.exists() || target.is(tags.enemy)) continue
		pullTarget(maw, target, pullSpeed * 0.85, delta)
	}
}

function pullTarget(maw: GameObj, target: GameObj, speed: number, delta: number) {
	const offset = maw.pos.sub(target.pos)
	const distance = offset.len()
	if (distance <= 42 || distance > FIELD_RADIUS) return
	target.move(offset.unit().scale(speed * velocityScale() * delta / Math.max(k.dt(), 0.001)))
}

function releaseMagnetizedTargets(maw: GameObj, activeCoils: number) {
	const strength = 70 + activeCoils * 35
	for (const target of [playerObj, ...(k.get(tags.snareable) as GameObj[])]) {
		if (!target.exists() || target.pos.dist(maw.pos) > FIELD_RADIUS) continue
		const direction = target.pos.sub(maw.pos)
		if (direction.len() > 0.001) applyKnockbackImpulse(target, direction, strength)
	}
}
