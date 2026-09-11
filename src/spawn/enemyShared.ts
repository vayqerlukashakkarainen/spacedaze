import { GameObj, Vec2 } from "kaplay";
import { k, subSoundVolume } from "../main";
import { starsEmitter } from "../particles";
import { spawnDebree } from "./spawnDebree";
import {
	applyProjectileDamage,
	spawnProjectile,
} from "../services/combat/projectileService";
import {
	RewardSource,
	rollDropReward,
} from "../services/economy/rewardService";
import { spawnRewardPickup } from "./spawnPowerup";
import { getForgeDropMultiplier } from "../services/hub/hubProgressService";
import {
	recordRunKill,
	runStatsActive,
} from "../services/runs/runStatsService";
import { trySpawnHealthOrb } from "./spawnHealthOrb";
import { trySpawnHackedAlly } from "./spawnHackedAlly";
import { tags } from "../tags";
import { spawnEnemyDeathEffect } from "./spawnEnemyDeathEffect";
import type { EnemyDeathTier } from "./spawnEnemyDeathEffect";
import { grantUltimateCharge } from "../services/abilities/ultimateAbilityService";
import { player } from "../player";
import { triggerWreckHarvesterFeedback } from "../services/abilities/passiveUpgradeRuntimeService";
import { addRunLevelXp } from "../services/runs/runLevelService";
import { gameSoundService } from "../services/audio/gameSoundService";
import { spawnRockDestructionFragments } from "../services/combat/rockDestructionEffectService";
import { spawnEnemyDeathWreckage } from "../services/combat/persistentShipPartService";
import { getLastCombatCredit } from "../services/combat/damageService"
import { getPrimaryWeaponDamage } from "../services/player/playerCombatScalingService"
import type { DamageableCombatTarget } from "../services/combat/combatTarget"

export type EnemyDeathMaterial = "ship" | "rock"

interface EnemyDeathVisualOptions {
	intensity?: number;
	starCount?: number;
	tier?: EnemyDeathTier;
	particleScale?: number;
	material?: EnemyDeathMaterial;
}

export function onEnemyHit(m: DamageableCombatTarget, p: GameObj) {
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
	visuals: EnemyDeathVisualOptions = {},
	defeatedEnemy?: GameObj
) {
	if (runStatsActive()) {
		recordRunKill(
			defeatedEnemy ? getLastCombatCredit(defeatedEnemy) : undefined
		);
	}
	grantUltimateCharge(
		rewardSource === "boss"
			? 40
			: Math.min(14, 5 + Math.sqrt(Math.max(1, powerupMultiplier)) * 2),
		pos
	);
	spawnEnemyDeathEffect(
		pos,
		visuals.intensity ?? Math.sqrt(Math.max(1, powerupMultiplier)),
		rewardSource === "boss" ? "boss" : visuals.tier ?? "normal",
		{ particleScale: visuals.particleScale }
	);
	if (visuals.material) {
		gameSoundService.playPositional(
			visuals.material === "ship"
				? "enemy_ship_destroyed"
				: "rock_material_destroyed",
			pos,
			{ volume: subSoundVolume }
		)
		if (visuals.material === "rock") {
			spawnRockDestructionFragments(
				pos,
				visuals.intensity ?? Math.sqrt(Math.max(1, powerupMultiplier))
			)
		}
		if (visuals.material === "ship") {
			spawnEnemyDeathWreckage(pos)
		}
	}
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
	spawnDebree(pos, score * reactorRewardMultiplier, { source: "enemy" });
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
	if (player.wreckHarvesterDamageRatio <= 0) return;
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
			impact: {
				damage: getPrimaryWeaponDamage() * player.wreckHarvesterDamageRatio,
			},
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
