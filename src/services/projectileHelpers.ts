import { Vec2 } from "kaplay";
import { BULLET_SPEED, k, ROCKET_SPEED } from "../main";
import { tags } from "../tags";
import { ProjectileConfig } from "../projectiles/projectileConfig";
import { spawnProjectile } from "./projectileService";
import { player, session } from "../player";
import { getEquippedWeapon } from "./weaponService";
import { spawnFlash } from "../spawn/spawnFlash";

// Basic Blaster
export function spawnBasicBlaster(
	pos: Vec2,
	dir: Vec2,
	rot: number,
	damage: number,
	speedMultiplier: number,
	projectileTags: string[],
	inheritPlayerModifiers: boolean = false
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
	if (inheritPlayerModifiers) applyPlayerProjectileModifiers(config, true);

	return spawnProjectile(config);
}

// Player Blaster with all modifiers
export function spawnPlayerBlaster(pos: Vec2, dir: Vec2, rot: number) {
	const weapon = getEquippedWeapon();
	const spreadAngle = k.rand(
		-weapon.spreadDegrees,
		weapon.spreadDegrees
	);
	const config: ProjectileConfig = {
		pos,
		dir: k.Vec2.fromAngle(rot + spreadAngle - 90),
		rotation: rot + spreadAngle,
		sprite: "bullet1",
		speed: BULLET_SPEED,
		speedMultiplier:
			player.blasterSpeedMultiplier * weapon.projectileSpeedMultiplier,
		tags: [tags.friendly, tags.blaster],
		impact: {
			damage: player.blasterDmg * weapon.damageMultiplier,
			damageMultiplier: player.blasterDmgMultiplier,
		},
		crit: {
			chance: player.critChance,
			multiplier: player.critMultiplier,
		},
		fireSound: "shoot1",
	};
	if (weapon.piercing) {
		config.piercing = { ...weapon.piercing };
	}
	if (weapon.chain) {
		config.chain = {
			...weapon.chain,
			targetTags: [tags.enemy, tags.unit],
		};
	}
	applyPlayerProjectileModifiers(config, true);
	spawnFlash(pos, 3);

	return spawnProjectile(config);
}

export function spawnPrimaryLinkedRocket(pos: Vec2, dir: Vec2, rot: number) {
	const inheritedDamage = getPrimaryWeaponDamage();
	const config: ProjectileConfig = {
		pos,
		dir,
		rotation: rot,
		sprite: "rocket1",
		speed: ROCKET_SPEED,
		speedMultiplier: 1,
		tags: [tags.friendly, tags.rocket],
		impact: {
			damage: inheritedDamage,
		},
		splash: {
			damage: inheritedDamage * 0.5,
			radius: player.rocketSplashSize * player.rocketSplashSizeMultiplier,
			damageFalloff: player.rocketSplashDmgFallOverDistance,
			falloffDistance: player.rocketSplashDmgFallDistanceValue,
		},
		seek: {
			enabled: true,
			acquireDelay: 0.2,
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
		fireSound: "fire_rocket1",
		destroySound: "explosion1",
	};
	applyPlayerProjectileModifiers(config, false);

	return spawnProjectile(config);
}

export function getPrimaryWeaponDamage() {
	const weapon = getEquippedWeapon();
	return player.blasterDmg * weapon.damageMultiplier * player.blasterDmgMultiplier;
}

export function spawnPhaseMagazineSalvo(pos: Vec2) {
	const roundCount = 10;
	const tint = k.rgb(190, 75, 255);
	const damage = getPrimaryWeaponDamage() * 0.35;
	for (let index = 0; index < roundCount; index++) {
		const angle = index * (360 / roundCount);
		const config: ProjectileConfig = {
			pos: pos.add(k.Vec2.fromAngle(angle).scale(7)),
			dir: k.Vec2.fromAngle(angle),
			rotation: angle + 90,
			sprite: "bullet1",
			tint,
			speed: BULLET_SPEED,
			speedMultiplier: 0.82,
			tags: [tags.friendly, tags.blaster],
			impact: { damage },
			seek: {
				enabled: true,
				acquireDelay: 0.02,
				seekDistance: 420,
				turnSpeed: 0.12,
				targetTags: [tags.enemy],
			},
			wiggle: {
				amplitude: 14,
				frequency: 14,
				phase: index * 0.9,
			},
			lifespan: { duration: 2.8 },
			crit: {
				chance: player.critChance,
				multiplier: player.critMultiplier,
			},
			fireSound: index === 0 ? "shoot1" : undefined,
		};
		applyPlayerProjectileModifiers(config, false);
		spawnProjectile(config);
	}
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
	projectileTags: string[],
	inheritPlayerModifiers: boolean = false
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
	if (inheritPlayerModifiers) applyPlayerProjectileModifiers(config, false);

	return spawnProjectile(config);
}

function applyPlayerProjectileModifiers(
	config: ProjectileConfig,
	allowSplit: boolean
) {
	const modifierFallbacks = {
		piercing: config.piercing ? { ...config.piercing } : undefined,
		chain: config.chain
			? { ...config.chain, targetTags: [...config.chain.targetTags] }
			: undefined,
		split: config.split ? { ...config.split } : undefined,
		gravity: config.gravity
			? {
					...config.gravity,
					targetTags: config.gravity.targetTags
						? [...config.gravity.targetTags]
						: undefined,
				}
			: undefined,
	};

	if (player.projectilePierces > 0) {
		const builtInPierces = config.piercing?.maxPierces ?? 0;
		config.piercing = {
			maxPierces: builtInPierces + player.projectilePierces,
			damageReduction: config.piercing?.damageReduction ?? Math.min(
				0.91,
				0.75 + (player.projectilePierces - 1) * 0.04
			),
		};
	}

	if (player.projectileBounceCount > 0) {
		config.bounce = {
			maxBounces: player.projectileBounceCount,
			speedRetention: 1,
			damageRetention: player.projectileBounceDamageRetention,
			stripPlayerModifiers: true,
			inheritPlayerModifiers:
				player.ricochetInheritsModifiers !== undefined,
			modifierFallbacks,
		};
	}

	if (player.projectileSlowPercentage > 0) {
		config.slow = {
			duration:
				1.25 +
				Math.max(0, (player.projectileSlowPercentage - 0.15) / 0.1) * 0.25,
			slowPercentage: player.projectileSlowPercentage,
			effectType: "stars",
		};
	}

	if (player.projectileDotDamage > 0) {
		config.damageTick = {
			damagePerTick: player.projectileDotDamage,
			tickInterval: 0.5,
			duration:
				2 + Math.max(0, (player.projectileDotDamage - 0.5) / 0.5) * 0.25,
			effectType: "spark",
		};
	}

	if (player.projectileChainCount > 0) {
		const builtInChains = config.chain?.maxChains ?? 0;
		config.chain = {
			maxChains: builtInChains + player.projectileChainCount,
			chainDistance: config.chain?.chainDistance ?? 170,
			damageReduction: config.chain?.damageReduction ?? Math.min(
				0.75,
				0.55 + (player.projectileChainCount - 2) * 0.05
			),
			targetTags: [tags.enemy, tags.unit],
		};
	}

	if (allowSplit && player.projectileSplitCount > 0) {
		const totalDamageMultiplier =
			1.2 + (player.projectileSplitCount - 2) * 0.1;
		config.split = {
			splitCount: player.projectileSplitCount,
			splitAngle: 28,
			splitDelay: 0.25,
			speedMultiplier: 0.9,
			damageMultiplier:
				totalDamageMultiplier / player.projectileSplitCount,
		};
	}

	if (player.projectileGravityStrength > 0) {
		config.gravity = {
			strength: player.projectileGravityStrength,
			range:
				110 + Math.min(60, (player.projectileGravityStrength - 50) * 0.5),
			falloff: 1,
			targetTags: [tags.enemy, tags.unit],
		};
	}

	if (player.projectileFragmentCount > 0) {
		config.fragment = {
			count: player.projectileFragmentCount,
			spreadAngle: 150,
			damageMultiplier: player.projectileFragmentDamage,
		};
	}

	if (player.projectileGuidance > 0) {
		config.seek = {
			enabled: true,
			acquireDelay: 0.08,
			seekDistance: Math.max(
				player.projectileGuidanceDistance,
				config.seek?.seekDistance ?? 0
			),
			turnSpeed: Math.max(
				player.projectileGuidance,
				config.seek?.turnSpeed ?? 0
			),
			targetTags: [tags.enemy],
		};
	}

	if (player.projectileProximityRadius > 0) {
		config.proximity = {
			radius: player.projectileProximityRadius,
			explosionRadius: player.projectileProximityRadius * 1.15,
			damageMultiplier: player.projectileProximityDamage,
			targetTags: [tags.enemy, tags.unit],
		};
	}

	if (player.projectileEchoCount > 0) {
		config.echo = {
			count: player.projectileEchoCount,
			delay: 0.16,
			damageMultiplier: player.projectileEchoDamage,
		};
	}

	if (player.projectileReturnSpeed > 0) {
		config.returning = {
			delay: player.projectileReturnDelay,
			speedMultiplier: player.projectileReturnSpeed,
			turnDuration: 0.28,
		};
	}

	if (player.projectileGrowthDamage > 0) {
		config.growth = {
			maxDistance: 420,
			maxScale: player.projectileGrowthScale,
			maxDamageMultiplier: player.projectileGrowthDamage,
		};
	}

	if (player.projectileAcceleration > 0) {
		config.accelerate = {
			acceleration: player.projectileAcceleration,
			maxSpeed: config.speed * 3.2,
			minSpeed: config.speed * 0.4,
		};
	}

	if (player.projectileOrbitRadius > 0) {
		config.spiral = {
			rotationSpeed: 520,
			radius: player.projectileOrbitRadius,
		};
	}

	if (player.projectileStasisRadius > 0 && config.slow) {
		config.slow.stasisBurst = {
			radius: player.projectileStasisRadius,
			duration: config.slow.duration * 0.8,
			slowPercentage: config.slow.slowPercentage,
		};
	}

	if (player.projectileVolatileRadius > 0 && config.damageTick) {
		config.volatile = {
			radius: player.projectileVolatileRadius,
			damage: player.projectileVolatileDamage,
			spreadDuration: config.damageTick.duration * 0.75,
			spreadDamagePerTick: config.damageTick.damagePerTick * 0.7,
		};
	}

	if (player.projectileCriticalShards > 0) {
		config.criticalShatter = {
			count: player.projectileCriticalShards,
			spreadAngle: 110,
			damageMultiplier: player.projectileCriticalShardDamage,
		};
	}

	if (player.projectileExecutionDamage > 0) {
		config.execution = {
			healthThreshold: player.projectileExecutionThreshold,
			damageMultiplier: player.projectileExecutionDamage,
		};
	}

	if (player.projectilePaintDamage > 0) {
		config.paint = {
			damagePerStack: player.projectilePaintDamage,
			maxStacks: player.projectilePaintStacks,
			duration: 3,
		};
	}

	if (player.projectileMineDuration > 0) {
		config.mine = {
			duration: player.projectileMineDuration,
			chance: player.projectileMineChance,
			placementDistance: 100,
			armDelay: 2,
			triggerRadius: 34,
			explosionRadius: 58,
			damageMultiplier: player.projectileMineDamage,
		};
	}

	if (player.projectilePhasePierces > 0) {
		config.piercing = {
			maxPierces:
				(config.piercing?.maxPierces ?? 0) +
				player.projectilePhasePierces,
			damageReduction: Math.max(
				config.piercing?.damageReduction ?? 0,
				0.94
			),
		};
	}
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
	applyPlayerProjectileModifiers(config, false);

	return spawnProjectile(config);
}

// Enemy Blaster
export function spawnEnemyBlaster(
	pos: Vec2,
	dir: Vec2,
	rot: number,
	damage: number,
	damageSource: { name: string; sprite?: string } = {
		name: "ENEMY SHIP",
		sprite: "enemy_ship1_body",
	}
) {
	const config: ProjectileConfig = {
		pos,
		dir,
		rotation: rot,
		sprite: "bullet1",
		speed: BULLET_SPEED,
		speedMultiplier: 0.8,
		damageSource,
		tags: [tags.enemy, tags.blaster],
		impact: {
			damage,
		},
		fireSound: "shoot1",
	};

	return spawnProjectile(config);
}
