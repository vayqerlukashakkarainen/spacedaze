import type { ProgressionEnemyId } from "../services/enemies/enemyProgressionService"
import type { VisualRepresentation } from "./visualRepresentation"

export interface EnemyVisualRepresentation extends VisualRepresentation {
	destroyedSprite?: string
	phaseSprites?: readonly string[]
}

export type HunterVisualId = "standard" | "talon" | "carapace" | "needle"

export const HUNTER_VISUALS: Record<HunterVisualId, VisualRepresentation> = {
	standard: {
		parts: [
			{ sprite: "enemy_hunter_standard_core" },
			{ sprite: "enemy_hunter_standard_left_wing", offset: [-8, 2] },
			{ sprite: "enemy_hunter_standard_right_wing", offset: [8, 3] },
			{ sprite: "enemy_hunter_standard_weapon", offset: [0, -12] },
		],
		worldScale: 1,
	},
	talon: {
		parts: [
			{ sprite: "enemy_hunter_talon_core" },
			{ sprite: "enemy_hunter_talon_left_wing", offset: [-8, -3] },
			{ sprite: "enemy_hunter_talon_right_wing", offset: [9, -3] },
			{ sprite: "enemy_hunter_talon_weapon", offset: [0, -12] },
		],
		worldScale: 1,
	},
	carapace: {
		parts: [
			{ sprite: "enemy_hunter_carapace_core" },
			{ sprite: "enemy_hunter_carapace_left_wing", offset: [-9, 0] },
			{ sprite: "enemy_hunter_carapace_right_wing", offset: [9, -1] },
			{ sprite: "enemy_hunter_carapace_weapon", offset: [0, -10] },
		],
		worldScale: 1,
	},
	needle: {
		parts: [
			{ sprite: "enemy_hunter_needle_core" },
			{ sprite: "enemy_hunter_needle_left_wing", offset: [-9, -2] },
			{ sprite: "enemy_hunter_needle_right_wing", offset: [9, -2] },
			{ sprite: "enemy_hunter_needle_weapon", offset: [0, -12] },
		],
		worldScale: 1,
	},
}

export type EnemyVisualId = ProgressionEnemyId |
	"impact-ace" |
	"federation-dreadnought" |
	"wake-yardmaster" |
	"wake-last-beacon" |
	"stationary-cannon-platform" |
	"enemy-proximity-mine" |
	"range-keeper" |
	"generic-vehicle" |
	"heavy-vehicle" |
	"asteroid"

export const ENEMY_VISUALS: Record<EnemyVisualId, EnemyVisualRepresentation> = {
	"swarm-drone": {
		parts: [{ sprite: "enemy_swarm_drone" }],
		worldScale: 0.6,
	},
	fighter: {
		parts: [
			{ sprite: "enemy_fighter_core" },
			{ sprite: "enemy_fighter_left_wing", offset: [-10, 2] },
			{ sprite: "enemy_fighter_right_wing", offset: [10, 2] },
		],
		worldScale: 1,
	},
	assassin: HUNTER_VISUALS.standard,
	rammer: { parts: [{ sprite: "enemy_rammer" }], worldScale: 1 },
	sniper: { parts: [{ sprite: "enemy_sniper" }], worldScale: 1 },
	hivemind: {
		parts: [{ sprite: "enemy_swarm_hivemind" }],
		worldScale: 1,
	},
	"mine-layer": { parts: [{ sprite: "enemy_mine_layer" }], worldScale: 1 },
	"shield-drone": {
		parts: [{ sprite: "enemy_shield_drone" }],
		worldScale: 1,
	},
	"orbit-lancer": {
		parts: [{ sprite: "enemy_orbit_lancer" }],
		worldScale: 1,
	},
	splitter: { parts: [{ sprite: "enemy_splitter" }], worldScale: 1 },
	"siege-barge": {
		parts: [{ sprite: "enemy_siege_barge" }],
		worldScale: 1,
	},
	"tether-drone": {
		parts: [{ sprite: "enemy_tether_drone" }],
		worldScale: 1,
	},
	"repair-skiff": {
		parts: [{ sprite: "enemy_repair_skiff" }],
		worldScale: 1,
	},
	"gravity-warden": {
		parts: [{ sprite: "enemy_gravity_warden" }],
		worldScale: 1,
	},
	"phase-skirmisher": {
		parts: [{ sprite: "enemy_phase_skirmisher" }],
		worldScale: 1,
	},
	"salvage-scavenger": {
		parts: [{ sprite: "enemy_salvage_scavenger" }],
		worldScale: 1,
	},
	suppressor: {
		parts: [{ sprite: "enemy_suppressor" }],
		worldScale: 1,
	},
	"breach-crawler": {
		parts: [{ sprite: "enemy_breach_crawler" }],
		worldScale: 1,
	},
	"wake-scrap-nipper": {
		parts: [
			{ sprite: "enemy_wake_scrap_nipper_core" },
			{ sprite: "enemy_wake_scrap_nipper_left_cutter" },
			{ sprite: "enemy_wake_scrap_nipper_right_cutter" },
		],
		worldScale: 0.75,
	},
	"wake-scrappers-hut": {
		parts: [{ sprite: "enemy_wake_scrappers_hut" }],
		worldScale: 1,
	},
	"wake-rivet-gunner": {
		parts: [
			{ sprite: "enemy_wake_rivet_gunner_core" },
			{ sprite: "enemy_wake_rivet_gunner_weapon" },
		],
		worldScale: 1,
	},
	"wake-towhook-rig": {
		parts: [
			{ sprite: "enemy_wake_towhook_rig_core" },
			{ sprite: "enemy_wake_towhook_rig_left_hook" },
			{ sprite: "enemy_wake_towhook_rig_right_hook" },
		],
		worldScale: 1,
	},
	"wake-patch-tender": {
		parts: [
			{ sprite: "enemy_wake_patch_tender_core" },
			{ sprite: "enemy_wake_patch_tender_welder" },
		],
		worldScale: 1,
	},
	"wake-scrap-raiser": {
		parts: [
			{ sprite: "enemy_wake_scrap_raiser_core" },
			{ sprite: "enemy_wake_scrap_raiser_left_collector" },
			{ sprite: "enemy_wake_scrap_raiser_right_collector" },
		],
		worldScale: 1,
	},
	"wake-clampback": {
		parts: [
			{ sprite: "enemy_wake_clampback_core" },
			{ sprite: "enemy_wake_clampback_left_clamp" },
			{ sprite: "enemy_wake_clampback_right_clamp" },
		],
		worldScale: 1,
	},
	"wake-fuse-rat": {
		parts: [
			{ sprite: "enemy_wake_fuse_rat_core" },
			{ sprite: "enemy_wake_fuse_rat_overcharger" },
		],
		worldScale: 1,
	},
	"wake-shredder-skiff": {
		parts: [
			{ sprite: "enemy_wake_shredder_skiff_core" },
			{ sprite: "enemy_wake_shredder_skiff_grinder" },
			{ sprite: "enemy_wake_shredder_skiff_hopper" },
		],
		worldScale: 1,
	},
	"wake-boiler-hulk": {
		parts: [
			{ sprite: "enemy_wake_boiler_hulk_core" },
			{ sprite: "enemy_wake_boiler_hulk_scoop" },
			{ sprite: "enemy_wake_boiler_hulk_vent" },
			{ sprite: "enemy_wake_boiler_hulk_mortar" },
		],
		worldScale: 1,
	},
	"wake-magnet-maw": {
		parts: [
			{ sprite: "enemy_wake_magnet_maw_platform_core" },
			{ sprite: "enemy_wake_magnet_maw_crane" },
			{ sprite: "enemy_wake_magnet_maw_left_coil" },
			{ sprite: "enemy_wake_magnet_maw_right_coil" },
		],
		worldScale: 1,
	},
	"wake-railbreaker-rig": {
		parts: [
			{ sprite: "enemy_wake_railbreaker_rig_core" },
			{ sprite: "enemy_wake_railbreaker_rig_ram" },
			{ sprite: "enemy_wake_railbreaker_rig_left_thruster" },
			{ sprite: "enemy_wake_railbreaker_rig_right_thruster" },
		],
		worldScale: 1,
	},
	"impact-ace": {
		parts: [{ sprite: "enemy_impact_ace" }],
		worldScale: 1,
	},
	"federation-dreadnought": {
		parts: [
			{ sprite: "boss1_core" },
			{ sprite: "boss1_blaster", offset: [-50, -5] },
			{ sprite: "boss1_blaster_right", offset: [50, -5] },
			{ sprite: "boss1_head", offset: [0, -37] },
		],
		worldScale: 1.25,
		phaseSprites: ["boss1_core", "boss1_core_phase2", "boss1_core_phase3"],
	},
	"wake-yardmaster": {
		parts: [
			{ sprite: "boss_wake_yardmaster" },
			{ sprite: "boss_wake_yardmaster_arm" },
			{ sprite: "enemy_wake_boiler_hulk_vent" },
		],
		worldScale: 1,
	},
	"wake-last-beacon": {
		parts: [
			{ sprite: "boss_wake_last_beacon" },
			{ sprite: "boss_wake_last_beacon_relay" },
		],
		worldScale: 1,
	},
	"stationary-cannon-platform": {
		parts: [{ sprite: "enemy_stationary_cannon_platform" }],
		worldScale: 1,
		destroyedSprite: "enemy_stationary_cannon_platform_destroyed",
	},
	"enemy-proximity-mine": {
		parts: [{ sprite: "room_proximity_mine" }],
		worldScale: 1,
	},
	"range-keeper": {
		parts: [{ sprite: "hub_ship_range_keeper" }],
		worldScale: 1,
	},
	"generic-vehicle": { parts: [], worldScale: 1 },
	"heavy-vehicle": { parts: [], worldScale: 1 },
	asteroid: { parts: [], worldScale: 1 },
}

export function getEnemyVisual(id: EnemyVisualId) {
	return ENEMY_VISUALS[id]
}
