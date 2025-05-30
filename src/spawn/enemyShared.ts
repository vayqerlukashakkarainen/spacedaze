import { GameObj, Vec2 } from "kaplay";
import { createExplosion } from "../game";
import { k } from "../main";
import { debreeRocketEmitter, starsEmitter } from "../particles";
import { player } from "../player";
import { getDmg } from "../projectiles/shared";
import { tags } from "../tags";
import { spawnDebree } from "./spawnDebree";
import { trySpawnRandomizedPowerup } from "../powerups";

export function onEnemyHit(m: GameObj, p: GameObj) {
	if (p.tags.includes(tags.blaster)) {
		const dmg = getDmg(player.critChance, p.dmg, player.critMultiplier, p.pos);
		m.hurt(dmg);
	} else if (p.tags.includes(tags.rocket)) {
		const dmg = getDmg(
			player.critChance,
			p.impactDmg,
			player.critMultiplier,
			m.pos
		);
		m.hurt(dmg);
		createExplosion(
			p.pos,
			p.splashSize,
			p.splashDmg,
			p.splashDmgFallof,
			p.splashDmgFallofDist
		);
		k.shake(3);
		debreeRocketEmitter.emitter.position = m.pos;
		debreeRocketEmitter.emitter.direction = p.angle - 90;
		debreeRocketEmitter.emit(6);
	}
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
