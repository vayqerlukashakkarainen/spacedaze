import { Vec2 } from "kaplay";
import { checkProjectileIntersection, playerObj } from "../game";
import { k, mainSoundVolume, velocityScale } from "../main";
import { audioService } from "../services/audioService";
import { tags } from "../tags";
import { randomExplosion } from "../util";
import { registerHitAnimation } from "../shared";
import { enemyOnDeath, onEnemyHit } from "./enemyShared";
import {
	createEnemySpawnProfile,
	type EnemySpawnOptions,
} from "../services/threatService";
import { applyDamage } from "../services/damageService";
import { isPlayerDamageInvulnerable } from "../services/playerDamageState";
import { registerBatchedEntityUpdate } from "../services/entityUpdateService";

export function spawnHeavyVehicle(
	pos: Vec2,
	dir: Vec2,
	hp: number,
	sprite: string,
	options: EnemySpawnOptions = {}
) {
	const profile = createEnemySpawnProfile(hp, 1, 1, options);
	const hb = 12 * profile.scale;
	const m = k.add([
		k.pos(pos),
		k.sprite(sprite),
		k.color(...profile.tint),
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
		},
		tags.enemy,
		tags.unit,
		...(profile.elite ? [tags.elite] : []),
		tags.gameLoop,
		...(options.tags ?? []),
	]);

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
				source: { name: "HEAVY SHIP", sprite },
			});
			applyDamage(m, profile.hp);
		}
	});

	m.onDeath(() => {
		enemyOnDeath(
			m.pos,
			10 * profile.rewardMultiplier,
			2 * profile.rewardMultiplier
		);
		audioService.playSound(randomExplosion(), { volume: mainSoundVolume });
		k.destroy(m);
	});

	m.onHurt(() => {
		audioService.playSound("hit1", { volume: mainSoundVolume });
		m.animation.seek(0);
	});
}
