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
import { PROJECTILE_VISUALS } from "./projectileVisualCatalog"
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
	"wake-boiler-hulk",
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

console.log("Visual catalog tests passed")
