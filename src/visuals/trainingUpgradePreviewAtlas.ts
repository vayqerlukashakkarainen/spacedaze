export const TRAINING_UPGRADE_PREVIEW_ATLAS_PATH =
	"sprites/upgrades/training-preview-atlas.png"

const TRAINING_UPGRADE_PREVIEW_ATLAS_COLUMNS = 8
const TRAINING_UPGRADE_PREVIEW_ATLAS_CELL_SIZE = 32
const TRAINING_UPGRADE_PREVIEW_PREFIX = "training_upgrade_preview_"

const TRAINING_UPGRADE_PREVIEW_SPRITES = [
	["afterimage_rounds_upg1", 16, 16],
	["arc_capacitor_upg1", 16, 16],
	["armor_piercing_upg1", 16, 16],
	["blaster1", 16, 16],
	["blaster_upg_dmg1", 32, 32],
	["blaster_upg_speed1", 32, 32],
	["boomerang_payload_upg1", 16, 16],
	["corrosive_payload_upg1", 16, 16],
	["critical_shatter_upg1", 16, 16],
	["cryo_rounds_upg1", 16, 16],
	["debree_dist_upg1", 32, 32],
	["debree_value_upg1", 32, 32],
	["drone_fusion_upg1", 16, 16],
	["drone_gunship", 24, 24],
	["drone_interceptor", 24, 24],
	["drone_medic", 24, 24],
	["drone_missile", 24, 24],
	["drone_salvager", 24, 24],
	["execution_rounds_upg1", 16, 16],
	["faster_speed_upg1", 32, 32],
	["follower_blaster_dmg_upg1", 16, 16],
	["follower_upg1", 16, 16],
	["fragmentation_core_upg1", 16, 16],
	["glass_reactor_upg1", 16, 16],
	["growing_charge_upg1", 16, 16],
	["hull_upg1", 32, 32],
	["hunter_guidance_upg1", 16, 16],
	["kinetic_ram_upg1", 16, 16],
	["mine_layer_upg1", 16, 16],
	["missile_shards_upg1", 32, 32],
	["more_missiles_upg1", 32, 32],
	["near_miss_capacitor_upg1", 16, 16],
	["overclock_thrusters_upg1", 16, 16],
	["pack_intelligence_upg1", 16, 16],
	["parallel_blasters_upg1", 16, 16],
	["phase_capacitor_upg1", 16, 16],
	["phase_counter_upg1", 32, 32],
	["phase_echo_upg1", 16, 16],
	["phase_recall_upg1", 16, 16],
	["proximity_fuse_upg1", 16, 16],
	["reactive_plating_upg1", 16, 16],
	["resonance_coil_upg1", 32, 32],
	["rocket_upg1", 32, 32],
	["salvage_battery_upg1", 16, 16],
	["salvage_lasso", 32, 32],
	["saw_satellite_upg1", 16, 16],
	["singularity_payload_upg1", 16, 16],
	["space_jump_upg1", 16, 16],
	["split_chamber_upg1", 16, 16],
	["stasis_burst_upg1", 16, 16],
	["stun_rounds_upg1", 16, 16],
	["tactical_uplink_upg1", 32, 32],
	["target_painter_upg1", 16, 16],
	["threat_reactor_upg1", 32, 32],
	["void_lance_upg1", 16, 16],
	["volatile_corrosion_upg1", 16, 16],
	["wreck_harvester_upg1", 32, 32],
] as const

const trainingUpgradePreviewSpriteNames = new Set<string>(
	TRAINING_UPGRADE_PREVIEW_SPRITES.map(([sprite]) => sprite)
)

export function getTrainingUpgradePreviewAtlasEntries() {
	return Object.fromEntries(
		TRAINING_UPGRADE_PREVIEW_SPRITES.map(([sprite, width, height], index) => [
			`${TRAINING_UPGRADE_PREVIEW_PREFIX}${sprite}`,
			{
				x: index % TRAINING_UPGRADE_PREVIEW_ATLAS_COLUMNS *
					TRAINING_UPGRADE_PREVIEW_ATLAS_CELL_SIZE,
				y: Math.floor(index / TRAINING_UPGRADE_PREVIEW_ATLAS_COLUMNS) *
					TRAINING_UPGRADE_PREVIEW_ATLAS_CELL_SIZE,
				width,
				height,
			},
		])
	)
}

export function getTrainingUpgradePreviewSprite(sprite: string) {
	if (!trainingUpgradePreviewSpriteNames.has(sprite)) return sprite
	return `${TRAINING_UPGRADE_PREVIEW_PREFIX}${sprite}`
}
