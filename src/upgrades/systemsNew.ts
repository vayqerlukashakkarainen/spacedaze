import { UpgradeDefinition } from "../types/upgradeTypes"

export const scrapArmor: UpgradeDefinition = {
	toolKey: "scrapArmor",
	toolName: "Scrap armor",
	category: "survival",
	type: "passive",
	requirements: {
		anyOf: [{ toolKey: "debreeDist" }, { toolKey: "debreeValue" }],
	},
	levels: [
		{
			name: "Magnetic Plating",
			desc: "Every 8 salvage collected forms an orbiting plate that blocks one hit",
			sprite: "hull_upg1",
			price: 28,
			effects: {
				unlocks: [{ unlockId: "scrapArmor", description: "Salvage forms protective plates" }],
			},
		},
	],
}

export const afterburnerWake: UpgradeDefinition = {
	toolKey: "afterburnerWake",
	toolName: "Afterburner wake",
	category: "movement",
	type: "passive",
	requirements: { allOf: [{ toolKey: "sprint" }] },
	levels: [
		{
			name: "Plasma Trail",
			desc: "Overclocked thrusters leave a burning wake that damages enemies",
			sprite: "overclock_thrusters_upg1",
			price: 28,
			effects: {
				unlocks: [{ unlockId: "afterburnerWake", description: "Sprint leaves a damaging wake" }],
			},
		},
	],
}

export const sacrificialProtocol: UpgradeDefinition = {
	toolKey: "sacrificialProtocol",
	toolName: "Drone failsafe",
	category: "survival",
	type: "passive",
	requirements: {
		anyOf: [
			{ toolKey: "followerBlasterDmg" },
			{ toolKey: "followerMissiles" },
			{ toolKey: "followerInterceptorProtocol" },
		],
	},
	levels: [
		{
			name: "Sacrificial Protocol",
			desc: "A combat drone sacrifices itself to prevent lethal hull damage",
			sprite: "follower_upg1",
			price: 34,
			effects: {
				unlocks: [{ unlockId: "sacrificialProtocol", description: "Drones intercept lethal damage" }],
			},
		},
	],
}

export const enemyHacker: UpgradeDefinition = {
	toolKey: "enemyHacker",
	toolName: "Enemy hacker",
	category: "special",
	type: "passive",
	requirements: {
		anyOf: [
			{ toolKey: "followerProjectileLink" },
			{ toolKey: "followerInterceptorProtocol" },
		],
	},
	levels: [
		{
			name: "Ghost Override",
			desc: "Defeated enemies have a 12% chance to return as temporary allies",
			sprite: "arc_capacitor_upg1",
			price: 38,
			effects: {
				unlocks: [{ unlockId: "enemyHacker", description: "Defeated enemies may become allies" }],
			},
		},
	],
}
