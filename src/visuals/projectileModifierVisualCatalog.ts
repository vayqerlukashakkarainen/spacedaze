import type {
	ProjectileConfig,
	ProjectileModifierVisualKey,
} from "../projectiles/projectileConfig"

interface ProjectileModifierVisualRule {
	id: string
	color: readonly [number, number, number]
	modifiers: readonly ProjectileModifierVisualKey[]
}

// Highest matching rule wins. Disruptive effects sit above movement modifiers
// so a stacked projectile communicates its most important behavior.
export const PROJECTILE_MODIFIER_VISUAL_RULES = [
	{
		id: "electrical-control",
		color: [70, 220, 255],
		modifiers: ["emp", "stun", "chain"],
	},
	{
		id: "explosive",
		color: [255, 145, 45],
		modifiers: ["volatile", "mine", "proximity", "splash"],
	},
	{
		id: "gravity",
		color: [185, 105, 255],
		modifiers: ["gravity"],
	},
	{
		id: "sustain",
		color: [100, 235, 145],
		modifiers: ["lifesteal", "damageTick", "paint"],
	},
	{
		id: "replication",
		color: [255, 105, 205],
		modifiers: [
			"split",
			"fragment",
			"criticalShatter",
			"echo",
			"duplicate",
		],
	},
	{
		id: "kinetic",
		color: [255, 215, 80],
		modifiers: [
			"piercing",
			"bounce",
			"knockback",
			"growth",
			"execution",
			"hitCombo",
		],
	},
	{
		id: "guidance",
		color: [115, 175, 255],
		modifiers: [
			"seek",
			"returning",
			"slow",
			"accelerate",
			"curve",
			"wiggle",
			"spiral",
			"spin",
		],
	},
] as const satisfies readonly ProjectileModifierVisualRule[]

export function resolveProjectileModifierColors(config: ProjectileConfig) {
	const loadedModifiers = new Set(config.loadedModifierVisuals ?? [])
	return PROJECTILE_MODIFIER_VISUAL_RULES
		.filter((rule) =>
			rule.modifiers.some((modifier) => loadedModifiers.has(modifier))
		)
		.map((rule) => rule.color)
}

export function resolveProjectileModifierColor(config: ProjectileConfig) {
	return resolveProjectileModifierColors(config)[0]
}
