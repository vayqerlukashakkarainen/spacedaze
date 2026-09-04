import { Color, Vec2 } from "kaplay";

// Core Modifiers

export interface ImpactModifier {
	damage: number;
	damageMultiplier?: number;
}

export interface SplashModifier {
	damage: number;
	radius: number;
	damageMultiplier?: number;
	damageFalloff?: number;
	falloffDistance?: number;
}

export interface SeekModifier {
	enabled: boolean;
	acquireDelay?: number;
	seekDistance?: number;
	turnSpeed?: number;
	targetTags: string[];
}

export interface CritModifier {
	chance: number;
	multiplier: number;
	flashSize?: number;
	sound?: string;
}

export interface TrailModifier {
	emitterType: "trail" | "spark" | "dust" | "stars";
	offset?: number;
	particleCount?: number;
}

// Additional Modifiers

export interface PiercingModifier {
	maxPierces: number;
	damageReduction?: number;
}

export interface BounceModifier {
	maxBounces: number;
	speedRetention?: number;
	damageRetention?: number;
	stripPlayerModifiers?: boolean;
	inheritPlayerModifiers?: boolean;
	modifierFallbacks?: BounceModifierFallbacks;
}

export interface BounceModifierFallbacks {
	piercing?: PiercingModifier;
	chain?: ChainModifier;
	split?: SplitModifier;
	gravity?: GravityModifier;
}

export interface ChainModifier {
	maxChains: number;
	chainDistance: number;
	damageReduction?: number;
	targetTags: string[];
}

export interface LifespanModifier {
	duration: number;
}

export interface OnDestroyModifier {
	spawnProjectiles?: {
		count: number;
		spreadAngle: number;
		inheritModifiers?: boolean;
		config: Partial<ProjectileConfig>;
	};
	explode?: boolean;
}

export interface SplitModifier {
	splitCount: number;
	splitAngle: number;
	splitDelay?: number;
	speedMultiplier?: number;
	damageMultiplier?: number;
}

export interface SpiralModifier {
	rotationSpeed: number;
	radius: number;
	expandSpeed?: number;
}

export interface DuplicateModifier {
	duplicateCount: number;
	offset: number;
	delay?: number;
}

export interface AccelerateModifier {
	acceleration: number;
	maxSpeed?: number;
	minSpeed?: number;
}

export interface GravityModifier {
	strength: number;
	range: number;
	falloff?: number;
	targetTags?: string[];
}

export interface CurveModifier {
	strength: number;
	direction: "left" | "right" | "random";
}

export interface WiggleModifier {
	amplitude: number;
	frequency: number;
	phase?: number;
	trailColor?: Color;
	trailLength?: number;
}

export interface DamageTickModifier {
	damagePerTick: number;
	tickInterval: number;
	duration: number;
	effectType?: "trail" | "spark" | "dust" | "stars";
	shader?: string;
	volatile?: VolatileModifier;
}

export interface SlowModifier {
	duration: number;
	slowPercentage: number;
	effectType?: "trail" | "spark" | "dust" | "stars";
	shader?: string;
	stasisBurst?: {
		radius: number;
		duration: number;
		slowPercentage: number;
	};
	procState?: ProjectileProcState;
}

export interface KnockbackModifier {
	strength: number;
}

export interface ProjectileProcState {
	remaining: number;
}

export interface FragmentModifier {
	count: number;
	spreadAngle: number;
	damageMultiplier: number;
}

export interface ProximityModifier {
	radius: number;
	explosionRadius: number;
	damageMultiplier: number;
	targetTags: string[];
	armDelay?: number;
}

export interface EchoModifier {
	count: number;
	delay: number;
	damageMultiplier: number;
}

export interface ReturnModifier {
	delay: number;
	speedMultiplier: number;
	turnDuration?: number;
}

export interface GrowthModifier {
	maxDistance: number;
	maxScale: number;
	maxDamageMultiplier: number;
}

export interface VolatileModifier {
	radius: number;
	damage: number;
	spreadDuration: number;
	spreadDamagePerTick: number;
	procState?: ProjectileProcState;
}

export interface CriticalShatterModifier {
	count: number;
	spreadAngle: number;
	damageMultiplier: number;
}

export interface ExecutionModifier {
	healthThreshold: number;
	damageMultiplier: number;
}

export interface PaintModifier {
	damagePerStack: number;
	maxStacks: number;
	duration: number;
}

export interface MineModifier {
	duration: number;
	chance: number;
	placementDistance: number;
	armDelay: number;
	triggerRadius: number;
	explosionRadius: number;
	damageMultiplier: number;
}

// Main Configuration

export interface ProjectileConfig {
	// Core properties
	pos: Vec2;
	dir: Vec2;
	rotation: number;
	sprite: string;
	tint?: Color;
	speed: number;
	tags: string[];
	speedMultiplier?: number;
	damageSource?: {
		name: string;
		sprite?: string;
	};
	damageTick?: DamageTickModifier;
	slow?: SlowModifier;

	// Modifiers (all optional)
	impact?: ImpactModifier;
	splash?: SplashModifier;
	seek?: SeekModifier;
	crit?: CritModifier;
	trail?: TrailModifier;
	piercing?: PiercingModifier;
	bounce?: BounceModifier;
	chain?: ChainModifier;
	lifespan?: LifespanModifier;
	onDestroy?: OnDestroyModifier;
	split?: SplitModifier;
	spiral?: SpiralModifier;
	duplicate?: DuplicateModifier;
	accelerate?: AccelerateModifier;
	gravity?: GravityModifier;
	curve?: CurveModifier;
	wiggle?: WiggleModifier;
	knockback?: KnockbackModifier;
	fragment?: FragmentModifier;
	proximity?: ProximityModifier;
	echo?: EchoModifier;
	returning?: ReturnModifier;
	growth?: GrowthModifier;
	volatile?: VolatileModifier;
	criticalShatter?: CriticalShatterModifier;
	execution?: ExecutionModifier;
	paint?: PaintModifier;
	mine?: MineModifier;
	procState?: ProjectileProcState;

	// Audio
	fireSound?: string;
	destroySound?: string;
}
