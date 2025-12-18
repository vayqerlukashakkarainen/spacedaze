import { GameObj, Vec2 } from "kaplay";
import { k } from "../main";
import { debreeRocketEmitter, starsEmitter } from "../particles";
import { tags } from "../tags";
import { spawnDebree } from "./spawnDebree";
import { trySpawnRandomizedPowerup } from "../powerups";
import { applyProjectileDamage } from "../services/projectileService";

export function onEnemyHit(m: GameObj, p: GameObj) {
	// Use new projectile damage system
	const shouldDestroy = applyProjectileDamage(m, p);

	// Shake on splash damage
	if (p.splashDamage !== undefined) {
		k.shake(3);
	}

	return shouldDestroy;
}

export function enemyOnDeath(
	pos: Vec2,
	score: number,
	powerupMultiplier: number
) {
	starsEmitter.emitter.position = pos;
	starsEmitter.emit(20);
	spawnDebree(pos, score);
	trySpawnRandomizedPowerup(pos, powerupMultiplier);
}
