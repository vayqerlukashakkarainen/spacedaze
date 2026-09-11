import type { GameObj, PosComp, Vec2 } from "kaplay";
import { BULLET_SPEED, k, ROCKET_SPEED } from "../../main";
import { tags } from "../../tags";
import {
	getTargetWorldPosition,
	isProjectileTargetForTags,
} from "./targetingService";
import {
	ProjectileConfig,
	ProjectileModifierVisualKey,
} from "../../projectiles/projectileConfig";
import {
	placeProjectileInFrontOfMuzzle,
	spawnProjectile,
} from "./projectileService";
import { player, session } from "../../player";
import { getEquippedWeapon } from "../player/weaponService";
import { getPrimaryWeaponDamage as getScaledPrimaryWeaponDamage } from "../player/playerCombatScalingService"
import { spawnFlash } from "../../spawn/spawnFlash";
import { getAbilityTierValues } from "../abilities/abilityTierService";
import { isEnemyEmpDisrupted } from "../enemies/enemyEmpService"
import {
	rollPlayerProjectileModifier,
} from "./playerProjectileModifierChance"
import type { PlayerProjectileModifierUpgradeKey } from "./playerProjectileModifierChance"

const ROCKET_ACQUIRE_DELAY = 0.2;
const ROCKET_TURN_SPEED = 0.065;
const RAIL_LANCE_MIN_KNOCKBACK_MULTIPLIER = 0.04;
const SPLIT_CHAMBER_MAX_DISTANCE = 520;
const PLAYER_WEAPON_PROJECTILE_SPEED_MULTIPLIER = 1.5;
const MISSILE_VISUAL_PULSE = {
	amplitude: 0.2,
	frequency: 12,
};

export interface BasicBlasterOptions {
	suppressHitRecoil?: boolean
}

// Basic Blaster
export function spawnBasicBlaster(
	pos: Vec2,
	dir: Vec2,
	rot: number,
	damage: number,
	speedMultiplier: number,
	projectileTags: string[],
	inheritPlayerModifiers: boolean = false,
	options: BasicBlasterOptions = {}
) {
	const config: ProjectileConfig = {
		pos,
		dir,
		rotation: rot,
		sprite: "bullet1",
		speed: BULLET_SPEED,
		speedMultiplier,
		tags: projectileTags,
		suppressHitRecoil: options.suppressHitRecoil,
		impact: {
			damage,
			damageMultiplier: 1,
		},
		fireSound: "shoot1",
	};
	placeProjectileInFrontOfMuzzle(config, pos, 1)
	if (inheritPlayerModifiers) applyPlayerProjectileModifiers(config, true);

	return spawnProjectile(config);
}

export interface PlayerBlasterShotOptions {
	angleOffset?: number
	damageMultiplier?: number
	speedMultiplier?: number
	playFireSound?: boolean
	fireSoundDetune?: number
	isFullyCharged?: boolean
	chargeRatio?: number
	critChanceBonus?: number
	ultimateChargeMultiplier?: number
	preferredTarget?: GameObj<PosComp>
	alteredTargeting?: boolean
	splitTargetPosition?: Vec2
	wigglePhase?: number
	spreadMultiplier?: number
}

// Player Blaster with all modifiers
export function spawnPlayerBlaster(
	pos: Vec2,
	dir: Vec2,
	rot: number,
	shotOptions: PlayerBlasterShotOptions = {}
) {
	const weapon = getEquippedWeapon();
	const spreadMultiplier = shotOptions.spreadMultiplier ?? 1
	const spreadAngle = k.rand(
		-weapon.spreadDegrees * spreadMultiplier,
		weapon.spreadDegrees * spreadMultiplier
	) + (shotOptions.angleOffset ?? 0);
	const impactDamage = player.blasterDmg *
		weapon.damageMultiplier *
		(shotOptions.damageMultiplier ?? 1);
	const projectileTint = weapon.projectileTint
		? k.rgb(...weapon.projectileTint)
		: undefined;
	const projectileDirection = k.Vec2.fromAngle(rot + spreadAngle - 90)
	const isFullyChargedWeapon =
		weapon.charge !== undefined && shotOptions.isFullyCharged === true;
	const isFullyChargedRailLance =
		weapon.id === "railLance" && isFullyChargedWeapon;
	const isFullyChargedTwinNeedle =
		weapon.id === "twinNeedle" && isFullyChargedWeapon;
	const isFullyChargedRailgun =
		weapon.id === "railgun" && isFullyChargedWeapon;
	const chargeRatio = k.clamp(shotOptions.chargeRatio ?? 0, 0, 1)
	const chargeScale = weapon.charge?.projectileScaleMultiplier
		? k.lerp(
			weapon.charge.projectileScaleMultiplier.min,
			weapon.charge.projectileScaleMultiplier.max,
			chargeRatio
		)
		: isFullyChargedWeapon
			? 1.5
			: 1
	const chargePiercing = weapon.charge?.piercing
	const chargePierces = chargePiercing
		? Math.min(
			chargePiercing.maxPierces,
			Math.floor(k.lerp(
				chargePiercing.minPierces,
				chargePiercing.maxPierces + 0.999,
				chargeRatio
			))
		)
		: 0
	const knockbackStrength = weapon.knockback === undefined
		? undefined
		: weapon.id === "railLance" || weapon.id === "railgun"
			? scaleChargedKnockback(
				weapon.knockback,
				shotOptions.chargeRatio ?? (isFullyChargedWeapon ? 1 : 0)
			)
			: weapon.knockback;
	const arsenalSpeedMultiplier =
		weapon.id === "railLance" || weapon.id === "railgun"
			? 1
			: PLAYER_WEAPON_PROJECTILE_SPEED_MULTIPLIER;
	const inheritedSpeedMultiplier =
		player.blasterSpeedMultiplier *
		(shotOptions.speedMultiplier ?? 1) *
		arsenalSpeedMultiplier;
	const projectileSpeed = getPlayerWeaponProjectileSpeed(
		shotOptions.speedMultiplier ?? 1
	)
	const config: ProjectileConfig = {
		pos,
		dir: projectileDirection,
		rotation: rot + spreadAngle,
		sprite: weapon.projectileSprite ?? "bullet1",
		tint: projectileTint,
		effectTint:
			weapon.splash || isFullyChargedWeapon ? projectileTint : undefined,
		flashLikeThruster: weapon.projectileFlash,
		flashMinOpacity: weapon.projectileFlashMinOpacity,
		visualWobble: weapon.projectileWobble,
		visualScale: (weapon.projectileScale ?? 1) * chargeScale,
		visualLengthScale: weapon.projectileLengthScale,
		persistOffscreen: weapon.returning !== undefined,
		explosionDelay: weapon.explosionDelay,
		speed: BULLET_SPEED,
		speedMultiplier: projectileSpeed / BULLET_SPEED,
		tags: [tags.friendly, tags.blaster],
		combatCredit: {
			kind: "primary",
			id: weapon.id,
			ultimateCharge:
				weapon.ultimateChargePerHit *
				(shotOptions.ultimateChargeMultiplier ?? 1),
		},
		impact: {
			damage: impactDamage,
			damageMultiplier: player.blasterDmgMultiplier,
		},
		crit: {
			chance: player.critChance + (shotOptions.critChanceBonus ?? 0),
			multiplier: player.critMultiplier,
		},
		piercing: chargePierces > 0
			? {
				maxPierces: chargePierces,
				damageReduction: chargePiercing?.damageReduction ?? 0.8,
			}
			: undefined,
		lifesteal: weapon.lifesteal
			? { healthRatio: weapon.lifesteal }
			: undefined,
		lifespan: weapon.lifespan
			? { duration: weapon.lifespan }
			: undefined,
		splash: weapon.splash
			? {
				damage: impactDamage * weapon.splash.damageMultiplier,
				radius: weapon.splash.radius,
				damageMultiplier: player.blasterDmgMultiplier,
			}
			: undefined,
		proximity: weapon.proximityRadius && weapon.splash
			? {
				radius: weapon.proximityRadius,
				explosionRadius: weapon.splash.radius,
				damageMultiplier: weapon.splash.damageMultiplier,
				targetTags: [tags.enemy, tags.unit],
				fullExplosionVisual: true,
			}
			: undefined,
		knockback: knockbackStrength !== undefined
			? { strength: knockbackStrength }
			: undefined,
		accelerate: weapon.projectileAcceleration
			? {
				acceleration:
					weapon.projectileAcceleration.acceleration *
					inheritedSpeedMultiplier,
				maxSpeed:
					BULLET_SPEED *
					weapon.projectileAcceleration.maxSpeedMultiplier *
					inheritedSpeedMultiplier,
			}
			: undefined,
		spin: weapon.projectileSpin
			? {
				...weapon.projectileSpin,
				direction: "random",
			}
			: undefined,
		bounce: weapon.bounce ? { ...weapon.bounce } : undefined,
		wiggle: weapon.pattern?.wiggle
			? {
				amplitude: weapon.pattern.wiggle.amplitude,
				frequency: weapon.pattern.wiggle.frequency,
				phase: shotOptions.wigglePhase ?? 0,
			}
			: undefined,
		trail: isFullyChargedRailLance ||
			isFullyChargedTwinNeedle ||
			isFullyChargedRailgun
			? {
				emitterType: isFullyChargedRailgun ? "railgun" : "boost",
				offset: isFullyChargedRailgun
					? 4
					: isFullyChargedTwinNeedle
						? 6
						: 8,
				particleCount: isFullyChargedRailgun ? 3 : 2,
			}
			: undefined,
		fireSound: shotOptions.playFireSound === false
			? undefined
			: weapon.fireSound ?? "shoot1",
		fireSoundVolume: weapon.fireSoundVolume,
		fireSoundDetune: shotOptions.fireSoundDetune ?? weapon.fireSoundDetune,
		explosionSoundPool: weapon.explosionSoundPool,
		explosionSoundVolume: weapon.explosionSoundVolume,
	};
	placeProjectileInFrontOfMuzzle(
		config,
		pos,
		weapon.projectileSpawnOffset ?? 0
	)
	const preferredTarget = shotOptions.preferredTarget?.exists()
		? shotOptions.preferredTarget
		: undefined
	if (preferredTarget && weapon.targetingGuidance) {
		config.seek = {
			enabled: true,
			acquireDelay: weapon.targetingGuidance.acquireDelay ?? 0,
			seekDistance: getTargetWorldPosition(preferredTarget).dist(pos) + 64,
			turnSpeed: weapon.targetingGuidance.turnSpeed,
			targetTags: [tags.enemy],
		}
	}
	if (weapon.piercing) {
		config.piercing = { ...weapon.piercing };
	}
	if (weapon.chain) {
		config.chain = {
			...weapon.chain,
			targetTags: [tags.enemy, tags.unit],
		};
	}
	applyPlayerProjectileModifiers(
		config,
		true,
		Boolean(preferredTarget),
		shotOptions.splitTargetPosition
	);
	if (weapon.returning) config.returning = { ...weapon.returning }
	if (weapon.mine) config.mine = { ...weapon.mine }
	if (weapon.hitCombo) config.hitCombo = { ...weapon.hitCombo }
	config.componentDamageMultiplier = weapon.componentDamageMultiplier
	config.impactFragment = weapon.impactFragment
		? { ...weapon.impactFragment }
		: undefined
	if (shotOptions.alteredTargeting && preferredTarget) {
		config.seek = {
			enabled: true,
			acquireDelay: 0,
			seekDistance: Math.max(
				config.seek?.seekDistance ?? 0,
				getTargetWorldPosition(preferredTarget).dist(pos) + 180
			),
			turnSpeed: Math.max(config.seek?.turnSpeed ?? 0, 0.065),
			targetTags: [tags.enemy],
		}
		config.piercing = {
			maxPierces: (config.piercing?.maxPierces ?? 0) + 2,
			damageReduction: Math.max(
				config.piercing?.damageReduction ?? 0,
				0.9
			),
		}
	}
	spawnFlash(
		pos,
		isFullyChargedWeapon ? 6 : 3,
		weapon.projectileFlash || isFullyChargedWeapon
			? projectileTint
			: undefined
	);

	const projectile = spawnProjectile(config)
	return config.seek
		? applyPreferredProjectileTarget(projectile, preferredTarget)
		: projectile
}

export function getPlayerWeaponProjectileSpeed(
	shotSpeedMultiplier: number = 1
) {
	const weapon = getEquippedWeapon()
	const arsenalSpeedMultiplier =
		weapon.id === "railLance" || weapon.id === "railgun" ? 1 : 1.5
	const speed = BULLET_SPEED *
		player.blasterSpeedMultiplier *
		shotSpeedMultiplier *
		arsenalSpeedMultiplier *
		weapon.projectileSpeedMultiplier
	return weapon.projectileSpeedCap === undefined
		? speed
		: Math.min(speed, weapon.projectileSpeedCap)
}

function scaleChargedKnockback(maxStrength: number, chargeRatio: number) {
	const charge = k.clamp(chargeRatio, 0, 1);
	const multiplier = k.lerp(
		RAIL_LANCE_MIN_KNOCKBACK_MULTIPLIER,
		1,
		charge * charge
	);
	return maxStrength * multiplier;
}

export function spawnPrimaryLinkedRocket(
	pos: Vec2,
	dir: Vec2,
	rot: number,
	preferredTarget?: GameObj
) {
	const inheritedDamage = getPrimaryWeaponDamage();
	const config: ProjectileConfig = {
		pos,
		dir,
		rotation: rot,
		sprite: "missile_passive",
		visualScale: 0.5,
		visualPulse: MISSILE_VISUAL_PULSE,
		speed: ROCKET_SPEED,
		speedMultiplier: 1,
		tags: [tags.friendly, tags.rocket],
		combatCredit: {
			kind: "primary",
			id: getEquippedWeapon().id,
			explosive: true,
			ultimateCharge: getEquippedWeapon().ultimateChargePerHit,
		},
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
			acquireDelay: ROCKET_ACQUIRE_DELAY,
			seekDistance: player.rocketSeekDistance,
			turnSpeed: ROCKET_TURN_SPEED,
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
		explosionSoundPool: "general",
	};
	placeProjectileInFrontOfMuzzle(config, pos, 2)
	applyPlayerProjectileModifiers(config, false);

	return applyPreferredProjectileTarget(
		spawnProjectile(config),
		preferredTarget
	);
}

function applyPreferredProjectileTarget(
	projectile: GameObj,
	preferredTarget?: GameObj
) {
	if (
		!preferredTarget ||
		!isProjectileTargetForTags(preferredTarget, projectile.targetTags ?? [])
	) return projectile;
	projectile.targetUnit = preferredTarget;
	preferredTarget.onDestroy(() => {
		if (
			projectile.exists() &&
			projectile.targetUnit?.id === preferredTarget.id
		) projectile.targetUnit = null;
	});
	return projectile;
}

export function getPrimaryWeaponDamage() {
	return getScaledPrimaryWeaponDamage();
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
			combatCredit: { kind: "mobility", id: "phaseJump" },
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
	inheritPlayerModifiers: boolean = false,
	preferredTarget?: GameObj
) {
	const config: ProjectileConfig = {
		pos,
		dir,
		rotation: rot,
		sprite: "missile_passive",
		visualScale: 0.5,
		visualPulse: MISSILE_VISUAL_PULSE,
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
					acquireDelay: ROCKET_ACQUIRE_DELAY,
					seekDistance: 200,
					turnSpeed: ROCKET_TURN_SPEED,
					targetTags: [tags.enemy],
				}
			: undefined,
		trail: {
			emitterType: "trail",
			offset: 12,
			particleCount: 1,
		},
		fireSound: "fire_rocket1",
		explosionSoundPool: "general",
	};
	if (inheritPlayerModifiers) applyPlayerProjectileModifiers(config, false);

	return applyPreferredProjectileTarget(
		spawnProjectile(config),
		preferredTarget
	);
}

function markLoadedProjectileModifier(
	config: ProjectileConfig,
	modifier: ProjectileModifierVisualKey
) {
	config.loadedModifierVisuals ??= [];
	if (!config.loadedModifierVisuals.includes(modifier)) {
		config.loadedModifierVisuals.push(modifier);
	}
}

function applyPlayerProjectileModifiers(
	config: ProjectileConfig,
	allowSplit: boolean,
	targetModeActive = false,
	splitTargetPosition?: Vec2
) {
	const projectileDamage = getConfiguredProjectileDamage(config)
	const inherits = (key: PlayerProjectileModifierUpgradeKey) =>
		rollPlayerProjectileModifier(key, () => k.rand())
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
		lifesteal: config.lifesteal ? { ...config.lifesteal } : undefined,
	};

	if (player.projectilePierces > 0 && inherits("armorPiercing")) {
		markLoadedProjectileModifier(config, "piercing");
		const builtInPierces = config.piercing?.maxPierces ?? 0;
		config.piercing = {
			maxPierces: builtInPierces + player.projectilePierces,
			damageReduction: config.piercing?.damageReduction ?? Math.min(
				0.91,
				0.75 + (player.projectilePierces - 1) * 0.04
			),
		};
	}

	if (player.projectileBounceCount > 0 && inherits("ricochetRounds")) {
		markLoadedProjectileModifier(config, "bounce");
		const builtInBounceCount = config.bounce?.maxBounces ?? 0;
		const builtInDamageRetention = config.bounce?.damageRetention ?? 0.7;
		config.bounce = {
			maxBounces: builtInBounceCount + player.projectileBounceCount,
			speedRetention: config.bounce?.speedRetention ?? 1,
			damageRetention: Math.max(
				builtInDamageRetention,
				player.projectileBounceDamageRetention
			),
			seekNextTarget: config.bounce?.seekNextTarget,
			seekDistance: config.bounce?.seekDistance,
			stripPlayerModifiers: true,
			inheritPlayerModifiers:
				player.ricochetInheritsModifiers !== undefined,
			modifierFallbacks,
		};
	}

	if (player.projectileSlowPercentage > 0 && inherits("cryoRounds")) {
		markLoadedProjectileModifier(config, "slow");
		config.slow = {
			duration:
				1.25 +
				Math.max(0, (player.projectileSlowPercentage - 0.15) / 0.1) * 0.25,
			slowPercentage: player.projectileSlowPercentage,
			effectType: "stars",
		};
	}

	if (player.projectileStunDuration > 0 && inherits("stunRounds")) {
		markLoadedProjectileModifier(config, "stun");
		config.stun = {
			chance: 1,
			duration: player.projectileStunDuration,
		}
	}

	if (player.projectileEmpDuration > 0 && inherits("empRounds")) {
		markLoadedProjectileModifier(config, "emp");
		config.emp = {
			chance: 1,
			duration: player.projectileEmpDuration,
			slowPercentage: player.projectileEmpSlowPercentage,
		}
	}

	if (player.projectileDotDamage > 0 && inherits("corrosivePayload")) {
		markLoadedProjectileModifier(config, "damageTick");
		config.damageTick = {
			damagePerTick: projectileDamage * player.projectileDotDamage,
			tickInterval: 0.5,
			duration:
				2 + Math.max(0, (player.projectileDotDamage - 0.25) / 0.25) * 0.25,
			effectType: "spark",
		};
	}

	if (player.projectileChainCount > 0 && inherits("arcCapacitor")) {
		markLoadedProjectileModifier(config, "chain");
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

	if (player.projectileLifesteal > 0 && inherits("lifesteal")) {
		markLoadedProjectileModifier(config, "lifesteal");
		config.lifesteal = {
			healthRatio:
				(config.lifesteal?.healthRatio ?? 0) +
				player.projectileLifesteal,
		}
	}

	if (
		allowSplit &&
		player.projectileSplitCount > 0 &&
		inherits("splitChamber")
	) {
		markLoadedProjectileModifier(config, "split");
		const totalDamageMultiplier =
			1.2 + (player.projectileSplitCount - 2) * 0.1;
		config.split = {
			splitCount: player.projectileSplitCount,
			splitAngle: 28,
			maxDistance: SPLIT_CHAMBER_MAX_DISTANCE,
			targetPosition: splitTargetPosition?.clone(),
			impactLeadDistance: 50,
			speedMultiplier: 0.9,
			damageMultiplier:
				totalDamageMultiplier / player.projectileSplitCount,
		};
	}

	if (
		player.projectileGravityStrength > 0 &&
		inherits("singularityPayload")
	) {
		markLoadedProjectileModifier(config, "gravity");
		config.gravity = {
			strength: player.projectileGravityStrength,
			range:
				110 + Math.min(60, (player.projectileGravityStrength - 50) * 0.5),
			falloff: 1,
			targetTags: [tags.enemy, tags.unit],
		};
	}

	if (
		player.projectileFragmentCount > 0 &&
		inherits("fragmentationCore")
	) {
		markLoadedProjectileModifier(config, "fragment");
		config.fragment = {
			count: player.projectileFragmentCount,
			spreadAngle: 150,
			damageMultiplier: player.projectileFragmentDamage,
		};
	}

	if (
		targetModeActive &&
		player.projectileGuidance > 0 &&
		inherits("hunterGuidance")
	) {
		markLoadedProjectileModifier(config, "seek");
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

	if (
		player.projectileProximityRadius > 0 &&
		inherits("proximityFuse")
	) {
		markLoadedProjectileModifier(config, "proximity");
		const weaponProximity = config.proximity
		config.proximity = {
			radius: Math.max(
				player.projectileProximityRadius,
				weaponProximity?.radius ?? 0
			),
			explosionRadius: Math.max(
				player.projectileProximityRadius * 1.15,
				weaponProximity?.explosionRadius ?? 0
			),
			damageMultiplier: Math.max(
				player.projectileProximityDamage,
				weaponProximity?.damageMultiplier ?? 0
			),
			targetTags: weaponProximity?.targetTags ?? [tags.enemy, tags.unit],
			fullExplosionVisual: weaponProximity?.fullExplosionVisual,
		};
	}

	if (player.projectileEchoCount > 0 && inherits("afterimageRounds")) {
		markLoadedProjectileModifier(config, "echo");
		config.echo = {
			count: player.projectileEchoCount,
			delay: 0.16,
			damageMultiplier: player.projectileEchoDamage,
		};
	}

	if (player.projectileGrowthDamage > 0 && inherits("growingCharge")) {
		markLoadedProjectileModifier(config, "growth");
		config.growth = {
			maxDistance: 420,
			maxScale: player.projectileGrowthScale,
			maxDamageMultiplier: player.projectileGrowthDamage,
		};
	}

	if (
		player.projectileStasisRadius > 0 &&
		config.slow &&
		inherits("stasisBurst")
	) {
		markLoadedProjectileModifier(config, "slow");
		config.slow.stasisBurst = {
			radius: player.projectileStasisRadius,
			duration: config.slow.duration * 0.8,
			slowPercentage: config.slow.slowPercentage,
		};
	}

	if (
		player.projectileVolatileRadius > 0 &&
		config.damageTick &&
		inherits("volatileCorrosion")
	) {
		markLoadedProjectileModifier(config, "volatile");
		config.volatile = {
			radius: player.projectileVolatileRadius,
			damage: projectileDamage * player.projectileVolatileDamage,
			spreadDuration: config.damageTick.duration * 0.75,
			spreadDamagePerTick: config.damageTick.damagePerTick * 0.7,
		};
	}

	if (
		player.projectileCriticalShards > 0 &&
		inherits("criticalShatter")
	) {
		markLoadedProjectileModifier(config, "criticalShatter");
		config.criticalShatter = {
			count: player.projectileCriticalShards,
			spreadAngle: 110,
			damageMultiplier: player.projectileCriticalShardDamage,
		};
	}

	if (
		player.projectileExecutionDamage > 0 &&
		inherits("executionRounds")
	) {
		markLoadedProjectileModifier(config, "execution");
		config.execution = {
			healthThreshold: player.projectileExecutionThreshold,
			damageMultiplier: player.projectileExecutionDamage,
		};
	}

	if (player.projectilePaintDamage > 0 && inherits("targetPainter")) {
		markLoadedProjectileModifier(config, "paint");
		config.paint = {
			damagePerStack: player.projectilePaintDamage,
			maxStacks: player.projectilePaintStacks,
			duration: 3,
		};
	}

	if (
		player.projectileMineDuration > 0 &&
		!config.mine &&
		inherits("mineLayer")
	) {
		markLoadedProjectileModifier(config, "mine");
		config.mine = {
			duration: player.projectileMineDuration,
			chance: 1,
			placementDistance: 100,
			placementCount: 5,
			placementDuration: 3,
			followPlayer: true,
			armDelay: 2,
			triggerRadius: 34,
			explosionRadius: 58,
			damageMultiplier: player.projectileMineDamage,
			maxActive: 15,
			replaceOldest: true,
		};
	}

	if (player.projectilePhasePierces > 0 && inherits("voidLance")) {
		markLoadedProjectileModifier(config, "piercing");
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

function getConfiguredProjectileDamage(config: ProjectileConfig) {
	if (config.impact) {
		return config.impact.damage * (config.impact.damageMultiplier ?? 1)
	}
	if (config.splash) {
		return config.splash.damage * (config.splash.damageMultiplier ?? 1)
	}
	return 0
}

// Player Rocket with all player modifiers
export function spawnPlayerRocket(
	pos: Vec2,
	dir: Vec2,
	rot: number,
	preferredTarget?: GameObj
) {
	const tier = getAbilityTierValues("rocketPod");
	const config: ProjectileConfig = {
		pos,
		dir,
		rotation: rot,
		sprite: "missile_player",
		visualScale: 0.5,
		visualPulse: MISSILE_VISUAL_PULSE,
		speed: ROCKET_SPEED,
		speedMultiplier: tier.speed,
		tags: [tags.friendly, tags.rocket],
		combatCredit: { kind: "secondary", id: "rocketPod", explosive: true },
		impact: {
			damage: player.rocketImpactDmg,
			damageMultiplier: player.rocketDmgMultiplier * tier.power,
		},
		splash: {
			damage: player.rocketSplashDmg,
			radius:
				player.rocketSplashSize *
				player.rocketSplashSizeMultiplier *
				tier.speed,
			damageMultiplier: player.rocketDmgMultiplier * tier.power,
			damageFalloff: player.rocketSplashDmgFallOverDistance,
			falloffDistance: player.rocketSplashDmgFallDistanceValue,
		},
		seek: {
			enabled: true,
			acquireDelay: ROCKET_ACQUIRE_DELAY,
			seekDistance: player.rocketSeekDistance,
			turnSpeed: ROCKET_TURN_SPEED,
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
	placeProjectileInFrontOfMuzzle(config, pos, 2)
	applyPlayerProjectileModifiers(config, false);

	return applyPreferredProjectileTarget(
		spawnProjectile(config),
		preferredTarget
	);
}

// Enemy Blaster
export function spawnEnemyBlaster(
	pos: Vec2,
	dir: Vec2,
	rot: number,
	damage: number,
	damageSource: { name: string; sprite?: string } = {
		name: "ENEMY SHIP",
		sprite: "enemy_fighter_core",
	},
	attacker: GameObj
) {
	if (isEnemyEmpDisrupted(attacker)) return undefined
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
		fireSound: "enemy_blaster_fire",
		fireSoundVolume: 0.7,
	};

	return spawnProjectile(config);
}
