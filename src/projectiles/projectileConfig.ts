import { Vec2 } from "kaplay";

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
}

export interface CurveModifier {
	strength: number;
	direction: "left" | "right" | "random";
}

export interface DamageTickModifier {
	damagePerTick: number;
	tickInterval: number;
	duration: number;
	effectType?: "trail" | "spark" | "dust" | "stars";
	shader?: string;
}

export interface SlowModifier {
	duration: number;
	slowPercentage: number;
	effectType?: "trail" | "spark" | "dust" | "stars";
	shader?: string;
}

export interface KnockbackModifier {
	strength: number;
}

// Main Configuration

export interface ProjectileConfig {
	// Core properties
	pos: Vec2;
	dir: Vec2;
	rotation: number;
	sprite: string;
	speed: number;
	tags: string[];
	speedMultiplier?: number;
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
	knockback?: KnockbackModifier;

	// Audio
	fireSound?: string;
	destroySound?: string;
}
