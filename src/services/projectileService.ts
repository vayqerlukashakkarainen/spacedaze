import { GameObj, Vec2 } from "kaplay";
import {
	k,
	mainSoundVolume,
	subSoundVolume,
	timeScale,
	velocityScale,
} from "../main";
import { audioService } from "./audioService";
import { gameSoundService } from "./gameSoundService"
import { timescale } from "../comp/timescale";
import { playerObj, projectiles } from "../game";
import { tags } from "../tags";
import { applyPlayerStatusEffect } from "./playerStatusEffectService";
import {
	spawnDelayedExplosionPulse,
	spawnFlash,
} from "../spawn/spawnFlash";
import { spawnChainProjectile } from "../spawn/spawnLink";
import {
	boostTrailEmitter,
	debreeRocketEmitter,
	dustTrailEmitter,
	sparkEmitter,
	starsEmitter,
	trailEmitter,
	railgunTrailEmitter,
} from "../particles";
import {
	applySteeringLean,
	lerpAngleBetweenPos,
	steerMoveRotateAndLean,
} from "../shared";
import { resolveCriticalDamage } from "../projectiles/shared";
import type {
	AccelerateModifier,
	BounceModifier,
	ChainModifier,
	CritModifier,
	CurveModifier,
	DamageTickModifier,
	DuplicateModifier,
	EchoModifier,
	ExecutionModifier,
	FragmentModifier,
	GravityModifier,
	GrowthModifier,
	ImpactModifier,
	KnockbackModifier,
	LifestealModifier,
	LifespanModifier,
	MineModifier,
	OnDestroyModifier,
	PaintModifier,
	PiercingModifier,
	ProximityModifier,
	ProjectileConfig,
	ReturnModifier,
	SeekModifier,
	SlowModifier,
	SpinModifier,
	SplashModifier,
	SpiralModifier,
	SplitModifier,
	TrailModifier,
	VolatileModifier,
	CriticalShatterModifier,
	WiggleModifier,
} from "../projectiles/projectileConfig";
import { gridRegistry } from "../grid/gridRegistry";
import { ACTIVE_RUN_GRID_KEY } from "../grid/gridKeys";
import type { HexGrid } from "../grid/hexGrid";
import { damageDestructibleWall } from "./destructibleWallService";
import { spawnRing } from "../spawn/spawnRing";
import { randomExplosion } from "../util";
import { player } from "../player";
import { getEffectiveUpgradeLevel } from "../upg";
import { applyDamage } from "./damageService";
import { applyEnemyProjectileImpact } from "./combatImpactService";
import {
	createExplosion,
	type ExplosionContext,
	type ExplosionOptions,
} from "./explosionService";
import { applyRadialGravity } from "./radialGravityService";
import { profileSection } from "./frameProfilerService";
import { runLoop } from "./runLoopService";
import { registerBatchedEntityUpdate } from "./entityUpdateService";
import {
	findClosestSpatial,
	findSpatialNearby,
	querySpatialNearby,
} from "./runtimeSpatialIndexService";
import { getShipThrusterFlash } from "../comp/shipThruster";
import { registerRuntimeSpriteVisual } from "./enemyVisualBatchService";
import {
	consumePhaseCounterMultiplier,
	triggerTacticalUplinkFeedback,
	triggerResonanceCoil,
} from "./passiveUpgradeRuntimeService";
import { getTacticalUplinkHullThreshold } from "./tacticalUplinkService";
import { recoverPlayerHealth } from "./playerHealthService";
import {
	getPlayerTargetInterceptPoint,
	getPlayerTargetLock,
} from "./playerTargetLockService";
import { PROJECTILE_VISUALS } from "../visuals/projectileVisualCatalog";
import { updateRocketGuidance } from "./rocketGuidanceService"

const DEFAULT_PROJECTILE_PROC_BUDGET = 32;
const PLAYER_PROJECTILE_SCALE = PROJECTILE_VISUALS.player.worldScale;
const ENEMY_PROJECTILE_SPEED_MULTIPLIER = 0.8;
const KNOCKBACK_PUSH_DURATION = 0.32;
const KNOCKBACK_FULL_STEER_STRENGTH = 60;
let projectileUpdateController: GameObj | undefined;

interface KnockbackImpulse {
	direction: Vec2;
	distance: number;
	elapsed: number;
	steerAmount: number;
}

interface ChainLightningRuntime extends ChainModifier {
	chainedTargets: Set<number>;
	chainsUsed: number;
}

export function spawnProjectile(config: ProjectileConfig): GameObj {
	config.procState ??= { remaining: DEFAULT_PROJECTILE_PROC_BUDGET };
	// Calculate final speed
	const hostileSpeedMultiplier = config.tags.includes(tags.enemy)
		? ENEMY_PROJECTILE_SPEED_MULTIPLIER
		: 1;
	const finalSpeed =
		config.speed *
		(config.speedMultiplier ?? 1) *
		hostileSpeedMultiplier;
	const damagesDestructibleWalls = config.tags.includes(tags.friendly);
	const projectileScale = damagesDestructibleWalls
		? PLAYER_PROJECTILE_SCALE * (config.visualScale ?? 1)
		: PROJECTILE_VISUALS.enemy.worldScale * (config.visualScale ?? 1);
	const projectileLengthScale = config.visualLengthScale ?? 1;

	// Build component list
	const components: any[] = [
		k.pos(config.pos),
		k.rotate(config.rotation),
		timescale(),
		...(config.persistOffscreen ? [] : [k.offscreen({ destroy: true })]),
		k.anchor("center"),
		k.sprite(config.sprite),
		k.color(
			config.tint ??
				(config.tags.includes(tags.enemy) ? k.rgb(255, 150, 150) : k.WHITE)
		),
		...(config.visualWobble !== undefined
			? [
				k.shader("ringDistortion", () => ({
					u_time: k.time(),
					u_intensity: config.visualWobble,
				})),
			]
			: []),
		...(config.flashLikeThruster ? [k.opacity(1)] : []),
		k.scale(projectileScale, projectileScale * projectileLengthScale),
		{
			speed: finalSpeed,
			dir: config.dir,
			lifetime: 0,
			previousPos: config.pos.clone(),
		},
		...[...config.tags, tags.projectile, tags.gameLoop],
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
	applyLifestealModifier(proj, config.lifesteal);
	applyLifespanModifier(proj, config.lifespan);
	applyOnDestroyModifier(proj, config.onDestroy);
	applySplitModifier(proj, config.split);
	applySpiralModifier(proj, config.spiral);
	applyDuplicateModifier(proj, config.duplicate);
	applyAccelerateModifier(proj, config.accelerate);
	applySpinModifier(proj, config.spin);
	applyGravityModifier(proj, config.gravity);
	applyCurveModifier(proj, config.curve);
	applyWiggleModifier(proj, config.wiggle);
	applyDamageTickModifier(proj, config.damageTick);
	applySlowModifier(proj, config.slow);
	applyKnockbackModifier(proj, config.knockback);
	applyFragmentModifier(proj, config.fragment);
	applyProximityModifier(proj, config.proximity);
	applyEchoModifier(proj, config.echo);
	applyReturnModifier(proj, config.returning);
	applyGrowthModifier(proj, config.growth);
	applyVolatileModifier(proj, config.volatile);
	applyCriticalShatterModifier(proj, config.criticalShatter);
	applyExecutionModifier(proj, config.execution);
	applyPaintModifier(proj, config.paint);
	applyMineModifier(proj, config.mine);
	proj.projectileConfig = config;
	proj.procState = config.procState;
	proj.damagesDestructibleWalls = damagesDestructibleWalls;
	proj.projectileVisualScale = projectileScale;
	proj.projectileVisualLengthScale = projectileLengthScale;

	// Play fire sound
	if (config.fireSound) {
		gameSoundService.playPositional(config.fireSound, proj.pos, {
			volume: mainSoundVolume * (config.fireSoundVolume ?? 1),
			detune: config.fireSoundDetune,
		});
	}

	// On destroy
	proj.onDestroy(() => {
		if (proj.isDeployedMine && proj.destroyCause !== "proximity") {
			proj.suppressOnDestroyEffects = true;
		}
		// Remove from projectiles array
		const index = projectiles.findIndex((p) => p.id === proj.id);
		if (index !== -1) {
			projectiles.splice(index, 1);
		}

		// Play destroy sound
		if (config.destroySound && !proj.suppressDestroySound) {
			audioService.playPositionalSound(config.destroySound, proj.pos, {
				volume: subSoundVolume,
			});
		}

		// Flash effect
		if (!proj.suppressDestroyFlash) {
			spawnFlash(
				proj.pos,
				5,
				proj.didCrit ? k.RED : config.effectTint ?? k.WHITE
			);
		}

		// OnDestroy effects
		if (proj.onDestroyConfig && !proj.suppressOnDestroyEffects) {
			handleOnDestroy(proj, config);
		}
		if (proj.fragmentConfig && !proj.suppressOnDestroyEffects) {
			handleFragmentation(proj, config);
		}
	});

	// Add to projectiles array
	projectiles.push(proj);
	registerRuntimeSpriteVisual(proj);
	ensureProjectileUpdateController();

	return proj;
}

function ensureProjectileUpdateController() {
	if (projectileUpdateController?.exists()) return;
	const controller = k.add([
		tags.props,
		tags.gameLoop,
	]);
	projectileUpdateController = controller;

	controller.onUpdate(() => {
		if (!runLoop.isEnabled()) updateProjectileBatch();
	});
	controller.onDestroy(() => {
		if (projectileUpdateController?.id === controller.id) {
			projectileUpdateController = undefined;
		}
	});
}

export function updateProjectileBatch() {
	profileSection("projectiles", () => {
		const lastProjectileIndex = projectiles.length - 1;
		for (let index = lastProjectileIndex; index >= 0; index--) {
			const proj = projectiles[index];
			if (!proj?.exists() || proj.paused) continue;
			updateProjectile(proj);
		}
	});
}

function updateProjectile(proj: GameObj) {
	const config = proj.projectileConfig as ProjectileConfig;
	const activeGrid = config.ignoreWorldCollision
		? undefined
		: gridRegistry.get(ACTIVE_RUN_GRID_KEY);
	const previousPos = proj.pos.clone();
	proj.previousPos = previousPos;
	proj.lifetime += k.dt() * proj.getTimescale();
	if (config.flashLikeThruster) {
		proj.opacity = getShipThrusterFlash(k.time())
			? 1
			: config.flashMinOpacity ?? 0;
	}
	if (
		proj.isDeployedMine &&
		!proj.mineArmed &&
		proj.lifetime >= proj.mineArmDelay
	) {
		proj.mineArmed = true;
		proj.color = k.rgb(255, 190, 70);
	}

	if (proj.lifespanDuration && proj.lifetime > proj.lifespanDuration) {
		proj.destroyCause = "lifespan";
		if (proj.isDeployedMine) proj.suppressOnDestroyEffects = true;
		k.destroy(proj);
		return;
	}

	if (proj.proximityConfig && updateProximityFuse(proj)) return;
	if (proj.echoConfig) updateEcho(proj, config);
	if (proj.returnConfig) updateReturning(proj);
	if (proj.growthConfig) updateGrowth(proj);
	if (proj.trail) updateTrail(proj);

	if (
		proj.canSeek &&
		proj.lifetime > proj.seekDelay &&
		!proj.returnConfig?.returning
	) {
		updateSeeking(proj);
	}

	if (
		proj.splitConfig &&
		proj.lifetime > proj.splitConfig.splitDelay &&
		!proj.hasSplit
	) {
		updateSplit(proj, config);
		if (!proj.exists()) return;
	}

	if (proj.spiralConfig) updateSpiral(proj);
	if (
		proj.duplicateConfig &&
		proj.lifetime > proj.duplicateConfig.delay &&
		!proj.hasDuplicated
	) {
		updateDuplicate(proj, config);
	}
	if (proj.accelerateConfig) updateAccelerate(proj);
	if (proj.spinConfig) updateSpin(proj);
	if (proj.gravityConfig) updateGravity(proj);
	if (proj.curveConfig) updateCurve(proj);

	if (!proj.spiralConfig) updateMovement(proj);
	if (proj.wiggleConfig?.trailPoints) updateWiggleTrail(proj);
	const wallCollision = activeGrid
		? findSolidCellCollision(activeGrid, previousPos, proj.pos)
		: undefined;
	if (wallCollision) {
		let hitDestructibleWall = false;
		if (proj.damagesDestructibleWalls) {
			hitDestructibleWall = damageDestructibleWall(
				ACTIVE_RUN_GRID_KEY,
				wallCollision.coord,
				Math.max(proj.impactDamage ?? proj.splashDamage ?? 1, 1),
				wallCollision.safePos
			) !== undefined;
		}
		proj.pos = wallCollision.safePos;
		if (
			!tryBounceProjectile(
				proj,
				undefined,
				wallCollision.normal,
				false,
				hitDestructibleWall
			)
		) {
			if (!hitDestructibleWall) {
				proj.suppressDestroyFlash = true;
				proj.suppressOnDestroyEffects = true;
			}
			k.destroy(proj);
		}
	}
	if (!proj.exists()) return;
	if (
		proj.mineConfig &&
		!proj.isDeployedMine &&
		updateMinePlacement(proj, config)
	) return;
}

interface SolidCellCollision {
	safePos: Vec2;
	normal: Vec2;
	coord: Parameters<HexGrid["hexToScreen"]>[0];
}

function findSolidCellCollision(
	grid: HexGrid,
	start: Vec2,
	end: Vec2
): SolidCellCollision | undefined {
	const distance = start.dist(end);
	const sampleSpacing = Math.max(4, grid.config.hexSize * 0.2);
	const sampleCount = Math.max(1, Math.ceil(distance / sampleSpacing));
	let safePos = start.clone();

	for (let index = 1; index <= sampleCount; index++) {
		const samplePos = start.lerp(end, index / sampleCount);
		const coord = grid.screenToHex(samplePos);
		if (!grid.inBounds(coord) || !grid.isWalkable(coord)) {
			return {
				safePos,
				normal: getSolidCellNormal(grid, coord, samplePos, end.sub(start)),
				coord,
			};
		}
		safePos = samplePos;
	}
	return undefined;
}

function getSolidCellNormal(
	grid: HexGrid,
	blockedCoord: Parameters<HexGrid["hexToScreen"]>[0],
	impactPos: Vec2,
	movement: Vec2
) {
	const normal = impactPos.sub(grid.hexToScreen(blockedCoord));
	if (normal.len() > 0) return normal.unit();
	return movement.len() > 0 ? movement.unit().scale(-1) : k.vec2(0, -1);
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
		offset: (config.offset ?? 12) * proj.scale.x,
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
	proj.bounceSpeedRetention = config.speedRetention ?? 1;
	proj.bounceDamageRetention = config.damageRetention ?? 0.7;
	proj.bounceSeeksNextTarget = config.seekNextTarget ?? false;
	proj.bounceSeekDistance = config.seekDistance ?? 320;
	proj.stripPlayerModifiersOnBounce = config.stripPlayerModifiers ?? false;
	proj.bounceInheritsPlayerModifiers = config.inheritPlayerModifiers ?? false;
	proj.bounceModifierFallbacks = config.modifierFallbacks;
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
		chainsUsed: 0,
	};
}

function applyLifestealModifier(proj: GameObj, config?: LifestealModifier) {
	if (!config || config.healthRatio <= 0) return;
	proj.lifestealHealthRatio = config.healthRatio;
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

function applySpinModifier(proj: GameObj, config?: SpinModifier) {
	if (!config) return;
	const direction = config.direction === "counterclockwise"
		? -1
		: config.direction === "random"
			? (k.chance(0.5) ? -1 : 1)
			: 1;
	proj.visualAngle = proj.angle;
	proj.spinConfig = {
		angularSpeed: config.initialSpeed,
		acceleration: config.acceleration,
		maxSpeed: config.maxSpeed,
		direction,
	};
}

function applyGravityModifier(proj: GameObj, config?: GravityModifier) {
	if (!config) return;
	proj.gravityConfig = {
		strength: config.strength,
		range: config.range,
		falloff: config.falloff ?? 0.5,
		targetTags: config.targetTags,
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

function applyWiggleModifier(proj: GameObj, config?: WiggleModifier) {
	if (!config) return;
	proj.wiggleConfig = {
		amplitude: config.amplitude,
		frequency: config.frequency,
		phase: config.phase ?? k.rand(0, Math.PI * 2),
		baseAngle: proj.angle,
	};
	if (!config.trailLength || config.trailLength < 2) return;
	proj.wiggleConfig.trailColor = config.trailColor ?? proj.color;
	proj.wiggleConfig.trailLength = Math.max(2, Math.round(config.trailLength));
	proj.wiggleConfig.trailPoints = [proj.pos.clone()];
	proj.add([
		k.z(-1),
		{
			draw() {
				const points = proj.wiggleConfig.trailPoints as Vec2[];
				for (let index = 1; index < points.length; index++) {
					const progress = index / points.length;
					k.drawLine({
						p1: points[index - 1].sub(proj.pos),
						p2: points[index].sub(proj.pos),
						width: k.lerp(0.5, 2.2, progress),
						color: proj.wiggleConfig.trailColor,
						opacity: k.lerp(0.08, 0.8, progress),
					});
				}
			},
		},
	]);
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

function applyFragmentModifier(proj: GameObj, config?: FragmentModifier) {
	if (!config) return;
	proj.fragmentConfig = { ...config };
}

function applyProximityModifier(proj: GameObj, config?: ProximityModifier) {
	if (!config) return;
	proj.proximityConfig = {
		...config,
		targetTags: [...config.targetTags],
	};
}

function applyEchoModifier(proj: GameObj, config?: EchoModifier) {
	if (!config) return;
	proj.echoConfig = {
		...config,
		remaining: config.count,
		nextAt: config.delay,
		origin: proj.pos.clone(),
	};
}

function applyReturnModifier(proj: GameObj, config?: ReturnModifier) {
	if (!config) return;
	proj.returnConfig = {
		...config,
		origin: proj.pos.clone(),
		returning: false,
		returned: false,
		turnProgress: 0,
		turnDirection: k.chance(0.5) ? 1 : -1,
	};
}

function applyGrowthModifier(proj: GameObj, config?: GrowthModifier) {
	if (!config) return;
	proj.growthConfig = {
		...config,
		origin: proj.pos.clone(),
		baseDamage: proj.impactDamage,
		baseScale: proj.scale.x,
		maxScale: proj.scale.x * config.maxScale,
		particleTimer: 0,
	};
}

function applyVolatileModifier(proj: GameObj, config?: VolatileModifier) {
	if (!config) return;
	proj.volatileConfig = { ...config, procState: proj.procState };
}

function applyCriticalShatterModifier(
	proj: GameObj,
	config?: CriticalShatterModifier
) {
	if (!config) return;
	proj.criticalShatterConfig = { ...config };
}

function applyExecutionModifier(proj: GameObj, config?: ExecutionModifier) {
	if (!config) return;
	proj.executionConfig = { ...config };
}

function applyPaintModifier(proj: GameObj, config?: PaintModifier) {
	if (!config) return;
	proj.paintConfig = { ...config };
}

function applyMineModifier(proj: GameObj, config?: MineModifier) {
	if (!config) return;
	proj.mineConfig = {
		...config,
		origin: proj.pos.clone(),
		placementChecked: false,
	};
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
		case "boost":
			emitter = boostTrailEmitter;
			break;
		case "railgun":
			emitter = railgunTrailEmitter;
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
	const directedTarget = proj.tags.includes(tags.friendly)
		? getPlayerTargetLock()
		: undefined;
	if (
		directedTarget &&
		directedTarget.id !== proj.targetUnit?.id &&
		directedTarget.tags.includes(tags.unit) &&
		proj.targetTags.some((tag: string) => directedTarget.tags.includes(tag)) &&
		proj.pos.dist(directedTarget.pos) <= proj.seekDistance
	) {
		setSeekingTarget(proj, directedTarget);
		return;
	}
	if (proj.targetUnit == null) {
		const target = findClosestSpatial(proj.pos, proj.seekDistance, {
			allTags: [tags.unit],
			anyTags: proj.targetTags,
		})
		if (target) setSeekingTarget(proj, target)
	}
}

function setSeekingTarget(proj: GameObj, target: GameObj) {
	proj.targetUnit = target;
	proj.rocketGuidanceState = undefined
	target.onDestroy(() => {
		if (proj.exists() && proj.targetUnit?.id === target.id) {
			proj.targetUnit = null;
		}
	});
}

function updateMovement(proj: GameObj) {
	let speed = proj.speed * proj.getTimescale();

	if (proj.targetUnit) {
		let targetPosition = proj.targetUnit.pos
		const guidanceTimeScale = timeScale * proj.getTimescale()
		let turnStrength = proj.turnSpeed * guidanceTimeScale
		if (proj.is(tags.rocket)) {
			const guidance = updateRocketGuidance({
				rocketPosition: proj.pos,
				heading: k.Vec2.fromAngle(proj.angle - 90),
				targetId: proj.targetUnit.id,
				targetPosition: proj.targetUnit.pos,
				rocketSpeed: speed,
				baseTurnStrength: proj.turnSpeed,
				deltaTime: k.dt() * guidanceTimeScale,
			}, proj.rocketGuidanceState)
			proj.rocketGuidanceState = guidance.state
			targetPosition = guidance.aimPosition
			turnStrength = guidance.turnStrength * guidanceTimeScale
			speed *= guidance.speedMultiplier
		} else if (
			proj.tags.includes(tags.friendly) &&
			getPlayerTargetLock()?.id === proj.targetUnit.id
		) {
			targetPosition = getPlayerTargetInterceptPoint(
				proj.pos,
				proj.targetUnit,
				speed * velocityScale()
			)
		}
		// Homing movement
		const { lerp, correctedDesiredRot } = lerpAngleBetweenPos(
			proj.angle,
			proj.pos,
			targetPosition,
			turnStrength,
			-90
		);
		const wiggleAngle = getWiggleAngle(proj);
		steerMoveRotateAndLean(
			proj,
			lerp + wiggleAngle,
			speed,
			correctedDesiredRot + wiggleAngle,
			k.vec2(
				proj.projectileVisualScale,
				proj.projectileVisualScale * proj.projectileVisualLengthScale
			)
		);
	} else {
		// Straight movement
		const travelAngle = proj.wiggleConfig
			? proj.wiggleConfig.baseAngle + getWiggleAngle(proj)
			: proj.angle;
		proj.angle = travelAngle;
		const travelRadians = k.deg2rad(travelAngle - 90);
		const directionX = Math.cos(travelRadians);
		const directionY = Math.sin(travelRadians);
		const distance = speed * velocityScale() * k.dt();
		proj.pos.x += directionX * distance;
		proj.pos.y += directionY * distance;
		if (proj.dir) {
			proj.dir.x = directionX;
			proj.dir.y = directionY;
		}
		applySteeringLean(
			proj,
			proj.angle,
			proj.angle,
			k.vec2(
				proj.projectileVisualScale,
				proj.projectileVisualScale * proj.projectileVisualLengthScale
			)
		);
	}
}

function getWiggleAngle(proj: GameObj) {
	if (!proj.wiggleConfig) return 0;
	return Math.sin(
		proj.lifetime * proj.wiggleConfig.frequency + proj.wiggleConfig.phase
	) * proj.wiggleConfig.amplitude;
}

function updateWiggleTrail(proj: GameObj) {
	if (!proj.wiggleConfig.trailPoints) return;
	const points = proj.wiggleConfig.trailPoints as Vec2[];
	points.push(proj.pos.clone());
	while (points.length > proj.wiggleConfig.trailLength) points.shift();
}

function updateSplit(proj: GameObj, config: ProjectileConfig) {
	proj.hasSplit = true;
	const splitCount = consumeProcSlots(config, proj.splitConfig.splitCount);
	if (splitCount < 2) return;

	const angleStep =
		proj.splitConfig.splitAngle / (splitCount - 1);
	const startAngle = proj.angle - proj.splitConfig.splitAngle / 2;

	for (let i = 0; i < splitCount; i++) {
		const angle = startAngle + i * angleStep;
		const dir = k.Vec2.fromAngle(angle - 90);

		const newConfig: ProjectileConfig = {
			...config,
			pos: proj.pos.clone(),
			dir: dir,
			rotation: angle,
			speed: config.speed * proj.splitConfig.speedMultiplier,
			split: undefined,
			impact: config.impact
				? {
						...config.impact,
						damage:
							config.impact.damage * proj.splitConfig.damageMultiplier,
					}
				: undefined,
		};

		spawnProjectile(newConfig);
	}

	proj.suppressOnDestroyEffects = true;
	k.destroy(proj);
}

function updateSpiral(proj: GameObj) {
	const config = proj.spiralConfig;
	if (proj.targetUnit) updateSeekingAngle(proj);
	config.currentAngle +=
		config.rotationSpeed * k.dt() * velocityScale() * proj.getTimescale();
	config.currentRadius +=
		config.expandSpeed * k.dt() * velocityScale() * proj.getTimescale();

	const spiralOffset = k.Vec2.fromAngle(config.currentAngle).scale(
		config.radius + config.currentRadius
	);
	const baseDir = k.Vec2.fromAngle(proj.angle - 90);
	const baseMovement = baseDir.scale(
		proj.speed * k.dt() * velocityScale() * proj.getTimescale()
	);

	proj.spiralCenter = proj.spiralCenter.add(baseMovement);
	proj.pos = proj.spiralCenter.add(spiralOffset);
}

function updateSeekingAngle(proj: GameObj) {
	const { lerp } = lerpAngleBetweenPos(
		proj.angle,
		proj.pos,
		proj.targetUnit.pos,
		proj.turnSpeed * timeScale * proj.getTimescale(),
		-90
	);
	proj.angle = lerp;
	proj.dir = k.Vec2.fromAngle(proj.angle - 90);
}

function updateDuplicate(proj: GameObj, config: ProjectileConfig) {
	proj.hasDuplicated = true;
	const duplicateCount = consumeProcSlots(
		config,
		proj.duplicateConfig.duplicateCount
	);

	for (let i = 0; i < duplicateCount; i++) {
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
	proj.speed +=
		config.acceleration * k.dt() * velocityScale() * proj.getTimescale();
	proj.speed = Math.max(config.minSpeed, Math.min(config.maxSpeed, proj.speed));
}

function updateSpin(proj: GameObj) {
	const config = proj.spinConfig;
	const delta = k.dt() * velocityScale() * proj.getTimescale();
	config.angularSpeed = Math.min(
		config.maxSpeed,
		config.angularSpeed + config.acceleration * delta
	);
	proj.visualAngle += config.angularSpeed * config.direction * delta;
}

function updateGravity(proj: GameObj) {
	const config = proj.gravityConfig;
	applyRadialGravity(proj.pos, {
		strength: config.strength,
		range: config.range,
		falloff: config.falloff,
		targetTags: config.targetTags,
		targetTagMode: "and",
		excludeIds: [proj.id],
	});
}

function updateCurve(proj: GameObj) {
	const config = proj.curveConfig;
	const turnDirection = config.direction === "left" ? -1 : 1;
	const angleChange =
		config.strength *
		turnDirection *
		k.dt() *
		velocityScale() *
		proj.getTimescale();
	proj.angle += angleChange;
	if (proj.dir) {
		const radians = k.deg2rad(proj.angle - 90);
		proj.dir.x = Math.cos(radians);
		proj.dir.y = Math.sin(radians);
	}
}

function updateProximityFuse(proj: GameObj) {
	const config = proj.proximityConfig;
	if (proj.lifetime < (config.armDelay ?? 0)) return false;
	const target = findSpatialNearby(proj.pos, config.radius, {
		allTags: config.targetTags,
	});
	if (!target) return false;

	if (proj.isDeployedMine) {
		detonateMine(proj);
		return true;
	}

	const damage = (proj.impactDamage ?? proj.splashDamage ?? 1) *
		config.damageMultiplier;
	const useCompactVisual = config.fullExplosionVisual !== true;
	delete proj.proximityConfig;
	createProjectileExplosion(proj, {
		pos: proj.pos,
		radius: config.explosionRadius,
		damage,
		visualScale: useCompactVisual ? 0.55 : 1,
		visualIntensity: useCompactVisual ? 0.16 : undefined,
		visualParticleCount: useCompactVisual ? 5 : undefined,
		damageFalloff: 0.35,
		falloffDistance: 0.5,
	});
	debreeRocketEmitter.emitter.position = proj.pos;
	debreeRocketEmitter.emitter.direction = proj.angle - 90;
	debreeRocketEmitter.emit(useCompactVisual ? 2 : 6);
	return false;
}

function detonateMine(proj: GameObj) {
	if (!proj.isDeployedMine || proj.mineDetonationFeedbackPlayed) return;
	proj.mineDetonationFeedbackPlayed = true;
	proj.destroyCause = "proximity";
	proj.suppressOnDestroyEffects = true;
	createProjectileExplosion(proj, {
		pos: proj.pos,
		radius: proj.splashRadius ?? 58,
		damage: proj.splashDamage ?? 1,
		damageFalloff: proj.splashFalloff ?? 0.35,
		falloffDistance: proj.splashFalloffDist ?? 0.5,
	});
	debreeRocketEmitter.emitter.position = proj.pos;
	debreeRocketEmitter.emitter.direction = proj.angle - 90;
	debreeRocketEmitter.emit(6);
	audioService.playSound(randomExplosion(), { volume: subSoundVolume });
	k.shake(4);
	k.destroy(proj);
}

function updateMinePlacement(proj: GameObj, config: ProjectileConfig) {
	const mine = proj.mineConfig;
	if (mine.placementChecked) return false;
	if (mine.origin.dist(proj.pos) < mine.placementDistance) return false;

	mine.placementChecked = true;
	if (!k.chance(mine.chance)) return false;
	return deployMine(proj, config);
}

function updateEcho(proj: GameObj, config: ProjectileConfig) {
	const echo = proj.echoConfig;
	if (echo.remaining <= 0 || proj.lifetime < echo.nextAt) return;
	if (!consumeProcBudget(config, 1)) {
		echo.remaining = 0;
		return;
	}

	const echoConfig: ProjectileConfig = {
		...config,
		pos: echo.origin.clone(),
		dir: config.dir.clone(),
		echo: undefined,
		impact: config.impact
			? {
					damage: config.impact.damage * echo.damageMultiplier,
					damageMultiplier: config.impact.damageMultiplier,
				}
			: undefined,
		fireSound: undefined,
	};
	spawnProjectile(echoConfig);
	echo.remaining--;
	echo.nextAt += echo.delay;
}

function updateReturning(proj: GameObj) {
	const config = proj.returnConfig;
	if (config.returned || proj.lifetime < config.delay) return;

	if (!config.returning) {
		config.returning = true;
		proj.speed *= config.speedMultiplier;
		proj.targetUnit = null;
		if (proj.hitTargets) proj.hitTargets.clear();
		spawnFlash(proj.pos, 3, k.rgb(100, 190, 255));
	}

	const turnDuration = Math.max(0.08, config.turnDuration ?? 0.28);
	const remainingTurn = 180 - config.turnProgress;
	const turnStep = Math.min(
		remainingTurn,
		(180 / turnDuration) * k.dt() * velocityScale() * proj.getTimescale()
	);
	proj.angle += turnStep * config.turnDirection;
	config.turnProgress += turnStep;
	proj.dir = k.Vec2.fromAngle(proj.angle - 90);

	if (config.turnProgress < 180) return;
	config.returned = true;
	const towardOrigin = config.origin.sub(proj.pos);
	if (towardOrigin.len() > 0) {
		proj.dir = towardOrigin.unit();
		proj.angle = k.rad2deg(k.Vec2.toAngle(proj.dir)) + 90;
	}
}

function updateGrowth(proj: GameObj) {
	const config = proj.growthConfig;
	const progress = k.clamp(
		config.origin.dist(proj.pos) / config.maxDistance,
		0,
		1
	);
	const scale = k.lerp(config.baseScale, config.maxScale, progress);
	proj.projectileVisualScale = scale;
	proj.scale = k.vec2(scale, scale * proj.projectileVisualLengthScale);
	if (config.baseDamage !== undefined) {
		const damageMultiplier = k.lerp(
			1,
			config.maxDamageMultiplier,
			progress
		);
		proj.impactDamage = config.baseDamage * damageMultiplier;

		if (proj.is(tags.blaster) && damageMultiplier > 1.02) {
			config.particleTimer += k.dt() * proj.getTimescale();
			const particleInterval = k.lerp(0.1, 0.035, progress);
			if (config.particleTimer >= particleInterval) {
				config.particleTimer %= particleInterval;
				const currentDir = k.Vec2.fromAngle(proj.angle - 90);
				trailEmitter.emitter.position = proj.pos.sub(
					currentDir.scale(5 + proj.scale.x * 2)
				);
				trailEmitter.emitter.direction = proj.angle;
				trailEmitter.emit(1 + Math.floor(progress * 2));
			}
		}
	}
}

function deployMine(proj: GameObj, config: ProjectileConfig) {
	if (!consumeProcBudget(config, 1)) {
		return false;
	}

	const mine = proj.mineConfig;
	const damage = proj.impactDamage ?? proj.splashDamage ?? 1;
	const mineConfig: ProjectileConfig = {
		...config,
		pos: proj.pos.clone(),
		dir: k.vec2(0),
		speed: 0,
		fireSound: undefined,
		destroySound: undefined,
		mine: undefined,
		echo: undefined,
		returning: undefined,
		growth: undefined,
		accelerate: undefined,
		spiral: undefined,
		split: undefined,
		lifespan: { duration: mine.armDelay + mine.duration },
		proximity: {
			radius: mine.triggerRadius,
			explosionRadius: mine.explosionRadius,
			damageMultiplier: mine.damageMultiplier,
			targetTags: [tags.enemy],
			armDelay: mine.armDelay,
		},
		impact: undefined,
		splash: {
			damage,
			radius: mine.explosionRadius,
		},
		onDestroy: { explode: true },
	};
	const mineObj = spawnProjectile(mineConfig);
	mineObj.isDeployedMine = true;
	mineObj.mineArmDelay = mine.armDelay;
	mineObj.scale = mineObj.scale.scale(1.35);
	mineObj.color = k.rgb(105, 105, 105);
	return true;
}

function handleFragmentation(proj: GameObj, config: ProjectileConfig) {
	const fragment = proj.fragmentConfig;
	const count = consumeProcSlots(config, fragment.count);
	if (count <= 0) return;
	const damage = proj.impactDamage ?? config.impact?.damage ?? 1;

	for (let index = 0; index < count; index++) {
		const angle = proj.angle - fragment.spreadAngle / 2 +
			fragment.spreadAngle * ((index + 0.5) / count);
		const shard = spawnProjectile({
			...config,
			pos: proj.pos.clone(),
			dir: k.Vec2.fromAngle(angle - 90),
			rotation: angle,
			fireSound: undefined,
			fragment: undefined,
			echo: undefined,
			mine: undefined,
			split: undefined,
			onDestroy: undefined,
			impact: {
				damage: damage * fragment.damageMultiplier,
			},
			lifespan: { duration: 0.7 },
		});
		ignoreSourceTarget(shard, proj.lastHitTargetId);
	}
}

function spawnCriticalShards(proj: GameObj) {
	const config = proj.criticalShatterConfig;
	const sourceConfig = proj.projectileConfig as ProjectileConfig;
	const count = consumeProcSlots(sourceConfig, config.count);
	if (count <= 0) return;
	const damage = proj.impactDamage ?? sourceConfig.impact?.damage ?? 1;

	for (let index = 0; index < count; index++) {
		const angle = proj.angle - config.spreadAngle / 2 +
			config.spreadAngle * ((index + 0.5) / count);
		const shard = spawnProjectile({
			...sourceConfig,
			pos: proj.pos.clone(),
			dir: k.Vec2.fromAngle(angle - 90),
			rotation: angle,
			fireSound: undefined,
			criticalShatter: undefined,
			fragment: undefined,
			echo: undefined,
			mine: undefined,
			split: undefined,
			onDestroy: undefined,
			impact: { damage: damage * config.damageMultiplier },
			lifespan: { duration: 0.65 },
		});
		ignoreSourceTarget(shard, proj.lastHitTargetId);
	}
}

function ignoreSourceTarget(projectile: GameObj, sourceTargetId?: number) {
	if (sourceTargetId === undefined) return;
	projectile.hitTargets ??= new Set<number>();
	projectile.hitTargets.add(sourceTargetId);
}

function consumeProcBudget(config: ProjectileConfig, amount: number) {
	if (!config.procState || config.procState.remaining < amount) return false;
	config.procState.remaining -= amount;
	return true;
}

function consumeProcSlots(config: ProjectileConfig, requested: number) {
	if (!config.procState) return 0;
	const count = Math.min(requested, config.procState.remaining);
	config.procState.remaining -= count;
	return count;
}

export function tryBounceProjectile(
	projectile: GameObj,
	target?: GameObj,
	explicitNormal?: Vec2,
	deferModifierCleanup: boolean = false,
	showImpactEffect: boolean = true
) {
	if (
		projectile.bouncesRemaining === undefined ||
		projectile.bouncesRemaining <= 0
	) return false;

	let normal = explicitNormal;
	if (!normal && target?.pos) {
		const targetNormal = projectile.pos.sub(target.pos);
		if (targetNormal.len() > 0) normal = targetNormal.unit();
	}
	if (!normal) normal = projectile.dir.scale(-1);

	const targetDirection = target && projectile.bounceSeeksNextTarget
		? findNextBounceDirection(projectile, target)
		: undefined;
	const incident = projectile.dir;
	const dotProduct = incident.dot(normal);
	const reflected = targetDirection ??
		incident.sub(normal.scale(2 * dotProduct)).unit();

	// Update projectile direction and angle
	projectile.dir = reflected;
	projectile.angle = k.rad2deg(k.Vec2.toAngle(projectile.dir)) + 90;

	// Increase speed (arcade-style energy boost)
	projectile.speed *= projectile.bounceSpeedRetention;
	if (projectile.impactDamage !== undefined) {
		projectile.impactDamage *= projectile.bounceDamageRetention;
	}
	if (projectile.splashDamage !== undefined) {
		projectile.splashDamage *= projectile.bounceDamageRetention;
	}

	// Decrement bounces
	projectile.bouncesRemaining--;
	projectile.pos = projectile.pos.add(projectile.dir.scale(3));
	if (showImpactEffect) spawnFlash(projectile.pos, 2, k.WHITE);

	// Mark target as hit to prevent immediate re-collision
	if (target && !projectile.hitTargets) {
		projectile.hitTargets = new Set();
	}
	if (target) projectile.hitTargets.add(target.id);
	if (deferModifierCleanup) {
		projectile.bounceModifierCleanupPending = true;
	} else {
		stripPlayerModifiersAfterBounce(projectile);
	}
	return true;
}

function findNextBounceDirection(projectile: GameObj, currentTarget: GameObj) {
	const excludedTargetIds = new Set<number>(projectile.hitTargets ?? []);
	excludedTargetIds.add(currentTarget.id);
	const targetTags = projectile.tags.includes(tags.friendly)
		? [tags.enemy, tags.unit]
		: [tags.player];
	const nextTarget = findClosestSpatial(
		projectile.pos,
		projectile.bounceSeekDistance,
		{
			allTags: targetTags,
			excludeIds: excludedTargetIds,
		}
	);
	if (!nextTarget?.pos) return;
	const direction = nextTarget.pos.sub(projectile.pos);
	return direction.len() > 0.001 ? direction.unit() : undefined;
}

function stripPlayerModifiersAfterBounce(projectile: GameObj) {
	if (!projectile.bounceModifierCleanupPending && !projectile.stripPlayerModifiersOnBounce) {
		return;
	}
	projectile.bounceModifierCleanupPending = false;
	if (
		!projectile.stripPlayerModifiersOnBounce ||
		projectile.bounceInheritsPlayerModifiers
	) return;

	const fallback = projectile.bounceModifierFallbacks ?? {};

	if (fallback.piercing) {
		projectile.piercesRemaining = fallback.piercing.maxPierces;
		projectile.pierceReduction = fallback.piercing.damageReduction ?? 0.8;
	} else {
		delete projectile.piercesRemaining;
		delete projectile.pierceReduction;
	}

	if (fallback.chain) {
		projectile.chainConfig = {
			maxChains: fallback.chain.maxChains,
			chainDistance: fallback.chain.chainDistance,
			damageReduction: fallback.chain.damageReduction ?? 0.7,
			targetTags: fallback.chain.targetTags,
			chainedTargets: new Set(),
			chainsUsed: 0,
		};
	} else {
		delete projectile.chainConfig;
	}

	if (fallback.split) {
		projectile.splitConfig = {
			splitCount: fallback.split.splitCount,
			splitAngle: fallback.split.splitAngle,
			splitDelay: fallback.split.splitDelay ?? 0.5,
			speedMultiplier: fallback.split.speedMultiplier ?? 0.8,
			damageMultiplier: fallback.split.damageMultiplier ?? 0.6,
		};
		projectile.hasSplit = false;
	} else {
		delete projectile.splitConfig;
		projectile.hasSplit = true;
	}

	if (fallback.gravity) {
		projectile.gravityConfig = {
			strength: fallback.gravity.strength,
			range: fallback.gravity.range,
			falloff: fallback.gravity.falloff ?? 0.5,
			targetTags: fallback.gravity.targetTags,
		};
	} else {
		delete projectile.gravityConfig;
	}

	if (fallback.lifesteal) {
		projectile.lifestealHealthRatio = fallback.lifesteal.healthRatio;
	} else {
		delete projectile.lifestealHealthRatio;
	}

	delete projectile.critChance;
	delete projectile.critMultiplier;
	delete projectile.critFlashSize;
	delete projectile.critSound;
	delete projectile.damageTickConfig;
	delete projectile.slowConfig;
	delete projectile.knockbackStrength;
	delete projectile.fragmentConfig;
	delete projectile.proximityConfig;
	delete projectile.echoConfig;
	delete projectile.returnConfig;
	delete projectile.growthConfig;
	delete projectile.volatileConfig;
	delete projectile.criticalShatterConfig;
	delete projectile.executionConfig;
	delete projectile.paintConfig;
	delete projectile.mineConfig;
	delete projectile.accelerateConfig;
	delete projectile.spiralConfig;
}

function handleOnDestroy(proj: GameObj, config: ProjectileConfig) {
	// Spawn projectiles on destroy
	if (proj.onDestroyConfig.spawnProjectiles) {
		const spawnConfig = proj.onDestroyConfig.spawnProjectiles;
		const spawnCount = consumeProcSlots(config, spawnConfig.count);
		const angleStep = spawnConfig.spreadAngle / Math.max(1, spawnCount);

		for (let i = 0; i < spawnCount; i++) {
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
	if (
		proj.onDestroyConfig.explode &&
		proj.splashRadius &&
		!proj.splashResolvedOnImpact
	) {
		const isProximityDetonation = proj.destroyCause === "proximity";
		const useCompactProximityVisual = isProximityDetonation &&
			proj.proximityConfig?.fullExplosionVisual !== true;
		createProjectileExplosion(proj, {
			pos: proj.pos,
			radius: proj.splashRadius,
			damage: proj.splashDamage,
			visualScale: useCompactProximityVisual ? 0.55 : 1,
			visualIntensity: useCompactProximityVisual ? 0.16 : undefined,
			visualParticleCount: useCompactProximityVisual ? 5 : undefined,
			damageFalloff: proj.splashFalloff,
			falloffDistance: proj.splashFalloffDist,
		});
		debreeRocketEmitter.emitter.position = proj.pos;
		debreeRocketEmitter.emitter.direction = proj.angle - 90;
		debreeRocketEmitter.emit(useCompactProximityVisual ? 2 : 6);
	}
}

function triggerProjectileLifesteal(
	target: GameObj,
	projectile: GameObj,
	damage: number
) {
	const healthRatio = projectile.lifestealHealthRatio;
	if (!Number.isFinite(healthRatio) || healthRatio <= 0) return;
	if (!projectile.tags.includes(tags.friendly)) return;
	if (
		!playerObj?.exists() ||
		typeof playerObj.hp !== "number" ||
		typeof playerObj.maxHP !== "number" ||
		playerObj.hp >= playerObj.maxHP
	) return;

	const recovery = damage * healthRatio;
	if (!Number.isFinite(recovery) || recovery <= 0) return;
	const lifestealColor = k.rgb(255, 48, 72);
	spawnChainProjectile({
		pos1: target.pos.clone(),
		pos2: playerObj.pos.clone(),
		target: playerObj,
		decayTime: 0.2 * (2 - timeScale),
		color: lifestealColor,
		opacity: 0.95,
		size: 2.5,
		onArrive: () => {
			if (!playerObj?.exists()) return;
			const recovered = recoverPlayerHealth(playerObj, recovery);
			if (recovered > 0) {
				spawnFlash(playerObj.pos.clone(), 4, lifestealColor);
			}
		},
	});
}

// Damage Application Helper (called from collision detection)

export function applyProjectileDamage(
	target: GameObj,
	projectile: GameObj
): boolean {
	if (!target.exists() || typeof target.hp !== "number") return true;
	if (
		projectile.isDeployedMine &&
		projectile.lifetime < (projectile.mineArmDelay ?? 0)
	) return false;
	if (projectile.isDeployedMine) {
		detonateMine(projectile);
		return false;
	}
	// Check if already hit (for piercing)
	if (projectile.hitTargets && projectile.hitTargets.has(target.id)) {
		return false;
	}
	projectile.lastHitTargetId = target.id;

	let shouldDestroy = true;
	let directTargetChainedByExplosion = false;
	if (projectile.damageTickConfig) {
		applyDamageTickEffect(target, {
			...projectile.damageTickConfig,
			volatile: projectile.volatileConfig,
		});
	}
	if (projectile.slowConfig) {
		applySlowEffect(target, {
			...projectile.slowConfig,
			procState: projectile.procState,
		});
	}

	// Apply impact damage with crit
	if (projectile.impactDamage !== undefined) {
		let damage = projectile.impactDamage;
		const friendlyProjectile = projectile.tags.includes(tags.friendly);
		const tacticalUplinkLevel = getEffectiveUpgradeLevel("tacticalUplink");
		const tacticalUplinkProc =
			friendlyProjectile &&
			tacticalUplinkLevel !== undefined &&
			target.tags.includes(tags.enemy) &&
			typeof target.maxHP === "number" &&
			target.maxHP > 0 &&
			target.hp / target.maxHP >=
				getTacticalUplinkHullThreshold(tacticalUplinkLevel) &&
			player.tacticalUplinkMultiplier > 1;
		if (tacticalUplinkProc) {
			damage *= player.tacticalUplinkMultiplier;
			triggerTacticalUplinkFeedback(projectile.pos);
		}
		if (friendlyProjectile) {
			damage *= consumePhaseCounterMultiplier(projectile);
		}
		if (
			player.glassReactor !== undefined &&
			projectile.tags.includes(tags.friendly)
		) damage *= 2;
		let critical = false;
		projectile.didCrit = false;
		if (
			projectile.executionConfig &&
			target.hp &&
			target.maxHP &&
			target.maxHP > 0 &&
			target.hp / target.maxHP <=
				projectile.executionConfig.healthThreshold
		) {
			damage *= projectile.executionConfig.damageMultiplier;
		}
		if (projectile.paintConfig && target.projectilePaintStacks > 0) {
			damage *= 1 + target.projectilePaintStacks *
				projectile.paintConfig.damagePerStack;
		}

		// Apply crit
		if (
			projectile.critChance !== undefined &&
			projectile.critMultiplier !== undefined
		) {
			const result = resolveCriticalDamage(
				projectile.critChance,
				damage,
				projectile.critMultiplier
			);
			damage = result.damage;
			critical = result.critical;
			if (critical) {
				projectile.didCrit = true;
				spawnFlash(projectile.pos, projectile.critFlashSize, k.RED);
				audioService.playSound(projectile.critSound, {
					volume: mainSoundVolume,
				});
			}
		}

		target.detachImpactDirection = projectile.dir?.clone();
		target.detachImpactPosition = projectile.pos?.clone();
		const damageApplied = applyDamage(target, damage, {
			critical,
			position: projectile.pos,
			incomingDirection: projectile.dir,
			source: projectile.projectileConfig?.damageSource,
		});
		if (damageApplied && target.tags.includes(tags.enemy)) {
			triggerProjectileLifesteal(target, projectile, damage);
			triggerResonanceCoil(target, projectile, damage);
			if (!projectile.suppressImpactEffects) {
				const piercing = projectile.piercesRemaining !== undefined &&
					projectile.piercesRemaining > 0;
				applyEnemyProjectileImpact(target, {
					position: projectile.pos.clone(),
					direction: projectile.dir,
					damage,
					critical,
					piercing,
					splash: projectile.splashRadius !== undefined,
					knockback: projectile.knockbackStrength ?? 0,
					suppressHitRecoil:
						projectile.projectileConfig?.suppressHitRecoil,
				});
			}
			projectile.suppressDestroyFlash = true;
		}
		if (target.tags.includes(tags.player) && projectile.playerStatusEffect) {
			applyPlayerStatusEffect(projectile.playerStatusEffect);
		}
		if (critical && projectile.criticalShatterConfig) {
			spawnCriticalShards(projectile);
		}
		if (projectile.paintConfig && (!target.hp || target.hp > 0)) {
			applyPaintEffect(target, projectile.paintConfig);
		}
		if (target.hp && target.hp <= 0) {
			const volatile = target.damageTickEffect?.volatile;
			if (volatile) triggerVolatileCorrosion(target, volatile);
			const slowEffect = target.slowEffect;
			if (slowEffect?.stasisBurst) triggerStasisBurst(target, slowEffect);
		}
	}

	// Apply splash damage
	if (
		projectile.splashDamage !== undefined &&
		projectile.splashRadius !== undefined
	) {
		projectile.splashResolvedOnImpact = true;
		const explosionOptions = {
			pos: projectile.pos,
			radius: projectile.splashRadius,
			damage: projectile.splashDamage,
			damageFalloff: projectile.splashFalloff ?? 0,
			falloffDistance: projectile.splashFalloffDist ?? 0,
		};
		const explosionDelay = projectile.projectileConfig?.explosionDelay ?? 0;
		if (explosionDelay > 0) {
			scheduleProjectileExplosion(projectile, explosionOptions, explosionDelay);
			directTargetChainedByExplosion = target.exists();
		} else {
			const explosion = createProjectileExplosion(projectile, explosionOptions);
			directTargetChainedByExplosion = explosion.hits.some(
				(hit) => hit.target.id === target.id
			);
		}
	}

	// Handle bounce (takes priority over piercing)
	if (
		projectile.bouncesRemaining !== undefined &&
		projectile.bouncesRemaining > 0
	) {
		tryBounceProjectile(projectile, target, undefined, true);
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
	if (
		projectile.chainConfig &&
		projectile.chainConfig.maxChains > 0 &&
		!directTargetChainedByExplosion
	) {
		projectile.chainConfig.chainedTargets.add(target.id);
		handleChainLightning(
			target.pos,
			projectile.chainConfig,
			projectile.impactDamage ?? 1
		);
	}

	if (
		projectile.knockbackStrength !== undefined &&
		(target.is(tags.enemy) || target.is(tags.player))
	) {
		const impactOffset = target.pos.sub(projectile.pos);
		const direction = projectile.dir.len() > 0.001
			? projectile.dir.unit()
			: impactOffset.unit();
		applyKnockbackImpulse(target, direction, projectile.knockbackStrength);
	}

	stripPlayerModifiersAfterBounce(projectile);

	return shouldDestroy;
}

export function applyKnockbackImpulse(
	target: GameObj,
	direction: Vec2,
	strength: number
) {
	if (!target.exists() || strength <= 0 || direction.len() <= 0.001) return;
	const pushDirection = direction.unit();
	const steerAmount = k.clamp(
		strength / KNOCKBACK_FULL_STEER_STRENGTH,
		0,
		1
	);

	const impulse: KnockbackImpulse = {
		direction: pushDirection,
		distance: strength,
		elapsed: 0,
		steerAmount,
	};
	const impulses = target.knockbackImpulses as KnockbackImpulse[] | undefined;
	if (impulses) {
		impulses.push(impulse);
		return;
	}

	target.knockbackImpulses = [impulse];
	const controller = target.onUpdate(() => {
		if (!target.exists()) return;
		const activeImpulses = target.knockbackImpulses as
			| KnockbackImpulse[]
			| undefined;
		if (!activeImpulses || activeImpulses.length === 0) {
			controller.cancel();
			delete target.knockbackImpulses;
			return;
		}

		const frameDuration = k.dt();
		if (frameDuration <= 0) return;
		const timescaleMultiplier = typeof target.getTimescale === "function"
			? target.getTimescale()
			: 1;
		const impulseDelta = k.vec2(0, 0);
		const steeringImpulse = activeImpulses[activeImpulses.length - 1];
		for (let index = activeImpulses.length - 1; index >= 0; index--) {
			const activeImpulse = activeImpulses[index];
			const previousProgress = k.clamp(
				activeImpulse.elapsed / KNOCKBACK_PUSH_DURATION,
				0,
				1
			);
			activeImpulse.elapsed += frameDuration * timescaleMultiplier;
			const progress = k.clamp(
				activeImpulse.elapsed / KNOCKBACK_PUSH_DURATION,
				0,
				1
			);
			const previousEase = smoothstep(previousProgress);
			const ease = smoothstep(progress);
			impulseDelta.x += activeImpulse.direction.x *
				activeImpulse.distance * (ease - previousEase);
			impulseDelta.y += activeImpulse.direction.y *
				activeImpulse.distance * (ease - previousEase);
			if (activeImpulse === steeringImpulse) {
				steerObjectDirection(
					target,
					activeImpulse,
					previousEase,
					ease
				);
			}
			if (progress >= 1) activeImpulses.splice(index, 1);
		}

		if (impulseDelta.len() > 0.001) {
			target.move(impulseDelta.scale(1 / frameDuration));
		}
	});
}

function steerObjectDirection(
	target: GameObj,
	impulse: KnockbackImpulse,
	previousProgress: number,
	progress: number
) {
	const previousAmount = impulse.steerAmount * previousProgress;
	const nextAmount = impulse.steerAmount * progress;
	const amount = k.clamp(
		(nextAmount - previousAmount) / Math.max(0.001, 1 - previousAmount),
		0,
		1
	);
	if (target.vel && typeof target.vel.len === "function") {
		target.vel = blendDirection(
			target.vel,
			impulse.direction,
			amount
		);
	}
	if (
		target.moveDirection &&
		typeof target.moveDirection.len === "function"
	) {
		target.moveDirection = blendDirection(
			target.moveDirection,
			impulse.direction,
			amount
		);
	}
}

function smoothstep(progress: number) {
	return progress * progress * (3 - 2 * progress);
}

function blendDirection(current: Vec2, target: Vec2, amount: number) {
	const currentDirection = current.len() > 0.001 ? current.unit() : target;
	const currentAngle = currentDirection.angle();
	const targetAngle = target.angle();
	const angleDelta = ((targetAngle - currentAngle + 540) % 360) - 180;
	return k.Vec2.fromAngle(currentAngle + angleDelta * amount);
}

function createProjectileExplosion(
	projectile: GameObj,
	options: Omit<ExplosionOptions, "onResolved">
) {
	const config = projectile.projectileConfig as ProjectileConfig;
	playProjectileExplosionSound(config, options.pos);
	return createExplosion({
		...options,
		visualColor: options.visualColor ?? config.effectTint,
		onResolved: (explosion) => {
			startExplosionChainLightning(explosion, projectile);
		},
	});
}

function scheduleProjectileExplosion(
	projectile: GameObj,
	options: Omit<ExplosionOptions, "onResolved">,
	delay: number
) {
	const config = projectile.projectileConfig as ProjectileConfig;
	const explosionPos = options.pos.clone();
	const visualColor = options.visualColor ?? config.effectTint ?? k.WHITE;
	spawnDelayedExplosionPulse({
		pos: explosionPos,
		size: options.radius,
		duration: delay,
		color: visualColor,
		onComplete: () => {
			playProjectileExplosionSound(config, explosionPos);
			createExplosion({
				...options,
				pos: explosionPos,
				visualColor,
				onResolved: (explosion) => {
					startExplosionChainLightning(explosion, projectile);
				},
			});
		},
	});
}

function playProjectileExplosionSound(config: ProjectileConfig, pos: Vec2) {
	if (!config.explosionSoundPool) return;
	audioService.playPositionalSound(randomExplosion(config.explosionSoundPool), pos, {
		volume: subSoundVolume * (config.explosionSoundVolume ?? 1),
	});
}

function startExplosionChainLightning(
	explosion: ExplosionContext,
	projectile: GameObj
) {
	const sourceConfig = projectile.chainConfig;
	if (!sourceConfig || sourceConfig.maxChains <= 0) return;
	const blastTargetIds = new Set(
		explosion.hits.map((hit) => hit.target.id)
	);

	for (const hit of explosion.hits) {
		spawnChainProjectile({
			pos1: explosion.pos,
			pos2: hit.target.pos,
			decayTime: 0.2 * (2 - timeScale),
			color: k.Color.fromHex("#00ffff"),
			opacity: 0.8,
			size: 2,
		});
		const branchConfig = {
			...sourceConfig,
			chainedTargets: new Set(blastTargetIds),
			chainsUsed: 0,
		};
		handleChainLightning(hit.target.pos, branchConfig, hit.damage);
	}
}

function handleChainLightning(
	origin: Vec2,
	config: ChainLightningRuntime,
	baseDamage: number
) {
	if (config.chainsUsed >= config.maxChains) return;
	const units = querySpatialNearby(origin, config.chainDistance, {
		allTags: config.targetTags,
	});

	for (const unit of units) {
		if (!unit.exists()) continue;
		if (config.chainedTargets.has(unit.id)) continue;
		if (unit.pos.dist(origin) > config.chainDistance) continue;
		config.chainedTargets.add(unit.id);
		config.chainsUsed++;

		// Spawn a collision-free visual arc between targets
		spawnChainProjectile({
			pos1: origin,
			pos2: unit.pos,
			target: unit,
			decayTime: 0.2 * (2 - timeScale),
			color: k.Color.fromHex("#00ffff"),
			opacity: 0.8,
			size: 2,
			onArrive: () => {
				if (!unit.exists()) return;

				const chainDamage = baseDamage * config.damageReduction;
				applyDamage(unit, chainDamage);
				spawnFlash(unit.pos, 1);

				if (config.chainsUsed < config.maxChains) {
					handleChainLightning(unit.pos, config, baseDamage);
				}
			},
		});
		break;
	}
}

function applyDamageTickEffect(target: GameObj, config: any) {
	if (target.damageTickEffect) {
		target.damageTickEffect.remaining = config.duration;
		target.damageTickEffect.damagePerTick = config.damagePerTick;
		if (config.volatile) target.damageTickEffect.volatile = config.volatile;
		return;
	}

	if (config.shader && !target.hasShader) {
		target.use(k.shader(config.shader));
		target.hasShader = true;
	}

	target.damageTickEffect = {
		damagePerTick: config.damagePerTick,
		tickInterval: config.tickInterval,
		effectType: config.effectType,
		tickRemaining: config.tickInterval,
		remaining: config.duration,
		shader: config.shader,
		volatile: config.volatile,
	};

	if (!target.hasVolatileDeathHook) {
		target.hasVolatileDeathHook = true;
		target.onDeath(() => {
			const volatile = target.damageTickEffect?.volatile;
			if (volatile) triggerVolatileCorrosion(target, volatile);
		});
	}

	if (!target.hasDamageTickUpdate) {
		target.hasDamageTickUpdate = true;
		registerBatchedEntityUpdate("effects", target, () => {
			if (!target.damageTickEffect) return;
			const delta = k.dt() * (target.getTimescale ? target.getTimescale() : 1);
			target.damageTickEffect.remaining -= delta;
			target.damageTickEffect.tickRemaining -= delta;

			if (target.damageTickEffect.remaining <= 0) {
				if (target.damageTickEffect.shader && target.hasShader) {
					target.unuse("shader");
					target.hasShader = false;
				}
				target.damageTickEffect = null;
				return;
			}

			if (target.damageTickEffect.tickRemaining <= 0) {
				const tickDamage = target.damageTickEffect.damagePerTick;
				applyDamage(target, tickDamage);
				if (target.hp && target.hp <= 0) {
					const volatile = target.damageTickEffect?.volatile;
					if (volatile) triggerVolatileCorrosion(target, volatile);
				}
				target.damageTickEffect.tickRemaining +=
					target.damageTickEffect.tickInterval;

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
	if (target.slowEffect) {
		target.slowEffect.remaining = config.duration;
		if (config.stasisBurst) {
			target.slowEffect.stasisBurst = config.stasisBurst;
			target.slowEffect.procState = config.procState;
		}
		return;
	}

	if (target.originalSpeed === undefined && target.speed !== undefined) {
		target.originalSpeed = target.speed;
	}

	if (config.shader && !target.hasSlowShader) {
		target.use(k.shader(config.shader));
		target.hasSlowShader = true;
	}

	if (target.speed !== undefined) {
		target.speed = target.originalSpeed * (1 - config.slowPercentage);
	}

	target.slowEffect = {
		slowPercentage: config.slowPercentage,
		effectType: config.effectType,
		remaining: config.duration,
		shader: config.shader,
		particleTimer: 0,
		stasisBurst: config.stasisBurst,
		procState: config.procState,
	};

	if (!target.hasStasisDeathHook) {
		target.hasStasisDeathHook = true;
		target.onDeath(() => {
			const effect = target.slowEffect;
			if (effect?.stasisBurst) triggerStasisBurst(target, effect);
		});
	}

	if (!target.hasSlowUpdate) {
		target.hasSlowUpdate = true;
		registerBatchedEntityUpdate("effects", target, () => {
			if (!target.slowEffect) return;
			const delta = k.dt() * (target.getTimescale ? target.getTimescale() : 1);
			target.slowEffect.remaining -= delta;
			target.slowEffect.particleTimer += delta;

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

			if (target.slowEffect.remaining <= 0) {
				if (target.originalSpeed !== undefined) {
					target.speed = target.originalSpeed;
				}

				if (target.slowEffect.shader && target.hasSlowShader) {
					target.unuse("shader");
					target.hasSlowShader = false;
				}

				target.slowEffect = null;
			}
		});
	}
}

function triggerVolatileCorrosion(target: GameObj, config: VolatileModifier) {
	if (target.volatileCorrosionTriggered) return;
	if (!config.procState || config.procState.remaining <= 0) return;
	target.volatileCorrosionTriggered = true;
	config.procState.remaining--;
	const nearbyTargets = querySpatialNearby(target.pos, config.radius, {
		allTags: [tags.enemy, tags.unit],
	});
	for (const nearby of nearbyTargets) {
		if (nearby.id === target.id || nearby.pos.dist(target.pos) > config.radius) {
			continue;
		}
		applyDamageTickEffect(nearby, {
			damagePerTick: config.spreadDamagePerTick,
			tickInterval: 0.5,
			duration: config.spreadDuration,
			effectType: "spark",
			volatile: config,
		});
	}
	createExplosion({
		pos: target.pos,
		radius: config.radius,
		damage: config.damage,
		damageFalloff: 0.45,
		falloffDistance: 0.5,
	});
}

function triggerStasisBurst(target: GameObj, effect: any) {
	if (target.stasisBurstTriggered) return;
	if (!effect.procState || effect.procState.remaining <= 0) return;
	target.stasisBurstTriggered = true;
	effect.procState.remaining--;
	const burst = effect.stasisBurst;
	const nearbyTargets = querySpatialNearby(target.pos, burst.radius, {
		allTags: [tags.enemy, tags.unit],
	});
	for (const nearby of nearbyTargets) {
		if (nearby.id === target.id || nearby.pos.dist(target.pos) > burst.radius) {
			continue;
		}
		applySlowEffect(nearby, {
			duration: burst.duration,
			slowPercentage: burst.slowPercentage,
			effectType: "stars",
			stasisBurst: burst,
			procState: effect.procState,
		});
	}
	spawnRing({
		pos: target.pos,
		speed: 190,
		intensity: 0.35,
		maxRadius: burst.radius,
		visualize: true,
		color: k.rgb(100, 205, 255),
	});
}

function applyPaintEffect(target: GameObj, config: PaintModifier) {
	target.projectilePaintStacks = Math.min(
		config.maxStacks,
		(target.projectilePaintStacks ?? 0) + 1
	);
	target.projectilePaintRemaining = config.duration;
	spawnFlash(target.pos, 2 + target.projectilePaintStacks, k.rgb(255, 220, 80));

	if (target.hasProjectilePaintUpdate) return;
	target.hasProjectilePaintUpdate = true;
	registerBatchedEntityUpdate("effects", target, () => {
		if (!target.projectilePaintRemaining) return;
		target.projectilePaintRemaining -=
			k.dt() * (target.getTimescale ? target.getTimescale() : 1);
		if (target.projectilePaintRemaining > 0) return;
		target.projectilePaintRemaining = 0;
		target.projectilePaintStacks = 0;
	});
}
