import type { Color, GameObj, PosComp } from "kaplay"
import { k } from "../main"

const THRUSTER_FLASH_INTERVAL = 0.035
const THRUSTER_REFERENCE_SPEED = 130
const THRUSTER_PARTICLE_BASE_RATE = 6
const THRUSTER_PARTICLE_SPEED_RATE = 2.5
const THRUSTER_PARTICLE_MAX_RATE = 16
let flashTime = -1
let flashVisible = true

// All enemy batches share one square-wave calculation per game frame.
export function getShipThrusterFlash(time: number) {
	if (time !== flashTime) {
		flashTime = time
		flashVisible = Math.floor(time / THRUSTER_FLASH_INTERVAL) % 2 === 0
	}
	return flashVisible
}

// A local-space plume follows the hull's rotation, scale, and lifetime.
export function addShipThruster(ship: GameObj<PosComp>, nozzleY: number) {
	let elapsed = 0
	let length = 0
	let particleElapsed = 0
	let plumeColor: Color = k.WHITE
	const plume = ship.add([
		k.pos(0, nozzleY),
		k.z(-2),
		k.opacity(0),
		{
			draw() {
				if (plume.opacity === 0 || length === 0) return
				// Integer-width steps keep the flame crisp instead of a smooth cone.
				const shoulder = Math.max(1, Math.round(length * 0.25))
				const body = Math.max(1, Math.round(length * 0.45))
				k.drawRect({ pos: k.vec2(-2, 0), width: 4, height: shoulder, color: plumeColor })
				k.drawRect({ pos: k.vec2(-1, shoulder), width: 2, height: body, color: plumeColor })
				k.drawRect({ pos: k.vec2(0, shoulder + body), width: 1, height: Math.max(1, length - shoulder - body), color: plumeColor })
			},
		},
	])

	const updateShared = (speed: number, visible: boolean, weight: number = 1, minimumLength: number = 0) => {
		const speedRatio = k.clamp(speed / THRUSTER_REFERENCE_SPEED, 0, 3)
		length = speed <= 4
			? minimumLength
			: Math.max(minimumLength, Math.round(k.clamp(2 + 5 * speedRatio * weight, 2, 18)))
		plume.opacity = length > 0 && visible ? 1 : 0
	}

	const consumeParticleEmission = (speed: number, delta: number) => {
		if (speed <= 4) {
			particleElapsed = 0
			return false
		}
		const speedRatio = k.clamp(speed / THRUSTER_REFERENCE_SPEED, 0, 4)
		const rate = Math.min(
			THRUSTER_PARTICLE_MAX_RATE,
			THRUSTER_PARTICLE_BASE_RATE + speedRatio * THRUSTER_PARTICLE_SPEED_RATE
		)
		const interval = 1 / rate
		particleElapsed += delta
		if (particleElapsed < interval) return false
		particleElapsed %= interval
		return true
	}

	return {
		updateShared,
		consumeParticleEmission,
		setColor(color: Color) {
			plumeColor = color
		},
		getExhaustPosition(gap: number = 4) {
			return ship.toWorld(k.vec2(0, nozzleY + length + gap))
		},
		update(speed: number, delta: number, weight: number = 1) {
			if (speed <= 4) {
				elapsed = 0
				length = 0
				particleElapsed = 0
				plume.opacity = 0
				return false
			}
			elapsed += delta
			// Square wave: opacity is always exactly zero or one, with no tween.
			updateShared(speed, Math.floor(elapsed / THRUSTER_FLASH_INTERVAL) % 2 === 0, weight)
			return consumeParticleEmission(speed, delta)
		},
	}
}
