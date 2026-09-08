import { GameObj, Vec2 } from "kaplay";
import { k } from "../main";
import { starsEmitter } from "../particles";
import { spawnDebree } from "./spawnDebree";
import {
	applyProjectileDamage,
	spawnProjectile,
} from "../services/projectileService";
import {
	RewardSource,
	rollDropReward,
} from "../services/rewardService";
import { spawnRewardPickup } from "./spawnPowerup";
import { getForgeDropMultiplier } from "../services/hubProgressService";
import {
	recordRunKill,
	runStatsActive,
} from "../services/runStatsService";
import { trySpawnHealthOrb } from "./spawnHealthOrb";
import { trySpawnHackedAlly } from "./spawnHackedAlly";
import { tags } from "../tags";
import { spawnEnemyDeathEffect } from "./spawnEnemyDeathEffect";
import type { EnemyDeathTier } from "./spawnEnemyDeathEffect";
import { grantUltimateCharge } from "../services/ultimateAbilityService";
import { player } from "../player";
import { triggerWreckHarvesterFeedback } from "../services/passiveUpgradeRuntimeService";
import { addRunLevelXp } from "../services/runLevelService";

interface EnemyDeathVisualOptions {
	intensity?: number;
	starCount?: number;
	tier?: EnemyDeathTier;
	particleScale?: number;
}

export function onEnemyHit(m: GameObj, p: GameObj) {
	// Use new projectile damage system
	const shouldDestroy = applyProjectileDamage(m, p);

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
	allowHack: boolean = true,
	visuals: EnemyDeathVisualOptions = {}
) {
	if (runStatsActive()) recordRunKill();
	grantUltimateCharge(
		rewardSource === "boss"
			? 40
			: Math.min(14, 5 + Math.sqrt(Math.max(1, powerupMultiplier)) * 2)
	);
	spawnEnemyDeathEffect(
		pos,
		visuals.intensity ?? Math.sqrt(Math.max(1, powerupMultiplier)),
		rewardSource === "boss" ? "boss" : visuals.tier ?? "normal",
		{ particleScale: visuals.particleScale }
	);
	for (const follower of k.get(tags.follower) as GameObj[]) {
		if (!follower.exists() || follower.droneType !== "medic") continue;
		follower.medicKillCharge = Math.min(
			8,
			(follower.medicKillCharge ?? 0) + 1
		);
	}
	starsEmitter.emitter.position = pos;
	starsEmitter.emit(visuals.starCount ?? 20);
	const reactorRewardMultiplier = 1 + player.threatReactorStacks * 0.25;
	if (score > 0) addRunLevelXp(Math.max(1, Math.round(score)));
	spawnDebree(pos, score * reactorRewardMultiplier);
	const dropMultiplier =
		powerupMultiplier * getForgeDropMultiplier();
	trySpawnHealthOrb(pos, dropMultiplier);
	const reward = rollDropReward(
		rewardSource,
		dropMultiplier
	);
	if (reward) {
		spawnRewardPickup(pos, reward, {
			telemetrySource: rewardSource === "boss" ? "boss-drop" : "enemy-drop",
		});
	}
	if (allowHack) trySpawnHackedAlly(pos);
	spawnWreckHarvesterShards(pos);
}

function spawnWreckHarvesterShards(pos: Vec2) {
	if (player.wreckHarvesterDamage <= 0) return;
	triggerWreckHarvesterFeedback(pos);
	for (const angle of [-25, 25]) {
		const direction = k.Vec2.fromAngle(angle - 90);
		spawnProjectile({
			pos: pos.clone(),
			dir: direction,
			rotation: angle,
			sprite: "particle3",
			tint: k.rgb(100, 200, 255),
			effectTint: k.rgb(100, 200, 255),
			visualScale: 0.65,
			speed: 105,
			tags: [tags.friendly, tags.blaster],
			impact: { damage: player.wreckHarvesterDamage },
			seek: {
				enabled: true,
				acquireDelay: 0.05,
				seekDistance: 320,
				turnSpeed: 320,
				targetTags: [tags.enemy],
			},
			lifespan: { duration: 2.8 },
		});
	}
}
