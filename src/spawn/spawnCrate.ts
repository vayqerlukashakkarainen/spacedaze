import { Vec2 } from "kaplay";
import { checkProjectileIntersection, playerObj } from "../game";
import { dtScaled, k, mainSoundVolume, velocityScale } from "../main";
import { audioService } from "../services/audioService";
import { registerHitAnimation } from "../shared";
import { tags } from "../tags";
import { enemyOnDeath, onEnemyHit } from "./enemyShared";
import { timescale } from "../comp/timescale";
import { applyDamage } from "../services/damageService";
import { registerBatchedEntityUpdate } from "../services/entityUpdateService";
import {
	addLocalLight,
	updateLocalLight,
} from "../services/localLightService";
import { spawnDebree } from "./spawnDebree";
import { spawnExplosionEffect } from "./spawnFlash";
import { spawnRerollTokenPickup } from "./spawnPowerup";

export type CrateTier = "normal" | "golden";

interface Props {
	pos: Vec2;
	am: number;
	hp: number;
	powerupMultiplier: number;
	speed?: number;
	destroyOffscreen?: boolean;
	tags?: string[];
	tier?: CrateTier;
}

const GOLDEN_DEBREE_MULTIPLIER = 8;
const GOLDEN_MIN_DEBREE = 20;
const GOLDEN_DEBREE_MIN_SPEED = 60;
const GOLDEN_DEBREE_MAX_SPEED = 100;

export function spawnCrate(props: Props) {
	const tier = props.tier ?? "normal";
	const golden = tier === "golden";
	const m = k.add([
		k.pos(props.pos),
		k.sprite(golden ? "salvage_asteroid_rich" : "salvage_asteroid_normal", {
			width: 24,
			height: 24,
		}),
		k.scale(golden ? 1.2 : 1),
		k.rotate(0),
		k.anchor("center"),
		k.health(props.hp),
		k.animate(),
		timescale(),
		...(props.destroyOffscreen === false
			? []
			: [k.offscreen({ destroy: true })]),
		{
			tier,
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
	const rareGlow = golden
		? addLocalLight(m, {
			size: 76,
			color: [255, 255, 255],
			opacity: 0.48,
			z: -2,
			pulse: {
				scaleMin: 0.92,
				scaleMax: 1.08,
				scaleSpeed: 2.6,
				opacityMin: 0.38,
				opacityMax: 0.52,
				opacitySpeed: 2.2,
			},
		})
		: undefined;

	if (golden) {
		m.add([
			k.pos(),
			k.z(1),
			k.particles(
				{
					max: 12,
					speed: [3, 9],
					angle: [0, 360],
					lifeTime: [0.45, 0.9],
					colors: [k.rgb(255, 191, 36), k.WHITE],
					opacities: [0, 1, 0],
					scales: [0.15, 0.7, 0.1],
					angularVelocity: [-60, 60],
					texture: k.getSprite("particle4")!.data!.frames[0].tex,
					quads: [k.getSprite("particle4")!.data!.frames[0].q],
				},
				{
					rate: 3,
					direction: -90,
					spread: 360,
					position: k.vec2(),
				}
			),
		])
	}

	registerBatchedEntityUpdate("enemies", m, () => {
		m.move(m.vel.scale(m.speed * velocityScale() * m.getTimescale()));
		m.angle += m.rotVel * dtScaled() * m.getTimescale();
		if (rareGlow) updateLocalLight(rareGlow);

		checkProjectileIntersection(m.pos, 12, tags.friendly, (p) => {
			m.hitAngle = p.angle;
			onEnemyHit(m, p);
		});

		if (playerObj.pos.dist(m.pos) < 16) {
			applyDamage(m, props.hp);
		}
	});

	m.onDeath(() => {
		const deathPos = m.pos.clone();
		if (golden) {
			enemyOnDeath(deathPos, 0, props.powerupMultiplier, "enemy", false);
			spawnDebree(
				deathPos,
				Math.max(GOLDEN_MIN_DEBREE, props.am * GOLDEN_DEBREE_MULTIPLIER),
				{
					pattern: "radial",
					minSpeed: GOLDEN_DEBREE_MIN_SPEED,
					maxSpeed: GOLDEN_DEBREE_MAX_SPEED,
				}
			);
			if (k.chance(0.35)) {
				spawnRerollTokenPickup(deathPos.add(18, 0));
			}
			spawnExplosionEffect(deathPos, 46, {
				ringIntensity: 0.9,
				particleCount: 28,
			});
			k.shake(5);
			audioService.playPositionalSound("golden_crate_destroyed", deathPos, {
				volume: mainSoundVolume,
			});
		} else {
			enemyOnDeath(deathPos, props.am, props.powerupMultiplier, "enemy", false);
			audioService.playPositionalSound("explosion4", deathPos, {
				volume: mainSoundVolume,
			});
		}
		k.destroy(m);
	});

	m.onHurt(() => {
		audioService.playPositionalSound("hit2", m.pos.clone(), {
			volume: mainSoundVolume,
		});
		m.animation.seek(0);
	});
}
