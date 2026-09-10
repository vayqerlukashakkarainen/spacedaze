import { KAPLAYCtx } from "kaplay";
import { loadout, loadoutRarity, upgrades } from "./upg";
import { RewardRarity } from "./types/rewardTypes";
import { timeSeconds } from "./main";
import {
	getEquippedWeaponId,
	getOwnedWeaponIds,
	setWeaponInventory,
	WEAPONS,
} from "./services/player/weaponService";
import { PLANET_CHUNK_SPRITES } from "./planetChunkSprites";
import { getDepositedDebree } from "./services/economy/debreeEconomyService";
import { isBlueprintDiscovered } from "./services/hub/hubProgressService";
import {
	getAbilityLoadout,
	setAbilityLoadout,
	type AbilityLoadout,
} from "./services/abilities/abilityLoadoutService";
import {
	getDefaultMobilityFromLegacyLoadout,
	isAbilityIdForSlot,
	migrateLegacyAbilityDiscoveries,
} from "./services/abilities/abilityRegistry";
import {
	HUB_SETTLEMENT_ATLAS,
	HUB_SETTLEMENT_ROCK_FOUNDATION_ATLAS,
} from "./hubSettlementSprites";
import {
	randomExplosionSound,
	type ExplosionSoundPoolId,
} from "./services/audio/explosionSoundPoolService";
import { loadAudioAssets } from "./audio/soundCatalog"
import {
	getTrainingAlterationPreviewAtlasEntries,
	getTrainingUpgradePreviewAtlasEntries,
	TRAINING_ALTERATION_PREVIEW_ATLAS_PATH,
	TRAINING_UPGRADE_PREVIEW_ATLAS_PATH,
} from "./visuals/trainingUpgradePreviewAtlas"

const SAVE_VERSION = 2;
const LEGACY_SAVE_KEYS = [
	"spacedaze_hub_progress",
	"spacedaze_warp_zone_progress",
	"spacedaze_last_run",
];

interface SaveSlot {
	version: number;
	time: number;
	score: number;
	loadout: Record<string, number | undefined>;
	loadoutRarity?: Partial<Record<string, RewardRarity>>;
	weaponInventoryVersion?: number;
	ownedWeaponIds: string[];
	equippedWeaponId: string;
	abilityLoadoutVersion?: number;
	abilityLoadout?: Partial<AbilityLoadout>;
}

function atlasEntry(index: number, size: number = 16) {
	// 24px cells hold the drones and the existing 16px upgrade icons.
	return {
		x: index % 4 * 24,
		y: Math.floor(index / 4) * 24,
		width: size,
		height: size,
	};
}

function hubShipAtlasEntry(index: number) {
	return {
		x: index % 3 * 32,
		y: 120 + Math.floor(index / 3) * 32,
		width: 32,
		height: 32,
	}
}

export async function init(k: KAPLAYCtx) {
	await k.loadRoot("./"); // A good idea for Itch.io publishing later
	let audioLoadError: unknown
	const audioAssets = loadAudioAssets(k).catch((error) => {
		audioLoadError = error
	})
	// Keep the original 16px registration in place so the automatic atlas
	// layout for neighboring sprites remains stable.
	await k.loadSprite("ship_legacy", "sprites/ship-v2.png");
	await k.loadSprite("crate1", "sprites/crate-v2.png");
	await k.loadSprite(
		"salvage_asteroid_normal",
		"sprites/salvage-asteroids/salvage-asteroid-normal.png"
	)
	await k.loadSprite(
		"salvage_asteroid_rich",
		"sprites/salvage-asteroids/salvage-asteroid-rich.png"
	)
	await k.loadSprite(
		"facility_contract_terminal",
		"sprites/facilities/v2/facility-contract-terminal.png"
	);
	await k.loadSprite(
		"facility_contract_terminal_destroyed",
		"sprites/facilities/v2/facility-contract-terminal-destroyed.png"
	);
	await k.loadSprite(
		"facility_contract_terminal_1bit",
		"sprites/facilities/v3/facility-contract-terminal-pixellab-256.png"
	)
	await k.loadSprite(
		"facility_contract_terminal_destroyed_1bit",
		"sprites/facilities/v3/facility-contract-terminal-broken-pixellab-256.png"
	)
	await k.loadSprite(
		"facility_training_range",
		"sprites/facilities/v2/facility-training-range.png"
	);
	await k.loadSprite(
		"facility_phase_station_minimal",
		"sprites/facilities/v3/facility-phase-station-pixellab-256.png"
	)
	await k.loadSprite(
		"facility_training_range_destroyed",
		"sprites/facilities/v3/facility-phase-station-broken-pixellab-256.png"
	);
	await k.loadSprite(
		"facility_salvage_forge",
		"sprites/facilities/v2/facility-salvage-forge.png"
	);
	await k.loadSprite(
		"facility_salvage_forge_destroyed",
		"sprites/facilities/v2/facility-salvage-forge-destroyed.png"
	);
	await k.loadSprite(
		"facility_salvage_forge_1bit",
		"sprites/facilities/v3/facility-salvage-forge-pixellab-256.png"
	)
	await k.loadSprite(
		"facility_salvage_forge_destroyed_1bit",
		"sprites/facilities/v3/facility-salvage-forge-broken-pixellab-256.png"
	)
	await k.loadSprite(
		"facility_debrief_terminal",
		"sprites/facilities/v2/facility-debrief-terminal.png"
	);
	await k.loadSprite(
		"facility_debrief_terminal_destroyed",
		"sprites/facilities/v2/facility-debrief-terminal-destroyed.png"
	);
	await k.loadSprite(
		"facility_debrief_terminal_1bit",
		"sprites/facilities/v3/facility-debrief-terminal-pixellab-256.png"
	)
	await k.loadSprite(
		"facility_debrief_terminal_destroyed_1bit",
		"sprites/facilities/v3/facility-debrief-terminal-broken-pixellab-256.png"
	)
	await k.loadSprite(
		"recovery_shop_1bit",
		"sprites/shops/v3/recovery-shop-pixellab-256.png"
	)
	await k.loadSprite("bullet1", "sprites/bullet1.png");
	await k.loadSprite("rocket1", "sprites/rocket1.png");
	await k.loadSpriteAtlas("sprites/salvage-pickups.png", {
		salvage_shard: { x: 0, y: 0, width: 16, height: 16 },
		salvage_plate: { x: 16, y: 0, width: 16, height: 16 },
		salvage_core: { x: 32, y: 0, width: 16, height: 16 },
		salvage_reactor_fragment: { x: 48, y: 0, width: 16, height: 16 },
	})
	await k.loadSpriteAtlas("sprites/swarm-atlas.png", {
		drone_combat: atlasEntry(0, 24),
		drone_gunship: atlasEntry(1, 24),
		drone_interceptor: atlasEntry(2, 24),
		drone_medic: atlasEntry(3, 24),
		drone_missile: atlasEntry(4, 24),
		drone_salvager: atlasEntry(5, 24),
		arc_capacitor_upg1: atlasEntry(6),
		follower_blaster_dmg_upg1: atlasEntry(7),
		follower_upg1: atlasEntry(8),
		blaster1: atlasEntry(9),
		parallel_blasters_upg1: atlasEntry(10),
		hub_droid_lamp_keeper: atlasEntry(13, 24),
		hub_droid_repair: atlasEntry(16, 24),
		hub_ship_ring_runner: hubShipAtlasEntry(0),
		hub_ship_range_keeper: hubShipAtlasEntry(1),
		hub_ship_gloom: hubShipAtlasEntry(2),
		hub_ship_jubilee: hubShipAtlasEntry(3),
	});
	await k.loadSpriteAtlas(
		TRAINING_UPGRADE_PREVIEW_ATLAS_PATH,
		getTrainingUpgradePreviewAtlasEntries()
	)
	await k.loadSpriteAtlas(
		TRAINING_ALTERATION_PREVIEW_ATLAS_PATH,
		getTrainingAlterationPreviewAtlasEntries()
	)
	await k.loadSpriteAtlas("sprites/player-ship-8dir.png", {
		ship: { x: 0, y: 0, width: 24, height: 24 },
		ship_north_east: { x: 24, y: 0, width: 24, height: 24 },
		ship_east: { x: 48, y: 0, width: 24, height: 24 },
		ship_south_east: { x: 72, y: 0, width: 24, height: 24 },
		ship_south: { x: 96, y: 0, width: 24, height: 24 },
		ship_south_west: { x: 120, y: 0, width: 24, height: 24 },
		ship_west: { x: 144, y: 0, width: 24, height: 24 },
		ship_north_west: { x: 168, y: 0, width: 24, height: 24 },
		ship_root: { x: 192, y: 0, width: 24, height: 24 },
	})
	const inputPromptSprites = [
		"escape",
		"enter",
		"space",
		"tab",
		"mouseLeft",
		"mouseRight",
		"w",
		"a",
		"s",
		"d",
		"f",
		"r",
		"t",
		"1",
		"2",
		"3",
	]
	for (const sprite of inputPromptSprites) {
		await k.loadSprite(
			`input_key_${sprite}`,
			`sprites/input-prompts/${sprite}.${sprite === "f" ? "svg" : "png"}`
		)
	}

	for (let index = 1; index <= 20; index++) {
		const number = String(index).padStart(2, "0")
		await k.loadSprite(
			`asteroid_${number}`,
			`sprites/asteroids/asteroid-${number}.png`
		)
	}
	for (const size of [16, 32]) {
		for (const variant of ["a", "b", "c"]) {
			await k.loadSprite(
				`rock_fragment_${size}_${variant}`,
				`sprites/asteroids/fragments/rock-${size}-${variant}.png`
			)
		}
	}
	await k.loadSprite(
		"foliage_void_fern",
		"sprites/bg/foliage/foliage-void-fern.png"
	);
	await k.loadSprite(
		"foliage_space_coral",
		"sprites/bg/foliage/foliage-space-coral.png"
	);
	await k.loadSprite(
		"foliage_spore_cluster",
		"sprites/bg/foliage/foliage-spore-cluster.png"
	);
	await k.loadSprite(
		"foliage_crystal_grass",
		"sprites/bg/foliage/foliage-crystal-grass.png"
	);
	await k.loadSprite("bike1", "sprites/bike1.png");
	await k.loadSprite("enemy_rammer", "sprites/enemies/rammer.png");
	await k.loadSprite("enemy_sniper", "sprites/enemies/sniper.png");
	await k.loadSprite("enemy_mine_layer", "sprites/enemies/mine-layer.png");
	await k.loadSprite(
		"enemy_shield_drone",
		"sprites/enemies/shield-drone.png"
	);
	await k.loadSprite("enemy_orbit_lancer", "sprites/enemies/orbit-lancer.png")
	await k.loadSprite("enemy_tether_drone", "sprites/enemies/tether-drone.png")
	await k.loadSprite("enemy_repair_skiff", "sprites/enemies/repair-skiff.png")
	await k.loadSprite("enemy_splitter", "sprites/enemies/splitter.png")
	await k.loadSprite("enemy_gravity_warden", "sprites/enemies/gravity-warden.png")
	await k.loadSprite("enemy_phase_skirmisher", "sprites/enemies/phase-skirmisher.png")
	await k.loadSprite("enemy_salvage_scavenger", "sprites/enemies/salvage-scavenger.png")
	await k.loadSprite("enemy_suppressor", "sprites/enemies/suppressor.png")
	await k.loadSprite("enemy_breach_crawler", "sprites/enemies/breach-crawler.png")
	await k.loadSprite("enemy_swarm_drone", "sprites/enemies/swarm-drone.png")
	await k.loadSprite("enemy_siege_barge", "sprites/enemies/siege-barge.png")
	await k.loadSprite(
		"enemy_swarm_hivemind",
		"sprites/enemies/swarm-hivemind.png"
	)
	await k.loadSprite(
		"enemy_impact_ace",
		"sprites/enemies/impact-ace-pixellab.png"
	)
	await k.loadSprite(
		"hub_salvage_hauler",
		"sprites/hub/salvage-hauler.png"
	)

	await k.loadSprite("particle1", "sprites/particle1.png");
	await k.loadSprite("particle2", "sprites/particle2.png");
	await k.loadSprite("particle3", "sprites/particle3.png");
	await k.loadSprite("particle4", "sprites/particle4.png");
	await k.loadSprite("spark1", "sprites/spark1.png");
	const emotionSprites = [
		"emote_bars",
		"emote_blank",
		"emote_dots",
		"emote_drops",
		"emote_exclamation",
		"emote_exclamations",
		"emote_faceAngry",
		"emote_faceHappy",
		"emote_faceSad",
		"emote_heart",
		"emote_heartBroken",
		"emote_idea",
		"emote_laugh",
		"emote_music",
		"emote_question",
		"emote_sleeps",
		"emote_stars",
		"emote_swirl",
	]
	for (const sprite of emotionSprites) {
		await k.loadSprite(sprite, `sprites/emotes/${sprite}.png`)
	}

	await k.loadSprite("debree_part1", "sprites/debree_part1.png");
	await k.loadSprite("room_rift_anchor", "sprites/rooms/rift-anchor.png");
	await k.loadSprite("room_proximity_mine", "sprites/rooms/proximity-mine.png");
	await k.loadSprite("room_convoy_drone", "sprites/rooms/convoy-drone.png");
	await k.loadSprite("room_signal_relay", "sprites/rooms/signal-relay.png");
	await k.loadSprite("room_phase_key", "sprites/pickups/phase-key.png")

	await k.loadSprite(
		"weapon_standard_blaster",
		"sprites/weapons/standard-blaster.png"
	);
	await k.loadSprite(
		"weapon_breach_cannon",
		"sprites/weapons/breach-cannon.png"
	);
	await k.loadSprite(
		"weapon_arc_carbine",
		"sprites/weapons/arc-carbine.png"
	);
	await k.loadSprite("weapon_scatter_array", "sprites/weapons/scatter-array.png")
	await k.loadSprite("weapon_burst_driver", "sprites/weapons/burst-driver.png")
	await k.loadSprite("weapon_plasma_mortar", "sprites/weapons/plasma-mortar.png")
	await k.loadSprite("weapon_rail_lance", "sprites/weapons/rail-lance.png")
	await k.loadSprite("weapon_pulse_repeater", "sprites/weapons/pulse-repeater.png")
	await k.loadSprite("weapon_twin_needle", "sprites/weapons/twin-needle.png")
	await k.loadSprite("weapon_impact_driver", "sprites/weapons/impact-driver.png")
	await k.loadSprite("weapon_railgun", "sprites/weapons/railgun.png")
	await k.loadSprite("rocket_upg1", "sprites/upgrades/rocket_upg1.png");
	await k.loadSprite(
		"active_repulsor_pulse",
		"sprites/active-modules/repulsor-pulse.png"
	)
	await k.loadSprite(
		"active_decoy_beacon",
		"sprites/active-modules/decoy-beacon.png"
	)
	await k.loadSprite(
		"active_scrap_mine",
		"sprites/active-modules/scrap-mine.png"
	)
	await k.loadSprite(
		"active_kinetic_barrier",
		"sprites/active-modules/kinetic-barrier.png"
	);
	await k.loadSprite(
		"active_gravity_charge",
		"sprites/active-modules/gravity-charge.png"
	);
	await k.loadSprite(
		"active_breach_charge",
		"sprites/active-modules/breach-charge.png"
	);
	await k.loadSprite(
		"active_drone_beacon",
		"sprites/active-modules/drone-beacon.png"
	);
	await k.loadSprite(
		"active_repair_pulse",
		"sprites/active-modules/repair-pulse.png"
	);
	await k.loadSprite(
		"active_emp_beacon",
		"sprites/active-modules/emp-beacon.png"
	);
	await k.loadSprite(
		"blaster_upg_speed1",
		"sprites/upgrades/blaster_upg_speed1.png"
	);
	await k.loadSprite(
		"blaster_upg_dmg1",
		"sprites/upgrades/blaster_upg_dmg1.png"
	);
	await k.loadSprite(
		"debree_dist_upg1",
		"sprites/upgrades/debree_dist_upg1.png"
	);
	await k.loadSprite(
		"debree_value_upg1",
		"sprites/upgrades/debree_value_upg1.png"
	);
	await k.loadSprite(
		"faster_speed_upg1",
		"sprites/upgrades/faster_speed_upg1.png"
	);
	await k.loadSprite("hull_upg1", "sprites/upgrades/hull_upg1.png");
	await k.loadSprite(
		"missile_shards_upg1",
		"sprites/upgrades/missiles_shards_upg1.png"
	);
	await k.loadSprite(
		"more_missiles_upg1",
		"sprites/upgrades/more_missiles_upg1.png"
	);
	await k.loadSprite(
		"overclock_thrusters_upg1",
		"sprites/upgrades/overclock_thrusters_upg1.png"
	);
	await k.loadSprite(
		"space_jump_upg1",
		"sprites/upgrades/space_jump_upg1.png"
	);
	await k.loadSprite("mobility_retro_burst", "sprites/upgrades/retro_burst.png")
	await k.loadSprite("mobility_gravity_sling", "sprites/upgrades/gravity_sling.png")
	await k.loadSprite(
		"reroll_token",
		"sprites/upgrades/reroll_token.svg"
	);
	await k.loadSprite(
		"phase_capacitor_upg1",
		"sprites/upgrades/phase_capacitor_upg1.png"
	);
	await k.loadSprite(
		"twin_capacitor_upg1",
		"sprites/upgrades/twin_capacitor_upg1.png"
	);
	await k.loadSprite(
		"follower_missiles_upg1",
		"sprites/upgrades/follower_missiles_upg1.png"
	);
	await k.loadSprite(
		"armor_piercing_upg1",
		"sprites/upgrades/armor_piercing_upg1.png"
	);
	await k.loadSprite(
		"cryo_rounds_upg1",
		"sprites/upgrades/cryo_rounds_upg1.png"
	);
	await k.loadSprite(
		"corrosive_payload_upg1",
		"sprites/upgrades/corrosive_payload_upg1.png"
	);
	await k.loadSprite(
		"split_chamber_upg1",
		"sprites/upgrades/split_chamber_upg1.png"
	);
	await k.loadSprite(
		"singularity_payload_upg1",
		"sprites/upgrades/singularity_payload_upg1.png"
	);
	await k.loadSprite(
		"ricochet_rounds_upg1",
		"sprites/upgrades/source/ricochet_rounds_upg1.svg"
	);
	const projectileBehaviorSprites = [
		"fragmentation_core_upg1",
		"hunter_guidance_upg1",
		"proximity_fuse_upg1",
		"afterimage_rounds_upg1",
		"boomerang_payload_upg1",
		"growing_charge_upg1",
		"stasis_burst_upg1",
		"stun_rounds_upg1",
		"volatile_corrosion_upg1",
		"critical_shatter_upg1",
		"execution_rounds_upg1",
		"target_painter_upg1",
		"mine_layer_upg1",
		"void_lance_upg1",
	];
	for (const sprite of projectileBehaviorSprites) {
		await k.loadSprite(sprite, `sprites/upgrades/${sprite}.png`);
	}
	await k.loadSprite(
		"phase_recall_upg1",
		"sprites/upgrades/phase_recall_upg1.png"
	);
	await k.loadSprite("start_run", "sprites/upgrades/start_run.png");
	const systemUpgradeSprites = [
		"kinetic_coupler_upg1",
		"torque_spool_upg1",
		"shock_cradle_upg1",
		"momentum_relay_upg1",
		"redline_cable_upg1",
		"phase_echo_upg1",
		"salvage_battery_upg1",
		"reactive_plating_upg1",
		"pack_intelligence_upg1",
		"glass_reactor_upg1",
		"drone_fusion_upg1",
		"saw_satellite_upg1",
		"kinetic_ram_upg1",
		"near_miss_capacitor_upg1",
		"phase_set_bonus",
		"drone_set_bonus",
		"salvage_set_bonus",
	];
	for (const sprite of systemUpgradeSprites) {
		await k.loadSprite(sprite, `sprites/upgrades/${sprite}.png`);
	}

	await k.loadSprite("bg_moon1", "sprites/bg/moon1.png");
	await k.loadSprite(
		"bg_destroyed_planet",
		"sprites/bg/destroyed-planet.png"
	);
	await k.loadSprite(
		"bg_destroyed_planet_sliced",
		"sprites/bg/destroyed-planet-sliced.png"
	);
	for (const [index, sprite] of PLANET_CHUNK_SPRITES.entries()) {
		await k.loadSprite(
			sprite,
			`sprites/planet-chunks/planet-chunk-${index + 1}.png`
		);
	}
	await k.loadSpriteAtlas(
		"sprites/hub/settlement-atlas.png",
		HUB_SETTLEMENT_ATLAS
	)
	await k.loadSpriteAtlas(
		"sprites/hub/settlement-rock-foundations-atlas.png",
		HUB_SETTLEMENT_ROCK_FOUNDATION_ATLAS
	)
	await k.loadSprite("companion_burt", "sprites/companions/burt.png")
	await k.loadSprite(
		"companion_burt_house",
		"sprites/companions/burt-house.png"
	)
	await k.loadSprite(
		"hub_progression_lamp",
		"sprites/hub/progression-lamp.png"
	)
	await k.loadSprite(
		"hub_progression_lamp_broken",
		"sprites/hub/progression-lamp-broken.png"
	)
	for (let index = 1; index <= 6; index++) {
		const number = String(index).padStart(2, "0")
		await k.loadSprite(
			`hub_progression_lamp_platform_${number}`,
			`sprites/hub/progression-lamp-platform-${number}.png`
		)
	}
	await k.loadSprite(
		"chest_salvage_world",
		"sprites/chests/salvage-chest-world.png"
	)
	await k.loadSprite(
		"chest_weapon_world",
		"sprites/chests/weapon-chest-world.png"
	)
	await k.loadSprite(
		"chest_salvage_open_world",
		"sprites/chests/salvage-chest-open-world.png"
	)
	await k.loadSprite(
		"chest_weapon_open_world",
		"sprites/chests/weapon-chest-open-world.png"
	)
	await k.loadSprite(
		"chest_salvage_ui",
		"sprites/chests/salvage-chest-ui.png"
	)
	await k.loadSprite(
		"chest_weapon_ui",
		"sprites/chests/weapon-chest-ui.png"
	)
	await k.loadSprite(
		"enemy_stationary_cannon_platform",
		"sprites/enemies/stationary-cannon-platform.png"
	)
	await k.loadSprite(
		"enemy_stationary_cannon_platform_destroyed",
		"sprites/enemies/stationary-cannon-platform-destroyed.png"
	)
	await k.loadSprite(
		"crosshair_precision",
		"sprites/crosshairs/crosshair-precision-16.png"
	)
	// Environment props use their native, non-16px canvases. Keep them after
	// the established gameplay sprite groups to preserve atlas packing.
	await k.loadSprite(
		"wake_hull_barricade",
		"sprites/rooms/environment/wake-hull-barricade.png"
	)
	await k.loadSprite(
		"wake_fuel_cell",
		"sprites/rooms/environment/wake-fuel-cell.png"
	)
	await k.loadSprite(
		"wake_salvage_cluster",
		"sprites/rooms/environment/wake-salvage-cluster.png"
	)
	await k.loadSprite(
		"wake_memory_console",
		"sprites/rooms/environment/wake-memory-console.png"
	)
	await k.loadSprite(
		"wake_cable_reel",
		"sprites/rooms/environment/wake-cable-reel.png"
	)
	await k.loadSprite(
		"wake_pipe_manifold",
		"sprites/rooms/environment/wake-pipe-manifold.png"
	)
	await k.loadSprite(
		"wake_concussion_plate",
		"sprites/rooms/traps/wake-concussion-plate.png",
		{
			sliceX: 7,
			sliceY: 2,
			anims: {
				trigger: { from: 7, to: 13, speed: 42, loop: false },
			},
		}
	)
	await k.loadSprite(
		"wake_slowdown_plate",
		"sprites/rooms/traps/wake-slowdown-plate.png",
		{
			sliceX: 7,
			sliceY: 2,
			anims: {
				trigger: { from: 7, to: 13, speed: 29, loop: false },
			},
		}
	)
	await k.loadSprite(
		"room_tesla_coil",
		"sprites/rooms/tesla-coil.png"
	)
	await k.loadBitmapFont("unscii", "/fonts/unscii_8x8.png", 8, 8);

	k.loadShader(
		"visualHitKnockback",
		`
		uniform vec2 u_visualHitOffset;

		vec4 vert(vec2 pos, vec2 uv, vec4 color) {
			vec4 worldPos = transform * vec4(pos, 0.0, 1.0);
			worldPos.xy += u_visualHitOffset;
			vec4 projected = camera * worldPos;
			return vec4(
				projected.x / width * 2.0 - 1.0,
				projected.y / -height * 2.0 + 1.0,
				projected.z,
				projected.w
			);
		}
		`,
		null
	)

	k.loadShader(
		"wormholeLighting",
		null,
		`
		uniform vec2 u_lightCenter;
		uniform vec2 u_resolution;
		uniform float u_radius;
		uniform float u_intensity;
		uniform float u_time;
		uniform vec2 u_secondaryLightCenter;
		uniform float u_secondaryRadius;
		uniform float u_secondaryIntensity;

		vec4 frag(vec2 pos, vec2 uv, vec4 color, sampler2D tex) {
			vec2 screenPos = uv * u_resolution;
			vec2 fromLight = screenPos - u_lightCenter;
			float lightDistance = length(fromLight);
			float normalizedDistance = lightDistance / max(u_radius, 1.0);
			float distortionMask = 1.0 - smoothstep(
				0.08,
				1.0,
				normalizedDistance
			);
			vec2 direction = lightDistance > 0.001
				? fromLight / lightDistance
				: vec2(0.0);
			float ripple = sin(normalizedDistance * 34.0 - u_time * 5.5);
			float inwardPull = (1.0 - normalizedDistance) * 4.2;
			float displacement = (ripple * 3.2 - inwardPull)
				* distortionMask
				* u_intensity;
			vec2 secondaryFromLight = screenPos - u_secondaryLightCenter;
			float secondaryDistance = length(secondaryFromLight);
			float secondaryNormalizedDistance = secondaryDistance
				/ max(u_secondaryRadius, 1.0);
			float secondaryDistortionMask = 1.0 - smoothstep(
				0.06,
				1.0,
				secondaryNormalizedDistance
			);
			vec2 secondaryDirection = secondaryDistance > 0.001
				? secondaryFromLight / secondaryDistance
				: vec2(0.0);
			float secondaryRipple = sin(
				secondaryNormalizedDistance * 39.0 + u_time * 6.8
			);
			float secondaryInwardPull =
				(1.0 - secondaryNormalizedDistance) * 5.4;
			float secondaryDisplacement =
				(secondaryRipple * 4.1 - secondaryInwardPull)
				* secondaryDistortionMask
				* u_secondaryIntensity;
			vec2 distortedUv = clamp(
				uv + direction * displacement / u_resolution
					+ secondaryDirection * secondaryDisplacement / u_resolution,
				vec2(0.0),
				vec2(1.0)
			);
			vec4 baseColor = texture2D(tex, distortedUv) * color;
			float radialLight = 1.0 - smoothstep(
				u_radius * 0.12,
				u_radius,
				lightDistance
			);
			float pulse = 0.92 + sin(u_time * 2.4) * 0.08;
			float lightStrength = radialLight * pulse * u_intensity;
			vec3 lightColor = vec3(0.18, 0.68, 1.0);
			float secondaryRadialLight = 1.0 - smoothstep(
				u_secondaryRadius * 0.1,
				u_secondaryRadius,
				secondaryDistance
			);
			float secondaryPulse = 0.88 + sin(u_time * 3.1) * 0.12;
			float secondaryLightStrength = secondaryRadialLight
				* secondaryPulse
				* u_secondaryIntensity;
			vec3 secondaryLightColor = vec3(0.62, 0.22, 0.25);
			float surfaceMask = smoothstep(
				0.015,
				0.24,
				max(baseColor.r, max(baseColor.g, baseColor.b))
			);
			vec3 illuminatedSurface = mix(
				baseColor.rgb,
				max(baseColor.rgb, lightColor * 0.82),
				lightStrength * surfaceMask * 0.52
			);
			illuminatedSurface = mix(
				illuminatedSurface,
				max(illuminatedSurface, secondaryLightColor * 0.78),
				secondaryLightStrength * surfaceMask * 0.68
			);
			vec3 atmosphericGlow = lightColor
				* lightStrength
				* 0.055
				* (1.0 - surfaceMask);
			atmosphericGlow += secondaryLightColor
				* secondaryLightStrength
				* 0.075
				* (1.0 - surfaceMask);
			return vec4(illuminatedSurface + atmosphericGlow, baseColor.a);
		}
	`
	);

	k.loadShader(
		"hubBoundaryFade",
		null,
		`
		uniform float u_time;
		uniform vec2 u_playerPos;
		uniform float u_revealRadius;

		vec4 frag(vec2 pos, vec2 uv, vec4 color, sampler2D tex) {
			float playerDistance = distance(pos, u_playerPos);
			float reveal = 1.0 - smoothstep(
				u_revealRadius * 0.55,
				u_revealRadius,
				playerDistance
			);
			float scan = 0.7 + 0.3 * sin((uv.x + uv.y) * 90.0 + u_time * 3.0);
			float pulse = 0.85 + 0.15 * sin(u_time * 2.0);
			float alpha = clamp(reveal * scan * pulse, 0.0, 1.0);
			return vec4(vec3(1.0), alpha) * color;
		}
	`
	);

	k.loadShader(
		"rockFoundationPalette",
		null,
		`
		vec4 frag(vec2 pos, vec2 uv, vec4 color, sampler2D tex) {
			vec4 source = texture2D(tex, uv);
			float alpha = step(0.5, source.a);
			float highlight = step(
				0.5,
				max(source.r, max(source.g, source.b))
			);
			vec3 shadowColor = vec3(0.098, 0.145, 0.184);
			vec3 surfaceColor = vec3(0.255, 0.329, 0.384);
			return vec4(mix(shadowColor, surfaceColor, highlight), alpha);
		}
		`
	);

	const modularEnemySprites = [
		["enemy_fighter_core", "sprites/enemies/fighter/fighter-core.png"],
		["enemy_fighter_left_wing", "sprites/enemies/fighter/fighter-left-wing.png"],
		["enemy_fighter_right_wing", "sprites/enemies/fighter/fighter-right-wing.png"],
		...(["standard", "talon", "carapace", "needle"] as const).flatMap(
			(chassis) => (["core", "left-wing", "right-wing", "weapon"] as const)
				.map((part) => [
					`enemy_hunter_${chassis}_${part.replace("-", "_")}`,
					`sprites/enemies/hunter/hunter-${chassis}-${part}.png`,
				] as const)
		),
		["enemy_wake_scrap_nipper_core", "sprites/enemies/wake/scrap-nipper-core.png"],
		["enemy_wake_scrap_nipper_left_cutter", "sprites/enemies/wake/scrap-nipper-left-cutter.png"],
		["enemy_wake_scrap_nipper_right_cutter", "sprites/enemies/wake/scrap-nipper-right-cutter.png"],
		["enemy_wake_rivet_gunner_core", "sprites/enemies/wake/rivet-gunner-core.png"],
		["enemy_wake_rivet_gunner_weapon", "sprites/enemies/wake/rivet-gunner-weapon.png"],
		["enemy_wake_towhook_rig_core", "sprites/enemies/wake/towhook-rig-core.png"],
		["enemy_wake_towhook_rig_left_hook", "sprites/enemies/wake/towhook-rig-left-hook.png"],
		["enemy_wake_towhook_rig_right_hook", "sprites/enemies/wake/towhook-rig-right-hook.png"],
		["enemy_wake_patch_tender_core", "sprites/enemies/wake/patch-tender-core.png"],
		["enemy_wake_patch_tender_welder", "sprites/enemies/wake/patch-tender-welder.png"],
		["enemy_wake_scrap_raiser_core", "sprites/enemies/wake/scrap-raiser-core.png"],
		["enemy_wake_scrap_raiser_left_collector", "sprites/enemies/wake/scrap-raiser-left-collector.png"],
		["enemy_wake_scrap_raiser_right_collector", "sprites/enemies/wake/scrap-raiser-right-collector.png"],
		["enemy_wake_clampback_core", "sprites/enemies/wake/clampback-core.png"],
		["enemy_wake_clampback_left_clamp", "sprites/enemies/wake/clampback-left-clamp.png"],
		["enemy_wake_clampback_right_clamp", "sprites/enemies/wake/clampback-right-clamp.png"],
		["enemy_wake_fuse_rat_core", "sprites/enemies/wake/fuse-rat-core.png"],
		["enemy_wake_fuse_rat_overcharger", "sprites/enemies/wake/fuse-rat-overcharger.png"],
		["enemy_wake_shredder_skiff_core", "sprites/enemies/wake/shredder-skiff-core.png"],
		["enemy_wake_shredder_skiff_grinder", "sprites/enemies/wake/shredder-skiff-grinder.png"],
		["enemy_wake_shredder_skiff_hopper", "sprites/enemies/wake/shredder-skiff-hopper.png"],
	] as const;
	for (const [name, path] of modularEnemySprites) {
		await k.loadSprite(name, path);
	}
	const heavyWakeEnemySprites = [
		["enemy_wake_boiler_hulk_core", "sprites/enemies/wake/boiler-hulk-core.png"],
		["enemy_wake_boiler_hulk_scoop", "sprites/enemies/wake/boiler-hulk-scoop.png"],
		["enemy_wake_boiler_hulk_vent", "sprites/enemies/wake/boiler-hulk-vent.png"],
		["enemy_wake_boiler_hulk_mortar", "sprites/enemies/wake/boiler-hulk-mortar.png"],
	] as const
	for (const [name, path] of heavyWakeEnemySprites) {
		await k.loadSprite(name, path)
	}
	await k.loadSprite(
		"run_rock_high",
		"sprites/terrain/run-rock-high-atlas.png",
		{ sliceX: 8, sliceY: 4 }
	)
	await k.loadSprite(
		"plasma_mortar_projectile",
		"sprites/projectiles/plasma-mortar.png"
	)
	await k.loadSprite(
		"impact_driver_arc_projectile",
		"sprites/projectiles/impact-driver-arc.png"
	)
	await k.loadSprite(
		"shrine_capture",
		"sprites/shrines/capture-shrine.png"
	)
	await k.loadSprite(
		"shrine_damage",
		"sprites/shrines/damage-shrine.png"
	)
	await k.loadSprite(
		"shrine_gravity",
		"sprites/shrines/gravity-shrine.png"
	)
	await k.loadSprite(
		"shrine_health",
		"sprites/shrines/health-shrine.png"
	)
	await k.loadSprite(
		"tactical_uplink_upg1",
		"sprites/upgrades/tactical_uplink_upg1.png"
	)
	await k.loadSprite(
		"phase_counter_upg1",
		"sprites/upgrades/phase_counter_upg1.png"
	)
	await k.loadSprite(
		"threat_reactor_upg1",
		"sprites/upgrades/threat_reactor_upg1.png"
	)
	await k.loadSprite(
		"resonance_coil_upg1",
		"sprites/upgrades/resonance_coil_upg1.png"
	)
	await k.loadSprite(
		"wreck_harvester_upg1",
		"sprites/upgrades/wreck_harvester_upg1.png"
	)
	await k.loadSprite(
		"salvage_lasso",
		"sprites/upgrades/salvage_lasso.png"
	)
	const alterationUpgradeSprites = [
		"arc_harpoon_upg1",
		"shrapnel_garden_upg1",
		"hunters_geometry_upg1",
		"gravitic_impaler_upg1",
	]
	for (const sprite of alterationUpgradeSprites) {
		await k.loadSprite(sprite, `sprites/upgrades/${sprite}.png`)
	}

	await k.loadSprite("boss1_body", "sprites/boss/boss1/boss1_body.png");
	await k.loadSprite("boss1_core", "sprites/boss/boss1/boss1_core.png")
	await k.loadSprite(
		"boss1_core_phase2",
		"sprites/boss/boss1/boss1_core_phase2.png"
	)
	await k.loadSprite(
		"boss1_core_phase3",
		"sprites/boss/boss1/boss1_core_phase3.png"
	)
	await k.loadSprite("boss1_blaster", "sprites/boss/boss1/boss1_blaster.png");
	await k.loadSprite(
		"boss1_blaster_right",
		"sprites/boss/boss1/boss1_blaster_right.png"
	)
	await k.loadSprite("boss1_head", "sprites/boss/boss1/boss1_head.png");
	// This 64x48 facility prop sits after the gameplay sprite groups so its
	// dimensions cannot disturb their automatic atlas packing.
	await k.loadSprite(
		"cargo_receiver_station",
		"sprites/bg/building1.png"
	)

	// Load timescale zone shader
	k.loadShader(
		"timescaleJitter",
		null,
		`
		uniform float u_time;
		uniform float u_intensity;
		
		vec4 frag(vec2 pos, vec2 uv, vec4 color, sampler2D tex) {
			// Get base texture color
			vec4 baseColor = def_frag();
			
			// Create subtle distortion effect
			float distortionX = sin(pos.y * 0.1 + u_time * 8.0) * u_intensity * 2.0;
			float distortionY = cos(pos.x * 0.1 + u_time * 6.0) * u_intensity * 2.0;
			vec2 distortedUV = uv + vec2(distortionX, distortionY) * 0.01;
			
			// Sample with distorted coordinates
			vec4 distortedColor = texture2D(tex, distortedUV);
			
			// Apply yellowish tint based on intensity
			vec3 yellowTint = vec3(1.0, 0.9, 0.3);
			vec3 tintedColor = mix(distortedColor.rgb, distortedColor.rgb * yellowTint, u_intensity * 0.5);
			
			// Mix between original and distorted/tinted
			vec3 finalColor = mix(baseColor.rgb, tintedColor, u_intensity * 0.8);
			
			return vec4(finalColor, baseColor.a) * color;
		}
	`
	);

	// Load ring distortion shader
	k.loadShader(
		"ringDistortion",
		null,
		`
		uniform float u_time;
		uniform float u_intensity;
		uniform vec2 u_uvMin;
		uniform vec2 u_uvMax;
		
		vec4 frag(vec2 pos, vec2 uv, vec4 color, sampler2D tex) {
			vec2 frameSize = max(u_uvMax - u_uvMin, vec2(0.00001));
			vec2 localUv = (uv - u_uvMin) / frameSize;
			float waveX = sin(localUv.y * 31.0 + u_time * 7.0)
				+ sin(localUv.y * 67.0 - u_time * 4.5) * 0.35;
			float waveY = cos(localUv.x * 27.0 - u_time * 6.0)
				+ cos(localUv.x * 59.0 + u_time * 3.5) * 0.3;
			float effectAmount = smoothstep(0.01, 0.28, u_intensity);
			vec2 displacement = vec2(waveX, waveY)
				* frameSize
				* effectAmount
				* 0.04;
			vec2 displacedUV = clamp(uv + displacement, u_uvMin, u_uvMax);
			vec4 baseColor = def_frag();
			vec4 displacedColor = texture2D(tex, displacedUV) * color;
			return mix(baseColor, displacedColor, effectAmount);
		}
	`
	);

	// A cleaner, brighter wave used when the player space-jumps into a level.
	// The shader is applied only while the expanding ring crosses each sprite.
	k.loadShader(
		"arrivalShockwave",
		null,
		`
		uniform float u_time;
		uniform float u_intensity;

		vec4 frag(vec2 pos, vec2 uv, vec4 color, sampler2D tex) {
			vec2 fromCenter = uv - vec2(0.5);
			float centerDistance = length(fromCenter);
			vec2 direction = centerDistance > 0.001
				? fromCenter / centerDistance
				: vec2(0.0);
			float ripple = sin(centerDistance * 48.0 - u_time * 34.0);
			float displacement = ripple * u_intensity * 0.035;
			vec2 shiftedUv = clamp(uv + direction * displacement, 0.0, 1.0);
			vec4 shifted = texture2D(tex, shiftedUv) * color;
			vec3 shockColor = vec3(0.45, 0.9, 1.0);
			float shimmer = 0.78 + 0.22 * sin(u_time * 42.0 + pos.x * 0.08);
			vec3 altered = shifted.rgb * shockColor * (1.0 + u_intensity * shimmer);
			return vec4(mix(shifted.rgb, altered, clamp(u_intensity, 0.0, 1.0)), shifted.a);
		}
	`
	);

	// Load lightning effect shader
	k.loadShader(
		"lightning",
		`
		uniform highp float u_time;
		uniform highp float u_distortion;
		
		vec4 vert(vec2 pos, vec2 uv, vec4 color) {
			// Create vertex displacement for lightning effect
			float noise = fract(sin(dot(pos + u_time * 10.0, vec2(12.9898, 78.233))) * 43758.5453);
			
			// Oscillating displacement along edges
			float displacement = sin(pos.x * 0.5 + u_time * 20.0) * cos(pos.y * 0.3 + u_time * 15.0);
			displacement += (noise - 0.5) * 2.0;
			displacement *= u_distortion * 3.0;
			
			// Apply displacement perpendicular to likely edge direction
			vec2 offset = vec2(
				sin(u_time * 30.0 + pos.y * 0.2) * displacement,
				cos(u_time * 25.0 + pos.x * 0.2) * displacement
			);
			
		return def_vert();
	}
	`,
		`
	uniform highp float u_time;
	uniform highp float u_distortion;		vec4 frag(vec2 pos, vec2 uv, vec4 color, sampler2D tex) {
			// Create lightning-like distortion with unstable current jitter
			float noise1 = fract(sin(dot(uv * 10.0 + u_time * 5.0, vec2(12.9898, 78.233))) * 43758.5453);
			float noise2 = fract(sin(dot(uv * 15.0 + u_time * 8.0, vec2(39.346, 11.135))) * 73156.3178);
			float noise3 = fract(sin(dot(pos + u_time * 20.0, vec2(54.321, 98.765))) * 12345.6789);
			
			// Pixel jitter for unstable current effect
			float jitterStrength = u_distortion * 0.02;
			vec2 jitter = vec2(
				(noise1 - 0.5) * jitterStrength,
				(noise2 - 0.5) * jitterStrength
			);
			
			// Add rapid high-frequency jitter
			jitter += vec2(
				sin(u_time * 50.0 + pos.x * 0.1) * (noise3 - 0.5),
				cos(u_time * 45.0 + pos.y * 0.1) * (noise3 - 0.5)
			) * jitterStrength * 2.0;
			
			// Sample with jittered UV coordinates
			vec2 jitteredUV = uv + jitter;
			vec4 baseColor = texture2D(tex, jitteredUV);
			
			// Lightning bolt effect - jagged distortion
			float lightning = sin(uv.x * 20.0 + u_time * 30.0 + noise1 * 10.0) * u_distortion;
			lightning += cos(uv.y * 15.0 + u_time * 25.0 + noise2 * 8.0) * u_distortion * 0.5;
			
			// Add sharp peaks for electrical look
			float peaks = step(0.8, noise1) * u_distortion * 2.0;
			
			// Brightness flicker (unstable power)
			float flicker = 1.0 + (noise1 - 0.5) * u_distortion * 0.4;
			flicker *= 1.0 + sin(u_time * 40.0) * u_distortion * 0.2;
			
			// Combine effects
			vec3 glowColor = baseColor.rgb * flicker;
			glowColor += vec3(peaks) * baseColor.rgb;
			
			// Edge glow based on UV distance from center
			float edgeDist = abs(uv.y - 0.5) * 2.0;
			float edgeGlow = (1.0 - edgeDist) * u_distortion * 0.5;
			glowColor += vec3(edgeGlow) * baseColor.rgb;
			
			return vec4(glowColor, baseColor.a) * color;
		}
	`
	);
	await audioAssets
	if (audioLoadError) throw audioLoadError
}

export function randomExplosion(poolId: ExplosionSoundPoolId = "general") {
	return randomExplosionSound(poolId);
}

export function adjustedTarget(from: number, to: number) {
	return from + shortestAngleDelta(from, to);
}

export function shortestAngleDelta(from: number, to: number) {
	let delta = (to - from) % 360;
	if (delta > 180) delta -= 360;
	if (delta < -180) delta += 360;
	return delta;
}

export function saveGame(slot: string) {
	const save: SaveSlot = {
		version: SAVE_VERSION,
		loadout,
		loadoutRarity,
		score: getDepositedDebree(),
		time: timeSeconds,
		weaponInventoryVersion: 1,
		ownedWeaponIds: getOwnedWeaponIds(),
		equippedWeaponId: getEquippedWeaponId(),
		abilityLoadoutVersion: 1,
		abilityLoadout: getAbilityLoadout(),
	};
	localStorage.setItem(slot, JSON.stringify(save));
}

export function hasGameSave(slot: string) {
	const saved = localStorage.getItem(slot)
	if (!saved) return false
	try {
		const parsed = JSON.parse(saved) as Partial<SaveSlot>
		return parsed.version === SAVE_VERSION
	} catch {
		return false
	}
}

export function deleteGameSave(slot: string) {
	localStorage.removeItem(slot)
}

export function loadGame(slot: string): SaveSlot | null {
	for (const legacyKey of LEGACY_SAVE_KEYS) {
		localStorage.removeItem(legacyKey);
	}
	var p = localStorage.getItem(slot);

	if (!p) return null;

	const save = JSON.parse(p) as Partial<SaveSlot>;
	if (save.version !== SAVE_VERSION) {
		localStorage.removeItem(slot);
		return null;
	}

	const savedWeaponIds = save.weaponInventoryVersion === 1
		? save.ownedWeaponIds ?? []
		: WEAPONS.filter((weapon) =>
			weapon.id === "standardBlaster" ||
			isBlueprintDiscovered(`weapon:${weapon.id}`)
		).map((weapon) => weapon.id);
	const discoveredWeaponIds = WEAPONS.filter((weapon) =>
		weapon.id === "standardBlaster" ||
		isBlueprintDiscovered(`weapon:${weapon.id}`)
	).map((weapon) => weapon.id);
	const ownedWeaponIds = [...new Set([
		...savedWeaponIds,
		...discoveredWeaponIds,
	])];
	setWeaponInventory(ownedWeaponIds, save.equippedWeaponId ?? "");
	migrateLegacyAbilityDiscoveries(ownedWeaponIds, save.loadout ?? {});
	const savedAbilities = save.abilityLoadoutVersion === 1
		? save.abilityLoadout
		: undefined;
	setAbilityLoadout({
		primary: isAbilityIdForSlot(savedAbilities?.primary, "primary") &&
			ownedWeaponIds.includes(savedAbilities.primary)
			? savedAbilities.primary
			: getEquippedWeaponId(),
		secondary: isAbilityIdForSlot(savedAbilities?.secondary, "secondary")
			? savedAbilities.secondary
			: undefined,
		mobility: isAbilityIdForSlot(savedAbilities?.mobility, "mobility")
			? savedAbilities.mobility
			: getDefaultMobilityFromLegacyLoadout(save.loadout ?? {}),
		ultimate: isAbilityIdForSlot(savedAbilities?.ultimate, "ultimate")
			? savedAbilities.ultimate
			: undefined,
	});
	return save as SaveSlot;
}
