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

export const phaseEcho: UpgradeDefinition = {
	toolKey: "phaseEcho",
	toolName: "Phase echo",
	category: "movement",
	type: "passive",
	requirements: { allOf: [{ toolKey: "spaceJump" }] },
	levels: [{
		name: "Phase Echo",
		desc: "Phase jump leaves a decoy that pulls enemies in and detonates",
		sprite: "phase_echo_upg1",
		price: 36,
		effects: {
			unlocks: [{ unlockId: "phaseEcho", description: "Phase jumps leave explosive decoys" }],
		},
	}],
}

export const salvageBattery: UpgradeDefinition = {
	toolKey: "salvageBattery",
	toolName: "Salvage battery",
	category: "resources",
	type: "passive",
	requirements: { anyOf: [{ toolKey: "debreeDist" }, { toolKey: "debreeValue" }] },
	levels: [{
		name: "Salvage Battery",
		desc: "Collected debris cools your secondary; excess charge forms a shield",
		sprite: "salvage_battery_upg1",
		price: 34,
		effects: {
			unlocks: [{ unlockId: "salvageBattery", description: "Salvage powers the secondary and shields" }],
		},
	}],
}

export const reactivePlating: UpgradeDefinition = {
	toolKey: "reactivePlating",
	toolName: "Reactive plating",
	category: "survival",
	type: "passive",
	levels: [{
		name: "Reactive Plating",
		desc: "Hull damage releases a close-range armor blast, with a short cooldown",
		sprite: "reactive_plating_upg1",
		price: 34,
		effects: {
			unlocks: [{ unlockId: "reactivePlating", description: "Taking damage releases an armor blast" }],
		},
	}],
}

export const packIntelligence: UpgradeDefinition = {
	toolKey: "packIntelligence",
	toolName: "Pack intelligence",
	category: "combat",
	type: "passive",
	requirements: { anyOf: [{ toolKey: "followerBlasterDmg" }] },
	levels: [{
		name: "Pack Intelligence",
		desc: "Drones gain 20% damage for each other drone focusing their target",
		sprite: "pack_intelligence_upg1",
		price: 38,
		effects: {
			unlocks: [{ unlockId: "packIntelligence", description: "Focused drone packs deal more damage" }],
		},
	}],
}

export const glassReactor: UpgradeDefinition = {
	toolKey: "glassReactor",
	toolName: "Glass reactor",
	category: "special",
	type: "passive",
	levels: [{
		name: "Glass Reactor",
		desc: "Double all damage dealt, but maximum hull is locked to one",
		sprite: "glass_reactor_upg1",
		price: 48,
		effects: {
			unlocks: [{ unlockId: "glassReactor", description: "Double damage at one maximum hull" }],
		},
	}],
}
