import type { GameObj, Vec2 } from "kaplay"
import { jitter } from "../../comp/jitter"
import { timescale } from "../../comp/timescale"
import { compose, unitComponents } from "../../compose"
import { checkProjectileComponentIntersection, playerObj } from "../../game"
import { k } from "../../main"
import { applyDamage } from "../../services/combat/damageService"
import { isPlayerDamageInvulnerable } from "../../services/player/playerDamageState"
import type { EnemySpawnProfile } from "../../services/enemies/threatService"
import { tags } from "../../tags"
import { enemyOnDeath, onEnemyHit } from "../enemyShared"
import { isEnemyEmpDisrupted } from "../../services/enemies/enemyEmpService"

export interface WakeEnemyPart {
	obj: GameObj
	hitbox: number
	hitboxOffset: Vec2
	onDestroyed?: (part: GameObj, body: GameObj) => void
}

export function addWakeEnemyPart(
	parent: GameObj,
	sprite: string,
	hp: number
) {
	return parent.add([
		k.pos(0, 0),
		k.sprite(sprite),
		k.color(k.WHITE),
		k.anchor("center"),
		k.health(hp),
		k.animate(),
		k.rotate(0),
		timescale(),
		jitter(),
		tags.part,
		tags.gameLoop,
	])
}

export function composeWakeEnemy(
	body: GameObj,
	profile: EnemySpawnProfile,
	parts: WakeEnemyPart[],
	score: number,
	powerupMultiplier: number,
	onBodyDeath?: () => void,
	deferBodyDeath?: (finish: () => void) => void
) {
	const deathPos = () => body.pos.clone()
	const finishBodyDeath = (pos: Vec2) => {
		if (body.exists()) k.destroy(body)
		const reconstructed = profile.rewardMode === "reconstructed"
		enemyOnDeath(
			pos,
			reconstructed ? 0 : score * profile.rewardMultiplier,
			reconstructed ? 0 : powerupMultiplier * profile.rewardMultiplier,
			"enemy",
			!reconstructed,
			{
				tier: profile.elite ? "elite" : "normal",
				material: "ship",
			},
			body
		)
		onBodyDeath?.()
	}
	unitComponents[body.id] = compose({
		rewardMultiplier: profile.rewardMultiplier,
		skipDefaultBodyDeath: true,
		deferBodyDestruction: Boolean(deferBodyDeath),
		onBodyDeath: () => {
			const pos = deathPos()
			if (deferBodyDeath) {
				deferBodyDeath(() => finishBodyDeath(pos))
				return
			}
			finishBodyDeath(pos)
		},
		parts: [
			{ obj: body, hitbox: body.hb, isBody: true, scoreOnDestroy: 0 },
			...parts.map((part) => ({
				obj: part.obj,
				hitbox: part.hitbox,
				hitboxOffset: part.hitboxOffset,
				isBody: false,
				scoreOnDestroy: 0,
				onDestroyed: part.onDestroyed,
			})),
		],
	})
	body.onDestroy(() => {
		delete unitComponents[body.id]
	})
}

export function handleWakeCompositeCombat(
	body: GameObj,
	name: string,
	sprite: string
) {
	const components = unitComponents[body.id]
	if (components) {
		checkProjectileComponentIntersection(
			body.pos,
			body.hb + 12,
			tags.friendly,
			components,
			(projectile, index) => onEnemyHit(components[index].obj, projectile)
		)
	}
	if (
		!isEnemyEmpDisrupted(body) &&
		!isPlayerDamageInvulnerable() &&
		body.pos.dist(playerObj.pos) < body.hb + 8
	) {
		applyDamage(playerObj, body.damage, {
			position: body.pos,
			source: { name, sprite },
		})
		applyDamage(body, body.hp)
	}
}
