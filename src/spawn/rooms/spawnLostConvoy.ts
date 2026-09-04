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
import { registerBatchedEntityUpdate } from "../../services/entityUpdateService"

interface LostConvoyProps {
	pos: Vec2
	health: number
	enemySpacing: number
	enemyWaveMultiplier?: number
	getDestination: () => Vec2 | undefined
	onComplete?: (pos: Vec2) => void
	tags?: string[]
}

const DELIVERY_COMPLETION_RADIUS = 400

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
	registerBatchedEntityUpdate("world", drone, () => {
		if (completed) return
		if (!active) {
			if (drone.pos.dist(playerObj.pos) >= 95) return
			active = true
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
			const encounterCount = Math.max(1, Math.round(props.enemyWaveMultiplier ?? 1))
			const baseAngle = k.rand(360)
			for (let index = 0; index < encounterCount; index++) {
				const spawnPos = drone.pos.add(
					k.Vec2.fromAngle(baseAngle + index * (360 / encounterCount)).scale(190)
				)
				spawnThreatEncounter(spawnPos, props.enemySpacing)
			}
		}

		const destination = props.getDestination()
		if (
			!destination ||
			drone.pos.dist(destination) > DELIVERY_COMPLETION_RADIUS
		) return
		completed = true
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
	return drone
}
