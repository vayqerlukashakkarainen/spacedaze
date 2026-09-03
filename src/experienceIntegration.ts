import { experienceService } from "./services/experienceService";
import { upgradeService } from "./services/upgradeService";

// Example level-gated passive upgrades
const levelRewards: Record<number, () => void> = {
	5: () => {
		// Level 5: Small speed boost
		upgradeService.addModifier(
			"speedMultiplier",
			1.05,
			"multiply",
			"level-reward"
		);
	},
	15: () => {
		// Level 15: Stronger magnets
		upgradeService.addModifier(
			"debreeSeekDistanceMultiplier",
			1.2,
			"multiply",
			"level-reward"
		);
	},
	20: () => {
		// Level 20: More damage
		upgradeService.addModifier(
			"blasterDmgMultiplier",
			1.1,
			"multiply",
			"level-reward"
		);
	},
};

export function initializeExperienceSystem() {
	// Set up level-up callback
	experienceService.onLevelUp((newLevel) => {
		console.log(`Level up! Now level ${newLevel}`);

		// Check if this level has a reward
		const reward = levelRewards[newLevel];
		if (reward) {
			reward();
			console.log(`Unlocked passive upgrade at level ${newLevel}`);
		}
	});

	// Optional: XP gain feedback
	experienceService.onXpGain((amount, total) => {
		// Could trigger UI effect here
	});
}

export function addXpFromKill(enemyType: string) {
	const xpValues: Record<string, number> = {
		basic: 10,
		heavy: 25,
		elite: 50,
		boss: 200,
	};

	const xp = xpValues[enemyType] ?? 10;
	experienceService.addXp(xp);
}

export function addXpFromDebree() {
	experienceService.addXp(1);
}

export function resetExperienceSystem() {
	experienceService.reset();
	experienceService.clearCallbacks();
}
