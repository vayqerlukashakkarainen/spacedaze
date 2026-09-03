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
