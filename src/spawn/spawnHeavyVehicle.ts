import { Vec2 } from "kaplay";
import { checkProjectileIntersection, playerObj } from "../game";
import { k, mainSoundVolume, velocityScale } from "../main";
import { gameSoundService } from "../services/gameSoundService"
import { tags } from "../tags";
import { registerHitAnimation } from "../shared";
import { enemyOnDeath, onEnemyHit } from "./enemyShared";
import {
	createEnemySpawnProfile,
	ENEMY_THREAT_RANK,
	type EnemySpawnOptions,
} from "../services/threatService";
import { applyDamage } from "../services/damageService";
import { isPlayerDamageInvulnerable } from "../services/playerDamageState";
import { registerBatchedEntityUpdate } from "../services/entityUpdateService";
import { setHitSoundProfile } from "../services/hitSoundService";
import { getEnemyVisual } from "../visuals/enemyVisualCatalog";

const HEAVY_VEHICLE_VISUAL = getEnemyVisual("heavy-vehicle");

export function spawnHeavyVehicle(
	pos: Vec2,
	dir: Vec2,
	hp: number,
	sprite: string,
	options: EnemySpawnOptions = {}
) {
	const profile = createEnemySpawnProfile(
		hp,
		1,
		HEAVY_VEHICLE_VISUAL.worldScale,
		options
	);
	const hb = 12 * profile.scale;
	const m = k.add([
		k.pos(pos),
		k.sprite(sprite),
		k.color(k.WHITE),
		k.rotate(dir.angle() - 90),
		k.anchor("center"),
		k.health(profile.hp),
		k.animate(),
		k.scale(profile.scale),
		...(options.persistOffscreen ? [] : [k.offscreen({ destroy: true })]),
		{
			vel: dir,
			speed: k.rand(180, 240) * profile.speedMultiplier,
			hb,
			elite: profile.elite,
			damage: profile.damage,
			threatRank: ENEMY_THREAT_RANK.heavyVehicle,
		},
		tags.enemy,
		tags.unit,
		tags.enemyRoleArtillery,
		...(profile.elite ? [tags.elite] : []),
		tags.gameLoop,
		...(options.tags ?? []),
	]);
	setHitSoundProfile(m, "heavyMetal");

	registerHitAnimation(m);

	registerBatchedEntityUpdate("enemies", m, () => {
		m.move(m.vel.scale(m.speed * velocityScale()));

		checkProjectileIntersection(m.pos, m.hb, tags.friendly, (p) => {
			onEnemyHit(m, p);
		});

		if (
			!isPlayerDamageInvulnerable() &&
			playerObj.pos.dist(m.pos) < m.hb
		) {
			applyDamage(playerObj, m.damage, {
				position: m.pos,
				source: { name: "HEAVY SHIP", sprite },
			});
			applyDamage(m, profile.hp);
		}
	});

	m.onDeath(() => {
			enemyOnDeath(
			m.pos,
			10 * profile.rewardMultiplier,
			2 * profile.rewardMultiplier,
			"enemy",
			true,
			{ tier: profile.elite ? "elite" : "normal" }
		);
		gameSoundService.play("enemy_explosion", { volume: mainSoundVolume });
		k.destroy(m);
	});

	m.onHurt(() => {
		m.animation.seek(0);
	});
}
