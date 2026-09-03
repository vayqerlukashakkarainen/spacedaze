import { GameObj, Vec2 } from "kaplay";
import { k } from "../main";
import { starsEmitter } from "../particles";
import { spawnDebree } from "./spawnDebree";
import { applyProjectileDamage } from "../services/projectileService";
import {
	RewardSource,
	rollDropReward,
} from "../services/rewardService";
import { spawnRewardPickup } from "./spawnPowerup";
import { getSelectedContract } from "../services/contractService";
import { getForgeDropMultiplier } from "../services/hubProgressService";
import {
	recordRunKill,
	runStatsActive,
} from "../services/runStatsService";
import { trySpawnHealthOrb } from "./spawnHealthOrb";

export function onEnemyHit(m: GameObj, p: GameObj) {
	// Use new projectile damage system
	const shouldDestroy = applyProjectileDamage(m, p);

	// Shake on splash damage
	if (p.splashDamage !== undefined && !p.isDeployedMine) {
		k.shake(3);
	}

	if (shouldDestroy) {
		k.destroy(p);
	}

	return shouldDestroy;
}

export function enemyOnDeath(
	pos: Vec2,
	score: number,
	powerupMultiplier: number,
	rewardSource: Exclude<RewardSource, "crate"> = "enemy"
) {
	if (runStatsActive()) recordRunKill();
	starsEmitter.emitter.position = pos;
	starsEmitter.emit(20);
	spawnDebree(pos, score);
	const contractMultiplier = runStatsActive()
		? getSelectedContract()?.rewardDropMultiplier ?? 1
		: 1;
	const dropMultiplier =
		powerupMultiplier * contractMultiplier * getForgeDropMultiplier();
	trySpawnHealthOrb(pos, dropMultiplier);
	const reward = rollDropReward(
		rewardSource,
		dropMultiplier
	);
	if (reward) spawnRewardPickup(pos, reward);
}
