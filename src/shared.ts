import {
	AnimateComp,
	GameObj,
	PosComp,
	RotateComp,
	ScaleComp,
	Vec2,
} from "kaplay";
import { k, velocityScale } from "./main";
import { adjustedTarget } from "./util";

const MAX_STEERING_LEAN = 0.65;

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

	return {
		dir,
		lerp: k.lerp(angle, correctedDesiredRot, hardness),
		correctedDesiredRot,
	};
}

export function steerMoveRotateAndLean(
	m: GameObj<PosComp | RotateComp | ScaleComp | any>,
	lerp: number,
	speed: number,
	desiredAngle: number,
	baseScale = 1
) {
	const lerpAngle = k.deg2rad(lerp + 90);
	const x = Math.cos(lerpAngle);
	const y = Math.sin(lerpAngle);
	m.move(k.vec2(x * speed * -1, y * speed * -1).scale(velocityScale()));
	m.angle = lerp;
	applySteeringLean(m, lerp, desiredAngle, baseScale);
}

export function applySteeringLean(
	m: GameObj<ScaleComp | any>,
	currentAngle: number,
	desiredAngle: number,
	baseScale = 1
) {
	const steeringAmount = k.clamp(
		Math.abs(currentAngle - desiredAngle) / 100,
		0,
		1
	);
	const targetScaleX = (1 - steeringAmount * MAX_STEERING_LEAN) * baseScale;
	const targetScaleY = (1 - steeringAmount / 40) * baseScale;
	const bankLerp = k.clamp(12 * k.dt(), 0, 1);
	m.scale = k.vec2(
		k.lerp(m.scale.x, targetScaleX, bankLerp),
		k.lerp(m.scale.y, targetScaleY, bankLerp)
	);
}

export function sum(values: number[]) {
	return values.reduce((a, b) => a + b, 0);
}
