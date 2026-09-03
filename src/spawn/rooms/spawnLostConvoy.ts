import type { Vec2 } from "kaplay"
import { checkProjectileIntersection, playerObj } from "../../game"
import { k, mainSoundVolume } from "../../main"
import { applyProjectileDamage } from "../../services/projectileService"
import { spawnThreatEncounter } from "../../services/enemyEncounterService"
import { audioService } from "../../services/audioService"
import { tags } from "../../tags"
import { timescale } from "../../comp/timescale"
import { spawnExplosionEffect } from "../spawnFlash"
import { spawnRing } from "../spawnRing"
import {
	lerpAngleBetweenPos,
	steerMoveRotateAndLean,
} from "../../shared"

interface LostConvoyProps {
	pos: Vec2
	health: number
	enemySpacing: number
	getDestination: () => Vec2 | undefined
	onComplete?: (pos: Vec2) => void
	tags?: string[]
}

export function spawnLostConvoy(props: LostConvoyProps) {
	let active = false
	let completed = false
	let waveTimer = 2.5
	const drone = k.add([
		k.pos(props.pos),
		k.sprite("room_convoy_drone"),
		k.anchor("center"),
		k.rotate(0),
		k.scale(1),
		k.color(220, 235, 255),
		k.health(props.health),
		timescale(),
		{
			speed: 105,
		},
		tags.friendly,
		tags.unit,
		tags.gameLoop,
		...(props.tags ?? []),
	])
	const label = k.add([
		k.pos(drone.pos.add(0, -24)),
		k.text("LOST CONVOY", { size: 7, font: "unscii" }),
		k.anchor("center"),
		k.color(125, 205, 255),
		tags.gameLoop,
		...(props.tags ?? []),
	])

	drone.onUpdate(() => {
		if (completed) return
		label.pos = drone.pos.add(0, -24)
		if (!active) {
			if (drone.pos.dist(playerObj.pos) >= 95) return
			active = true
			label.text = "ESCORT TO EXIT"
			spawnRing({
				pos: drone.pos,
				speed: 150,
				intensity: 0.2,
				maxRadius: 70,
				color: k.rgb(125, 205, 255),
			})
		}

		const toPlayer = playerObj.pos.sub(drone.pos)
		if (toPlayer.len() > 58) {
			const { lerp, correctedDesiredRot } = lerpAngleBetweenPos(
				drone.angle,
				drone.pos,
				playerObj.pos,
				0.08 * drone.getTimescale(),
				-90
			)
			steerMoveRotateAndLean(
				drone,
				lerp,
				drone.speed * drone.getTimescale(),
				correctedDesiredRot
			)
		}

		checkProjectileIntersection(drone.pos, 12, tags.enemy, (projectile) => {
			if (applyProjectileDamage(drone, projectile)) k.destroy(projectile)
		})

		waveTimer -= k.dt() * drone.getTimescale()
		if (waveTimer <= 0) {
			waveTimer = 6
			const spawnPos = drone.pos.add(
				k.Vec2.fromAngle(k.rand(360)).scale(190)
			)
			spawnThreatEncounter(spawnPos, props.enemySpacing)
		}

		const destination = props.getDestination()
		if (!destination || drone.pos.dist(destination) > 120) return
		completed = true
		label.text = "CONVOY SECURED"
		spawnRing({
			pos: drone.pos,
			speed: 180,
			intensity: 0.3,
			maxRadius: 90,
			color: k.rgb(100, 255, 150),
		})
		props.onComplete?.(drone.pos.clone())
		audioService.playSound("powerup1", { volume: mainSoundVolume })
		k.destroy(drone)
	})

	drone.onDeath(() => {
		if (completed) return
		spawnExplosionEffect(drone.pos, 38)
		audioService.playSound("explosion2", { volume: mainSoundVolume })
		k.destroy(drone)
	})
	drone.onDestroy(() => {
		if (label.exists()) k.destroy(label)
	})

	return drone
}
