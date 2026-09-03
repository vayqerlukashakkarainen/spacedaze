import { KEventController, Vec2 } from "kaplay";
import { addMaxHealth, playerObj } from "./game";
import { k, mainSoundVolume, setTimescale } from "./main";
import {
	getActiveTechnologySetNames,
	hasLvlValue,
	player,
	session,
} from "./player";
import {
	getDroneTypeCounts,
	spawnFollower,
} from "./spawn/spawnFollower";
import { spawnRing } from "./spawn/spawnRing";
import { audioService } from "./services/audioService";
import { upgradeService } from "./services/upgradeService";
import { tags } from "./tags";

// Track active slowdown timer and accumulated duration
let activeSlowdownTimer: KEventController | undefined;
let slowdownRemainingTime = 0;
export const PRIMARY_ROCKET_CHANCE_PER_PICKUP = 0.1;

export const powerups = {
	addFollower: (pos: Vec2) => {
		spawnCombatDrone();
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
	addPrimaryRocketChance: (pos: Vec2) => {
		session.primaryRocketChance += PRIMARY_ROCKET_CHANCE_PER_PICKUP;
		upgradeService.addModifier(
			"primaryRocketChance",
			PRIMARY_ROCKET_CHANCE_PER_PICKUP,
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

export function respawnCombatDrones(count: number) {
	for (let index = 0; index < count; index++) {
		spawnCombatDrone();
	}
}

export function spawnRepairedCombatDrone(deploymentStart: Vec2) {
	spawnCombatDrone(deploymentStart);
}

function spawnCombatDrone(deploymentStart?: Vec2) {
	spawnFollower({
		follow: playerObj,
		hp: 6,
		speed: k.rand(80, 110),
		blasterDmg:
			player.followerBlasterDmg * player.followerBlasterDmgMultiplier,
		deploymentStart,
	});
}

export type PowerupKey = keyof typeof powerups;

export function resetPowerupRuntime() {
	if (activeSlowdownTimer) activeSlowdownTimer.cancel();
	activeSlowdownTimer = undefined;
	slowdownRemainingTime = 0;
}

export function getPlayerPowerupStatus(): [string, string][] {
	const technologySets = getActiveTechnologySetNames();
	const droneCounts = getDroneTypeCounts();
	return [
		["Combat Drones", String(droneCounts.combat)],
		["Missile Drones", String(droneCounts.missile)],
		["Interceptor Drones", String(droneCounts.interceptor)],
		["Gunship Drones", String(droneCounts.gunship)],
		["Medic Drones", String(droneCounts.medic)],
		["Salvager Drones", String(droneCounts.salvager)],
		["Scrap Armor", String(session.scrapArmorCharges)],
		[
			"Volatile Cargo",
			!session.volatileCargoActive
				? "NONE"
				: session.volatileCargoIntact && !session.volatileCargoDelivered
					? "INTACT"
					: session.volatileCargoDelivered
						? "DELIVERED"
						: "LOST",
		],
		["Technology Sets", technologySets.join(" / ") || "NONE"],
		["Hull Reinforcement", formatBonus(session.extraHealth)],
		["Missile Cache", formatBonus(session.extraRockets)],
		["Shrapnel Payload", formatBonus(session.extraSpaceDebreeInMissiles)],
		["Rocket Coupler", formatPercentage(session.primaryRocketChance)],
		["Time Dilator", activeSlowdownTimer ? "ACTIVE" : "INACTIVE"],
	];
}

function formatBonus(value: number): string {
	return Number.isFinite(value) ? `+${value}` : "+0";
}

function formatPercentage(value: number): string {
	return Number.isFinite(value) ? `${Math.round(value * 100)}%` : "0%";
}

export const powerupsSprites: Record<PowerupKey, string> = {
	addFollower: "drone_combat",
	addPlayerMaxHealth: "hull_upg1",
	addExtraRockets: "more_missiles_upg1",
	addSpaceDebree: "missile_shards_upg1",
	addPrimaryRocketChance: "rocket_upg1",
	slowdownTime: "overclock_thrusters_upg1",
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
	addPrimaryRocketChance: undefined,
	slowdownTime: undefined, // No requirements
};

export function chance(c: number, max: number) {
	return k.rand(0, max) < c;
}
