import type { Color, GameObj, PosComp, Vec2 } from "kaplay";
import { dt, k, layers } from "../main";
import { tags } from "../tags";
import { registerBatchedEntityUpdate } from "../services/entityUpdateService";

interface Props {
	pos1: Vec2;
	pos2: Vec2;
	target?: GameObj<PosComp>;
	decayTime: number;
	color: Color;
	opacity: number;
	size: number;
	onArrive?: () => void;
}

const CHAIN_PROJECTILE_SPEED = 850;
const CHAIN_PROJECTILE_TRAIL_POINTS = 9;

export function spawnChainProjectile(props: Props) {
	const targetDirection = props.pos2.sub(props.pos1);
	const targetAngle = targetDirection.len() > 0
		? k.Vec2.toAngle(targetDirection)
		: k.rand(0, 360);
	const launchAngle = targetAngle + k.rand(-135, 135);
	const projectile = k.add([
		k.pos(props.pos1.clone()),
		k.circle(Math.max(1, props.size * 0.8)),
		k.color(props.color),
		k.opacity(props.opacity),
		k.z(8),
		k.layer(layers.gameEffects),
		{
			elapsed: 0,
			maxLifetime: Math.max(0.5, props.decayTime * 2),
			landed: false,
			velocity: k.Vec2.fromAngle(launchAngle).scale(
				CHAIN_PROJECTILE_SPEED * 0.42
			),
			trail: [props.pos1.clone()] as Vec2[],
			draw() {
				for (let index = 1; index < this.trail.length; index++) {
					const trailProgress = index / this.trail.length;
					k.drawLine({
						p1: this.trail[index - 1].sub(this.pos),
						p2: this.trail[index].sub(this.pos),
						width: Math.max(0.5, props.size * trailProgress),
						color: props.color,
						opacity: props.opacity * trailProgress,
					});
				}
			},
		},
		tags.props,
		tags.projectile,
		tags.gameLoop,
	]);

	registerBatchedEntityUpdate("effects", projectile, () => {
		const deltaTime = dt();
		projectile.elapsed += deltaTime;
		const targetPos = props.target?.pos ?? props.pos2;
		const toTarget = targetPos.sub(projectile.pos);

		if (toTarget.len() <= 7) {
			landChainProjectile(projectile, targetPos, props.onArrive);
			return;
		}

		const desiredVelocity = toTarget.unit().scale(CHAIN_PROJECTILE_SPEED);
		const homingStrength = projectile.elapsed < 0.045 ? 4 : 32;
		projectile.velocity = projectile.velocity.lerp(
			desiredVelocity,
			1 - Math.exp(-homingStrength * deltaTime)
		);
		const previousPos = projectile.pos.clone();
		const nextPos = projectile.pos.add(projectile.velocity.scale(deltaTime));
		if (distanceToSegment(targetPos, previousPos, nextPos) <= 7) {
			landChainProjectile(projectile, targetPos, props.onArrive);
			return;
		}
		projectile.pos = nextPos;
		projectile.trail.push(projectile.pos.clone());
		if (projectile.trail.length > CHAIN_PROJECTILE_TRAIL_POINTS) {
			projectile.trail.shift();
		}
		projectile.opacity =
			props.opacity *
			(1 - k.clamp(projectile.elapsed / projectile.maxLifetime, 0, 1));

		if (projectile.elapsed >= projectile.maxLifetime) k.destroy(projectile);
	});

	return projectile;
}

function landChainProjectile(
	projectile: GameObj<PosComp> & { landed: boolean },
	targetPos: Vec2,
	onArrive?: () => void
) {
	if (projectile.landed) return;
	projectile.landed = true;
	projectile.pos = targetPos.clone();
	onArrive?.();
	k.destroy(projectile);
}

function distanceToSegment(point: Vec2, start: Vec2, end: Vec2) {
	const segment = end.sub(start);
	const lengthSquared = segment.dot(segment);
	if (lengthSquared === 0) return point.dist(start);
	const progress = k.clamp(point.sub(start).dot(segment) / lengthSquared, 0, 1);
	return point.dist(start.add(segment.scale(progress)));
}
