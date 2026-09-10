import type { GameObj, PosComp, Vec2 } from "kaplay"
import { k, layers } from "../../main"
import { tags } from "../../tags"
import { drawLightning } from "../combat/lightningVisualService"
import {
	getTargetOwner,
	getTargetPartWorldPositions,
	getTargetHitRadius,
	getTargetWorldPosition,
} from "../combat/targetingService"
import { registerBatchedEntityUpdate } from "../core/entityUpdateService"

interface EnemyEmpState {
	expiresAt: number
	effect: GameObj
	ownerId: number
	timescale: number
}

const EMP_TIMESCALE_MODIFIER_ID = 87021
const DEFAULT_EMP_TIMESCALE = 0.05
const EMP_COLOR = { red: 75, green: 205, blue: 255 }
const activeEmpStates = new Map<number, EnemyEmpState>()

export function applyEnemyEmpDisruption(
	enemy: GameObj<PosComp>,
	duration: number,
	timescale = DEFAULT_EMP_TIMESCALE
) {
	const expiresAt = k.time() + Math.max(0, duration)
	const clampedTimescale = k.clamp(timescale, 0.05, 1)
	const current = activeEmpStates.get(enemy.id)
	if (current) {
		current.expiresAt = Math.max(current.expiresAt, expiresAt)
		current.timescale = Math.min(current.timescale, clampedTimescale)
		if (enemy.timescaleModifiers instanceof Map) {
			enemy.timescaleModifiers.set(EMP_TIMESCALE_MODIFIER_ID, current.timescale)
		}
		return
	}

	if (enemy.timescaleModifiers instanceof Map) {
		enemy.timescaleModifiers.set(EMP_TIMESCALE_MODIFIER_ID, clampedTimescale)
	}
	const effect = spawnEnemyEmpEffect(enemy)
	const state = {
		expiresAt,
		effect,
		ownerId: getTargetOwner(enemy).id,
		timescale: clampedTimescale,
	}
	activeEmpStates.set(enemy.id, state)
	enemy.onDestroy(() => clearEnemyEmpDisruption(enemy, state))
}

export function isEnemyEmpDisrupted(enemy: GameObj | undefined) {
	if (!enemy) return false
	const now = k.time()
	const directState = activeEmpStates.get(enemy.id)
	if (directState && directState.expiresAt > now) return true
	for (const state of activeEmpStates.values()) {
		if (state.ownerId === enemy.id && state.expiresAt > now) return true
	}
	return false
}

function spawnEnemyEmpEffect(enemy: GameObj<PosComp>) {
	const seed = k.rand(0, 1000)
	const effect = k.add([
		k.pos(getTargetWorldPosition(enemy)),
		k.layer(layers.gameEffects),
		{
			draw() {
				if (!enemy.exists() || enemy.hidden) return
				const localParts = getTargetPartWorldPositions(enemy)
					.map((position) => position.sub(this.pos))
				const pulseFrame = Math.floor(k.time() * 10 + seed)
				if (pulseFrame % 3 === 1) return
				const opacity = pulseFrame % 3 === 0 ? 0.95 : 0.55
				if (localParts.length >= 2) {
					drawPartConnections(localParts, seed, opacity)
					return
				}
				if (localParts.length === 1) {
					drawEmpArc(k.vec2(), localParts[0], seed, opacity)
					return
				}
				const radius = Math.max(6, getTargetHitRadius(enemy) * 0.68)
				const angle = pulseFrame * 47 + seed
				drawEmpArc(
					k.Vec2.fromAngle(angle).scale(radius),
					k.Vec2.fromAngle(angle + 180).scale(radius),
					seed,
					opacity
				)
			},
		},
		tags.gameLoop,
	])

	registerBatchedEntityUpdate("effects", effect, () => {
		const state = activeEmpStates.get(enemy.id)
		if (!enemy.exists() || !state || state.effect.id !== effect.id) {
			if (effect.exists()) k.destroy(effect)
			return
		}
		if (enemy.hidden || (typeof enemy.hp === "number" && enemy.hp <= 0)) {
			clearEnemyEmpDisruption(enemy, state)
			return
		}
		if (k.time() >= state.expiresAt) {
			clearEnemyEmpDisruption(enemy, state)
			return
		}
		effect.pos = getTargetWorldPosition(enemy)
	})
	return effect
}

function drawPartConnections(parts: Vec2[], seed: number, opacity: number) {
	for (let index = 0; index < parts.length - 1; index++) {
		drawEmpArc(parts[index], parts[index + 1], seed + index * 19.7, opacity)
	}
	if (parts.length > 2) {
		drawEmpArc(parts[parts.length - 1], parts[0], seed + 91.3, opacity * 0.72)
	}
}

function drawEmpArc(start: Vec2, end: Vec2, seed: number, opacity: number) {
	drawLightning({
		start,
		end,
		color: k.rgb(EMP_COLOR.red, EMP_COLOR.green, EMP_COLOR.blue),
		branchColor: k.WHITE,
		opacity,
		width: 1.25,
		segmentLength: 5,
		amplitude: 5,
		waveCount: 2.4,
		smoothness: 0.08,
		flickerRate: 28,
		seed,
		branchChance: 0.18,
		branchLength: 5,
	})
}

function clearEnemyEmpDisruption(
	enemy: GameObj,
	state: EnemyEmpState
) {
	if (activeEmpStates.get(enemy.id) !== state) return
	activeEmpStates.delete(enemy.id)
	if (enemy.timescaleModifiers instanceof Map) {
		enemy.timescaleModifiers.delete(EMP_TIMESCALE_MODIFIER_ID)
	}
	if (state.effect.exists()) k.destroy(state.effect)
}
