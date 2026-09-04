import {
	StatCategory,
	StatModifier,
	ModifierType,
	ActiveModifier,
	UnlockState,
	StatValue,
	UpgradeServiceState,
	UpgradeEffect,
} from "../types/upgradeTypes";

interface ServiceCallbacks {
	onStatChange?: (stat: string, oldValue: number, newValue: number) => void;
	onUnlock?: (unlockId: string) => void;
	onModifierAdded?: (modifier: ActiveModifier) => void;
	onModifierExpired?: (modifier: ActiveModifier) => void;
}

let modifierIdCounter = 0;

const state: UpgradeServiceState = {
	purchasedUpgrades: {},
	activeModifiers: [],
	unlocks: [],
	stats: {},
};

const callbacks: ServiceCallbacks = {};

// Default stat values
const defaultStats: Record<string, number> = {
	// Movement
	speed: 200,
	speedMultiplier: 1,
	sprintSpeedMultiplier: 1,

	// Combat - Blasters
	blasterDmg: 2,
	blasterDmgMultiplier: 1,
	blasterSpeedMultiplier: 1,
	blasterCount: 1,

	// Combat - Rockets
	rocketImpactDmg: 10,
	rocketSplashDmg: 5,
	rocketDmgMultiplier: 1,
	rocketSplashSize: 30,
	rocketSplashSizeMultiplier: 1,
	rocketSplashDmgFallOverDistance: 0.7,
	rocketSplashDmgFallDistanceValue: 0.6,
	rocketSeekDistance: 200,
	rocketCount: 3,
	rocketShards: 0,

	// Resources
	scorePerPickup: 1,
	debreeSeekDistance: 50,
	debreeSeekDistanceMultiplier: 1,
	debreeValueMultiplier: 1,

	// Survival
	maxHealth: 3,
	extraHealth: 0,

	// Follower
	followerBlasterDmg: 1,
	followerBlasterDmgMultiplier: 1,

	// Special
	extraRockets: 0,
	extraSpaceDebreeInMissiles: 0,
	primaryRocketChance: 0,
	projectileBounceCount: 0,
	projectileBounceDamageRetention: 0,
	projectileGuidanceDistance: 0,
};

function initializeStats() {
	for (const [stat, value] of Object.entries(defaultStats)) {
		state.stats[stat] = {
			base: value,
			final: value,
			modifiers: [],
		};
	}
}

function calculateStat(stat: string): number {
	const statValue = state.stats[stat];
	if (!statValue) return 0;

	let result = statValue.base;

	// Apply additive modifiers first
	const additiveModifiers = statValue.modifiers.filter(
		(m) => m.type === "additive"
	);
	for (const mod of additiveModifiers) {
		result += mod.value;
	}

	// Apply multiplicative modifiers
	const multiplyModifiers = statValue.modifiers.filter(
		(m) => m.type === "multiply"
	);
	for (const mod of multiplyModifiers) {
		result *= mod.value;
	}

	// Apply temporary modifiers (treat as additive by default)
	const temporaryModifiers = statValue.modifiers.filter(
		(m) => m.type === "temporary"
	);
	for (const mod of temporaryModifiers) {
		result += mod.value;
	}

	return result;
}

function recalculateStat(stat: string): void {
	const statValue = state.stats[stat];
	if (!statValue) return;

	const oldValue = statValue.final;
	const newValue = calculateStat(stat);
	statValue.final = newValue;

	if (oldValue !== newValue && callbacks.onStatChange) {
		callbacks.onStatChange(stat, oldValue, newValue);
	}
}

function cleanupExpiredModifiers(): void {
	const now = Date.now();
	const expiredModifiers: ActiveModifier[] = [];

	for (const modifier of state.activeModifiers) {
		if (modifier.expiresAt && modifier.expiresAt <= now) {
			expiredModifiers.push(modifier);
		}
	}

	for (const modifier of expiredModifiers) {
		removeModifier(modifier.id);
		if (callbacks.onModifierExpired) {
			callbacks.onModifierExpired(modifier);
		}
	}
}

function removeModifier(modifierId: string): void {
	const modifier = state.activeModifiers.find((m) => m.id === modifierId);
	if (!modifier) return;

	// Remove from global list
	state.activeModifiers = state.activeModifiers.filter(
		(m) => m.id !== modifierId
	);

	// Remove from stat
	const statValue = state.stats[modifier.stat];
	if (statValue) {
		statValue.modifiers = statValue.modifiers.filter(
			(m) => m.id !== modifierId
		);
		recalculateStat(modifier.stat);
	}
}

export const upgradeService = {
	initialize(): void {
		initializeStats();
	},

	reset(): void {
		state.purchasedUpgrades = {};
		state.activeModifiers = [];
		state.unlocks = [];
		initializeStats();
	},

	// Stat queries
	getStat(stat: string): number {
		cleanupExpiredModifiers();
		return state.stats[stat]?.final ?? 0;
	},

	getBaseStat(stat: string): number {
		return state.stats[stat]?.base ?? 0;
	},

	getAllStats(): Record<string, number> {
		cleanupExpiredModifiers();
		const result: Record<string, number> = {};
		for (const [stat, value] of Object.entries(state.stats)) {
			result[stat] = value.final;
		}
		return result;
	},

	// Unlock queries
	hasUnlock(unlockId: string): boolean {
		return state.unlocks.some((u) => u.unlockId === unlockId);
	},

	getUnlocks(): string[] {
		return state.unlocks.map((u) => u.unlockId);
	},

	// Modifier management
	addModifier(
		stat: string,
		value: number,
		type: ModifierType,
		source: string,
		duration?: number
	): string {
		const modifierId = `mod_${modifierIdCounter++}`;

		const modifier: ActiveModifier = {
			id: modifierId,
			stat,
			value,
			type,
			source,
			expiresAt: duration ? Date.now() + duration * 1000 : undefined,
		};

		state.activeModifiers.push(modifier);

		// Add to stat
		if (!state.stats[stat]) {
			state.stats[stat] = { base: 0, final: 0, modifiers: [] };
		}
		state.stats[stat].modifiers.push(modifier);

		recalculateStat(stat);

		if (callbacks.onModifierAdded) {
			callbacks.onModifierAdded(modifier);
		}

		return modifierId;
	},

	addTemporaryModifier(
		stat: string,
		value: number,
		duration: number,
		source: string = "powerup"
	): string {
		return this.addModifier(stat, value, "temporary", source, duration);
	},

	removeModifier(modifierId: string): void {
		removeModifier(modifierId);
	},

	getActiveModifiers(stat?: string): ActiveModifier[] {
		cleanupExpiredModifiers();
		if (stat) {
			return state.activeModifiers.filter((m) => m.stat === stat);
		}
		return [...state.activeModifiers];
	},

	// Upgrade management
	purchaseUpgrade(toolKey: string, effects: UpgradeEffect): void {
		const currentLevel = state.purchasedUpgrades[toolKey] ?? -1;
		state.purchasedUpgrades[toolKey] = currentLevel + 1;

		this.applyUpgradeEffects(effects, toolKey);
	},

	applyUpgradeEffects(effects: UpgradeEffect, source: string): void {
		// Apply stat modifiers
		if (effects.modifiers) {
			for (const modifier of effects.modifiers) {
				if (modifier.type === "base") {
					// Set base value
					if (state.stats[modifier.stat]) {
						state.stats[modifier.stat].base = modifier.value;
						recalculateStat(modifier.stat);
					}
				} else {
					// Add as modifier
					this.addModifier(
						modifier.stat,
						modifier.value,
						modifier.type,
						source,
						modifier.duration
					);
				}
			}
		}

		// Apply unlocks
		if (effects.unlocks) {
			for (const unlock of effects.unlocks) {
				if (!this.hasUnlock(unlock.unlockId)) {
					state.unlocks.push({
						unlockId: unlock.unlockId,
						unlockedAt: Date.now(),
						source,
					});
					if (callbacks.onUnlock) {
						callbacks.onUnlock(unlock.unlockId);
					}
				}
			}
		}

		// Abilities are tracked as unlocks for now
		if (effects.abilities) {
			for (const ability of effects.abilities) {
				if (!this.hasUnlock(ability.abilityId)) {
					state.unlocks.push({
						unlockId: ability.abilityId,
						unlockedAt: Date.now(),
						source,
					});
					if (callbacks.onUnlock) {
						callbacks.onUnlock(ability.abilityId);
					}
				}
			}
		}
	},

	getUpgradeLevel(toolKey: string): number {
		return state.purchasedUpgrades[toolKey] ?? -1;
	},

	hasUpgrade(toolKey: string): boolean {
		return (state.purchasedUpgrades[toolKey] ?? -1) >= 0;
	},

	// Callbacks
	onStatChange(
		callback: (stat: string, oldValue: number, newValue: number) => void
	): void {
		callbacks.onStatChange = callback;
	},

	onUnlock(callback: (unlockId: string) => void): void {
		callbacks.onUnlock = callback;
	},

	onModifierAdded(callback: (modifier: ActiveModifier) => void): void {
		callbacks.onModifierAdded = callback;
	},

	onModifierExpired(callback: (modifier: ActiveModifier) => void): void {
		callbacks.onModifierExpired = callback;
	},

	clearCallbacks(): void {
		callbacks.onStatChange = undefined;
		callbacks.onUnlock = undefined;
		callbacks.onModifierAdded = undefined;
		callbacks.onModifierExpired = undefined;
	},

	// State management
	getState(): UpgradeServiceState {
		cleanupExpiredModifiers();
		return {
			purchasedUpgrades: { ...state.purchasedUpgrades },
			activeModifiers: [...state.activeModifiers],
			unlocks: [...state.unlocks],
			stats: JSON.parse(JSON.stringify(state.stats)),
		};
	},

	loadState(savedState: Partial<UpgradeServiceState>): void {
		if (savedState.purchasedUpgrades) {
			state.purchasedUpgrades = { ...savedState.purchasedUpgrades };
		}
		if (savedState.unlocks) {
			state.unlocks = [...savedState.unlocks];
		}
		// Recalculate all stats
		for (const stat in state.stats) {
			recalculateStat(stat);
		}
	},

	// Utility
	update(deltaTime: number): void {
		cleanupExpiredModifiers();
	},

	debugPrint(): void {
		console.log("=== Upgrade Service State ===");
		console.log("Purchased Upgrades:", state.purchasedUpgrades);
		console.log("Active Modifiers:", state.activeModifiers.length);
		console.log(
			"Unlocks:",
			state.unlocks.map((u) => u.unlockId)
		);
		console.log(
			"Stats:",
			Object.entries(state.stats).map(([k, v]) => `${k}: ${v.final}`)
		);
	},
};
