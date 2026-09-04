import type { ToolKey } from "../upg"

export interface PlaytestBuild {
	id: string
	name: string
	description: string
	upgrades: Partial<Record<ToolKey, number>>
	followers?: number
	extraHealth?: number
	extraRockets?: number
	extraMissileShards?: number
	primaryRocketChance?: number
	initialScrapArmor?: number
}

export const PLAYTEST_BUILDS: readonly PlaytestBuild[] = [
	{
		id: "swarm",
		name: "SWARM INTELLIGENCE",
		description: "A complete six-drone roster with every specialization and a lethal-hit failsafe.",
		followers: 6,
		extraHealth: 2,
		upgrades: {
			blaster: 1,
			blasterParallel: 0,
			mouseAim: 0,
			followerBlasterDmg: 1,
			followerMissiles: 0,
			followerProjectileLink: 0,
			followerInterceptorProtocol: 0,
			followerGunship: 0,
			followerMedic: 0,
			followerSalvager: 0,
			sacrificialProtocol: 0,
			enemyHacker: 0,
			arcCapacitor: 1,
			targetingMatrix: 2,
		},
	},
	{
		id: "overdrive",
		name: "PLASMA RUNNER",
		description: "Maximum mobility, twin Space Jumps, and an enhanced damaging afterburner trail.",
		extraHealth: 1,
		upgrades: {
			blaster: 1,
			mouseAim: 0,
			sprint: 0,
			sprintSpeed: 1,
			movespeed: 1,
			spaceJump: 0,
			spaceJumpUpgrades: 1,
			afterburnerWake: 0,
			kineticPulse: 2,
		},
	},
	{
		id: "salvager",
		name: "SALVAGE FORTRESS",
		description: "Huge collection range, valuable salvage, four armor plates, and a reinforced hull.",
		extraHealth: 2,
		initialScrapArmor: 4,
		upgrades: {
			blaster: 1,
			debreeDist: 4,
			debreeValue: 1,
			maxHealth: 3,
			scrapArmor: 0,
			ricochetRounds: 1,
		},
	},
	{
		id: "storm",
		name: "ARC STORM",
		description: "Fast critical volleys chain through crowds, freeze survivors, and detonate stasis bursts.",
		extraRockets: 2,
		primaryRocketChance: 0.2,
		upgrades: {
			blaster: 1,
			blasterParallel: 0,
			blasterDmg: 0,
			blasterSpeed: 0,
			mouseAim: 0,
			arcCapacitor: 2,
			cryoRounds: 2,
			stasisBurst: 1,
			targetingMatrix: 3,
			criticalPayload: 2,
			rockets: 0,
			nrOfRockets: 2,
		},
	},
	{
		id: "voidstorm",
		name: "VOIDSTORM",
		description: "A deliberately excessive modifier build with gravity, splitting, ricochets, fragments, and mines.",
		extraHealth: 3,
		extraRockets: 3,
		extraMissileShards: 4,
		primaryRocketChance: 0.3,
		upgrades: {
			blaster: 1,
			blasterParallel: 0,
			blasterDmg: 0,
			blasterSpeed: 0,
			mouseAim: 0,
			rockets: 0,
			nrOfRockets: 3,
			rocketShards: 2,
			armorPiercing: 2,
			ricochetRounds: 2,
			ricochetModifierLink: 0,
			arcCapacitor: 1,
			splitChamber: 1,
			singularityPayload: 0,
			fragmentationCore: 1,
			growingCharge: 1,
			mineLayer: 1,
		},
	},
]
