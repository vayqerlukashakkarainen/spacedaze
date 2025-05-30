import { Vec2 } from "kaplay";
import { addMaxHealth, playerObj } from "./game";
import { k } from "./main";
import { hasLvlValue, player, session } from "./player";
import { sum } from "./shared";
import { spawnFollower } from "./spawn/spawnFollower";
import { spawnPowerup } from "./spawn/spawnPowerup";

export const powerups = {
	addFollower: () => {
		spawnFollower({
			follow: playerObj,
			hp: 6,
			pos: k.vec2(k.rand(k.width()), 0),
			speed: k.rand(80, 110),
			blasterDmg:
				player.followerBlasterDmg * player.followerBlasterDmgMultiplier,
		});
	},
	addPlayerMaxHealth: () => {
		addMaxHealth();
	},
	addExtraRockets: () => {
		session.extraRockets += 1;
	},
	addSpaceDebree: () => {
		session.extraSpaceDebreeInMissiles += 2;
	},
} as const;

export type PowerupKey = keyof typeof powerups;

export const powerupsSprites: Record<PowerupKey, string> = {
	addFollower: "follower_upg1",
	addPlayerMaxHealth: "hull_upg1",
	addExtraRockets: "more_missiles_upg1",
	addSpaceDebree: "missile_shards_upg1",
};

export const powerupWeights: Record<PowerupKey, number> = {
	addFollower: 350,
	addPlayerMaxHealth: 200,
	addExtraRockets: 120,
	addSpaceDebree: 110,
};

export const powerupReq: Record<PowerupKey, (() => boolean) | undefined> = {
	addFollower: undefined,
	addPlayerMaxHealth: undefined,
	addExtraRockets: () => {
		return player.rocketsLvl !== undefined;
	},
	addSpaceDebree: () => {
		return player.rocketsLvl !== undefined;
	},
};

const blankChance = 25000;
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
