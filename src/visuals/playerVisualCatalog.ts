import type { VisualRepresentation } from "./visualRepresentation"

export const PLAYER_DIRECTIONAL_SPRITES = [
	"ship",
	"ship_north_east",
	"ship_east",
	"ship_south_east",
	"ship_south",
	"ship_south_west",
	"ship_west",
	"ship_north_west",
] as const

export const PLAYER_VISUAL: VisualRepresentation = {
	parts: [{ sprite: "ship_root" }],
	worldScale: 1,
}
