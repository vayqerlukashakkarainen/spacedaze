export type FloorThemeId =
	| "wake-scrap-district"
	| "freebooter-exchange"
	| "khelt-moltworks"
	| "oruun-pilgrim-array"
	| "naru-tide-ark"
	| "silex-resonance-vault"
	| "vey-living-convoy"
	| "federation-claim-zone"
	| "daze-scar"

export interface FloorThemeDefinition {
	id: FloorThemeId
	name: string
	subtitle: string
	color: readonly [number, number, number]
	enemyFamily: string
	subfloorCount: number
	subfloorMusic: readonly (FloorMusicTrack | undefined)[]
}

export interface FloorMusicTrack {
	music: string
	path: string
	title: string
	author: string
	albumCover?: string
}

export interface FloorPosition {
	floor: number
	subfloor: number
}

const SHIROBON_FOX: FloorMusicTrack = {
	music: "shirobon_fox",
	path: "songs/shirobon-fox.mp3",
	title: "Fox",
	author: "Shirobon",
}

const SHIROBON_ON_THE_RUN: FloorMusicTrack = {
	music: "shirobon_on_the_run",
	path: "songs/shirobon-on-the-run.mp3",
	title: "On The Run",
	author: "Shirobon",
}

export const FLOOR_THEME_DIRECTORY: Readonly<Record<FloorThemeId, FloorThemeDefinition>> = {
	"wake-scrap-district": {
		id: "wake-scrap-district",
		name: "Wake Scrap District",
		subtitle: "THE DAZE REMEMBERS HOME",
		color: [0, 207, 255],
		enemyFamily: "wake-scrap",
		subfloorCount: 3,
		subfloorMusic: [
			SHIROBON_FOX,
			SHIROBON_ON_THE_RUN,
			SHIROBON_ON_THE_RUN,
		],
	},
	"freebooter-exchange": {
		id: "freebooter-exchange",
		name: "Freebooter Exchange",
		subtitle: "EVERYTHING HAS A PRICE",
		color: [255, 150, 55],
		enemyFamily: "freebooter",
		subfloorCount: 3,
		subfloorMusic: [],
	},
	"khelt-moltworks": {
		id: "khelt-moltworks",
		name: "Khelt Moltworks",
		subtitle: "THE OLD SHELL FEEDS THE NEW",
		color: [240, 184, 75],
		enemyFamily: "khelt",
		subfloorCount: 3,
		subfloorMusic: [],
	},
	"oruun-pilgrim-array": {
		id: "oruun-pilgrim-array",
		name: "Oruun Pilgrim Array",
		subtitle: "FOLLOW THE WEIGHT BETWEEN STARS",
		color: [174, 112, 255],
		enemyFamily: "oruun",
		subfloorCount: 3,
		subfloorMusic: [],
	},
	"naru-tide-ark": {
		id: "naru-tide-ark",
		name: "Naru Tide Ark",
		subtitle: "THE CURRENT CARRIES MEMORY",
		color: [65, 145, 255],
		enemyFamily: "naru",
		subfloorCount: 3,
		subfloorMusic: [],
	},
	"silex-resonance-vault": {
		id: "silex-resonance-vault",
		name: "Silex Resonance Vault",
		subtitle: "ONE SIGNAL BECOMES A CHORUS",
		color: [225, 75, 255],
		enemyFamily: "silex",
		subfloorCount: 3,
		subfloorMusic: [],
	},
	"vey-living-convoy": {
		id: "vey-living-convoy",
		name: "Vey Living Convoy",
		subtitle: "NOTHING LIVING TRAVELS ALONE",
		color: [90, 220, 145],
		enemyFamily: "vey",
		subfloorCount: 3,
		subfloorMusic: [],
	},
	"federation-claim-zone": {
		id: "federation-claim-zone",
		name: "Federation Claim Zone",
		subtitle: "PROPERTY MARKED FOR RECLAMATION",
		color: [255, 90, 90],
		enemyFamily: "federation",
		subfloorCount: 3,
		subfloorMusic: [],
	},
	"daze-scar": {
		id: "daze-scar",
		name: "Daze Scar",
		subtitle: "MEMORY HAS LOST ITS SHAPE",
		color: [210, 210, 255],
		enemyFamily: "phase-echo",
		subfloorCount: 3,
		subfloorMusic: [],
	},
}

const OPENING_FLOOR_THEMES: readonly FloorThemeId[] = [
	"wake-scrap-district",
	"freebooter-exchange",
	"khelt-moltworks",
	"oruun-pilgrim-array",
	"naru-tide-ark",
	"silex-resonance-vault",
	"vey-living-convoy",
	"federation-claim-zone",
	"daze-scar",
]

const DEEP_FLOOR_THEMES: readonly FloorThemeId[] = [
	"khelt-moltworks",
	"naru-tide-ark",
	"oruun-pilgrim-array",
	"silex-resonance-vault",
	"vey-living-convoy",
	"federation-claim-zone",
	"freebooter-exchange",
	"daze-scar",
]

export function getFloorThemeIdForDepth(depth: number): FloorThemeId {
	return resolveFloorDepth(depth).themeId
}

export function getFloorPositionForDepth(depth: number): FloorPosition {
	const resolved = resolveFloorDepth(depth)
	return { floor: resolved.floor, subfloor: resolved.subfloor }
}

function resolveFloorDepth(depth: number) {
	const normalizedDepth = Math.max(1, Math.floor(depth))
	let remainingDepth = normalizedDepth
	let floor = 1
	for (const themeId of OPENING_FLOOR_THEMES) {
		const subfloorCount = FLOOR_THEME_DIRECTORY[themeId].subfloorCount
		if (remainingDepth <= subfloorCount) {
			return { floor, subfloor: remainingDepth, themeId }
		}
		remainingDepth -= subfloorCount
		floor++
	}

	const cycleDepth = DEEP_FLOOR_THEMES.reduce(
		(total, themeId) => total + FLOOR_THEME_DIRECTORY[themeId].subfloorCount,
		0
	)
	const completedCycles = Math.floor((remainingDepth - 1) / cycleDepth)
	remainingDepth -= completedCycles * cycleDepth
	floor += completedCycles * DEEP_FLOOR_THEMES.length
	for (const themeId of DEEP_FLOOR_THEMES) {
		const subfloorCount = FLOOR_THEME_DIRECTORY[themeId].subfloorCount
		if (remainingDepth <= subfloorCount) {
			return { floor, subfloor: remainingDepth, themeId }
		}
		remainingDepth -= subfloorCount
		floor++
	}

	return { floor, subfloor: 1, themeId: DEEP_FLOOR_THEMES[0] }
}

export function getFloorThemeDefinition(themeId: FloorThemeId) {
	return FLOOR_THEME_DIRECTORY[themeId]
}

export function getFloorThemeForDepth(depth: number) {
	return getFloorThemeDefinition(getFloorThemeIdForDepth(depth))
}

export function selectFloorMusicTrack(depth: number, _seed: number) {
	const theme = getFloorThemeForDepth(depth)
	const { subfloor } = getFloorPositionForDepth(depth)
	return theme.subfloorMusic[subfloor - 1]
}
