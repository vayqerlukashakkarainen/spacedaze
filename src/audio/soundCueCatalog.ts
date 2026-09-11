import type { PositionalSoundOptions, SoundOptions } from "../services/audio/audioService"
import { SOUND_ASSETS, type SoundAssetId } from "./soundCatalog"

const SHIP_DESTRUCTION_ASSETS = [
	"ship_part_destroyed_01",
	"ship_part_destroyed_02",
] as const

const ROCK_DESTRUCTION_ASSETS = [
	"asteroid_destroyed",
	"rock_material_destroyed_02",
] as const

export type SoundStackingPolicy = "allow" | "ignore" | "restart" | "limit"

export interface SoundCuePolicy {
	asset?: SoundAssetId | readonly SoundAssetId[]
	defaults?: SoundOptions
	positionalDefaults?: Pick<
		PositionalSoundOptions,
		"minDistance" | "maxDistance" | "rolloff" | "panDistance" | "voiceLimit"
	>
	group?: string
	stacking?: SoundStackingPolicy
	maxVoices?: number
	cooldownSeconds?: number
	detuneRange?: readonly [number, number]
}

export const SEMANTIC_SOUND_CUES = {
	enemy_blaster_fire: {
		asset: [
			"enemy_blaster_01",
			"enemy_blaster_02",
			"enemy_blaster_03",
			"enemy_blaster_04",
			"enemy_blaster_05",
			"enemy_blaster_06",
			"enemy_blaster_07",
			"enemy_blaster_08",
			"enemy_blaster_09",
			"enemy_blaster_10",
		],
		group: "enemy-blaster-fire",
		stacking: "limit",
		maxVoices: 8,
		cooldownSeconds: 0.015,
		positionalDefaults: {
			minDistance: 80,
			maxDistance: 720,
			voiceLimit: 8,
		},
	},
	explosive_blast: {
		asset: [
			"explosion_pool_01",
			"explosion_pool_02",
			"explosion_pool_03",
			"explosion_pool_04",
			"explosion_pool_05",
		],
		group: "explosive-blast",
		stacking: "limit",
		maxVoices: 6,
		positionalDefaults: {
			minDistance: 70,
			maxDistance: 720,
			voiceLimit: 6,
		},
	},
	ship_part_destroyed: {
		asset: SHIP_DESTRUCTION_ASSETS,
		group: "ship-destruction",
		stacking: "limit",
		maxVoices: 5,
		cooldownSeconds: 0.02,
		positionalDefaults: {
			minDistance: 70,
			maxDistance: 680,
			voiceLimit: 5,
		},
	},
	enemy_ship_destroyed: {
		asset: SHIP_DESTRUCTION_ASSETS,
		group: "ship-destruction",
		stacking: "limit",
		maxVoices: 5,
		cooldownSeconds: 0.02,
		positionalDefaults: {
			minDistance: 80,
			maxDistance: 780,
			voiceLimit: 5,
		},
	},
	rock_material_destroyed: {
		asset: ROCK_DESTRUCTION_ASSETS,
		group: "rock-material-destruction",
		stacking: "limit",
		maxVoices: 6,
		cooldownSeconds: 0.02,
		positionalDefaults: {
			minDistance: 80,
			maxDistance: 780,
			voiceLimit: 6,
		},
	},
	player_primary_charge: {
		asset: "primary_weapon_charge",
		group: "player-primary-charge",
		stacking: "ignore",
	},
	chest_challenge_charge: {
		asset: "rail_lance_charge",
		group: "chest-challenge-charge",
		stacking: "ignore",
	},
	chest_open_charge: {
		asset: "primary_weapon_charge",
		group: "chest-open-charge",
		stacking: "restart",
	},
	charge_zone_charge: {
		asset: "primary_weapon_charge",
		group: "charge-zone-charge",
		stacking: "ignore",
	},
	miniboss_detonation_charge: {
		asset: "rail_lance_charge",
		defaults: { speed: 0.54 },
		group: "miniboss-detonation-charge",
		stacking: "ignore",
		positionalDefaults: {
			minDistance: 100,
			maxDistance: 900,
			voiceLimit: 1,
		},
	},
} as const satisfies Record<string, SoundCuePolicy>

export type SemanticSoundCueId = keyof typeof SEMANTIC_SOUND_CUES
export type SoundCueId = SoundAssetId | SemanticSoundCueId

export const SOUND_CUE_POLICIES: Partial<Record<SoundCueId, SoundCuePolicy>> = {
	ui_hover: {
		group: "ui-hover",
		stacking: "limit",
		maxVoices: 2,
		cooldownSeconds: 0.035,
	},
	ui_click: { group: "ui-click", stacking: "limit", maxVoices: 2 },
	room_cleared: { group: "room-cleared", stacking: "ignore" },
	player_game_over: { group: "player-game-over", stacking: "ignore" },
	low_health_warning: { group: "low-health-warning", stacking: "ignore" },
	player_overheated: {
		group: "player-overheated",
		stacking: "restart",
		cooldownSeconds: 0.1,
	},
	player_thruster_loop: { group: "player-thruster-loop", stacking: "ignore" },
	target_lock: { group: "target-lock", stacking: "restart" },
	lasso_throw: { group: "player-lasso", stacking: "restart" },
	menu_spacejump_warp: { group: "space-transition", stacking: "restart" },
	hyperspeed_jump_start: { group: "space-transition", stacking: "restart" },
	hostile_phase_arrival: {
		group: "hostile-arrival",
		stacking: "ignore",
		positionalDefaults: {
			minDistance: 100,
			maxDistance: 680,
			voiceLimit: 1,
		},
	},
	machine_boss_fight_start: {
		group: "machine-boss-fight-start",
		stacking: "restart",
	},
	shop_menu_open: { group: "shop-menu", stacking: "restart" },
	shop_menu_close: { group: "shop-menu", stacking: "restart" },
	weapon_burst_driver: {
		group: "weapon-burst-driver",
		stacking: "limit",
		maxVoices: 6,
	},
	lifesteal_health_receive: {
		group: "lifesteal-health-receive",
		stacking: "limit",
		maxVoices: 3,
		cooldownSeconds: 0.045,
		detuneRange: [-60, 60],
	},
}

export function getSoundCuePolicy(cueId: SoundCueId): SoundCuePolicy {
	if (Object.hasOwn(SEMANTIC_SOUND_CUES, cueId)) {
		return SEMANTIC_SOUND_CUES[cueId as SemanticSoundCueId]
	}
	return SOUND_CUE_POLICIES[cueId] ?? {}
}

export function isSoundCueId(value: string): value is SoundCueId {
	return Object.hasOwn(SOUND_ASSETS, value) || Object.hasOwn(SEMANTIC_SOUND_CUES, value)
}
