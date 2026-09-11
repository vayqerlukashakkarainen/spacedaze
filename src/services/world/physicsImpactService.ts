import { tags } from "../../tags"

const MIN_DAMAGE_IMPACT_SPEED = 90
const COLLISION_RESTITUTION = 0.22
const IMPULSE_PER_DAMAGE = 24

export interface PhysicsImpactResult {
	relativeSpeed: number
	impulse: number
	damage: number
}

interface PhysicsImpactTarget {
	tags: readonly string[]
	hp?: unknown
	maxHP?: unknown
}

export function resolvePhysicsImpactDamage(
	target: PhysicsImpactTarget,
	damage: number
) {
	if (!target.tags.includes(tags.roomVolatile)) return damage
	const explosiveHealth = typeof target.maxHP === "number"
		? target.maxHP
		: typeof target.hp === "number"
			? target.hp
			: 0
	return Math.max(damage, explosiveHealth)
}

export function calculatePhysicsImpact(
	relativeSpeed: number,
	firstMass: number,
	secondMass: number = Infinity
): PhysicsImpactResult {
	const speed = Math.max(0, relativeSpeed)
	if (speed < MIN_DAMAGE_IMPACT_SPEED) {
		return { relativeSpeed: speed, impulse: 0, damage: 0 }
	}
	const massA = Math.max(0.1, firstMass)
	const massB = Number.isFinite(secondMass)
		? Math.max(0.1, secondMass)
		: Infinity
	const inverseMassB = Number.isFinite(massB) ? 1 / massB : 0
	const reducedMass = 1 / (1 / massA + inverseMassB)
	const impulse = speed * reducedMass * (1 + COLLISION_RESTITUTION)
	return {
		relativeSpeed: speed,
		impulse,
		damage: Math.max(1, Math.round(impulse / IMPULSE_PER_DAMAGE)),
	}
}
