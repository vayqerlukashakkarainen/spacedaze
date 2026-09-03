import { Vec2 } from "kaplay";
import { checkProjectileIntersection, playerObj } from "../game";
import { dtScaled, k, mainSoundVolume, velocityScale } from "../main";
import { audioService } from "../services/audioService";
import { registerHitAnimation } from "../shared";
import { tags } from "../tags";
import { enemyOnDeath, onEnemyHit } from "./enemyShared";
import { timescale } from "../comp/timescale";
import { applyDamage } from "../services/damageService";

interface Props {
	pos: Vec2;
	am: number;
	hp: number;
	powerupMultiplier: number;
	speed?: number;
	destroyOffscreen?: boolean;
	tags?: string[];
}

export function spawnCrate(props: Props) {
	const m = k.add([
		k.pos(props.pos),
		k.sprite("crate1"),
		k.rotate(0),
		k.anchor("center"),
		k.health(props.hp),
		k.animate(),
		timescale(),
		...(props.destroyOffscreen === false
			? []
			: [k.offscreen({ destroy: true })]),
		{
			vel: k.Vec2.fromAngle(k.rand(0, 360)),
			rotVel: k.rand(-4, 4),
			speed: props.speed ?? k.rand(20, 60),
			hitAngle: 0,
		},
		tags.enemy,
		tags.unit,
		tags.gameLoop,
		...(props.tags ?? []),
	]);

	registerHitAnimation(m);

	m.onUpdate(() => {
		m.move(m.vel.scale(m.speed * velocityScale() * m.getTimescale()));
		m.angle += m.rotVel * dtScaled() * m.getTimescale();

		checkProjectileIntersection(m.pos, 12, tags.friendly, (p) => {
			m.hitAngle = p.angle;
			onEnemyHit(m, p);
		});

		if (playerObj.pos.dist(m.pos) < 16) {
			applyDamage(m, props.hp);
		}
	});

	m.onDeath(() => {
		enemyOnDeath(m.pos, props.am, props.powerupMultiplier, "enemy", false);
		audioService.playSound("explosion4", { volume: mainSoundVolume });
		k.destroy(m);
	});

	m.onHurt(() => {
		audioService.playSound("hit2", { volume: mainSoundVolume });
		m.animation.seek(0);
	});
}
