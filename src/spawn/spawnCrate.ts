import { Vec2 } from "kaplay";
import { checkProjectileIntersection, playerObj } from "../game";
import { k, mainSoundVolume } from "../main";
import { registerHitAnimation } from "../shared";
import { tags } from "../tags";
import { enemyOnDeath, onEnemyHit } from "./enemyShared";

interface Props {
	pos: Vec2;
	am: number;
	hp: number;
	powerupMultiplier: number;
}

export function spawnCrate(props: Props) {
	const m = k.add([
		k.pos(props.pos),
		k.sprite("crate1"),
		k.rotate(0),
		k.anchor("center"),
		k.health(props.hp),
		k.animate(),
		k.offscreen({ destroy: true }),
		{
			vel: k.Vec2.fromAngle(k.rand(0, 360)),
			rotVel: k.rand(-4, 4),
			speed: k.rand(20, 60),
			hitAngle: 0,
		},
		tags.enemy,
		tags.unit,
	]);

	registerHitAnimation(m);

	m.onUpdate(() => {
		m.move(m.vel.scale(m.speed));
		m.angle += m.rotVel;

		checkProjectileIntersection(m.pos, 12, tags.friendly, (p) => {
			k.destroy(p);

			m.hitAngle = p.angle;
			onEnemyHit(m, p);
		});

		if (playerObj.pos.dist(m.pos) < 16) {
			m.hurt(props.hp);
		}
	});

	m.onDeath(() => {
		enemyOnDeath(m.pos, props.am, props.powerupMultiplier);
		k.play("explosion4", { volume: mainSoundVolume });
		k.destroy(m);
	});

	m.onHurt(() => {
		k.play("hit2", { volume: mainSoundVolume });
		m.animation.seek(0);
	});
}
