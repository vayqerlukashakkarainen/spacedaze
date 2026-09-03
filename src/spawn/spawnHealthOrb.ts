import type { Vec2 } from "kaplay"
import { playerObj } from "../game"
import { dt, k, mainSoundVolume, velocityScale } from "../main"
import { player } from "../player"
import { audioService } from "../services/audioService"
import { tags } from "../tags"
import { updatePlayerHealthBar } from "../ui/gameUi"
import { timescale } from "../comp/timescale"

export const HEALTH_ORB_DROP_CHANCE = 0.05

const ORB_COLOR = [70, 255, 120] as const
const ORB_HIGHLIGHT = [190, 255, 205] as const

export function trySpawnHealthOrb(pos: Vec2, chanceMultiplier = 1) {
	if (!playerObj || playerObj.hp() >= playerObj.maxHP) return
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
		k.scale(1),
		timescale(),
		k.offscreen({ destroy: true }),
		{
			dir: k.rand(k.vec2(-1, -1), k.vec2(1, 1)),
			speed: k.rand(35, 55),
			lifeSpan: 0,
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
		const pulse = k.wave(0.86, 1.14, k.time() * 4)
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
		collectHealthOrb()
	})

	function collectHealthOrb() {
		if (collected || playerObj.hp() >= playerObj.maxHP) return
		collected = true
		playerObj.heal(1)
		updatePlayerHealthBar(playerObj.hp())
		audioService.playSound("powerup1", {
			volume: mainSoundVolume,
			detune: -200,
		})
		k.destroy(orb)
	}

	return orb
}
