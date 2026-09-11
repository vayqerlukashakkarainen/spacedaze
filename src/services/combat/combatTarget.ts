import type { GameObj, PosComp, Vec2 } from "kaplay"
import type {
	SlowModifier,
	VolatileModifier,
} from "../../projectiles/projectileConfig"

interface DamageTickRuntimeEffect {
	volatile?: VolatileModifier
}

interface SlowRuntimeEffect {
	stasisBurst?: SlowModifier["stasisBurst"]
}

// Status effects and detachable-part impact data are attached lazily. Keeping
// them in one optional runtime contract lets ordinary enemies and ship parts
// share the same combat systems without claiming every target has every state.
export interface CombatTargetRuntimeState {
	hp?: number
	timescaleModifiers?: Map<number, number>
	getTimescale?: () => number
	paintTargetVisual?: GameObj
	gravityTargetVisual?: GameObj
	projectilePaintStacks?: number
	projectilePaintRemaining?: number
	hasProjectilePaintUpdate?: boolean
	detachImpactDirection?: Vec2
	detachImpactPosition?: Vec2
	damageTickEffect?: DamageTickRuntimeEffect | null
	slowEffect?: SlowRuntimeEffect | null
}

export type PositionedCombatTarget = GameObj<PosComp> &
	CombatTargetRuntimeState

export type DamageableCombatTarget = GameObj<PosComp> &
	CombatTargetRuntimeState & {
		hp: number
		maxHP?: number
	}
