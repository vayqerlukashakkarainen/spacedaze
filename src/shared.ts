import {
	AnimateComp,
	GameObj,
	OpacityComp,
	PosComp,
	RotateComp,
	ScaleComp,
	Vec2,
} from "kaplay";
import { k } from "./main";
import { adjustedTarget } from "./util";

export function registerHitAnimation(m: GameObj<AnimateComp>) {
	m.animate("opacity", [0, 1, 0, 1], {
		duration: 0.14,
		loops: 1,
	});
}

export function lerpAngleBetweenPos(
	angle: number,
	pos1: Vec2,
	pos2: Vec2,
	hardness: number,
	addAngle: number
) {
	const dir = pos1.sub(pos2).unit();

	const a = Math.atan2(dir.y, dir.x);

	const desiredRot = k.rad2deg(a) + addAngle;
	const correctedDesiredRot = adjustedTarget(angle, desiredRot);

	return { dir, lerp: k.lerp(angle, correctedDesiredRot, hardness) };
}

export function lerpMoveRotateAndScale(
	m: GameObj<PosComp | RotateComp | ScaleComp | any>,
	lerp: number,
	speed: number
) {
	const lerpAngle = k.deg2rad(lerp + 90);
	const x = Math.cos(lerpAngle);
	const y = Math.sin(lerpAngle);
	m.move(x * speed * -1, y * speed * -1);
	m.angle = lerp;
	m.scale = k.vec2(1, Math.abs(y));
}

export function sum(values: number[]) {
	return values.reduce((a, b) => a + b, 0);
}
