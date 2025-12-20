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
import { spawnLink } from "../spawn/spawnLink";
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
	AccelerateModifier,
	BounceModifier,
	ChainModifier,
	CritModifier,
	CurveModifier,
	DamageTickModifier,
	DuplicateModifier,
	GravityModifier,
	ImpactModifier,
	KnockbackModifier,
	LifespanModifier,
	OnDestroyModifier,
	PiercingModifier,
	ProjectileConfig,
	SeekModifier,
	SlowModifier,
	SplashModifier,
	SpiralModifier,
	SplitModifier,
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
		...[...config.tags, tags.gameLoop],
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
	applySplitModifier(proj, config.split);
	applyAccelerateModifier(proj, config.accelerate);
	applyGravityModifier(proj, config.gravity);
	applyCurveModifier(proj, config.curve);
	applyDamageTickModifier(proj, config.damageTick);
	applySlowModifier(proj, config.slow);
	applyKnockbackModifier(proj, config.knockback);

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

		// Split behavior
		if (
			proj.splitConfig &&
			proj.lifetime > proj.splitConfig.splitDelay &&
			!proj.hasSplit
		) {
			updateSplit(proj, config);
		}

		// Spiral behavior
		if (proj.spiralConfig) {
			updateSpiral(proj);
		}

		// Duplicate behavior
		if (
			proj.duplicateConfig &&
			proj.lifetime > proj.duplicateConfig.delay &&
			!proj.hasDuplicated
		) {
			updateDuplicate(proj, config);
		}

		// Accelerate behavior
		if (proj.accelerateConfig) {
			updateAccelerate(proj);
		}

		// Gravity behavior
		if (proj.gravityConfig) {
			updateGravity(proj);
		}

		// Curve behavior
		if (proj.curveConfig) {
			updateCurve(proj);
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

function applySplitModifier(proj: GameObj, config?: SplitModifier) {
	if (!config) return;
	proj.splitConfig = {
		splitCount: config.splitCount,
		splitAngle: config.splitAngle,
		splitDelay: config.splitDelay ?? 0.5,
		speedMultiplier: config.speedMultiplier ?? 0.8,
		damageMultiplier: config.damageMultiplier ?? 0.6,
	};
	proj.hasSplit = false;
}

function applySpiralModifier(proj: GameObj, config?: SpiralModifier) {
	if (!config) return;
	proj.spiralConfig = {
		rotationSpeed: config.rotationSpeed,
		radius: config.radius,
		expandSpeed: config.expandSpeed ?? 0,
		currentRadius: 0,
		currentAngle: 0,
	};
	proj.spiralCenter = proj.pos.clone();
}

function applyDuplicateModifier(proj: GameObj, config?: DuplicateModifier) {
	if (!config) return;
	proj.duplicateConfig = {
		duplicateCount: config.duplicateCount,
		offset: config.offset,
		delay: config.delay ?? 0.3,
	};
	proj.hasDuplicated = false;
}

function applyAccelerateModifier(proj: GameObj, config?: AccelerateModifier) {
	if (!config) return;
	proj.accelerateConfig = {
		acceleration: config.acceleration,
		maxSpeed: config.maxSpeed ?? 1000,
		minSpeed: config.minSpeed ?? 50,
	};
}

function applyGravityModifier(proj: GameObj, config?: GravityModifier) {
	if (!config) return;
	proj.gravityConfig = {
		strength: config.strength,
		range: config.range,
		falloff: config.falloff ?? 0.5,
	};
}

function applyCurveModifier(proj: GameObj, config?: CurveModifier) {
	if (!config) return;
	const finalDirection =
		config.direction === "random"
			? Math.random() < 0.5
				? "left"
				: "right"
			: config.direction;
	proj.curveConfig = {
		strength: config.strength,
		direction: finalDirection,
	};
}

function applyDamageTickModifier(proj: GameObj, config?: DamageTickModifier) {
	if (!config) return;
	proj.damageTickConfig = {
		damagePerTick: config.damagePerTick,
		tickInterval: config.tickInterval,
		duration: config.duration,
		effectType: config.effectType,
		shader: config.shader,
	};
}

function applySlowModifier(proj: GameObj, config?: SlowModifier) {
	if (!config) return;
	proj.slowConfig = {
		duration: config.duration,
		slowPercentage: config.slowPercentage,
		effectType: config.effectType,
		shader: config.shader,
	};
}

function applyKnockbackModifier(proj: GameObj, config?: KnockbackModifier) {
	if (!config) return;
	proj.knockbackStrength = config.strength;
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

function updateSplit(proj: GameObj, config: ProjectileConfig) {
	proj.hasSplit = true;

	const angleStep =
		proj.splitConfig.splitAngle / (proj.splitConfig.splitCount - 1);
	const startAngle = proj.angle - proj.splitConfig.splitAngle / 2;

	for (let i = 0; i < proj.splitConfig.splitCount; i++) {
		const angle = startAngle + i * angleStep;
		const dir = k.Vec2.fromAngle(angle - 90);

		const newConfig: ProjectileConfig = {
			...config,
			pos: proj.pos.clone(),
			dir: dir,
			rotation: angle,
			speed: config.speed * proj.splitConfig.speedMultiplier,
			split: undefined,
		};

		if (newConfig.impact) {
			newConfig.impact.damage *= proj.splitConfig.damageMultiplier;
		}

		spawnProjectile(newConfig);
	}

	k.destroy(proj);
}

function updateSpiral(proj: GameObj) {
	const config = proj.spiralConfig;
	config.currentAngle +=
		config.rotationSpeed * dtScaled() * proj.getTimescale();
	config.currentRadius += config.expandSpeed * dtScaled() * proj.getTimescale();

	const spiralOffset = k.Vec2.fromAngle(config.currentAngle).scale(
		config.radius + config.currentRadius
	);
	const baseDir = k.Vec2.fromAngle(proj.angle - 90);
	const baseMovement = baseDir.scale(
		proj.speed * dtScaled() * proj.getTimescale()
	);

	proj.spiralCenter = proj.spiralCenter.add(baseMovement);
	proj.pos = proj.spiralCenter.add(spiralOffset);
}

function updateDuplicate(proj: GameObj, config: ProjectileConfig) {
	proj.hasDuplicated = true;

	for (let i = 0; i < proj.duplicateConfig.duplicateCount; i++) {
		const offsetAngle =
			(i + 1) * (360 / (proj.duplicateConfig.duplicateCount + 1));
		const offsetDir = k.Vec2.fromAngle(offsetAngle);
		const offsetPos = proj.pos.add(
			offsetDir.scale(proj.duplicateConfig.offset)
		);

		const newConfig: ProjectileConfig = {
			...config,
			pos: offsetPos,
			duplicate: undefined,
		};

		spawnProjectile(newConfig);
	}
}

function updateAccelerate(proj: GameObj) {
	const config = proj.accelerateConfig;
	proj.speed += config.acceleration * dtScaled() * proj.getTimescale();
	proj.speed = Math.max(config.minSpeed, Math.min(config.maxSpeed, proj.speed));
}

function updateGravity(proj: GameObj) {
	const config = proj.gravityConfig;
	const massObjects = k.query({ include: ["mass"], includeOp: "and" });

	for (const obj of massObjects) {
		const distance = proj.pos.dist(obj.pos);
		if (distance > config.range || distance < 1) continue;

		// Calculate direction from mass object to projectile (pull towards projectile)
		const direction = proj.pos.sub(obj.pos).unit();

		// Calculate force with distance falloff (inverse square law approximation)
		const normalizedDistance = distance / config.range;
		const falloffMultiplier = Math.pow(1 - normalizedDistance, config.falloff);
		const force =
			config.strength * falloffMultiplier * dtScaled() * proj.getTimescale();

		// Apply force to mass object's velocity (relative effect)
		const acceleration = direction.scale(force / obj.mass);
		obj.velocity.x += acceleration.x;
		obj.velocity.y += acceleration.y;

		// Apply velocity to position
		obj.pos.x +=
			obj.velocity.x * dtScaled() * (obj.getTimescale ? obj.getTimescale() : 1);
		obj.pos.y +=
			obj.velocity.y * dtScaled() * (obj.getTimescale ? obj.getTimescale() : 1);

		// Apply damping to prevent infinite acceleration
		const damping = 0.95;
		obj.velocity.x *= damping;
		obj.velocity.y *= damping;
	}
}

function updateCurve(proj: GameObj) {
	const config = proj.curveConfig;
	const turnDirection = config.direction === "left" ? -1 : 1;
	const angleChange =
		config.strength * turnDirection * dtScaled() * proj.getTimescale();
	proj.angle += angleChange;
	proj.dir = k.Vec2.fromAngle(proj.angle - 90);
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

		target.hp -= damage;
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

	// Apply damage tick effect
	if (projectile.damageTickConfig) {
		applyDamageTickEffect(target, projectile.damageTickConfig);
	}

	// Apply slow effect
	if (projectile.slowConfig) {
		applySlowEffect(target, projectile.slowConfig);
	}

	// Apply knockback
	if (projectile.knockbackStrength !== undefined && target.vel) {
		const dir = projectile.pos.sub(target.pos).unit();
		target.vel = target.vel.add(dir.scale(projectile.knockbackStrength));
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

		// Spawn visual link between targets
		spawnLink({
			pos1: target.pos,
			pos2: unit.pos,
			decayTime: 0.2 * (2 - timeScale),
			color: k.Color.fromHex("#00ffff"),
			opacity: 0.8,
			size: 2,
			distortion: 0,
		});

		// Apply reduced damage
		const chainDamage = projectile.impactDamage * config.damageReduction;
		unit.hp -= chainDamage;

		// Visual effect
		spawnFlash(unit.pos, 1);

		// Recursive chain
		if (config.chainedTargets.size < config.maxChains) {
			handleChainLightning(unit, projectile);
		}
		break;
	}
}

function applyDamageTickEffect(target: GameObj, config: any) {
	// Check if target already has damage tick effect
	if (target.damageTickEffect) {
		// Refresh duration if already applied
		target.damageTickEffect.endTime = target.lifetime + config.duration;
		return;
	}

	// Initialize target lifetime if not present
	if (target.lifetime === undefined) {
		target.lifetime = 0;
	}

	// Apply shader if specified
	if (config.shader && !target.hasShader) {
		target.use(k.shader(config.shader));
		target.hasShader = true;
	}

	// Set up damage tick effect
	target.damageTickEffect = {
		damagePerTick: config.damagePerTick,
		tickInterval: config.tickInterval,
		duration: config.duration,
		effectType: config.effectType,
		nextTickTime: target.lifetime + config.tickInterval,
		endTime: target.lifetime + config.duration,
		shader: config.shader,
	};

	// Add update handler if not already present
	if (!target.hasDamageTickUpdate) {
		target.hasDamageTickUpdate = true;
		target.onUpdate(() => {
			if (!target.damageTickEffect) return;

			target.lifetime += dtScaled();

			// Check if effect has expired
			if (target.lifetime >= target.damageTickEffect.endTime) {
				// Remove shader if specified
				if (target.damageTickEffect.shader && target.hasShader) {
					target.unuse("shader");
					target.hasShader = false;
				}
				target.damageTickEffect = null;
				return;
			}

			// Check if it's time to tick
			if (target.lifetime >= target.damageTickEffect.nextTickTime) {
				target.hp -= target.damageTickEffect.damagePerTick;
				target.damageTickEffect.nextTickTime =
					target.lifetime + target.damageTickEffect.tickInterval;

				// Spawn effect particles
				if (target.damageTickEffect.effectType) {
					let emitter: any;
					switch (target.damageTickEffect.effectType) {
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
					}
					if (emitter) {
						emitter.emitter.position = target.pos;
						emitter.emit(3);
					}
				}
			}
		});
	}
}

function applySlowEffect(target: GameObj, config: any) {
	// Check if target already has slow effect
	if (target.slowEffect) {
		// Refresh duration if already applied
		target.slowEffect.endTime = target.lifetime + config.duration;
		return;
	}

	// Initialize target lifetime if not present
	if (target.lifetime === undefined) {
		target.lifetime = 0;
	}

	// Store original speed if not already stored
	if (target.originalSpeed === undefined && target.speed !== undefined) {
		target.originalSpeed = target.speed;
	}

	// Apply shader if specified
	if (config.shader && !target.hasSlowShader) {
		target.use(k.shader(config.shader));
		target.hasSlowShader = true;
	}

	// Apply slow to speed
	if (target.speed !== undefined) {
		target.speed = target.originalSpeed * (1 - config.slowPercentage);
	}

	// Set up slow effect
	target.slowEffect = {
		duration: config.duration,
		slowPercentage: config.slowPercentage,
		effectType: config.effectType,
		endTime: target.lifetime + config.duration,
		shader: config.shader,
		particleTimer: 0,
	};

	// Add update handler if not already present
	if (!target.hasSlowUpdate) {
		target.hasSlowUpdate = true;
		target.onUpdate(() => {
			if (!target.slowEffect) return;

			target.lifetime += dtScaled();
			target.slowEffect.particleTimer += dtScaled();

			// Spawn effect particles periodically
			if (
				target.slowEffect.effectType &&
				target.slowEffect.particleTimer >= 0.1
			) {
				target.slowEffect.particleTimer = 0;
				let emitter: any;
				switch (target.slowEffect.effectType) {
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
				}
				if (emitter) {
					emitter.emitter.position = target.pos;
					emitter.emit(1);
				}
			}

			// Check if effect has expired
			if (target.lifetime >= target.slowEffect.endTime) {
				// Restore original speed
				if (target.originalSpeed !== undefined) {
					target.speed = target.originalSpeed;
				}

				// Remove shader if specified
				if (target.slowEffect.shader && target.hasSlowShader) {
					target.unuse("shader");
					target.hasSlowShader = false;
				}

				target.slowEffect = null;
			}
		});
	}
}
