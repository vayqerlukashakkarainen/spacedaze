import type { Vec2 } from "kaplay"
import { playerObj } from "../game"
import { dt, k, mainSoundVolume, velocityScale } from "../main"
import { player } from "../player"
import { audioService } from "../services/audioService"
import { tags } from "../tags"
import { updatePlayerHealthBar } from "../ui/gameUi"
import { timescale } from "../comp/timescale"
import { spawnDamageNumber } from "./spawnDamageNumber"

export const HEALTH_ORB_DROP_CHANCE = 0.05

const ORB_COLOR = [70, 255, 120] as const
const ORB_HIGHLIGHT = [190, 255, 205] as const
const HEALTH_ORB_SCALE = 0.3
const HEALTH_ORB_COLLECTION_DURATION = 0.48
const HEALTH_PULSE_DURATION = 0.6

interface HealthOrbCollectionState {
	elapsed: number
	startPos: Vec2
	approachDir: Vec2
	startAngle: number
	startScale: number
	spin: number
}

export function trySpawnHealthOrb(pos: Vec2, chanceMultiplier = 1) {
	if (!playerCanReceiveHealth()) return
	const chance = k.clamp(HEALTH_ORB_DROP_CHANCE * chanceMultiplier, 0, 1)
	if (!k.chance(chance)) return
	return spawnHealthOrb(pos)
}

export function spawnHealthOrb(pos: Vec2) {
	let collected = false
	const orb = k.add([
		k.circle(7),
		k.pos(pos),
		k.anchor("center"),
		k.color(...ORB_COLOR),
		k.opacity(0.9),
		k.outline(2, k.rgb(...ORB_HIGHLIGHT)),
		k.rotate(k.rand(360)),
		k.scale(HEALTH_ORB_SCALE),
		timescale(),
		k.offscreen({ destroy: true }),
		{
			dir: k.rand(k.vec2(-1, -1), k.vec2(1, 1)),
			speed: k.rand(35, 55),
			lifeSpan: 0,
			collection: undefined as HealthOrbCollectionState | undefined,
		},
		tags.props,
		tags.gameLoop,
	])
	const glow = orb.add([
		k.circle(13),
		k.anchor("center"),
		k.color(...ORB_COLOR),
		k.opacity(0.18),
		k.z(-1),
	])
	const ring = orb.add([
		k.circle(15, { fill: false }),
		k.anchor("center"),
		k.opacity(0.65),
		k.outline(1, k.rgb(...ORB_COLOR)),
	])

	orb.onUpdate(() => {
		if (!playerObj || !playerObj.exists() || typeof playerObj.hp !== "function") {
			return
		}
		if (orb.collection) {
			const completed = updateHealthOrbCollection(
				orb,
				playerObj.pos,
				dt() * orb.getTimescale()
			)
			if (completed) collectHealthOrb()
			return
		}

		const pulse = k.wave(
			HEALTH_ORB_SCALE * 0.86,
			HEALTH_ORB_SCALE * 1.14,
			k.time() * 4
		)
		orb.scale = k.vec2(pulse)
		glow.opacity = k.wave(0.1, 0.3, k.time() * 3)
		ring.scale = k.vec2(k.wave(0.9, 1.18, k.time() * 3))

		if (orb.lifeSpan < orb.speed) {
			orb.move(
				orb.dir.scale(
					(orb.speed - orb.lifeSpan) * velocityScale() * orb.getTimescale()
				)
			)
			orb.lifeSpan += dt() * 45
		}

		if (playerObj.hp() >= playerObj.maxHP) return
		const pickupDistance =
			player.debreeSeekDistance * player.debreeSeekDistanceMultiplier
		if (orb.pos.dist(playerObj.pos) >= pickupDistance) return
		beginHealthOrbCollection()
	})

	function beginHealthOrbCollection() {
		const approach = playerObj.pos.sub(orb.pos)
		orb.collection = {
			elapsed: 0,
			startPos: orb.pos.clone(),
			approachDir: approach.len() > 0 ? approach.unit() : k.vec2(0, -1),
			startAngle: orb.angle,
			startScale: orb.scale.x,
			spin: k.chance(0.5) ? 1 : -1,
		}
	}

	function collectHealthOrb() {
		if (collected || !playerCanReceiveHealth()) return
		collected = true
		playerObj.heal(1)
		updatePlayerHealthBar(playerObj.hp())
		spawnDamageNumber(playerObj.pos.clone(), 1, {
			color: k.rgb(...ORB_COLOR),
			prefix: "+",
		})
		spawnPlayerHealthPulse()
		audioService.playSound("powerup1", {
			volume: mainSoundVolume,
			detune: -200,
		})
		k.destroy(orb)
	}

	return orb
}

function playerCanReceiveHealth() {
	return Boolean(
		playerObj &&
			playerObj.exists() &&
			typeof playerObj.hp === "function" &&
			typeof playerObj.heal === "function" &&
			playerObj.hp() < playerObj.maxHP
	)
}

function updateHealthOrbCollection(
	orb: ReturnType<typeof spawnHealthOrb>,
	playerPos: Vec2,
	deltaTime: number
) {
	const collection = orb.collection
	if (!collection) return false
	collection.elapsed += deltaTime
	const progress = k.clamp(
		collection.elapsed / HEALTH_ORB_COLLECTION_DURATION,
		0,
		1
	)
	const overshootDistance = 26
	const overshootAt = 0.72
	const overshootPos = playerPos.add(
		collection.approachDir.scale(overshootDistance)
	)

	if (progress < overshootAt) {
		const pullProgress = progress / overshootAt
		const eased = pullProgress * pullProgress * pullProgress
		orb.pos = collection.startPos.add(
			overshootPos.sub(collection.startPos).scale(eased)
		)
		orb.scale = k.vec2(collection.startScale * k.lerp(1, 1.45, eased))
		orb.angle = collection.startAngle + collection.spin * 300 * eased
	} else {
		const snapProgress = (progress - overshootAt) / (1 - overshootAt)
		const eased = 1 - Math.pow(1 - snapProgress, 3)
		orb.pos = overshootPos.add(playerPos.sub(overshootPos).scale(eased))
		orb.scale = k.vec2(collection.startScale * k.lerp(1.45, 0.35, eased))
		orb.angle =
			collection.startAngle + collection.spin * k.lerp(300, 440, eased)
	}

	return progress >= 1
}

function spawnPlayerHealthPulse() {
	const pulse = playerObj.add([
		k.sprite("ship"),
		k.anchor("center"),
		k.color(...ORB_COLOR),
		k.opacity(0.65),
		k.scale(1),
		k.z(1),
		{
			elapsed: 0,
		},
	])

	pulse.onUpdate(() => {
		pulse.elapsed += k.dt()
		const progress = k.clamp(pulse.elapsed / HEALTH_PULSE_DURATION, 0, 1)
		const wave = (Math.sin(progress * Math.PI * 4) + 1) / 2
		pulse.opacity = (0.2 + wave * 0.55) * (1 - progress)
		pulse.scale = k.vec2(k.lerp(1, 1.08, wave))
		if (progress >= 1) k.destroy(pulse)
	})
}
