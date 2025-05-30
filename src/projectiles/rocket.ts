import { Vec2 } from "kaplay";
import { pickUnitInDistance, projectiles } from "../game";
import { k, mainSoundVolume, ROCKET_SPEED, subSoundVolume } from "../main";
import { trailEmitter } from "../particles";
import { lerpAngleBetweenPos, lerpMoveRotateAndScale } from "../shared";
import { shootBlaster } from "./blaster";
import { tags } from "../tags";
import { player, session } from "../player";
import { randomExplosion } from "../util";

const acquireTargetAfter = 0.5;
const trailOffset = 12;
const maxSpeed = 400;
export function shootRocket(
	pos,
	dir,
	rot,
	impactDmg,
	splashDmg,
	splashSize,
	splashDmgFallof,
	splashDmgFallofDist,
	speedMltp,
	tagsToAttach,
	canSeek
) {
	const r = k.add([
		k.pos(pos),
		k.area(),
		k.rotate(rot),
		k.offscreen({ destroy: true }),
		k.anchor("center"),
		k.scale(1),
		k.sprite("rocket1"),
		{
			impactDmg,
			splashDmg,
			splashSize,
			splashDmgFallof,
			splashDmgFallofDist,
			lifetime: 0,
			speedMltp,
			dir,
			targetUnit: null,
			canSeek,
		},
		...[...tagsToAttach, tags.gameLoopUi],
	]);

	k.play("fire_rocket1", { volume: mainSoundVolume });

	r.onUpdate(() => {
		r.lifetime += k.dt();

		const speed = k.clamp(
			ROCKET_SPEED * r.speedMltp * (0.3 + r.lifetime),
			0,
			maxSpeed
		);

		const currentDir = k.Vec2.fromAngle(r.angle - 90);
		if (r.targetUnit) {
			const { lerp, dir } = lerpAngleBetweenPos(
				r.angle,
				r.pos,
				r.targetUnit.pos,
				0.04,
				-90
			);
			lerpMoveRotateAndScale(r, lerp, speed);
		} else {
			r.move(currentDir.x * speed, currentDir.y * speed);
		}

		const emitterPos = k.vec2(
			r.pos.x - trailOffset * currentDir.x,
			r.pos.y - trailOffset * currentDir.y
		);
		trailEmitter.emitter.position = emitterPos;
		trailEmitter.emitter.direction = r.angle;
		trailEmitter.emit(1);

		if (r.canSeek && r.lifetime > acquireTargetAfter && r.targetUnit == null) {
			pickUnitInDistance(r.pos, 200, tags.enemy, (u) => {
				r.targetUnit = u;

				r.targetUnit?.onDestroy(() => {
					r.targetUnit = null;
				});
			});
		}
	});

	r.onDestroy(() => {
		const index = projectiles.findIndex((p2) => p2.id == r.id);

		projectiles.splice(index, 1);
		k.play(randomExplosion(), { volume: subSoundVolume });

		const shards = player.rocketShards + session.extraSpaceDebreeInMissiles;
		for (let i = 0; i < shards; i++) {
			const angle = 360 * (i / shards);
			shootBlaster(
				r.pos,
				k.Vec2.fromAngle(angle),
				angle + 90,
				1,
				1,
				[tags.friendly, tags.blaster],
				false
			);
		}
	});

	projectiles.push(r);
}
