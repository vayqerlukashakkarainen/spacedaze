export type BuildProfile = "full" | "demo"

export interface BuildLimits {
	maxRunDepth: number
	maxHubLevel: number
}

export const BUILD_PROFILE: BuildProfile =
	import.meta.env?.VITE_SPACEDAZE_BUILD_PROFILE === "demo"
		? "demo"
		: "full"

const FULL_BUILD_LIMITS: BuildLimits = {
	maxRunDepth: Number.POSITIVE_INFINITY,
	maxHubLevel: Number.POSITIVE_INFINITY,
}

const DEMO_BUILD_LIMITS: BuildLimits = {
	maxRunDepth: 5,
	maxHubLevel: 3,
}

export function isDemoBuild() {
	return BUILD_PROFILE === "demo"
}

export function getBuildLimits(
	profile: BuildProfile = BUILD_PROFILE
): BuildLimits {
	return profile === "demo" ? DEMO_BUILD_LIMITS : FULL_BUILD_LIMITS
}

export function canAdvanceRunAfterDepth(
	depth: number,
	profile: BuildProfile = BUILD_PROFILE
) {
	return depth < getBuildLimits(profile).maxRunDepth
}
