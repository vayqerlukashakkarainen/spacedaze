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
import { trySpawnHackedAlly } from "./spawnHackedAlly";
import { tags } from "../tags";

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
	rewardSource: Exclude<RewardSource, "crate"> = "enemy",
	allowHack: boolean = true
) {
	if (runStatsActive()) recordRunKill();
	for (const follower of k.get(tags.follower) as GameObj[]) {
		if (!follower.exists() || follower.droneType !== "medic") continue;
		follower.medicKillCharge = Math.min(
			8,
			(follower.medicKillCharge ?? 0) + 1
		);
	}
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
	if (allowHack) trySpawnHackedAlly(pos);
}
