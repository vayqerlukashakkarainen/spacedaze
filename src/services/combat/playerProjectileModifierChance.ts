export const PLAYER_PROJECTILE_MODIFIER_UPGRADE_KEYS = [
	"armorPiercing",
	"ricochetRounds",
	"cryoRounds",
	"stunRounds",
	"empRounds",
	"corrosivePayload",
	"arcCapacitor",
	"lifesteal",
	"splitChamber",
	"singularityPayload",
	"fragmentationCore",
	"hunterGuidance",
	"proximityFuse",
	"afterimageRounds",
	"growingCharge",
	"stasisBurst",
	"volatileCorrosion",
	"criticalShatter",
	"executionRounds",
	"targetPainter",
	"mineLayer",
	"voidLance",
] as const

export type PlayerProjectileModifierUpgradeKey =
	(typeof PLAYER_PROJECTILE_MODIFIER_UPGRADE_KEYS)[number]

export const FIVE_LEVEL_PROJECTILE_MODIFIER_CHANCES = [
	0.12,
	0.18,
	0.24,
	0.3,
	0.36,
] as const

export const THREE_LEVEL_PROJECTILE_MODIFIER_CHANCES = [
	0.18,
	0.28,
	0.38,
] as const

const loadedModifierChances: Partial<
	Record<PlayerProjectileModifierUpgradeKey, number>
> = {}
let loadedModifierChanceBonus = 0

export function setPlayerProjectileModifierChance(
	key: PlayerProjectileModifierUpgradeKey,
	chance: number
) {
	loadedModifierChances[key] = clampChance(chance)
}

export function rollPlayerProjectileModifier(
	key: PlayerProjectileModifierUpgradeKey,
	random: () => number = Math.random
) {
	const chance = getEffectivePlayerProjectileModifierChance(key)
	return chance > 0 && random() < chance
}

export function getPlayerProjectileModifierChance(
	key: PlayerProjectileModifierUpgradeKey
) {
	return loadedModifierChances[key] ?? 0
}

export function setPlayerProjectileModifierChanceBonus(chance: number) {
	loadedModifierChanceBonus = clampChance(chance)
}

export function getPlayerProjectileModifierChanceBonus() {
	return loadedModifierChanceBonus
}

export function getEffectivePlayerProjectileModifierChance(
	key: PlayerProjectileModifierUpgradeKey
) {
	return clampChance(
		getPlayerProjectileModifierChance(key) + loadedModifierChanceBonus
	)
}

function clampChance(chance: number) {
	return Math.max(0, Math.min(1, chance))
}
