import type { GameObj, Vec2 } from "kaplay"
import { timescale } from "../../comp/timescale"
import { checkProjectileIntersection } from "../../game"
import { k, layers, mainSoundVolume } from "../../main"
import { gameSoundService } from "../../services/audio/gameSoundService"
import { setHitSoundProfile } from "../../services/audio/hitSoundService"
import { applyDefaultExplosionForce } from "../../services/combat/explosionPulseService"
import { registerBatchedEntityUpdate } from "../../services/core/entityUpdateService"
import {
	createEnemySpawnProfile,
	ENEMY_THREAT_RANK,
	type EnemySpawnOptions,
} from "../../services/enemies/threatService"
import { registerHitAnimation } from "../../shared"
import { tags } from "../../tags"
import { getEnemyVisual } from "../../visuals/enemyVisualCatalog"
import { requirePrimaryVisualSprite } from "../../visuals/visualRepresentation"
import { enemyOnDeath, onEnemyHit } from "../enemyShared"
import { spawnExplosionEffect, spawnFlash } from "../spawnFlash"
import { spawnScrapNipper } from "./spawnScrapNipper"

const HUT_VISUAL = getEnemyVisual("wake-scrappers-hut")
const HUT_SCALE = HUT_VISUAL.worldScale
const HATCH_OFFSET_X = 0
const HATCH_OFFSET_Y = 42
const INITIAL_SPAWN_DELAY = 1.4
const SPAWN_COOLDOWN = 3.6
const SPAWN_TELEGRAPH_DURATION = 0.85
const NORMAL_RESERVE = 4
const ELITE_RESERVE = 6
const NORMAL_ACTIVE_LIMIT = 2
const ELITE_ACTIVE_LIMIT = 3

export function spawnScrappersHut(
	pos: Vec2,
	hp = 18,
	options: EnemySpawnOptions = {}
) {
	const profile = createEnemySpawnProfile(hp, 0, HUT_SCALE, options)
	const origin = pos.clone()
	const activeChildren = new Set<number>()
	const hut = k.add([
		k.pos(pos),
		k.sprite(requirePrimaryVisualSprite(HUT_VISUAL)),
		k.color(k.WHITE),
		k.rotate(0),
		k.anchor("center"),
		k.health(profile.hp),
		k.animate(),
		k.opacity(1),
		k.scale(profile.scale),
		timescale(),
		{
			hb: 42 * profile.scale,
			damage: 0,
			spawnTimer: INITIAL_SPAWN_DELAY,
			spawnTelegraph: 0,
			spawnCharging: false,
			reserve: profile.elite ? ELITE_RESERVE : NORMAL_RESERVE,
			activeChildren,
			deathHandled: false,
			origin,
			baseScale: profile.scale,
			runtimeCullRadius: 72 * profile.scale,
			threatRank: ENEMY_THREAT_RANK.heavyVehicle,
			groundShadowMode: "ground" as const,
		},
		tags.enemy,
		tags.unit,
		tags.enemyRoleTerrain,
		tags.enemyRoleController,
		...(profile.elite ? [tags.elite] : []),
		tags.gameLoop,
		...(options.tags ?? []),
	])
	setHitSoundProfile(hut, "heavyMetal")
	registerHitAnimation(hut)

	registerBatchedEntityUpdate("enemies", hut, () => {
		if (hut.deathHandled) return
		checkProjectileIntersection(
			hut.pos,
			hut.hb,
			tags.friendly,
			(projectile) => onEnemyHit(hut, projectile)
		)
		if (!hut.exists() || hut.deathHandled) return

		const activeLimit = profile.elite
			? ELITE_ACTIVE_LIMIT
			: NORMAL_ACTIVE_LIMIT
		if (hut.reserve <= 0 || hut.activeChildren.size >= activeLimit) {
			resetSpawnTelegraph(hut)
			return
		}

		const delta = k.dt() * hut.getTimescale()
		if (!hut.spawnCharging) {
			hut.spawnTimer -= delta
			if (hut.spawnTimer > 0) return
			hut.spawnCharging = true
			hut.spawnTelegraph = 0
			gameSoundService.playPositional("charge_zone_charge", hut.pos, {
				volume: mainSoundVolume * 0.32,
				maxDistance: 560,
				detune: -420,
			})
		}

		hut.spawnTelegraph += delta
		const progress = k.clamp(
			hut.spawnTelegraph / SPAWN_TELEGRAPH_DURATION,
			0,
			1
		)
		const pulse = Math.sin(progress * Math.PI * 7)
		const shake = progress * 2.5
		hut.pos = hut.origin.add(k.vec2(
			k.rand(-shake, shake),
			k.rand(-shake, shake)
		))
		hut.scale = k.vec2(profile.scale * (1 + Math.max(0, pulse) * 0.035))
		hut.color = pulse > 0.25 ? k.rgb(255, 92, 92) : k.WHITE
		if (progress < 1) return
		deployNipper(hut, profile, options)
	})

	hut.onHurt(() => {
		if (!hut.deathHandled) hut.animation.seek(0)
	})

	hut.onDeath(() => {
		if (hut.deathHandled) return
		hut.deathHandled = true
		const deathPos = hut.origin.clone()
		spawnExplosionEffect(deathPos, 70 * profile.scale, {
			particleCount: 30,
			ringIntensity: 0.85,
			persistentSmoke: true,
		})
		applyDefaultExplosionForce(deathPos, 105 * profile.scale, {
			excludeIds: [hut.id],
		})
		gameSoundService.playPositional("explosive_blast", deathPos, {
			volume: mainSoundVolume * 0.9,
			maxDistance: 720,
			detune: -180,
		})
		spawnDestroyedHut(deathPos, profile.scale, options.tags)
		enemyOnDeath(
			deathPos,
			12 * profile.rewardMultiplier,
			1.8 * profile.rewardMultiplier,
			"enemy",
			false,
			{ tier: profile.elite ? "elite" : "normal" },
			hut
		)
		k.shake(6)
		k.destroy(hut)
	})

	return hut
}

function deployNipper(
	hut: GameObj,
	profile: ReturnType<typeof createEnemySpawnProfile>,
	options: EnemySpawnOptions
) {
	const hatch = hut.origin.add(
		k.vec2(HATCH_OFFSET_X, HATCH_OFFSET_Y).scale(profile.scale)
	)
	hut.reserve--
	resetSpawnTelegraph(hut)
	hut.spawnTimer = SPAWN_COOLDOWN * k.rand(0.88, 1.14)
	spawnFlash(hatch, 18, k.rgb(255, 90, 90))
	spawnExplosionEffect(hatch, 14, {
		particleCount: 5,
		ringIntensity: 0.15,
	})
	const child = spawnScrapNipper(hatch, 2, {
		...options,
		elite: false,
		rewardMode: "reconstructed",
		tags: [...new Set(options.tags ?? [])],
	})
	hut.activeChildren.add(child.id)
	child.onDestroy(() => {
		if (hut.exists()) hut.activeChildren.delete(child.id)
	})
}

function resetSpawnTelegraph(hut: GameObj) {
	hut.spawnCharging = false
	hut.spawnTelegraph = 0
	hut.pos = hut.origin.clone()
	hut.scale = k.vec2(hut.baseScale)
	hut.color = k.WHITE
}

function spawnDestroyedHut(pos: Vec2, scale: number, extraTags?: string[]) {
	return k.add([
		k.pos(pos),
		k.sprite(requirePrimaryVisualSprite(HUT_VISUAL)),
		k.anchor("center"),
		k.rotate(k.rand(-8, 8)),
		k.scale(scale),
		k.color(80, 88, 94),
		k.opacity(0.72),
		k.layer(layers.game),
		k.z(-2),
		{ runtimeCullRadius: 72 * scale },
		tags.props,
		tags.runtimeCullable,
		tags.gameLoop,
		...(extraTags ?? []).filter((tag) => tag !== tags.runRoomEnemy),
	])
}
