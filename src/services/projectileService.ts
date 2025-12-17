import { GameObj } from "kaplay";
import {
	dtScaled,
	k,
	mainSoundVolume,
	subSoundVolume,
	timeScale,
} from "../main";
import { audioService } from "./audioService";
import { timescale } from "../comp/timescale";
import { createExplosion, pickUnitInDistance, projectiles } from "../game";
import { tags } from "../tags";
import { spawnFlash } from "../spawn/spawnFlash";
import {
	debreeRocketEmitter,
	dustTrailEmitter,
	sparkEmitter,
	starsEmitter,
	trailEmitter,
} from "../particles";
import { lerpAngleBetweenPos, lerpMoveRotateAndScale } from "../shared";
import { chance } from "../powerups";
import type {
	BounceModifier,
	ChainModifier,
	CritModifier,
	ImpactModifier,
	LifespanModifier,
	OnDestroyModifier,
	PiercingModifier,
	ProjectileConfig,
	SeekModifier,
	SplashModifier,
	TrailModifier,
} from "../projectiles/projectileConfig";

export function spawnProjectile(config: ProjectileConfig): GameObj {
	// Calculate final speed
	const finalSpeed = config.speed * (config.speedMultiplier ?? 1);

	// Build component list
	const components: any[] = [
		k.pos(config.pos),
		k.area(),
		k.rotate(config.rotation),
		timescale(),
		k.offscreen({ destroy: true }),
		k.anchor("center"),
		k.sprite(config.sprite),
		k.scale(1),
		{
			speed: finalSpeed,
			dir: config.dir,
			lifetime: 0,
		},
		...[...config.tags, tags.gameLoopUi],
	];

	const proj = k.add(components);

	// Apply modifiers
	applyImpactModifier(proj, config.impact);
	applySplashModifier(proj, config.splash);
	applySeekModifier(proj, config.seek);
	applyCritModifier(proj, config.crit);
	applyTrailModifier(proj, config.trail);
	applyPiercingModifier(proj, config.piercing);
	applyBounceModifier(proj, config.bounce);
	applyChainModifier(proj, config.chain);
	applyLifespanModifier(proj, config.lifespan);
	applyOnDestroyModifier(proj, config.onDestroy);

	// Play fire sound
	if (config.fireSound) {
		audioService.playSound(config.fireSound, { volume: mainSoundVolume });
	}

	// Update loop
	proj.onUpdate(() => {
		proj.lifetime += dtScaled();

		// Check lifespan
		if (proj.lifespanDuration && proj.lifetime > proj.lifespanDuration) {
			k.destroy(proj);
			return;
		}

		// Trail rendering
		if (proj.trail) {
			updateTrail(proj);
		}

		// Seeking behavior
		if (proj.canSeek && proj.lifetime > proj.seekDelay) {
			updateSeeking(proj);
		}

		// Movement
		updateMovement(proj);
	});

	// On destroy
	proj.onDestroy(() => {
		// Remove from projectiles array
		const index = projectiles.findIndex((p) => p.id === proj.id);
		if (index !== -1) {
			projectiles.splice(index, 1);
		}

		// Play destroy sound
		if (config.destroySound) {
			audioService.playSound(config.destroySound, { volume: subSoundVolume });
		}

		// Flash effect
		spawnFlash(proj.pos, 5);

		// OnDestroy effects
		if (proj.onDestroyConfig) {
			handleOnDestroy(proj, config);
		}
	});

	// Add to projectiles array
	projectiles.push(proj);

	return proj;
}

// Modifier Application Functions

function applyImpactModifier(proj: GameObj, config?: ImpactModifier) {
	if (!config) return;
	proj.impactDamage = config.damage * (config.damageMultiplier ?? 1);
}

function applySplashModifier(proj: GameObj, config?: SplashModifier) {
	if (!config) return;
	proj.splashDamage = config.damage * (config.damageMultiplier ?? 1);
	proj.splashRadius = config.radius;
	proj.splashFalloff = config.damageFalloff ?? 0;
	proj.splashFalloffDist = config.falloffDistance ?? 0;
}

function applySeekModifier(proj: GameObj, config?: SeekModifier) {
	if (!config) return;
	proj.canSeek = config.enabled;
	proj.seekDistance = config.seekDistance ?? 200;
	proj.turnSpeed = config.turnSpeed ?? 0.04;
	proj.targetTags = config.targetTags;
	proj.seekDelay = config.acquireDelay ?? 0.5;
	proj.targetUnit = null;
}

function applyCritModifier(proj: GameObj, config?: CritModifier) {
	if (!config) return;
	proj.critChance = config.chance;
	proj.critMultiplier = config.multiplier;
	proj.critFlashSize = config.flashSize ?? 1.5;
	proj.critSound = config.sound ?? "crit1";
}

function applyTrailModifier(proj: GameObj, config?: TrailModifier) {
	if (!config) return;
	proj.trail = {
		type: config.emitterType,
		offset: config.offset ?? 12,
		count: config.particleCount ?? 1,
	};
}

function applyPiercingModifier(proj: GameObj, config?: PiercingModifier) {
	if (!config) return;
	proj.piercesRemaining = config.maxPierces;
	proj.pierceReduction = config.damageReduction ?? 0.8;
	proj.hitTargets = new Set();
}

function applyBounceModifier(proj: GameObj, config?: BounceModifier) {
	if (!config) return;
	proj.bouncesRemaining = config.maxBounces;
	proj.bounceSpeedRetention = config.speedRetention ?? 1.1;
	proj.bounceConfig = config;
	proj.hitTargets = new Set();
}

function applyChainModifier(proj: GameObj, config?: ChainModifier) {
	if (!config) return;
	proj.chainConfig = {
		maxChains: config.maxChains,
		chainDistance: config.chainDistance,
		damageReduction: config.damageReduction ?? 0.7,
		targetTags: config.targetTags,
		chainedTargets: new Set(),
	};
}

function applyLifespanModifier(proj: GameObj, config?: LifespanModifier) {
	if (!config) return;
	proj.lifespanDuration = config.duration;
}

function applyOnDestroyModifier(proj: GameObj, config?: OnDestroyModifier) {
	if (!config) return;
	proj.onDestroyConfig = config;
}

// Update Functions

function updateTrail(proj: GameObj) {
	const currentDir = k.Vec2.fromAngle(proj.angle - 90);
	const emitterPos = k.vec2(
		proj.pos.x - proj.trail.offset * currentDir.x,
		proj.pos.y - proj.trail.offset * currentDir.y
	);

	let emitter: any;
	switch (proj.trail.type) {
		case "trail":
			emitter = trailEmitter;
			break;
		case "spark":
			emitter = sparkEmitter;
			break;
		case "dust":
			emitter = dustTrailEmitter;
			break;
		case "stars":
			emitter = starsEmitter;
			break;
		default:
			emitter = trailEmitter;
	}

	emitter.emitter.position = emitterPos;
	emitter.emitter.direction = proj.angle;
	emitter.emit(proj.trail.count);
}

function updateSeeking(proj: GameObj) {
	if (proj.targetUnit == null) {
		pickUnitInDistance(proj.pos, proj.seekDistance, proj.targetTags[0], (u) => {
			proj.targetUnit = u;
			proj.targetUnit?.onDestroy(() => {
				proj.targetUnit = null;
			});
		});
	}
}

function updateMovement(proj: GameObj) {
	const speed = proj.speed * proj.getTimescale();

	if (proj.targetUnit) {
		// Homing movement
		const { lerp } = lerpAngleBetweenPos(
			proj.angle,
			proj.pos,
			proj.targetUnit.pos,
			proj.turnSpeed * timeScale * proj.getTimescale(),
			-90
		);
		lerpMoveRotateAndScale(proj, lerp, speed);
	} else {
		// Straight movement
		const currentDir = k.Vec2.fromAngle(proj.angle - 90);
		proj.move(
			k
				.vec2(currentDir.x * speed, currentDir.y * speed)
				.scale(dtScaled() * proj.getTimescale())
		);
	}
}

function handleBounce(target: GameObj, projectile: GameObj) {
	// Calculate normal (surface normal) from target center to projectile position
	// For circular objects, the normal is the vector from center to impact point
	const normal = projectile.pos.sub(target.pos).unit();

	// Get incident direction (current projectile direction)
	const incident = projectile.dir;

	// Reflect projectile direction across the normal
	// Formula: reflected = incident - 2 * (incident · normal) * normal
	const dotProduct = incident.dot(normal);
	const reflected = incident.sub(normal.scale(2 * dotProduct));

	// Update projectile direction and angle
	projectile.dir = reflected.unit();
	projectile.angle = k.rad2deg(k.Vec2.toAngle(projectile.dir)) + 90;

	// Increase speed (arcade-style energy boost)
	projectile.speed *= projectile.bounceSpeedRetention;

	// Decrement bounces
	projectile.bouncesRemaining--;

	// Mark target as hit to prevent immediate re-collision
	if (!projectile.hitTargets) {
		projectile.hitTargets = new Set();
	}
	projectile.hitTargets.add(target.id);
}

function handleOnDestroy(proj: GameObj, config: ProjectileConfig) {
	// Spawn projectiles on destroy
	if (proj.onDestroyConfig.spawnProjectiles) {
		const spawnConfig = proj.onDestroyConfig.spawnProjectiles;
		const angleStep = spawnConfig.spreadAngle / spawnConfig.count;

		for (let i = 0; i < spawnConfig.count; i++) {
			const angle = proj.angle + (i * angleStep - spawnConfig.spreadAngle / 2);
			const dir = k.Vec2.fromAngle(angle - 90);

			const newConfig: ProjectileConfig = {
				pos: proj.pos.clone(),
				dir: dir,
				rotation: angle,
				sprite: spawnConfig.config.sprite ?? config.sprite,
				speed: spawnConfig.config.speed ?? config.speed * 0.8,
				tags: spawnConfig.config.tags ?? config.tags,
				...spawnConfig.config,
			};

			// Inherit modifiers if specified
			if (spawnConfig.inheritModifiers) {
				if (config.impact) newConfig.impact = config.impact;
				if (config.splash) newConfig.splash = config.splash;
				if (config.crit) newConfig.crit = config.crit;
			}

			spawnProjectile(newConfig);
		}
	}

	// Explode effect
	if (proj.onDestroyConfig.explode && proj.splashRadius) {
		createExplosion(
			proj.pos,
			proj.splashRadius,
			proj.splashDamage,
			proj.splashFalloff,
			proj.splashFalloffDist
		);
		debreeRocketEmitter.emitter.position = proj.pos;
		debreeRocketEmitter.emitter.direction = proj.angle - 90;
		debreeRocketEmitter.emit(6);
	}
}

// Damage Application Helper (called from collision detection)

export function applyProjectileDamage(
	target: GameObj,
	projectile: GameObj
): boolean {
	// Check if already hit (for piercing)
	if (projectile.hitTargets && projectile.hitTargets.has(target.id)) {
		return false;
	}

	let shouldDestroy = true;

	// Apply impact damage with crit
	if (projectile.impactDamage !== undefined) {
		let damage = projectile.impactDamage;

		// Apply crit
		if (
			projectile.critChance !== undefined &&
			projectile.critMultiplier !== undefined
		) {
			if (chance(projectile.critChance, 100)) {
				damage *= projectile.critMultiplier;
				spawnFlash(projectile.pos, projectile.critFlashSize);
				audioService.playSound(projectile.critSound, {
					volume: mainSoundVolume,
				});
			}
		}

		target.hurt(damage);
	}

	// Apply splash damage
	if (
		projectile.splashDamage !== undefined &&
		projectile.splashRadius !== undefined
	) {
		createExplosion(
			projectile.pos,
			projectile.splashRadius,
			projectile.splashDamage,
			projectile.splashFalloff ?? 0,
			projectile.splashFalloffDist ?? 0
		);
	}

	// Handle bounce (takes priority over piercing)
	if (
		projectile.bouncesRemaining !== undefined &&
		projectile.bouncesRemaining > 0
	) {
		handleBounce(target, projectile);
		shouldDestroy = false;
	}
	// Handle piercing (only if not bouncing)
	else if (
		projectile.piercesRemaining !== undefined &&
		projectile.piercesRemaining > 0
	) {
		projectile.hitTargets.add(target.id);
		projectile.piercesRemaining--;
		projectile.impactDamage *= projectile.pierceReduction;
		shouldDestroy = false;
	}

	// Handle chain
	if (projectile.chainConfig && projectile.chainConfig.maxChains > 0) {
		handleChainLightning(target, projectile);
	}

	return shouldDestroy;
}

function handleChainLightning(target: GameObj, projectile: GameObj) {
	const config = projectile.chainConfig;

	if (config.chainedTargets.size >= config.maxChains) return;

	config.chainedTargets.add(target.id);

	// Find next target
	const units = k.query({ include: config.targetTags, includeOp: "and" });

	for (const unit of units) {
		if (config.chainedTargets.has(unit.id)) continue;
		if (unit.pos.dist(target.pos) > config.chainDistance) continue;

		// Apply reduced damage
		const chainDamage = projectile.impactDamage * config.damageReduction;
		unit.hurt(chainDamage);

		// Visual effect
		spawnFlash(unit.pos, 1);

		// Recursive chain
		if (config.chainedTargets.size < config.maxChains) {
			handleChainLightning(unit, projectile);
		}
		break;
	}
}
