import type { Vec2 } from "kaplay"
import { k, layers } from "../main"
import { tags } from "../tags"

const REPAIR_DRONE_COUNT = 6
const PATROL_RADIUS_X = 145
const PATROL_RADIUS_Y = 88

export interface HubRepairCrew {
	setRepairTarget(target: Vec2 | undefined): void
}

export function spawnHubRepairCrew(phaseStationPos: Vec2): HubRepairCrew {
	let repairTarget: Vec2 | undefined

	for (let index = 0; index < REPAIR_DRONE_COUNT; index++) {
		const phase = index / REPAIR_DRONE_COUNT
		const initialAngle = phase * Math.PI * 2
		const initialPos = phaseStationPos.add(
			Math.cos(initialAngle) * PATROL_RADIUS_X,
			Math.sin(initialAngle) * PATROL_RADIUS_Y
		)
		let patrolStart = initialPos.clone()
		let patrolDestination = randomPatrolPosition(phaseStationPos)
		let patrolElapsed = k.rand(0, 1.2)
		let patrolDuration = k.rand(1.8, 3.2)
		let patrolPause = 0
		let wasRepairing = false

		function beginPatrolFrom(pos: Vec2) {
			patrolStart = pos.clone()
			patrolDestination = randomPatrolPosition(phaseStationPos)
			patrolElapsed = 0
			patrolDuration = k.rand(1.8, 3.2)
		}

		k.add([
			k.pos(initialPos),
			k.sprite("drone_medic"),
			k.anchor("center"),
			k.rotate(0),
			k.color(255, 255, 255),
			k.opacity(0.92),
			k.layer(layers.game2),
			k.z(-1),
			{
				update() {
					const elapsed = k.time()
					const previousPos = this.pos.clone()
					if (repairTarget) {
						wasRepairing = true
						const repairAngle = (elapsed * 0.25 + phase) * Math.PI * 2
						const destination = repairTarget.add(
							Math.cos(repairAngle) * (42 + index % 2 * 10),
							Math.sin(repairAngle) * (30 + index % 3 * 8)
						)
						this.pos = this.pos.lerp(destination, Math.min(1, k.dt() * 2.5))
					} else {
						if (wasRepairing) {
							wasRepairing = false
							beginPatrolFrom(this.pos)
						}
						if (patrolPause > 0) {
							patrolPause = Math.max(0, patrolPause - k.dt())
						} else {
							patrolElapsed += k.dt()
							const progress = k.clamp(patrolElapsed / patrolDuration, 0, 1)
							const eased = progress < 0.5
								? 4 * progress * progress * progress
								: 1 - Math.pow(-2 * progress + 2, 3) / 2
							this.pos = patrolStart.lerp(patrolDestination, eased)
							if (progress >= 1) {
								patrolPause = k.rand(0.15, 0.7)
								beginPatrolFrom(this.pos)
							}
						}
					}
					const direction = this.pos.sub(previousPos)
					if (direction.len() > 1) {
						this.angle = Math.atan2(direction.y, direction.x) * 180 / Math.PI + 90
					}
					this.opacity = repairTarget
						? k.wave(0.76, 1, elapsed * 6 + index)
						: 0.92
				},
				draw() {
					if (!repairTarget || this.pos.dist(repairTarget) > 72) return
					k.drawLine({
						p1: k.vec2(0),
						p2: repairTarget.sub(this.pos),
						width: 1,
						color: k.rgb(240, 184, 75),
						opacity: k.wave(0.25, 0.82, k.time() * 11 + index),
					})
				},
			},
			tags.hubRepairDrone,
			tags.gameLoop,
		])

	}

	return {
		setRepairTarget(target) {
			repairTarget = target?.clone()
		},
	}
}

function randomPatrolPosition(center: Vec2) {
	const angle = k.rand(0, Math.PI * 2)
	const radius = k.rand(0.35, 1)
	return center.add(
		Math.cos(angle) * PATROL_RADIUS_X * radius,
		Math.sin(angle) * PATROL_RADIUS_Y * radius
	)
}
