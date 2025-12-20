import { KEventController, Vec2 } from "kaplay";
import { addMaxHealth, playerObj } from "./game";
import { k, mainSoundVolume, setTimescale } from "./main";
import { hasLvlValue, player, session } from "./player";
import { sum } from "./shared";
import { spawnFollower } from "./spawn/spawnFollower";
import { spawnPowerup } from "./spawn/spawnPowerup";
import { spawnRing } from "./spawn/spawnRing";
import { audioService } from "./services/audioService";
import { upgradeService } from "./services/upgradeService";

// Track active slowdown timer and accumulated duration
let activeSlowdownTimer: KEventController | undefined;
let slowdownRemainingTime = 0;

export const powerups = {
	addFollower: (pos: Vec2) => {
		spawnFollower({
			follow: playerObj,
			hp: 6,
			pos: k.vec2(k.rand(k.width()), 0),
			speed: k.rand(80, 110),
			blasterDmg:
				player.followerBlasterDmg * player.followerBlasterDmgMultiplier,
		});
	},
	addPlayerMaxHealth: (pos: Vec2) => {
		addMaxHealth();
	},
	addExtraRockets: (pos: Vec2) => {
		session.extraRockets += 1;
		upgradeService.addModifier("extraRockets", 1, "additive", "powerup");
	},
	addSpaceDebree: (pos: Vec2) => {
		session.extraSpaceDebreeInMissiles += 2;
		upgradeService.addModifier(
			"extraSpaceDebreeInMissiles",
			2,
			"additive",
			"powerup"
		);
	},
	slowdownTime: (pos: Vec2) => {
		// Extend duration if already active (6B: Extend duration)
		slowdownRemainingTime += 6; // 1B: Medium duration (5-7 seconds) - using 6 seconds

		// Cancel existing timer if any
		if (activeSlowdownTimer) {
			activeSlowdownTimer.cancel();
		}

		// Set timescale to 0.3 (2B: Heavy slowdown)
		setTimescale(0.3, 0.3);

		// Play slowdown sound (3A: Audio cue)
		audioService.playSound("slowdown", { volume: mainSoundVolume });

		// Spawn ring from powerup position (3A & 4A)
		spawnRing({
			pos: pos,
			speed: 250,
			intensity: 0.7,
			maxRadius: 400,
			visualize: true,
		});

		// Start new timer
		activeSlowdownTimer = k.wait(slowdownRemainingTime, () => {
			// Restore normal speed
			setTimescale(1.0, 0.5);
			slowdownRemainingTime = 0;
			activeSlowdownTimer = undefined;
		});
	},
} as const;

export type PowerupKey = keyof typeof powerups;

export const powerupsSprites: Record<PowerupKey, string> = {
	addFollower: "follower_upg1",
	addPlayerMaxHealth: "hull_upg1",
	addExtraRockets: "more_missiles_upg1",
	addSpaceDebree: "missile_shards_upg1",
	slowdownTime: "overclock_thrusters_upg1",
};

export const powerupWeights: Record<PowerupKey, number> = {
	addFollower: 350,
	addPlayerMaxHealth: 200,
	addExtraRockets: 120,
	addSpaceDebree: 110,
	slowdownTime: 130, // 5B: Uncommon (weight: ~120-150)
};

export const powerupReq: Record<PowerupKey, (() => boolean) | undefined> = {
	addFollower: undefined,
	addPlayerMaxHealth: undefined,
	addExtraRockets: () => {
		return (
			player.rocketsLvl !== undefined || upgradeService.hasUnlock("rockets")
		);
	},
	addSpaceDebree: () => {
		return (
			player.rocketsLvl !== undefined || upgradeService.hasUnlock("rockets")
		);
	},
	slowdownTime: undefined, // No requirements
};

const blankChance = 45000;
function randomizePowerup(chanceMultiplier: number): PowerupKey | null {
	const keyValues = Object.entries(powerupWeights).filter((x) => {
		if (powerupReq[x[0]] === undefined) return true;

		return powerupReq[x[0]]();
	});

	const chanceSpan =
		blankChance + sum(keyValues.map((x) => x[1] * chanceMultiplier));

	const r = Math.floor(k.rand(0, chanceSpan));

	let previous = 0;
	for (let i = 0; i < keyValues.length; i++) {
		const thisChance = previous + keyValues[i][1] * chanceMultiplier;
		if (r > previous && r <= thisChance) {
			return keyValues[i][0] as PowerupKey;
		}

		previous = thisChance;
	}

	return null;
}

export function trySpawnRandomizedPowerup(pos: Vec2, chanceMultiplier: number) {
	const key = randomizePowerup(chanceMultiplier);

	if (!key) {
		return;
	}

	spawnPowerup(pos, key);
}

export function chance(c: number, max: number) {
	return Math.floor(k.rand(0, max)) <= c;
}
