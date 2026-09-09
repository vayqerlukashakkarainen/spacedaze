import type { Vec2 } from "kaplay"
import { playerObj } from "../game"
import { k, velocityScale } from "../main"
import { registerBatchedEntityUpdate } from "../services/entityUpdateService"
import { getEnemyNavigationDirection } from "../services/enemyNavigationService"
import {
	createEnemySpawnProfile,
	type EnemySpawnOptions,
} from "../services/threatService"
import { applyDirectionalSteeringLean, easeDirection } from "../shared"
import { tags } from "../tags"
import { getEnemyVisual } from "../visuals/enemyVisualCatalog"
import { requirePrimaryVisualSprite } from "../visuals/visualRepresentation"
import { timescale } from "../comp/timescale"
import { handleEnemyCombat, registerEnemyLifecycle } from "./newEnemyShared"
import { spawnSwarmEnemy } from "./spawnSwarm"

const SPLITTER_VISUAL = getEnemyVisual("splitter")

export function spawnSplitter(
	pos: Vec2,
	hp = 7,
	options: EnemySpawnOptions = {}
) {
	const profile = createEnemySpawnProfile(hp, 1, SPLITTER_VISUAL.worldScale, options)
	const splitter = k.add([
		k.pos(pos),
		k.sprite(requirePrimaryVisualSprite(SPLITTER_VISUAL)),
		k.color(k.WHITE),
		k.rotate(0),
		k.anchor("center"),
		k.health(profile.hp),
		k.animate(),
		k.scale(profile.scale),
		timescale(),
		...(options.persistOffscreen ? [] : [k.offscreen({ destroy: true })]),
		{
			hb: 15 * profile.scale,
			damage: profile.damage,
			moveDirection: k.vec2(0, 1),
			orbitDirection: k.chance(0.5) ? 1 : -1,
		},
		tags.enemy,
		tags.unit,
		tags.enemyRolePressure,
		...(profile.elite ? [tags.elite] : []),
		tags.gameLoop,
		...(options.tags ?? []),
	])

	registerEnemyLifecycle(splitter, profile, 7, 1.45, () => {
		const fragmentCount = profile.elite ? 5 : 3
		for (let index = 0; index < fragmentCount; index++) {
			const direction = k.Vec2.fromAngle((360 / fragmentCount) * index + k.rand(-14, 14))
			spawnSwarmEnemy(
				splitter.pos.add(direction.scale(12)),
				1,
				{
					persistOffscreen: options.persistOffscreen,
					disableThreatScaling: true,
					tags: options.tags,
				}
			)
		}
	})
	registerBatchedEntityUpdate("enemies", splitter, () => {
		const delta = k.dt() * splitter.getTimescale()
		const toPlayer = playerObj.pos.sub(splitter.pos)
		const distance = toPlayer.len()
		const direction = distance > 0 ? toPlayer.unit() : k.vec2(0, 1)
		const weave = direction.normal().scale(
			Math.sin(k.time() * 1.9 + splitter.id) * 0.42 * splitter.orbitDirection
		)
		const desired = getEnemyNavigationDirection(
			splitter,
			direction.add(weave).unit(),
			playerObj.pos
		)
		splitter.moveDirection = easeDirection(
			splitter.moveDirection,
			desired,
			3.2,
			delta
		)
		splitter.move(splitter.moveDirection.scale(
			67 * profile.speedMultiplier * velocityScale() * splitter.getTimescale()
		))
		splitter.angle = splitter.moveDirection.angle() + 90
		applyDirectionalSteeringLean(
			splitter,
			splitter.moveDirection,
			desired,
			profile.scale
		)
		handleEnemyCombat(splitter, "SPLITTER", "enemy_splitter")
	})

	return splitter
}
