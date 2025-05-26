import { pickUnitInDistance, projectiles } from "../game";
import { k, ROCKET_SPEED } from "../main";
import { trailEmitter } from "../particles";
import { lerpAngleBetweenPos } from "../shared";

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
	tags,
	canSeek
) {
	const r = k.add([
		k.pos(pos),
		k.area(),
		k.rotate(rot),
		k.offscreen({ destroy: true }),
		k.anchor("center"),
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
		...tags,
	]);

	k.play("fire_rocket1", { volume: 0.4 });

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
			const lerpAngle = k.deg2rad(lerp + 90);

			r.dir = dir;
			r.move(
				Math.cos(lerpAngle) * speed * -1,
				Math.sin(lerpAngle) * speed * -1
			);
			r.angle = lerp;
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
			pickUnitInDistance(r.pos, 200, "enemy", (u) => {
				r.targetUnit = u;

				r.targetUnit.onDestroy(() => {
					r.targetUnit = null;
				});
			});
		}
	});

	r.onDestroy(() => {
		const index = projectiles.findIndex((p2) => p2.id == r.id);

		projectiles.splice(index, 1);
	});

	projectiles.push(r);
}
