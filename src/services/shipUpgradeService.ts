import type { GameObj } from "kaplay"
import { addScore, k } from "../main"
import { starsEmitter } from "../particles"
import { player, session } from "../player"
import { spawnFlash } from "../spawn/spawnFlash"
import { spawnRing } from "../spawn/spawnRing"
import { tags } from "../tags"

const VOLATILE_CARGO_REWARD = 40

export function tryBlockPlayerDamage(target: GameObj, damage: number) {
	if (!target.tags.includes(tags.player)) return false

	if (player.scrapArmor !== undefined && session.scrapArmorCharges > 0) {
		session.scrapArmorCharges--
		spawnDefensePulse(target, k.rgb(90, 210, 255))
		return true
	}

	if (
		player.sacrificialProtocol !== undefined &&
		typeof target.hp === "function" &&
		damage >= target.hp()
	) {
		const drone = findClosestCombatDrone(target)
		if (drone) {
			spawnSacrificeLink(drone, target)
			drone.hurt(drone.hp())
			return true
		}
	}

	if (session.volatileCargoActive && session.volatileCargoIntact) {
		session.volatileCargoIntact = false
		spawnDefensePulse(target, k.rgb(255, 130, 35))
	}

	return false
}

export function extractVolatileCargo() {
	if (
		!session.volatileCargoActive ||
		!session.volatileCargoIntact ||
		session.volatileCargoDelivered
	) return 0

	session.volatileCargoDelivered = true
	const reward = player.salvageSetBonus
		? Math.round(VOLATILE_CARGO_REWARD * 1.5)
		: VOLATILE_CARGO_REWARD
	addScore(reward)
	starsEmitter.emitter.position = k.getCamPos()
	starsEmitter.emit(40)
	return reward
}

export function collectVolatileCargo() {
	if (session.volatileCargoActive) return false
	session.volatileCargoActive = true
	session.volatileCargoIntact = true
	session.volatileCargoDelivered = false
	return true
}

function findClosestCombatDrone(target: GameObj) {
	return (k.get(tags.follower) as GameObj[])
		.filter(
			(drone) =>
				drone.exists() &&
				typeof drone.hp === "function" &&
				drone.hp() > 0
		)
		.sort((a, b) => a.pos.dist(target.pos) - b.pos.dist(target.pos))[0]
}

function spawnDefensePulse(target: GameObj, color: ReturnType<typeof k.rgb>) {
	spawnFlash(target.pos.clone(), 12, color)
	spawnRing({
		pos: target.pos.clone(),
		speed: 260,
		intensity: 0.35,
		maxRadius: 46,
		color,
	})
}

function spawnSacrificeLink(drone: GameObj, target: GameObj) {
	const start = drone.pos.clone()
	const delta = target.pos.sub(start)
	const color = k.rgb(90, 210, 255)
	k.add([
		k.pos(start),
		k.opacity(1),
		k.lifespan(0.22, { fade: 0.16 }),
		{
			draw() {
				k.drawLine({
					p1: k.vec2(),
					p2: delta,
					width: 3,
					color,
					opacity: this.opacity,
				})
			},
		},
		tags.gameLoop,
	])
	spawnDefensePulse(target, color)
}
