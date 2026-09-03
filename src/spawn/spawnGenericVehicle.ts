import { GameObj, Vec2 } from "kaplay";
import { checkProjectileIntersection, playerObj } from "../game";
import { k, mainSoundVolume, subSoundVolume, velocityScale } from "../main";
import { audioService } from "../services/audioService";
import { starsEmitterDir } from "../particles";
import { tags } from "../tags";
import { randomExplosion } from "../util";
import { registerHitAnimation } from "../shared";
import { onEnemyHit } from "./enemyShared";
import { timescale } from "../comp/timescale";
import { applyDamage } from "../services/damageService";
import { isPlayerDamageInvulnerable } from "../services/playerDamageState";
import {
	createEnemySpawnProfile,
	type EnemySpawnOptions,
} from "../services/threatService";

export function spawnGenericVehicle(
	addTo: GameObj<{ killed: number }>,
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
		timescale(),
		k.animate(),
		k.scale(profile.scale),
		...(options.persistOffscreen ? [] : [k.offscreen({ destroy: true })]),
		{
			vel: dir,
			speed: k.rand(300, 340) * profile.speedMultiplier,
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

	m.onUpdate(() => {
		m.move(m.vel.scale(m.speed * velocityScale() * m.getTimescale()));

		checkProjectileIntersection(m.pos, m.hb, tags.friendly, (p) => {
			onEnemyHit(m, p);
		});

		if (
			!isPlayerDamageInvulnerable() &&
			playerObj.pos.dist(m.pos) < m.hb
		) {
			applyDamage(playerObj, m.damage, {
				source: {
					name: sprite === "bike1" ? "RAIDER BIKE" : "ENEMY SHIP",
					sprite,
				},
			});
			applyDamage(m, profile.hp);
		}
	});

	m.onDeath(() => {
		starsEmitterDir.emitter.position = m.pos;
		starsEmitterDir.emitter.direction = m.angle + 90;

		starsEmitterDir.emit(20);
		audioService.playSound(randomExplosion(), { volume: subSoundVolume });
		k.destroy(m);

		addTo.killed += 1;
	});

	m.onHurt(() => {
		audioService.playSound("hit1", { volume: mainSoundVolume });
		m.animation.seek(0);
	});
}
