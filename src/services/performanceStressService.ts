import type { GameObj, Vec2 } from "kaplay";
import { k } from "../main";
import { tags } from "../tags";
import { spawnProjectile } from "./projectileService";

const STRESS_PROJECTILE_LIFETIME = 12;

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
			tags: [tags.blaster, tags.stressProjectile],
			impact: { damage: 0 },
			lifespan: { duration: STRESS_PROJECTILE_LIFETIME },
			curve: {
				strength: k.rand(12, 32),
				direction: clockwise ? "right" : "left",
			},
		});
		projectile.paused = paused;
		projectile.suppressDestroyFlash = true;
		projectile.suppressOnDestroyEffects = true;
		projectile.suppressDestroySound = true;
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
