import type { GameObj, Vec2 } from "kaplay";
import { k } from "../main";
import { spawnAllDebugEnemies } from "./debugEnemySpawnService";
import { spawnDebreeValues } from "../spawn/spawnDebree";
import { tags } from "../tags";
import { spawnProjectile } from "./projectileService";

const STRESS_PROJECTILE_LIFETIME = 60;

export function spawnEnemyStressTest(
	count: number,
	origin: Vec2,
	paused: boolean
) {
	const removed = clearEnemyStressTest();
	const result = spawnAllDebugEnemies(count, origin, [tags.stressEnemy]);
	for (const enemy of k.get<GameObj>(tags.stressEnemy)) enemy.paused = paused;
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
	const values = Array.from({ length: count }, () => 1 as const);
	spawnDebreeValues(origin.add(420, 0), values, {
		pattern: "radial",
		minSpeed: 40,
		maxSpeed: 60,
		tags: [tags.stressDebree],
	});
	for (const debris of k.get<GameObj>(tags.stressDebree)) debris.paused = paused;
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
