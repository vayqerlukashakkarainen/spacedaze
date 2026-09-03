import { PLAYTEST_BUILDS } from "./buildPresets"
import type { PlaytestBuild } from "./buildPresets"
import { getUpgradeDefinition } from "../upgrades/upgradeRegistry"

export function getPlaytestBuild(id: string) {
	const normalizedId = normalizeBuildId(id)
	return PLAYTEST_BUILDS.find((build) => build.id === normalizedId)
}

export function formatPlaytestBuildList() {
	return [
		"## Playtest Builds",
		...PLAYTEST_BUILDS.flatMap(formatPlaytestBuild),
		"Use: build <id>",
	].join("\n")
}

function formatPlaytestBuild(build: PlaytestBuild) {
	const upgrades = Object.entries(build.upgrades)
		.filter((entry): entry is [string, number] => entry[1] !== undefined)
		.map(([toolKey, level]) => {
			const definition = getUpgradeDefinition(toolKey)
			return `${definition?.toolName ?? toolKey} L${level + 1}`.toUpperCase()
		})
	const powerups = getBuildPowerups(build)

	return [
		`### ${build.id} - ${build.name}`,
		"UPGRADES",
		...upgrades.map((upgrade) => `- ${upgrade}`),
		...(powerups.length > 0
			? ["POWERUPS", ...powerups.map((powerup) => `- ${powerup}`)]
			: []),
	]
}

function getBuildPowerups(build: PlaytestBuild) {
	const powerups: string[] = []
	if (build.followers) powerups.push(`COMBAT DRONE x${build.followers}`)
	if (build.extraHealth) {
		powerups.push(`HULL REINFORCEMENT x${build.extraHealth}`)
	}
	if (build.extraRockets) powerups.push(`MISSILE CACHE x${build.extraRockets}`)
	if (build.extraMissileShards) {
		powerups.push(`SHRAPNEL PAYLOAD +${build.extraMissileShards}`)
	}
	if (build.primaryRocketChance) {
		powerups.push(`ROCKET COUPLER ${Math.round(build.primaryRocketChance * 100)}%`)
	}
	if (build.initialScrapArmor) {
		powerups.push(`SCRAP ARMOR PLATE x${build.initialScrapArmor}`)
	}
	return powerups
}

function normalizeBuildId(id: string) {
	return id.trim().toLowerCase().replaceAll("_", "-")
}
