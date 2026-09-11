import type { Color, GameObj } from "kaplay"
import { k } from "../../main"

export type CombatStatusTint = "chilled" | "damageOverTime" | "stunned"

interface CombatStatusTintState {
	hadColor: boolean
	baseColor: Color
	chilled: boolean
	damageOverTime: boolean
	stunned: boolean
}

const CHILLED_TINT = [125, 205, 255] as const
const DAMAGE_OVER_TIME_TINT = [100, 235, 125] as const
const STUN_TINT = [255, 220, 75] as const

export function setCombatStatusTint(
	target: GameObj,
	status: CombatStatusTint,
	active: boolean
) {
	let state = target.combatStatusTintState as CombatStatusTintState | undefined
	if (!state && !active) return
	if (!state) {
		const transientBaseColor = target.partDamageFlashBaseColor ??
			target.combatHitBaseColor
		state = {
			hadColor: target.has("color"),
			baseColor: transientBaseColor
				? k.rgb(
					transientBaseColor.r,
					transientBaseColor.g,
					transientBaseColor.b
				)
				: target.color
					? k.rgb(target.color.r, target.color.g, target.color.b)
					: k.WHITE,
			chilled: false,
			damageOverTime: false,
			stunned: false,
		}
		target.combatStatusTintState = state
	}

	state[status] = active
	const tint = getCombatStatusTintColor(target)
	if (tint) {
		if (!target.has("color")) target.use(k.color(k.WHITE))
		target.color = tint
		return
	}

	if (state.hadColor) target.color = state.baseColor
	else if (target.has("color")) target.unuse("color")
	delete target.combatStatusTintState
}

export function refreshCombatStatusTint(target: GameObj) {
	const tint = getCombatStatusTintColor(target)
	if (!tint) return
	if (!target.has("color")) target.use(k.color(k.WHITE))
	target.color = tint
}

export function getCombatStatusTintColor(target: GameObj) {
	const state = target.combatStatusTintState as CombatStatusTintState | undefined
	if (!state) return undefined
	if (state.stunned) {
		return Math.floor(k.time() * 14) % 2 === 0
			? k.WHITE
			: k.rgb(...STUN_TINT)
	}
	if (state.damageOverTime) return k.rgb(...DAMAGE_OVER_TIME_TINT)
	if (state.chilled) return k.rgb(...CHILLED_TINT)
	return undefined
}

export function getCombatStatusBaseColor(target: GameObj) {
	const state = target.combatStatusTintState as CombatStatusTintState | undefined
	return state?.baseColor
}
