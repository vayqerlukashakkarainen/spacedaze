import type { GameObj, PosComp, Vec2 } from "kaplay"
import { checkProjectileIntersection, playerObj } from "../game"
import { k, velocityScale } from "../main"
import { starsEmitter } from "../particles"
import { player } from "../player"
import { spawnBasicBlaster } from "../services/projectileHelpers"
import { applyProjectileDamage } from "../services/projectileService"
import { tags } from "../tags"
import { target } from "../comp/target"
import { timescale } from "../comp/timescale"

const HACKED_ALLY_LIMIT = 3
const HACKED_ALLY_DURATION = 12

export function trySpawnHackedAlly(pos: Vec2) {
	if (player.enemyHacker === undefined) return false
	if (k.get(tags.hackedAlly).length >= HACKED_ALLY_LIMIT) return false
	if (!k.chance(0.12)) return false
	spawnHackedAlly(pos)
	return true
}

function spawnHackedAlly(pos: Vec2) {
	const orbitSeed = k.rand(0, 360)
	const ally = k.add([
		k.pos(pos),
		k.sprite("enemy_ship1_body"),
		k.anchor("center"),
		k.rotate(0),
		k.scale(0.85),
		k.color(80, 210, 255),
		k.opacity(1),
		k.health(4),
		target(),
		timescale(),
		{
			hb: 10,
			elapsed: 0,
			fireCooldown: k.rand(0.15, 0.6),
			targetCooldown: 0,
		},
		tags.friendly,
		tags.unit,
		tags.hackedAlly,
		tags.props,
		tags.gameLoop,
	])

	ally.onUpdate(() => {
		const deltaTime = k.dt() * ally.getTimescale()
		ally.elapsed += deltaTime
		ally.fireCooldown -= deltaTime
		ally.targetCooldown -= deltaTime

		const orbitAngle = orbitSeed + k.time() * 35
		const desiredPos = playerObj.pos.add(
			k.Vec2.fromAngle(orbitAngle).scale(58)
		)
		const travel = desiredPos.sub(ally.pos)
		if (travel.len() > 2) {
			ally.move(
				travel.unit().scale(
					Math.min(150, travel.len() * 5) * velocityScale() * ally.getTimescale()
				)
			)
		}

		if (ally.targetCooldown <= 0) {
			ally.pickTarget(ally.pos, 360, tags.enemy)
			ally.targetCooldown = 0.25
		}
		if (ally.hasTarget()) {
			ally.angle = ally.targetAngle() + 90
			if (ally.fireCooldown <= 0) {
				spawnBasicBlaster(
					ally.pos,
					k.Vec2.fromAngle(ally.targetAngle()),
					ally.targetAngle() + 90,
					player.droneSetBonus ? 3 : 2,
					1.5,
					[tags.friendly, tags.blaster],
					player.followerProjectileLink !== undefined
				)
				ally.fireCooldown = player.droneSetBonus ? 0.45 : 0.65
			}
		}

		checkProjectileIntersection(ally.pos, ally.hb, tags.enemy, (projectile) => {
			const shouldDestroy = applyProjectileDamage(ally, projectile)
			if (shouldDestroy) k.destroy(projectile)
		})

		ally.opacity = k.clamp((HACKED_ALLY_DURATION - ally.elapsed) / 1.5, 0, 1)
		if (ally.elapsed >= HACKED_ALLY_DURATION) k.destroy(ally)
	})

	ally.onDeath(() => {
		starsEmitter.emitter.position = ally.pos
		starsEmitter.emit(14)
		k.destroy(ally)
	})

	starsEmitter.emitter.position = pos
	starsEmitter.emit(22)
	return ally as GameObj<PosComp>
}
