import type { GameObj } from "kaplay"
import { k, layers } from "../../main"
import { updatePlayerHealthBar } from "../../ui/gameUi"
import { registerBatchedEntityUpdate } from "../core/entityUpdateService"
import { recordTelemetryHealing } from "../runs/runTelemetryService"
import { spawnHealingNumber } from "../../spawn/spawnDamageNumber"

const HEALTH_COLOR = [70, 255, 120] as const
const HEALTH_PULSE_DURATION = 0.6

export function recoverPlayerHealth(target: GameObj, amount: number) {
	if (
		!target.exists() ||
		!Number.isFinite(amount) ||
		amount <= 0 ||
		typeof target.hp !== "number" ||
		typeof target.maxHP !== "number"
	) return 0

	const previousHealth = target.hp
	target.hp = Math.min(target.maxHP, target.hp + amount)
	const recovered = target.hp - previousHealth
	if (recovered <= 0) return 0

	updatePlayerHealthBar(target.hp)
	recordTelemetryHealing(recovered)
	spawnHealingNumber(target.pos.clone(), recovered)
	spawnPlayerHealthPulse(target)
	return recovered
}

function spawnPlayerHealthPulse(target: GameObj) {
	const hull = target.playerHullVisual as GameObj | undefined
	const visual = hull?.exists() ? hull : target
	if (typeof visual.sprite !== "string") return

	const pulse = k.add([
		k.pos(target.pos),
		k.sprite(visual.sprite),
		k.anchor("center"),
		k.rotate((target.angle ?? 0) + (visual.angle ?? 0)),
		k.color(...HEALTH_COLOR),
		k.opacity(0.65),
		k.scale(1),
		k.layer(layers.gameEffects),
		k.z(20),
		{
			elapsed: 0,
		},
	])

	registerBatchedEntityUpdate("effects", pulse, () => {
		if (!visual.exists()) {
			k.destroy(pulse)
			return
		}
		if (typeof visual.sprite === "string" && pulse.sprite !== visual.sprite) {
			pulse.use(k.sprite(visual.sprite))
		}
		pulse.pos = target.pos
		pulse.angle = (target.angle ?? 0) + (visual.angle ?? 0)
		pulse.elapsed += k.dt()
		const progress = k.clamp(pulse.elapsed / HEALTH_PULSE_DURATION, 0, 1)
		const wave = (Math.sin(progress * Math.PI * 4) + 1) / 2
		pulse.opacity = (0.22 + wave * 0.58) * (1 - progress)
		const pulseScale = k.lerp(1, 1.08, wave)
		pulse.scale = k.vec2(
			(target.scale?.x ?? 1) * (visual.scale?.x ?? 1) * pulseScale,
			(target.scale?.y ?? 1) * (visual.scale?.y ?? 1) * pulseScale
		)
		if (progress >= 1) k.destroy(pulse)
	})
}
