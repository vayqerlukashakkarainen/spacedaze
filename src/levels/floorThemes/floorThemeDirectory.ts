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
}

export const FLOOR_THEME_DIRECTORY: Readonly<Record<FloorThemeId, FloorThemeDefinition>> = {
	"wake-scrap-district": {
		id: "wake-scrap-district",
		name: "Wake Scrap District",
		subtitle: "THE DAZE REMEMBERS HOME",
		color: [0, 207, 255],
		enemyFamily: "wake-scrap",
	},
	"freebooter-exchange": {
		id: "freebooter-exchange",
		name: "Freebooter Exchange",
		subtitle: "EVERYTHING HAS A PRICE",
		color: [255, 150, 55],
		enemyFamily: "freebooter",
	},
	"khelt-moltworks": {
		id: "khelt-moltworks",
		name: "Khelt Moltworks",
		subtitle: "THE OLD SHELL FEEDS THE NEW",
		color: [240, 184, 75],
		enemyFamily: "khelt",
	},
	"oruun-pilgrim-array": {
		id: "oruun-pilgrim-array",
		name: "Oruun Pilgrim Array",
		subtitle: "FOLLOW THE WEIGHT BETWEEN STARS",
		color: [174, 112, 255],
		enemyFamily: "oruun",
	},
	"naru-tide-ark": {
		id: "naru-tide-ark",
		name: "Naru Tide Ark",
		subtitle: "THE CURRENT CARRIES MEMORY",
		color: [65, 145, 255],
		enemyFamily: "naru",
	},
	"silex-resonance-vault": {
		id: "silex-resonance-vault",
		name: "Silex Resonance Vault",
		subtitle: "ONE SIGNAL BECOMES A CHORUS",
		color: [225, 75, 255],
		enemyFamily: "silex",
	},
	"vey-living-convoy": {
		id: "vey-living-convoy",
		name: "Vey Living Convoy",
		subtitle: "NOTHING LIVING TRAVELS ALONE",
		color: [90, 220, 145],
		enemyFamily: "vey",
	},
	"federation-claim-zone": {
		id: "federation-claim-zone",
		name: "Federation Claim Zone",
		subtitle: "PROPERTY MARKED FOR RECLAMATION",
		color: [255, 90, 90],
		enemyFamily: "federation",
	},
	"daze-scar": {
		id: "daze-scar",
		name: "Daze Scar",
		subtitle: "MEMORY HAS LOST ITS SHAPE",
		color: [210, 210, 255],
		enemyFamily: "phase-echo",
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
	const normalizedDepth = Math.max(1, Math.floor(depth))
	if (normalizedDepth <= OPENING_FLOOR_THEMES.length) {
		return OPENING_FLOOR_THEMES[normalizedDepth - 1]
	}
	return DEEP_FLOOR_THEMES[
		(normalizedDepth - OPENING_FLOOR_THEMES.length - 1) % DEEP_FLOOR_THEMES.length
	]
}

export function getFloorThemeDefinition(themeId: FloorThemeId) {
	return FLOOR_THEME_DIRECTORY[themeId]
}

export function getFloorThemeForDepth(depth: number) {
	return getFloorThemeDefinition(getFloorThemeIdForDepth(depth))
}
