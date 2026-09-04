import { KAPLAYCtx } from "kaplay";
import { loadout, upgrades } from "./upg";
import { score, timeSeconds } from "./main";
import {
	getEquippedWeaponId,
	getOwnedWeaponIds,
	setWeaponInventory,
} from "./services/weaponService";
import { PLANET_CHUNK_SPRITES } from "./planetChunkSprites";

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
	ownedWeaponIds: string[];
	equippedWeaponId: string;
}

function atlasEntry(index: number) {
	return {
		x: index % 4 * 16,
		y: Math.floor(index / 4) * 16,
		width: 16,
		height: 16,
	};
}

export async function init(k: KAPLAYCtx) {
	await k.loadRoot("./"); // A good idea for Itch.io publishing later
	await k.loadSprite("ship", "sprites/ship-v2.png");
	await k.loadSprite("crate1", "sprites/crate-v2.png");
	await k.loadSprite(
		"salvage_asteroid_normal",
		"sprites/salvage-asteroids/salvage-asteroid-normal.png"
	)
	await k.loadSprite(
		"salvage_asteroid_rich",
		"sprites/salvage-asteroids/salvage-asteroid-rich.png"
	)
	await k.loadSprite("recovery_shop", "sprites/shops/v3/recovery-shop.png");
	await k.loadSprite(
		"facility_contract_terminal",
		"sprites/facilities/v2/facility-contract-terminal.png"
	);
	await k.loadSprite(
		"facility_contract_terminal_destroyed",
		"sprites/facilities/v2/facility-contract-terminal-destroyed.png"
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
		"facility_debrief_terminal",
		"sprites/facilities/v2/facility-debrief-terminal.png"
	);
	await k.loadSprite(
		"facility_debrief_terminal_destroyed",
		"sprites/facilities/v2/facility-debrief-terminal-destroyed.png"
	);
	await k.loadSprite(
		"facility_training_range",
		"sprites/facilities/v2/facility-training-range.png"
	);
	await k.loadSprite(
		"facility_training_range_destroyed",
		"sprites/facilities/v2/facility-training-range-destroyed.png"
	);
	await k.loadSprite(
		"facility_blueprint_archive",
		"sprites/facilities/v2/facility-blueprint-archive.png"
	);
	await k.loadSprite(
		"facility_blueprint_archive_destroyed",
		"sprites/facilities/v2/facility-blueprint-archive-destroyed.png"
	);
	await k.loadSprite(
		"facility_warp_zones",
		"sprites/facilities/v2/facility-warp-zones.png"
	);
	await k.loadSprite(
		"facility_warp_zones_destroyed",
		"sprites/facilities/v2/facility-warp-zones-destroyed.png"
	);
	await k.loadSprite("bullet1", "sprites/bullet1.png");
	await k.loadSprite("rocket1", "sprites/rocket1.png");
	await k.loadSpriteAtlas("sprites/swarm-atlas.png", {
		drone_combat: atlasEntry(0),
		drone_gunship: atlasEntry(1),
		drone_interceptor: atlasEntry(2),
		drone_medic: atlasEntry(3),
		drone_missile: atlasEntry(4),
		drone_salvager: atlasEntry(5),
		arc_capacitor_upg1: atlasEntry(6),
		follower_blaster_dmg_upg1: atlasEntry(7),
		follower_upg1: atlasEntry(8),
		blaster1: atlasEntry(9),
		parallel_blasters_upg1: atlasEntry(10),
	});

	await k.loadSprite("asteroid1", "sprites/asteroid1.png");
	for (let index = 1; index <= 8; index++) {
		await k.loadSprite(
			`asteroid_chunk_${index}`,
			`sprites/asteroid-chunks/asteroid-chunk-${index}.png`
		)
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
	await k.loadSprite("enemy_ship1", "sprites/enemy_ship1.png");
	await k.loadSprite("bike1", "sprites/bike1.png");
	await k.loadSprite("enemy_rammer", "sprites/enemies/rammer.png");
	await k.loadSprite("enemy_sniper", "sprites/enemies/sniper.png");
	await k.loadSprite("enemy_mine_layer", "sprites/enemies/mine-layer.png");
	await k.loadSprite(
		"enemy_shield_drone",
		"sprites/enemies/shield-drone.png"
	);
	await k.loadSprite("enemy_swarm_drone", "sprites/enemies/swarm-drone.png")
	await k.loadSprite(
		"enemy_swarm_hivemind",
		"sprites/enemies/swarm-hivemind.png"
	)

	await k.loadSprite("particle1", "sprites/particle1.png");
	await k.loadSprite("particle2", "sprites/particle2.png");
	await k.loadSprite("particle3", "sprites/particle3.png");
	await k.loadSprite("particle4", "sprites/particle4.png");
	await k.loadSprite("spark1", "sprites/spark1.png");

	await k.loadSprite("debree_part1", "sprites/debree_part1.png");
	await k.loadSprite("room_rift_anchor", "sprites/rooms/rift-anchor.png");
	await k.loadSprite("room_repair_station", "sprites/rooms/repair-station.png");
	await k.loadSprite("room_gravity_core", "sprites/rooms/gravity-core.png");
	await k.loadSprite("room_proximity_mine", "sprites/rooms/proximity-mine.png");
	await k.loadSprite("room_convoy_drone", "sprites/rooms/convoy-drone.png");
	await k.loadSprite("room_signal_relay", "sprites/rooms/signal-relay.png");

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
	await k.loadSprite("rocket_upg1", "sprites/upgrades/rocket_upg1.png");
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
		"momentum_core_upg1",
		"orbiting_rounds_upg1",
		"stasis_burst_upg1",
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
	await k.loadSprite("start_run", "sprites/upgrades/start_run.png");

	await k.loadSprite("bg_moon1", "sprites/bg/moon1.png");
	await k.loadSprite("bg_building1", "sprites/bg/building1.png");
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

	await k.loadBitmapFont("unscii", "/fonts/unscii_8x8.png", 8, 8);

	await k.loadSound("shoot1", "sounds/shoot1.wav");
	await k.loadSound("fire_rocket1", "sounds/rocket_fire1.wav");

	await k.loadSound("explosion1", "sounds/explosion1.wav");
	await k.loadSound("explosion2", "sounds/explosion2.wav");
	await k.loadSound("explosion3", "sounds/explosion3.wav");
	await k.loadSound("explosion4", "sounds/explosion4.wav");
	await k.loadSound("hit1", "sounds/hit1.wav");
	await k.loadSound("hit2", "sounds/hit2.wav");
	await k.loadSound("player_hit1", "sounds/player_hit1.wav");
	await k.loadSound("collect1", "sounds/collect1.wav");
	await k.loadSound("salvage_pickup", "sounds/salvage-pickup.mp3");
	await k.loadSound("click1", "sounds/click.wav");
	await k.loadSound("ui_hover", "sounds/ui-hover.wav");
	await k.loadSound("ui_click", "sounds/ui-click.wav");
	await k.loadSound("purchase", "sounds/purchase.wav");
	await k.loadSound("error", "sounds/error.wav");
	await k.loadSound("purchase1", "sounds/purchase1.wav");
	await k.loadSound("powerup1", "sounds/powerup1.wav");
	await k.loadSound("crit1", "sounds/crit1.wav");
	await k.loadSound("slowdown", "sounds/slowdown.wav");
	await k.loadSound("swap_level", "sounds/swap_level.wav");
	await k.loadSound(
		"menu_spacejump_warp",
		"sounds/menu-spacejump-warp.mp3"
	);
	await k.loadSound(
		"player_arrival_impact",
		"sounds/player-arrival-impact.mp3"
	);
	await k.loadSound("wormhole_rampup", "sounds/wormhole-rampup.mp3");
	await k.loadSound("wormhole_ambience", "sounds/wormhole-ambience.mp3");
	await k.loadSound(
		"secret_cavern_reveal",
		"sounds/secret-cavern-reveal.mp3"
	);
	await k.loadSound("reward_riser_epic", "sounds/reward-riser-epic.mp3");
	await k.loadSound(
		"reward_riser_legendary",
		"sounds/reward-riser-legendary.mp3"
	);
	await k.loadSound(
		"reward_shine_legendary",
		"sounds/reward-shine-legendary.mp3"
	);
	await k.loadSound("shop_menu_open", "sounds/shop-menu-open.mp3");
	await k.loadSound("shop_menu_close", "sounds/shop-menu-close.mp3");
	await k.loadSound(
		"golden_crate_destroyed",
		"sounds/golden-crate-destroyed.mp3"
	);

	await k.loadMusic("arcadia", "songs/arcadia.mp3");
	await k.loadMusic(
		"flirtFlirtOhItHurts",
		"songs/flirt-flirt-oh-it-hurts.mp3"
	);
	await k.loadMusic("hub", "songs/hub.mp3");

	k.loadShader(
		"wormholeLighting",
		null,
		`
		uniform vec2 u_lightCenter;
		uniform vec2 u_resolution;
		uniform float u_radius;
		uniform float u_intensity;
		uniform float u_time;

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
			vec2 distortedUv = clamp(
				uv + direction * displacement / u_resolution,
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
			vec3 atmosphericGlow = lightColor
				* lightStrength
				* 0.055
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

	await k.loadSprite(
		"enemy_ship1_left_wing",
		"sprites/ships/enemy1/enemy_ship1_left_wing.png"
	);
	await k.loadSprite(
		"enemy_ship1_right_wing",
		"sprites/ships/enemy1/enemy_ship1_right_wing.png"
	);
	await k.loadSprite(
		"enemy_ship1_body",
		"sprites/ships/enemy1/enemy_ship1_body.png"
	);

	await k.loadSprite("boss1_body", "sprites/boss/boss1/boss1_body.png");
	await k.loadSprite("boss1_blaster", "sprites/boss/boss1/boss1_blaster.png");
	await k.loadSprite("boss1_head", "sprites/boss/boss1/boss1_head.png");

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
}

const explArr = ["explosion1", "explosion2", "explosion3"];

export function randomExplosion() {
	const r = Math.floor(Math.random() * explArr.length);
	return explArr[r];
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
		score: score,
		time: timeSeconds,
		ownedWeaponIds: getOwnedWeaponIds(),
		equippedWeaponId: getEquippedWeaponId(),
	};
	localStorage.setItem(slot, JSON.stringify(save));
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

	setWeaponInventory(
		save.ownedWeaponIds ?? [],
		save.equippedWeaponId ?? ""
	);
	return save as SaveSlot;
}
