const TACTICAL_UPLINK_BASE_HULL_THRESHOLD = 0.9
const TACTICAL_UPLINK_THRESHOLD_STEP = 0.05

export function getTacticalUplinkHullThreshold(level: number) {
	return Math.max(
		0,
		TACTICAL_UPLINK_BASE_HULL_THRESHOLD -
			Math.max(0, level) * TACTICAL_UPLINK_THRESHOLD_STEP
	)
}

export function describeTacticalUplinkLevel(level: number, totalLevels: number) {
	const threshold = Math.round(getTacticalUplinkHullThreshold(level) * 100)
	return `Deal more damage to enemies at ${threshold}% hull or higher. Stack ${level + 1}/${totalLevels}`
}
