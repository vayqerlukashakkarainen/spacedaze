import assert from "node:assert/strict"
import { getEnemyProgressionRoster } from "../services/enemies/enemyProgressionService"
import { COMPANION_VISUALS } from "./companionVisualCatalog"
import {
	ENEMY_VISUALS,
	getEnemyVisual,
	HUNTER_VISUALS,
} from "./enemyVisualCatalog"
import { PICKUP_VISUALS, SALVAGE_PICKUP_VISUALS } from "./pickupVisualCatalog"
import { PLAYER_DIRECTIONAL_SPRITES, PLAYER_VISUAL } from "./playerVisualCatalog"
import {
	getMinimumProjectileVisualScale,
	PROJECTILE_VISUALS,
} from "./projectileVisualCatalog"
import {
	PROJECTILE_MODIFIER_VISUAL_RULES,
	resolveProjectileModifierColor,
	resolveProjectileModifierColors,
} from "./projectileModifierVisualCatalog"
import type { ProjectileConfig } from "../projectiles/projectileConfig"
import type { VisualRepresentation } from "./visualRepresentation"
import { RUN_VILLAGE_VISUALS, WORLD_VISUALS } from "./worldVisualCatalog"

function assertValidVisual(
	name: string,
	visual: VisualRepresentation,
	requireSprite = true
) {
	assert.equal(
		Number.isFinite(visual.worldScale) && visual.worldScale > 0,
		true,
		`${name} must have a positive world scale`
	)
	if (requireSprite) {
		assert.equal(visual.parts.length > 0, true, `${name} must have a sprite`)
	}
	for (const part of visual.parts) {
		assert.equal(part.sprite.length > 0, true, `${name} has an empty sprite id`)
		assert.equal((part.scale ?? 1) > 0, true, `${name} has an invalid part scale`)
	}
}

for (const enemy of getEnemyProgressionRoster()) {
	assertValidVisual(`enemy:${enemy.id}`, getEnemyVisual(enemy.id))
}
const scaledEnemyWorldScales: Partial<Record<keyof typeof ENEMY_VISUALS, number>> = {
	"swarm-drone": 0.6,
	"wake-scrap-nipper": 0.75,
	"federation-dreadnought": 1.25,
}
for (const [id, visual] of Object.entries(ENEMY_VISUALS)) {
	assertValidVisual(`enemy:${id}`, visual, visual.parts.length > 0)
	assert.equal(
		visual.worldScale,
		scaledEnemyWorldScales[id as keyof typeof ENEMY_VISUALS] ?? 1,
		`enemy:${id} must use its canonical scale`
	)
}

for (const enemyId of [
	"wake-scrap-nipper",
	"wake-rivet-gunner",
	"wake-towhook-rig",
	"wake-patch-tender",
	"wake-scrap-raiser",
	"wake-clampback",
	"wake-fuse-rat",
	"wake-shredder-skiff",
	"wake-boiler-hulk",
	"wake-magnet-maw",
	"wake-railbreaker-rig",
	"federation-dreadnought",
] as const) {
	assert.equal(
		getEnemyVisual(enemyId).parts.length > 1,
		true,
		`enemy:${enemyId} must have destructible component art`
	)
}
for (const [id, visual] of Object.entries(HUNTER_VISUALS)) {
	assertValidVisual(`hunter:${id}`, visual)
	assert.equal(visual.worldScale, 1, `hunter:${id} must use canonical scale 1`)
}
for (const [id, visual] of Object.entries(COMPANION_VISUALS)) {
	assertValidVisual(`companion:${id}`, visual)
	assert.equal(visual.worldScale, 1, `companion:${id} must use canonical scale 1`)
}
for (const [id, visual] of Object.entries(PICKUP_VISUALS)) {
	assertValidVisual(`pickup:${id}`, visual, visual.parts.length > 0)
}
for (const [id, visual] of Object.entries(SALVAGE_PICKUP_VISUALS)) {
	assertValidVisual(`salvage:${id}`, visual)
}
for (const [id, visual] of Object.entries(WORLD_VISUALS)) {
	assertValidVisual(`world:${id}`, visual, visual.parts.length > 0)
}
for (const [index, visual] of RUN_VILLAGE_VISUALS.entries()) {
	assertValidVisual(`run-village:${index}`, visual)
}

assertValidVisual("player", PLAYER_VISUAL)
assert.equal(PLAYER_DIRECTIONAL_SPRITES.length, 8)
assert.equal(PROJECTILE_VISUALS.player.worldScale > 0, true)
assert.equal(PROJECTILE_VISUALS.enemy.worldScale > 0, true)
assert.equal(PROJECTILE_VISUALS.enemy.minimumSize, 8)
assert.equal(getMinimumProjectileVisualScale(0.65, 4, 8), 2)
assert.equal(getMinimumProjectileVisualScale(1, 12, 12), 1)
assert.equal(getMinimumProjectileVisualScale(1, 8, 16, 1, 0.2), 1.25)

const categorizedProjectileModifiers = new Set<string>()
for (const rule of PROJECTILE_MODIFIER_VISUAL_RULES) {
	assert.equal(rule.modifiers.length > 0, true, `${rule.id} must cover a modifier`)
	for (const channel of rule.color) {
		assert.equal(
			Number.isInteger(channel) && channel >= 0 && channel <= 255,
			true,
			`${rule.id} has an invalid color channel`
		)
	}
	for (const modifier of rule.modifiers) {
		assert.equal(
			categorizedProjectileModifiers.has(modifier),
			false,
			`${modifier} belongs to more than one projectile color family`
		)
		categorizedProjectileModifiers.add(modifier)
	}
}
assert.equal(
	resolveProjectileModifierColor({} as ProjectileConfig),
	undefined,
	"unmodified projectiles must remain neutral"
)
assert.equal(
	resolveProjectileModifierColor({
		splash: {},
		seek: {},
	} as ProjectileConfig),
	undefined,
	"native projectile behavior must remain neutral without loaded modifiers"
)
assert.deepEqual(
	resolveProjectileModifierColor({
		loadedModifierVisuals: ["splash", "chain"],
	} as ProjectileConfig),
	PROJECTILE_MODIFIER_VISUAL_RULES[0].color,
	"stacked projectiles must resolve to the highest-priority family"
)
assert.deepEqual(
	resolveProjectileModifierColors({
		loadedModifierVisuals: ["splash", "chain"],
	} as ProjectileConfig),
	[
		PROJECTILE_MODIFIER_VISUAL_RULES[0].color,
		PROJECTILE_MODIFIER_VISUAL_RULES[1].color,
	],
	"stacked projectiles must preserve every matching family for shader blending"
)

console.log("Visual catalog tests passed")
