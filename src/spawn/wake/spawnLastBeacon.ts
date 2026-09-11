import type { GameObj, Vec2 } from "kaplay"
import { jitter } from "../../comp/jitter"
import { timescale } from "../../comp/timescale"
import { compose, unitComponents } from "../../compose"
import { checkProjectileComponentIntersection, playerObj } from "../../game"
import { BULLET_SPEED, k, layers, mainSoundVolume } from "../../main"
import { sparkEmitter } from "../../particles"
import { gameSoundService } from "../../services/audio/gameSoundService"
import { applyDamage } from "../../services/combat/damageService"
import { spawnInwardForceCone } from "../../services/combat/forceInteractionEffectService"
import { spawnProjectile } from "../../services/combat/projectileService"
import { registerBatchedEntityUpdate } from "../../services/core/entityUpdateService"
import { registerBossEncounter } from "../../services/enemies/bossEncounterService"
import { getBossDefinition } from "../../services/enemies/bossRegistry"
import { ENEMY_THREAT_RANK } from "../../services/enemies/threatService"
import { setHitSoundProfile } from "../../services/audio/hitSoundService"
import { tags } from "../../tags"
import { getEnemyVisual } from "../../visuals/enemyVisualCatalog"
import { enemyOnDeath, onEnemyHit } from "../enemyShared"
import { spawnMiniBossDeathSequence } from "../spawnEnemyDeathEffect"
import { spawnExplosionEffect, spawnFlash } from "../spawnFlash"
import { spawnRing } from "../spawnRing"
import { spawnScrapNipper } from "./spawnScrapNipper"
import { addWakeEnemyPart } from "./wakeEnemyShared"

const VISUAL = getEnemyVisual("wake-last-beacon")
const BODY_HITBOX = 58
const RELAY_RADIUS = 235
const RELAY_HITBOX = 22
const ARENA_RADIUS = 450
const BEACON_ATTACK_TAG = "lastBeaconAttack"
const BEACON_RELAY_TAG = "lastBeaconRelay"
const BEACON_ADD_TAG = "lastBeaconAdd"

type BeaconState =
	| "recover"
	| "signalCharge"
	| "sweep"
	| "sectorWarn"
	| "wakeSignal"
	| "ringVolley"
	| "dying"

export interface LastBeaconSpawnOptions {
	onDefeated?: (pos: Vec2) => void
	tags?: string[]
	rewardAmount?: number
}

export function spawnLastBeacon(
	pos: Vec2,
	hp: number,
	options: LastBeaconSpawnOptions = {}
) {
	const definition = getBossDefinition("wake-last-beacon")
	const [bodyVisual, relayVisual] = VISUAL.parts
	const beacon = k.add([
		k.pos(pos),
		k.sprite(bodyVisual.sprite),
		k.anchor("center"),
		k.color(k.WHITE),
		k.opacity(1),
		k.rotate(0),
		k.health(hp),
		k.animate(),
		k.scale(VISUAL.worldScale),
		timescale(),
		jitter(),
		{
			hb: BODY_HITBOX,
			damage: 2,
			threatRank: ENEMY_THREAT_RANK.boss,
			phaseIndex: 0,
			state: "recover" as BeaconState,
			stateTimer: 1.4,
			attackCycle: 0,
			beamAngle: 0,
			beamLive: false,
			beamFeedbackTimer: 0,
			safeAngle: 0,
			volleyIndex: 0,
			nextVolleyAt: 0,
			groundShadowMode: "ground" as const,
			nextSignalState: "sweep" as Exclude<
				BeaconState,
				"signalCharge" | "recover" | "dying"
			>,
			deathSequenceActive: false,
		},
		tags.enemy,
		tags.unit,
		tags.enemyRoleController,
		tags.boss,
		tags.gameLoop,
		...(options.tags ?? []),
	])
	setHitSoundProfile(beacon, "heavyMetal")

	const relayHp = 5 * Math.max(10, Math.round(hp / 5 * 0.15))
	const relays = [0, 120, 240].map((angle) => {
		const relay = addWakeEnemyPart(beacon, relayVisual.sprite, relayHp)
		relay.pos = k.Vec2.fromAngle(angle - 90).scale(RELAY_RADIUS)
		relay.angle = angle
		relay.tag(BEACON_RELAY_TAG)
		return relay
	})
	const signalVisual = spawnSignalVisual(beacon, relays)
	let activeRelays = relays.length
	let deathStarted = false
	const chargeEffects: GameObj[] = []

	unitComponents[beacon.id] = compose({
		skipDefaultBodyDeath: true,
		deferBodyDestruction: true,
		parts: [
			{ obj: beacon, hitbox: BODY_HITBOX, isBody: true, scoreOnDestroy: 0 },
			...relays.map((relay) => ({
				obj: relay,
				hitbox: RELAY_HITBOX,
				hitboxOffset: relay.pos,
				isBody: false,
				scoreOnDestroy: 0,
				pullForce: 135,
				pullDuration: 1.25,
				onDestroyed: () => {
					activeRelays--
					beacon.state = "recover"
					beacon.stateTimer = activeRelays === 0 ? 1.5 : 0.75
					spawnFlash(beacon.pos.clone(), activeRelays === 0 ? 58 : 30, k.WHITE)
					spawnRing({
						pos: beacon.pos.clone(),
						speed: 280,
						intensity: 0.6,
						maxRadius: activeRelays === 0 ? 310 : 175,
						visualize: true,
						color: k.rgb(90, 225, 255),
						effectWidth: 22,
					})
					beacon.jitter(activeRelays === 0 ? 18 : 11)
					k.shake(activeRelays === 0 ? 8 : 4)
				},
			})),
		],
		onBodyDeath: beginDeath,
	})

	registerBossEncounter(beacon, definition.id, {
		maxHealth: hp,
		deferDefeatUntilDestroy: true,
		onPhaseChanged: (_phase, phaseIndex) => {
			beacon.phaseIndex = phaseIndex
			beacon.attackCycle = 0
			if (phaseIndex === 0) return
			beacon.state = "recover"
			beacon.stateTimer = 0.9
			spawnFlash(beacon.pos.clone(), 52, phaseIndex === 1
				? k.rgb(90, 225, 255)
				: k.WHITE)
			spawnRing({
				pos: beacon.pos.clone(),
				speed: 330,
				intensity: 0.8,
				maxRadius: ARENA_RADIUS,
				visualize: true,
				color: k.rgb(90, 225, 255),
				effectWidth: 30,
			})
			k.shake(7)
		},
		onDefeated: options.onDefeated,
	})

	registerBatchedEntityUpdate("enemies", beacon, () => {
		if (beacon.deathSequenceActive) return
		const delta = k.dt() * beacon.getTimescale()
		beacon.stateTimer -= delta
		beacon.opacity = beacon.state === "recover" || activeRelays === 0
			? 1
			: k.wave(0.68, 1, k.time() * 8)

		if (beacon.state === "recover") {
			if (beacon.stateTimer <= 0) beginNextAttack()
		} else if (beacon.state === "signalCharge") {
			if (beacon.stateTimer <= 0) beginChargedAttack()
		} else if (beacon.state === "sweep") {
			updateSweep(beacon, relays, activeRelays, delta)
			if (beacon.stateTimer <= 0) enterRecovery(1.05)
		} else if (beacon.state === "sectorWarn") {
			if (beacon.stateTimer <= 0) {
				fireSectorPulse(beacon)
				enterRecovery(1.15)
			}
		} else if (beacon.state === "wakeSignal") {
			if (beacon.stateTimer <= 0) {
				spawnWakeAdds(beacon, options.tags)
				enterRecovery(1.2)
			}
		} else if (beacon.state === "ringVolley") {
			if (beacon.volleyIndex < 3 && beacon.stateTimer <= beacon.nextVolleyAt) {
				fireSignalRing(beacon, beacon.volleyIndex, options.tags)
				beacon.volleyIndex++
				beacon.nextVolleyAt -= 0.34
			}
			if (beacon.stateTimer <= 0) enterRecovery(0.9)
		}

		resolveBeaconHits(beacon)
	})

	beacon.onDestroy(() => {
		for (const effect of chargeEffects) {
			if (effect.exists()) k.destroy(effect)
		}
		if (signalVisual.exists()) k.destroy(signalVisual)
		k.destroyAll(BEACON_ATTACK_TAG)
		k.destroyAll(BEACON_ADD_TAG)
		delete unitComponents[beacon.id]
	})
	return beacon

	function beginNextAttack() {
		beacon.attackCycle++
		if (beacon.phaseIndex >= 2 && beacon.attackCycle % 2 === 1) {
			beginSignalCharge("ringVolley")
			return
		}
		if (
			beacon.phaseIndex >= 1 &&
			beacon.attackCycle % 3 === 0 &&
			(k.get(BEACON_ADD_TAG) as GameObj[]).every((add) => !add.exists())
		) {
			beginSignalCharge("wakeSignal")
			return
		}
		beginSignalCharge(beacon.attackCycle % 2 === 0 ? "sectorWarn" : "sweep")
	}

	function beginSignalCharge(nextState: Exclude<BeaconState, "signalCharge" | "recover" | "dying">) {
		beacon.state = "signalCharge"
		beacon.stateTimer = 0.82
		beacon.nextSignalState = nextState
		beacon.beamLive = false
		for (const relay of relays) {
			if (relay.hidden) continue
			chargeEffects.push(spawnInwardForceCone({
				origin: () => beacon.exists() ? beacon.pos.clone() : undefined,
				direction: () => relay.exists() && !relay.hidden
					? relay.worldPos.sub(beacon.pos).unit()
					: undefined,
				radius: RELAY_RADIUS,
				halfAngle: 9,
				duration: 0.82,
				intensity: 0.65,
				color: k.rgb(90, 225, 255),
				extraTags: options.tags,
				shakeTags: [BEACON_RELAY_TAG, tags.roomEnvironment],
			}))
		}
		gameSoundService.playPositional("charge_zone_charge", beacon.pos, {
			volume: mainSoundVolume * 0.68,
			detune: 110 + beacon.phaseIndex * 80,
			voiceLimit: 1,
		})
		beacon.jitter(7)
		k.shake(2)
	}

	function beginChargedAttack() {
		const nextState = beacon.nextSignalState as BeaconState
		beacon.state = nextState
		spawnFlash(beacon.pos.clone(), 38, k.rgb(90, 225, 255))
		k.shake(4)
		if (nextState === "sweep") {
			beacon.stateTimer = 2.8
			beacon.beamAngle = playerObj.pos.sub(beacon.pos).angle() - 70
			beacon.beamFeedbackTimer = 0
		} else if (nextState === "sectorWarn") {
			beacon.stateTimer = 1.05
			beacon.safeAngle = playerObj.pos.sub(beacon.pos).angle()
		} else if (nextState === "wakeSignal") {
			beacon.stateTimer = 0.72
		} else {
			beacon.stateTimer = 1.22
			beacon.volleyIndex = 0
			beacon.nextVolleyAt = 0.94
		}
	}

	function enterRecovery(duration: number) {
		beacon.state = "recover"
		beacon.stateTimer = activeRelays === 0 ? duration * 1.45 : duration
	}

	function resolveBeaconHits(body: GameObj) {
		const components = unitComponents[body.id]
		if (components) {
			checkProjectileComponentIntersection(
				body.pos,
				RELAY_RADIUS + RELAY_HITBOX + 20,
				tags.friendly,
				components,
				(projectile, index) => onEnemyHit(components[index].obj, projectile)
			)
		}
		if (playerObj.exists() && playerObj.pos.dist(body.pos) < BODY_HITBOX + 8) {
			applyDamage(playerObj, body.damage, {
				position: body.pos,
				source: { name: definition.name, sprite: bodyVisual.sprite },
			})
		}
	}

	function beginDeath() {
		if (deathStarted) return
		deathStarted = true
		beacon.deathSequenceActive = true
		beacon.state = "dying"
		beacon.unuse(tags.enemy)
		beacon.unuse(tags.unit)
		k.destroyAll(BEACON_ATTACK_TAG)
		k.destroyAll(BEACON_ADD_TAG)
		spawnMiniBossDeathSequence(beacon, {
			radius: 76,
			color: k.rgb(90, 225, 255),
			onComplete: () => {
				spawnRing({
					pos: beacon.pos.clone(),
					speed: 430,
					intensity: 1.2,
					maxRadius: ARENA_RADIUS,
					visualize: true,
					color: k.rgb(90, 225, 255),
					effectWidth: 42,
				})
				enemyOnDeath(
					beacon.pos.clone(),
					options.rewardAmount ?? 18,
					definition.rewardMultiplier,
					"boss",
					false,
					{ intensity: 5, starCount: 100, material: "ship" },
					beacon
				)
				if (beacon.exists()) k.destroy(beacon)
			},
		})
	}
}

function spawnSignalVisual(beacon: GameObj, relays: GameObj[]) {
	return k.add([
		k.pos(0, 0),
		k.layer(layers.gameEffects),
		k.z(3),
		{
			draw() {
				if (!beacon.exists() || beacon.deathSequenceActive) return
				if (beacon.state === "sweep") {
					const danger = beacon.stateTimer < 2.05
					for (let index = 0; index < relays.length; index++) {
						if (relays[index].hidden) continue
						const angle = beacon.beamAngle + index * 120
						drawSweepBeam(beacon.pos, angle, danger, index)
					}
				} else if (beacon.state === "sectorWarn") {
					const left = k.Vec2.fromAngle(beacon.safeAngle - 44)
					const right = k.Vec2.fromAngle(beacon.safeAngle + 44)
					for (const edge of [left, right]) {
						k.drawLine({
							p1: beacon.pos.add(edge.scale(48)),
							p2: beacon.pos.add(edge.scale(ARENA_RADIUS)),
							width: 3,
							color: k.rgb(90, 225, 255),
							opacity: k.wave(0.3, 0.8, k.time() * 10),
						})
					}
					k.drawCircle({
						pos: beacon.pos,
						radius: ARENA_RADIUS * k.lerp(1, 0.45, 1 - beacon.stateTimer / 1.05),
						fill: false,
						outline: { width: 4, color: k.rgb(255, 70, 82) },
						opacity: 0.5,
					})
				}
			},
		},
		tags.props,
		tags.gameLoop,
	])
}

function updateSweep(
	beacon: GameObj,
	relays: GameObj[],
	activeRelays: number,
	delta: number
) {
	beacon.beamAngle += (34 + beacon.phaseIndex * 11) * delta
	if (beacon.stateTimer >= 2.05 || !playerObj.exists()) return
	if (!beacon.beamLive) igniteSweep(beacon, relays)
	beacon.beamFeedbackTimer -= delta
	if (beacon.beamFeedbackTimer <= 0) {
		k.shake(0.55 + beacon.phaseIndex * 0.18)
		beacon.beamFeedbackTimer = 0.12
	}
	for (let index = 0; index < relays.length; index++) {
		if (relays[index].hidden) continue
		const angle = beacon.beamAngle + index * 120
		if (distanceToRay(playerObj.pos, beacon.pos, angle) > 8) continue
		const damaged = applyDamage(playerObj, beacon.damage * (0.7 + activeRelays * 0.1), {
			position: beacon.pos,
			incomingDirection: k.Vec2.fromAngle(angle),
			source: { name: "GUIDANCE SWEEP", sprite: "boss_wake_last_beacon" },
		})
		if (damaged) {
			spawnFlash(playerObj.pos.clone(), 15, k.WHITE)
			spawnRing({
				pos: playerObj.pos.clone(),
				speed: 260,
				intensity: 0.45,
				maxRadius: 54,
				color: k.rgb(255, 70, 82),
				visualOpacity: 0.75,
			})
			sparkEmitter.emitter.position = playerObj.pos.clone()
			sparkEmitter.emitter.direction = angle
			sparkEmitter.emit(12)
			k.shake(4)
		}
		break
	}
}

function drawSweepBeam(
	origin: Vec2,
	angle: number,
	danger: boolean,
	beamIndex: number
) {
	const direction = k.Vec2.fromAngle(angle)
	const normal = direction.normal()
	const start = origin.add(direction.scale(52))
	const end = origin.add(direction.scale(ARENA_RADIUS))
	const pulse = k.wave(0, 1, k.time() * 17 + beamIndex * 1.7)
	const cyan = k.rgb(90, 225, 255)
	const red = k.rgb(255, 70, 82)
	if (!danger) {
		k.drawLine({
			p1: start,
			p2: end,
			width: 8,
			color: cyan,
			opacity: 0.08 + pulse * 0.08,
		})
		k.drawLine({
			p1: start,
			p2: end,
			width: 2,
			color: cyan,
			opacity: 0.42 + pulse * 0.22,
		})
		return
	}

	k.drawLine({
		p1: start,
		p2: end,
		width: 20,
		color: red,
		opacity: 0.11 + pulse * 0.07,
	})
	k.drawLine({
		p1: start,
		p2: end,
		width: 10,
		color: red,
		opacity: 0.46 + pulse * 0.18,
	})
	for (const side of [-1, 1]) {
		const offset = normal.scale(side * 7)
		k.drawLine({
			p1: start.add(offset),
			p2: end.add(offset),
			width: 1,
			color: cyan,
			opacity: 0.25 + pulse * 0.2,
		})
	}
	k.drawLine({
		p1: start,
		p2: end,
		width: 4,
		color: k.WHITE,
		opacity: 0.82 + pulse * 0.18,
	})

	const travelLength = ARENA_RADIUS - 60
	for (let index = 0; index < 6; index++) {
		const distance = 8 + (
			k.time() * 230 + index * travelLength / 6 + beamIndex * 31
		) % travelLength
		const packet = start.add(direction.scale(distance))
		k.drawRect({
			pos: packet,
			width: 7,
			height: 3,
			anchor: "center",
			angle,
			color: index % 2 === 0 ? k.WHITE : cyan,
			opacity: 0.65 + pulse * 0.25,
		})
	}

	k.drawCircle({
		pos: start,
		radius: 8 + pulse * 4,
		fill: false,
		outline: { width: 2, color: k.WHITE },
		opacity: 0.72,
	})
	k.drawCircle({
		pos: end,
		radius: 7 + pulse * 5,
		fill: false,
		outline: { width: 3, color: red },
		opacity: 0.7,
	})
	k.drawLine({
		p1: end.sub(normal.scale(10 + pulse * 4)),
		p2: end.add(normal.scale(10 + pulse * 4)),
		width: 2,
		color: k.WHITE,
		opacity: 0.72,
	})
}

function igniteSweep(beacon: GameObj, relays: GameObj[]) {
	beacon.beamLive = true
	spawnFlash(beacon.pos.clone(), 54, k.WHITE)
	spawnRing({
		pos: beacon.pos.clone(),
		speed: 410,
		intensity: 0.95,
		maxRadius: 260,
		color: k.rgb(255, 70, 82),
		visualOpacity: 0.9,
		effectWidth: 30,
	})
	for (let index = 0; index < relays.length; index++) {
		if (relays[index].hidden) continue
		const angle = beacon.beamAngle + index * 120
		const origin = beacon.pos.add(k.Vec2.fromAngle(angle).scale(52))
		sparkEmitter.emitter.position = origin
		sparkEmitter.emitter.direction = angle
		sparkEmitter.emit(16)
	}
	gameSoundService.playPositional("weapon_rail_lance_fire", beacon.pos, {
		volume: mainSoundVolume,
		detune: -220,
		voiceLimit: 1,
	})
	beacon.jitter(12)
	k.shake(7)
}

function fireSectorPulse(beacon: GameObj) {
	const playerOffset = playerObj.pos.sub(beacon.pos)
	const safe = Math.abs(shortestAngleDelta(beacon.safeAngle, playerOffset.angle())) <= 44
	if (!safe && playerOffset.len() <= ARENA_RADIUS) {
		applyDamage(playerObj, beacon.damage * 1.15, {
			position: beacon.pos,
			incomingDirection: playerOffset,
			source: { name: "SECTOR WARNING", sprite: "boss_wake_last_beacon" },
		})
	}
	spawnRing({
		pos: beacon.pos.clone(),
		speed: 520,
		intensity: 1,
		maxRadius: ARENA_RADIUS,
		visualize: true,
		color: k.rgb(255, 70, 82),
		effectWidth: 48,
	})
	gameSoundService.playPositional("explosive_blast", beacon.pos, {
		volume: mainSoundVolume * 0.8,
		detune: 180,
	})
	beacon.jitter(12)
	k.shake(8)
}

function spawnWakeAdds(beacon: GameObj, extraTags?: string[]) {
	const count = 2 + beacon.phaseIndex
	for (let index = 0; index < count; index++) {
		const angle = index * 360 / count + 30
		const spawnPos = beacon.pos.add(k.Vec2.fromAngle(angle).scale(300))
		spawnScrapNipper(spawnPos, (3 + beacon.phaseIndex) * 2, {
			persistOffscreen: true,
			rewardMode: "reconstructed",
			tags: [BEACON_ADD_TAG, ...(extraTags ?? [])],
		})
		spawnExplosionEffect(spawnPos, 22, {
			particleCount: 9,
			color: k.rgb(90, 225, 255),
		})
	}
	gameSoundService.playPositional("wormhole_rampup", beacon.pos, {
		volume: mainSoundVolume * 0.7,
		detune: 260,
	})
	spawnFlash(beacon.pos.clone(), 42, k.rgb(90, 225, 255))
	k.shake(5)
}

function fireSignalRing(beacon: GameObj, wave: number, extraTags?: string[]) {
	const count = 20
	const safeAngle = playerObj.pos.sub(beacon.pos).angle() + (wave - 1) * 22
	for (let index = 0; index < count; index++) {
		const angle = index * 360 / count
		if (Math.abs(shortestAngleDelta(angle, safeAngle)) < 32) continue
		const direction = k.Vec2.fromAngle(angle)
		spawnProjectile({
			pos: beacon.pos.add(direction.scale(58)),
			dir: direction,
			rotation: angle + 90,
			sprite: "particle4",
			visualScale: 1.25,
			speed: BULLET_SPEED,
			speedMultiplier: 0.34 + wave * 0.025,
			tags: [tags.enemy, tags.blaster, BEACON_ATTACK_TAG, ...(extraTags ?? [])],
			impact: { damage: beacon.damage * 0.62 },
			lifespan: { duration: 4 },
			damageSource: { name: "EMERGENCY BROADCAST", sprite: "boss_wake_last_beacon" },
		})
	}
	spawnFlash(beacon.pos.clone(), 30 + wave * 6, k.WHITE)
	spawnRing({
		pos: beacon.pos.clone(),
		speed: 320 + wave * 35,
		intensity: 0.7,
		maxRadius: 280,
		visualize: true,
		color: k.rgb(90, 225, 255),
		effectWidth: 24,
	})
	gameSoundService.playPositional("shoot1", beacon.pos, {
		volume: mainSoundVolume * 0.7,
		detune: wave * 120,
	})
	beacon.jitter(7)
	k.shake(3 + wave)
}

function distanceToRay(point: Vec2, origin: Vec2, angle: number) {
	const direction = k.Vec2.fromAngle(angle)
	const offset = point.sub(origin)
	const projection = offset.dot(direction)
	if (projection < 48 || projection > ARENA_RADIUS) return Number.POSITIVE_INFINITY
	return Math.abs(offset.dot(direction.normal()))
}

function shortestAngleDelta(from: number, to: number) {
	return ((to - from + 540) % 360) - 180
}
