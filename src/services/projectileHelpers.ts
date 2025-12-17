import { Vec2 } from "kaplay";
import { BULLET_SPEED, ROCKET_SPEED } from "../main";
import { tags } from "../tags";
import { ProjectileConfig } from "../projectiles/projectileConfig";
import { spawnProjectile } from "./projectileService";
import { player, session } from "../player";

// Basic Blaster
export function spawnBasicBlaster(
	pos: Vec2,
	dir: Vec2,
	rot: number,
	damage: number,
	speedMultiplier: number,
	projectileTags: string[]
) {
	const config: ProjectileConfig = {
		pos,
		dir,
		rotation: rot,
		sprite: "bullet1",
		speed: BULLET_SPEED,
		speedMultiplier,
		tags: projectileTags,
		impact: {
			damage,
			damageMultiplier: 1,
		},
		fireSound: "shoot1",
	};

	return spawnProjectile(config);
}

// Player Blaster with all modifiers
export function spawnPlayerBlaster(pos: Vec2, dir: Vec2, rot: number) {
	const config: ProjectileConfig = {
		pos,
		dir,
		rotation: rot,
		sprite: "bullet1",
		speed: BULLET_SPEED,
		speedMultiplier: player.blasterSpeedMultiplier,
		tags: [tags.friendly, tags.blaster],
		impact: {
			damage: player.blasterDmg,
			damageMultiplier: player.blasterDmgMultiplier,
		},
		bounce: {
			maxBounces: 3,
		},
		crit: {
			chance: player.critChance,
			multiplier: player.critMultiplier,
		},
		fireSound: "shoot1",
	};

	return spawnProjectile(config);
}

// Homing Rocket
export function spawnHomingRocket(
	pos: Vec2,
	dir: Vec2,
	rot: number,
	impactDmg: number,
	splashDmg: number,
	splashSize: number,
	canSeek: boolean,
	projectileTags: string[]
) {
	const config: ProjectileConfig = {
		pos,
		dir,
		rotation: rot,
		sprite: "rocket1",
		speed: ROCKET_SPEED,
		speedMultiplier: 1,
		tags: projectileTags,
		impact: {
			damage: impactDmg,
		},
		splash: {
			damage: splashDmg,
			radius: splashSize,
		},
		seek: canSeek
			? {
					enabled: true,
					acquireDelay: 0.5,
					seekDistance: 200,
					turnSpeed: 0.04,
					targetTags: [tags.enemy],
				}
			: undefined,
		trail: {
			emitterType: "trail",
			offset: 12,
			particleCount: 1,
		},
		fireSound: "fire_rocket1",
		destroySound: "explosion1",
	};

	return spawnProjectile(config);
}

// Player Rocket with all player modifiers
export function spawnPlayerRocket(pos: Vec2, dir: Vec2, rot: number) {
	const config: ProjectileConfig = {
		pos,
		dir,
		rotation: rot,
		sprite: "rocket1",
		speed: ROCKET_SPEED,
		speedMultiplier: 1,
		tags: [tags.friendly, tags.rocket],
		impact: {
			damage: player.rocketImpactDmg,
			damageMultiplier: player.rocketDmgMultiplier,
		},
		splash: {
			damage: player.rocketSplashDmg,
			radius: player.rocketSplashSize * player.rocketSplashSizeMultiplier,
			damageMultiplier: player.rocketDmgMultiplier,
			damageFalloff: player.rocketSplashDmgFallOverDistance,
			falloffDistance: player.rocketSplashDmgFallDistanceValue,
		},
		seek: {
			enabled: true,
			acquireDelay: 0.5,
			seekDistance: player.rocketSeekDistance,
			turnSpeed: 0.04,
			targetTags: [tags.enemy],
		},
		trail: {
			emitterType: "trail",
			offset: 12,
			particleCount: 1,
		},
		crit: {
			chance: player.critChance,
			multiplier: player.critMultiplier,
		},
		onDestroy: {
			spawnProjectiles:
				player.rocketShards + session.extraSpaceDebreeInMissiles > 0
					? {
							count: player.rocketShards + session.extraSpaceDebreeInMissiles,
							spreadAngle: 360,
							config: {
								sprite: "bullet1",
								speed: BULLET_SPEED,
								tags: [tags.friendly, tags.blaster],
								impact: {
									damage: 1,
								},
							},
						}
					: undefined,
		},
		fireSound: "fire_rocket1",
		destroySound: "explosion1",
	};

	return spawnProjectile(config);
}

// Enemy Blaster
export function spawnEnemyBlaster(
	pos: Vec2,
	dir: Vec2,
	rot: number,
	damage: number
) {
	const config: ProjectileConfig = {
		pos,
		dir,
		rotation: rot,
		sprite: "bullet1",
		speed: BULLET_SPEED,
		speedMultiplier: 0.8,
		tags: [tags.enemy, tags.blaster],
		impact: {
			damage,
		},
		fireSound: "shoot1",
	};

	return spawnProjectile(config);
}
