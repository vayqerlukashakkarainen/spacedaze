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
	"Overclocked thrusters leave a burning wake that damages enemies",
	"overclock_thrusters_upg1",
	28,
	{ allOf: [{ toolKey: "sprint" }] }
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
	"Phase jump leaves a decoy that pulls enemies in and detonates",
	"phase_echo_upg1", 36, { allOf: [{ toolKey: "spaceJump" }] }
)

export const salvageBattery: Tool = singleLevelTool(
	"Salvage battery", "Salvage Battery",
	"Collected debris cools your secondary; excess charge forms a shield",
	"salvage_battery_upg1", 34,
	{ anyOf: [{ toolKey: "debreeDist" }, { toolKey: "debreeValue" }] }
)

export const reactivePlating: Tool = singleLevelTool(
	"Reactive plating", "Reactive Plating",
	"Hull damage releases a close-range armor blast, with a short cooldown",
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
