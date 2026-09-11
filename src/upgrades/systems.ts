import { Tool } from "../upg"

export const scrapArmor: Tool = singleLevelTool(
	"Scrap armor",
	"Magnetic Plating",
	"Every 8 salvage collected forms an orbiting plate that blocks one hit",
	"hull_upg1",
	28,
	{ anyOf: [{ toolKey: "debreeDist" }, { toolKey: "debreeValue" }] }
)

export const afterburnerWake: Tool = singleLevelTool(
	"Afterburner wake",
	"Plasma Trail",
	"Overclocked thrusters leave a burning wake that deals 100% primary damage",
	"overclock_thrusters_upg1",
	28,
	{ allOf: [{ toolKey: "thrusterOverdrive" }] }
)

export const sacrificialProtocol: Tool = singleLevelTool(
	"Drone failsafe",
	"Sacrificial Protocol",
	"A combat drone sacrifices itself to prevent lethal hull damage",
	"follower_upg1",
	34,
	{
		anyOf: [
			{ toolKey: "followerBlasterDmg" },
			{ toolKey: "followerMissiles" },
			{ toolKey: "followerInterceptorProtocol" },
		],
	}
)

export const enemyHacker: Tool = singleLevelTool(
	"Enemy hacker",
	"Ghost Override",
	"Defeated enemies have a 12% chance to return as temporary allies",
	"arc_capacitor_upg1",
	38,
	{
		anyOf: [
			{ toolKey: "followerProjectileLink" },
			{ toolKey: "followerInterceptorProtocol" },
		],
	}
)

export const phaseEcho: Tool = singleLevelTool(
	"Phase echo", "Phase Echo",
	"Phase jump leaves a decoy that pulls enemies in and detonates for 400% primary damage",
	"phase_echo_upg1", 36, { allOf: [{ toolKey: "spaceJump" }] }
)

export const phaseWake: Tool = singleLevelTool(
	"Phase wake", "Phase Wake",
	"Phase jump leaves a wake that slows hostiles and accelerates you when crossed again",
	"phase_wake_upg1", 38, { allOf: [{ toolKey: "spaceJump" }] }
)

export const salvageBattery: Tool = singleLevelTool(
	"Salvage battery", "Salvage Battery",
	"Collected debris cools your secondary; excess charge forms a shield",
	"salvage_battery_upg1", 34,
	{ anyOf: [{ toolKey: "debreeDist" }, { toolKey: "debreeValue" }] }
)

export const reactivePlating: Tool = singleLevelTool(
	"Reactive plating", "Reactive Plating",
	"Hull damage releases a close-range blast for 300% primary damage, with a short cooldown",
	"reactive_plating_upg1", 34
)

export const packIntelligence: Tool = singleLevelTool(
	"Pack intelligence", "Pack Intelligence",
	"Drones gain damage when several focus the same target",
	"pack_intelligence_upg1", 38,
	{ anyOf: [{ toolKey: "followerBlasterDmg" }] }
)

export const glassReactor: Tool = singleLevelTool(
	"Glass reactor", "Glass Reactor",
	"Double all damage dealt, but maximum hull is locked to one",
	"glass_reactor_upg1", 48
)

export const droneFusion: Tool = singleLevelTool(
	"Drone fusion", "Drone Fusion",
	"Every three standard drones combine into one larger elite drone that inherits their strongest role",
	"drone_fusion_upg1", 44,
	{ allOf: [{ toolKey: "followerBlasterDmg" }] }
)

export const sawSatellite: Tool = singleLevelTool(
	"Saw satellite", "Saw Satellite",
	"A toothed satellite orbits the ship, dealing 150% primary damage per hit and cutting down hostile projectiles",
	"saw_satellite_upg1", 36
)

export const kineticRam: Tool = singleLevelTool(
	"Kinetic ram", "Kinetic Ram",
	"Boosting collisions and Phase Jump paths deal 300% primary damage, scaled by movement speed",
	"kinetic_ram_upg1", 38,
	{ anyOf: [{ toolKey: "thrusterOverdrive" }, { toolKey: "spaceJump" }] }
)

export const nearMissCapacitor: Tool = singleLevelTool(
	"Near-miss capacitor", "Near-Miss Capacitor",
	"Graze five hostile projectiles to discharge a shockwave for 400% primary damage",
	"near_miss_capacitor_upg1", 40
)

function singleLevelTool(
	toolName: string,
	name: string,
	desc: string,
	sprite: string,
	price: number,
	requirements?: Tool["requirements"]
): Tool {
	return {
		toolName,
		requirements,
		upgrades: [{ name, desc, sprite, price, value: 1 }],
	}
}
