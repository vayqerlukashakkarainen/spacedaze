import type { GameObj, Vec2 } from "kaplay";
import { k } from "../../main";
import { spawnAllDebugEnemies } from "./debugEnemySpawnService";
import { spawnDebreeValues } from "../../spawn/spawnDebree";
import { tags } from "../../tags";
import { spawnProjectile } from "../combat/projectileService";
import { snareable } from "../../comp/snareable";
import { registerBatchedEntityUpdate } from "../core/entityUpdateService";
import { forEachSpatialNearby } from "../core/runtimeSpatialIndexService";
import { registerPushableInteractionPhysics } from "../world/interactionPhysicsService";
import { incrementPerformanceCounter } from "./frameProfilerService";

const STRESS_PROJECTILE_LIFETIME = 60;
const PHYSICS_STRESS_RADIUS = 270;
const PHYSICS_BODY_RADIUS = 6;
const PHYSICS_BODY_MAX_SPEED = 230;

export function spawnEnemyStressTest(
	count: number,
	origin: Vec2,
	paused: boolean
) {
	const removed = clearEnemyStressTest();
	const result = spawnAllDebugEnemies(count, origin, [tags.stressEnemy]);
	for (const enemy of k.get(tags.stressEnemy)) enemy.paused = paused;
	return { ...result, removed };
}

export function clearEnemyStressTest() {
	const enemies = k.get(tags.stressEnemy) as GameObj[];
	for (const enemy of enemies) {
		if (enemy.exists()) k.destroy(enemy);
	}
	return enemies.length;
}

export function countStressEnemies() {
	return k.get(tags.stressEnemy).length;
}

export function spawnProjectileStressTest(
	count: number,
	origin: Vec2,
	paused: boolean
) {
	const removed = clearProjectileStressTest();

	for (let index = 0; index < count; index++) {
		const angle = (index / count) * 360;
		const radius = 24 + (index % 24) * 6;
		const clockwise = index % 2 === 0;
		const projectile = spawnProjectile({
			pos: origin.add(k.Vec2.fromAngle(angle).scale(radius)),
			dir: k.Vec2.fromAngle(angle + (clockwise ? 90 : -90)),
			rotation: angle + (clockwise ? 180 : 0),
			sprite: "bullet1",
			speed: k.rand(25, 55),
			tags: [tags.blaster, tags.friendly, tags.stressProjectile],
			impact: { damage: 0 },
			piercing: { maxPierces: 5000, damageReduction: 1 },
			lifespan: { duration: STRESS_PROJECTILE_LIFETIME },
			persistOffscreen: true,
			ignoreWorldCollision: true,
			curve: {
				strength: k.rand(12, 32),
				direction: clockwise ? "right" : "left",
			},
		});
		projectile.paused = paused;
		projectile.suppressDestroyFlash = true;
		projectile.suppressOnDestroyEffects = true;
		projectile.suppressDestroySound = true;
		projectile.suppressImpactEffects = true;
	}

	return {
		spawned: count,
		removed,
		lifetime: STRESS_PROJECTILE_LIFETIME,
	};
}

export function clearProjectileStressTest() {
	const projectiles = k.get(tags.stressProjectile) as GameObj[];
	for (const projectile of projectiles) {
		if (!projectile.exists()) continue;
		projectile.suppressDestroyFlash = true;
		projectile.suppressOnDestroyEffects = true;
		projectile.suppressDestroySound = true;
		k.destroy(projectile);
	}
	return projectiles.length;
}

export function countStressProjectiles() {
	return k.get(tags.stressProjectile).length;
}

export function spawnRocketStressTest(
	count: number,
	origin: Vec2,
	paused: boolean
) {
	const removed = clearRocketStressTest();
	for (let index = 0; index < count; index++) {
		const angle = (index / count) * 360;
		const projectile = spawnProjectile({
			pos: origin.add(k.Vec2.fromAngle(angle).scale(80 + index % 20 * 9)),
			dir: k.Vec2.fromAngle(angle),
			rotation: angle + 90,
			sprite: "rocket1",
			speed: 115,
			tags: [
				tags.friendly,
				tags.rocket,
				tags.stressProjectile,
				tags.stressRocket,
			],
			impact: { damage: 0 },
			piercing: { maxPierces: 5000, damageReduction: 1 },
			seek: {
				enabled: true,
				acquireDelay: 0.2,
				seekDistance: 520,
				turnSpeed: 0.065,
				targetTags: [tags.enemy],
			},
			lifespan: { duration: STRESS_PROJECTILE_LIFETIME },
			persistOffscreen: true,
			ignoreWorldCollision: true,
		});
		projectile.paused = paused;
		projectile.suppressDestroyFlash = true;
		projectile.suppressOnDestroyEffects = true;
		projectile.suppressDestroySound = true;
		projectile.suppressImpactEffects = true;
	}
	return { spawned: count, removed, lifetime: STRESS_PROJECTILE_LIFETIME };
}

export function clearRocketStressTest() {
	const rockets = k.get(tags.stressRocket) as GameObj[];
	for (const rocket of rockets) {
		if (!rocket.exists()) continue;
		rocket.suppressDestroyFlash = true;
		rocket.suppressOnDestroyEffects = true;
		rocket.suppressDestroySound = true;
		k.destroy(rocket);
	}
	return rockets.length;
}

export function countStressRockets() {
	return k.get(tags.stressRocket).length;
}

export function spawnDebreeStressTest(
	count: number,
	origin: Vec2,
	paused: boolean
) {
	const removed = clearDebreeStressTest();
	const denominations = [1, 3, 5, 10] as const;
	const values = Array.from(
		{ length: count },
		(_, index) => denominations[index % denominations.length]
	);
	spawnDebreeValues(origin.add(420, 0), values, {
		pattern: "radial",
		minSpeed: 40,
		maxSpeed: 60,
		tags: [tags.stressDebree],
	});
	for (const debris of k.get(tags.stressDebree)) debris.paused = paused;
	return { spawned: count, removed };
}

export function clearDebreeStressTest() {
	const debris = k.get(tags.stressDebree) as GameObj[];
	for (const item of debris) {
		if (item.exists()) k.destroy(item);
	}
	return debris.length;
}

export function countStressDebree() {
	return k.get(tags.stressDebree).length;
}

export function spawnPhysicsStressTest(
	count: number,
	origin: Vec2,
	paused: boolean
) {
	const removed = clearPhysicsStressTest();
	for (let index = 0; index < count; index++) {
		const angle = index * 137.508;
		const normalizedRadius = Math.sqrt((index + 0.5) / count);
		const spawnRadius = 24 + normalizedRadius * (PHYSICS_STRESS_RADIUS - 24);
		const radius = PHYSICS_BODY_RADIUS + index % 3;
		const objectMass = 0.8 + index % 5 * 0.22;
		const direction = k.Vec2.fromAngle(angle + 72 + index % 7 * 11);
		const body = k.add([
			k.pos(origin.add(k.Vec2.fromAngle(angle).scale(spawnRadius))),
			k.rect(radius * 2, radius * 2),
			k.anchor("center"),
			k.rotate(angle),
			k.color(index % 5 === 0 ? k.rgb(70, 220, 255) : k.WHITE),
			k.opacity(0.72),
			snareable({
				mass: objectMass,
				radius,
				releaseDrag: 0.035,
				angularDrag: 0.08,
			}),
			{
				hb: radius,
				stressOrigin: origin.clone(),
			},
			tags.props,
			tags.gameLoop,
			tags.stressPhysics,
		]);
		body.snareVelocity = direction.scale(80 + index % 9 * 13);
		body.snareAngularVelocity = (index % 2 === 0 ? 1 : -1) *
			(75 + index % 8 * 22);
		body.paused = paused;

		registerPushableInteractionPhysics(body, {
			radius,
			mass: objectMass,
			maxSpeed: PHYSICS_BODY_MAX_SPEED,
			pushTransfer: 0.92,
			separationResponse: 16,
			forEachPusher: (visitor) => forEachSpatialNearby(
				body.pos,
				radius * 4 + 12,
				{
					allTags: [tags.stressPhysics],
					excludeIds: [body.id],
				},
				visitor
			),
			getPusherRadius: (pusher) => pusher.snareRadius ?? PHYSICS_BODY_RADIUS,
		});
		registerBatchedEntityUpdate("world", body, () => {
			incrementPerformanceCounter("physicsStressObjects");
			const offset = body.pos.sub(body.stressOrigin);
			if (offset.len() <= PHYSICS_STRESS_RADIUS) return;
			const normal = offset.unit();
			body.pos = body.stressOrigin.add(normal.scale(PHYSICS_STRESS_RADIUS));
			const outwardSpeed = body.snareVelocity.dot(normal);
			if (outwardSpeed > 0) {
				body.snareVelocity = body.snareVelocity.sub(
					normal.scale(outwardSpeed * 1.85)
				);
			}
		});
	}
	return { spawned: count, removed, radius: PHYSICS_STRESS_RADIUS };
}

export function clearPhysicsStressTest() {
	const bodies = k.get(tags.stressPhysics) as GameObj[];
	for (const body of bodies) {
		if (body.exists()) k.destroy(body);
	}
	return bodies.length;
}

export function countStressPhysicsObjects() {
	return k.get(tags.stressPhysics).length;
}
