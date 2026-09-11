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
	requirements: { allOf: [{ toolKey: "thrusterOverdrive" }] },
	levels: [
		{
			name: "Plasma Trail",
			desc: "Overclocked thrusters leave a burning wake that deals 100% primary damage",
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
	requirements: { allOf: [{ toolKey: "phaseJump" }] },
	levels: [{
		name: "Phase Echo",
		desc: "Phase jump leaves a decoy that pulls enemies in and detonates for 400% primary damage",
		sprite: "phase_echo_upg1",
		price: 36,
		effects: {
			unlocks: [{ unlockId: "phaseEcho", description: "Phase jumps leave explosive decoys" }],
		},
	}],
}

export const phaseWake: UpgradeDefinition = {
	toolKey: "phaseWake",
	toolName: "Phase wake",
	category: "movement",
	type: "passive",
	requirements: { allOf: [{ toolKey: "phaseJump" }] },
	levels: [{
		name: "Phase Wake",
		desc: "Phase jump leaves a wake that slows hostiles and accelerates you when crossed again",
		sprite: "phase_wake_upg1",
		price: 38,
		effects: {
			unlocks: [{ unlockId: "phaseWake", description: "Phase jumps leave a reusable acceleration wake" }],
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
		desc: "Hull damage releases a close-range blast for 300% primary damage, with a short cooldown",
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

export const droneFusion: UpgradeDefinition = {
	toolKey: "droneFusion",
	toolName: "Drone fusion",
	category: "combat",
	type: "passive",
	requirements: { allOf: [{ toolKey: "followerBlasterDmg" }] },
	levels: [{
		name: "Drone Fusion",
		desc: "Every three standard drones combine into one larger elite drone that inherits their strongest role",
		sprite: "drone_fusion_upg1",
		price: 44,
		effects: {
			unlocks: [{ unlockId: "droneFusion", description: "Three drones combine into an elite chassis" }],
		},
	}],
}

export const sawSatellite: UpgradeDefinition = {
	toolKey: "sawSatellite",
	toolName: "Saw satellite",
	category: "combat",
	type: "passive",
	levels: [{
		name: "Saw Satellite",
		desc: "A toothed satellite orbits the ship, dealing 150% primary damage per hit and cutting down hostile projectiles",
		sprite: "saw_satellite_upg1",
		price: 36,
		effects: {
			unlocks: [{ unlockId: "sawSatellite", description: "Launches a damaging orbital saw" }],
		},
	}],
}

export const kineticRam: UpgradeDefinition = {
	toolKey: "kineticRam",
	toolName: "Kinetic ram",
	category: "movement",
	type: "passive",
	requirements: {
		anyOf: [{ toolKey: "thrusterOverdrive" }, { toolKey: "phaseJump" }],
	},
	levels: [{
		name: "Kinetic Ram",
		desc: "Boosting collisions and Phase Jump paths deal 300% primary damage, scaled by movement speed",
		sprite: "kinetic_ram_upg1",
		price: 38,
		effects: {
			unlocks: [{ unlockId: "kineticRam", description: "High-speed movement becomes a weapon" }],
		},
	}],
}

export const nearMissCapacitor: UpgradeDefinition = {
	toolKey: "nearMissCapacitor",
	toolName: "Near-miss capacitor",
	category: "special",
	type: "passive",
	levels: [{
		name: "Near-Miss Capacitor",
		desc: "Graze five hostile projectiles to discharge a shockwave for 400% primary damage",
		sprite: "near_miss_capacitor_upg1",
		price: 40,
		effects: {
			unlocks: [{ unlockId: "nearMissCapacitor", description: "Projectile grazes charge a shockwave" }],
		},
	}],
}
