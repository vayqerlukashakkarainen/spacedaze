interface ExperienceLevel {
	level: number;
	currentXp: number;
	xpToNextLevel: number;
	totalXp: number;
}

interface ExperienceServiceState {
	level: number;
	currentXp: number;
	totalXp: number;
	onLevelUp?: (newLevel: number) => void;
	onXpGain?: (amount: number, newTotal: number) => void;
}

const state: ExperienceServiceState = {
	level: 1,
	currentXp: 0,
	totalXp: 0,
	onLevelUp: undefined,
	onXpGain: undefined,
};

function calculateXpForLevel(level: number): number {
	// Exponential curve: base XP * (level ^ 1.5)
	const baseXp = 100;
	return Math.floor(baseXp * Math.pow(level, 1.5));
}

export const experienceService = {
	getLevel(): number {
		return state.level;
	},

	getCurrentXp(): number {
		return state.currentXp;
	},

	getTotalXp(): number {
		return state.totalXp;
	},

	getXpToNextLevel(): number {
		return calculateXpForLevel(state.level);
	},

	getXpProgress(): number {
		const xpNeeded = calculateXpForLevel(state.level);
		return state.currentXp / xpNeeded;
	},

	getLevelInfo(): ExperienceLevel {
		return {
			level: state.level,
			currentXp: state.currentXp,
			xpToNextLevel: calculateXpForLevel(state.level),
			totalXp: state.totalXp,
		};
	},

	addXp(amount: number): boolean {
		if (amount <= 0) return false;

		state.currentXp += amount;
		state.totalXp += amount;

		if (state.onXpGain) {
			state.onXpGain(amount, state.totalXp);
		}

		let leveledUp = false;
		while (state.currentXp >= calculateXpForLevel(state.level)) {
			const xpNeeded = calculateXpForLevel(state.level);
			state.currentXp -= xpNeeded;
			state.level++;
			leveledUp = true;

			if (state.onLevelUp) {
				state.onLevelUp(state.level);
			}
		}

		return leveledUp;
	},

	setLevel(level: number): void {
		if (level < 1) return;
		state.level = level;
		state.currentXp = 0;
	},

	reset(): void {
		state.level = 1;
		state.currentXp = 0;
		state.totalXp = 0;
	},

	onLevelUp(callback: (newLevel: number) => void): void {
		state.onLevelUp = callback;
	},

	onXpGain(callback: (amount: number, newTotal: number) => void): void {
		state.onXpGain = callback;
	},

	clearCallbacks(): void {
		state.onLevelUp = undefined;
		state.onXpGain = undefined;
	},
};
