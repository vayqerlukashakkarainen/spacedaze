import { Vec2 } from "kaplay";
import { checkProjectileIntersection, playerObj } from "../game";
import { k, mainSoundVolume, subSoundVolume } from "../main";
import { registerHitAnimation } from "../shared";
import { tags } from "../tags";
import { randomExplosion } from "../util";
import { enemyOnDeath, onEnemyHit } from "./enemyShared";

interface Props {
	pos: Vec2;
	dir: Vec2;
	scoreOnKill: number;
	hp: number;
	speed: number;
	splitOnDeath: number;
}

export function spawnMeteorite(props: Props) {
	const initScale = k.rand(1, 2);
	const hb = 12 * initScale;
	const m = k.add([
		k.pos(props.pos),
		k.sprite("asteroid1"),
		k.rotate(0),
		k.anchor("center"),
		k.scale(k.rand(1, 2)),
		k.health(props.hp),
		k.animate(),
		k.offscreen({ destroy: true }),
		{
			vel: props.dir,
			rotVel: k.rand(-4, 4),
			speed: props.speed,
			initScale,
			hb,
		},
		tags.enemy,
		tags.unit,
	]);

	registerHitAnimation(m);

	m.onUpdate(() => {
		m.move(m.vel.scale(m.speed));
		m.angle += m.rotVel;

		checkProjectileIntersection(m.pos, m.hb, tags.friendly, (p) => {
			k.destroy(p);

			onEnemyHit(m, p);
		});

		if (playerObj.pos.dist(m.pos) < m.hb) {
			playerObj.hurt(1);
			m.hurt(props.hp);
		}
	});

	m.onDeath(() => {
		enemyOnDeath(m.pos, props.scoreOnKill, 1);
		k.play(randomExplosion(), { volume: subSoundVolume });
		k.destroy(m);

		if (props.splitOnDeath) {
			for (let i = 0; i < props.splitOnDeath; i++) {
				spawnMeteorite({
					pos: m.pos,
					dir: k.rand(k.vec2(-1, -1), k.vec2(1, 1)),
					scoreOnKill: props.scoreOnKill / 2,
					hp: props.hp / 2,
					speed: props.speed * 2,
					splitOnDeath: 0,
				});
			}
		}
	});

	m.onHurt(() => {
		m.animation.seek(0);
	});
}
