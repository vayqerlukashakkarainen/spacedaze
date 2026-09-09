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
const ROUNDED_STEERING_STRETCH = 0.32;

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

export function easeDirection(
	current: Vec2,
	desired: Vec2,
	response: number,
	delta: number
) {
	const blend = 1 - Math.exp(-response * delta);
	const eased = current.lerp(desired, blend);
	return eased.len() > 0.001 ? eased.unit() : desired;
}

export function steerMoveRotateAndLean(
	m: GameObj<PosComp | RotateComp | ScaleComp | any>,
	lerp: number,
	speed: number,
	desiredAngle: number,
	baseScale: number | Vec2 = 1
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
	baseScale: number | Vec2 = 1,
	rounded = false,
	angleForFullLean = 100,
	responsiveness = 12
) {
	const baseScaleX = typeof baseScale === "number" ? baseScale : baseScale.x;
	const baseScaleY = typeof baseScale === "number" ? baseScale : baseScale.y;
	const correctedDesiredAngle = adjustedTarget(currentAngle, desiredAngle);
	const steeringAmount = k.clamp(
		Math.abs(currentAngle - correctedDesiredAngle) /
			Math.max(1, angleForFullLean),
		0,
		1
	);
	const targetScaleX = (1 - steeringAmount * MAX_STEERING_LEAN) * baseScaleX;
	const targetScaleY = rounded
		? (1 + steeringAmount * ROUNDED_STEERING_STRETCH) * baseScaleY
		: (1 - steeringAmount / 40) * baseScaleY;
	const bankLerp = k.clamp(responsiveness * k.dt(), 0, 1);
	m.scale.x = k.lerp(m.scale.x, targetScaleX, bankLerp);
	m.scale.y = k.lerp(m.scale.y, targetScaleY, bankLerp);
}

export function applyDirectionalSteeringLean(
	m: GameObj<ScaleComp | any>,
	currentDirection: Vec2,
	desiredDirection: Vec2,
	baseScale = 1,
	rounded = false,
	angleForFullLean = 100,
	responsiveness = 12
) {
	if (currentDirection.len() <= 0 || desiredDirection.len() <= 0) {
		applySteeringLean(
			m,
			0,
			0,
			baseScale,
			rounded,
			angleForFullLean,
			responsiveness
		);
		return;
	}
	applySteeringLean(
		m,
		currentDirection.angle(),
		desiredDirection.angle(),
		baseScale,
		rounded,
		angleForFullLean,
		responsiveness
	);
}

export function sum(values: number[]) {
	return values.reduce((a, b) => a + b, 0);
}
