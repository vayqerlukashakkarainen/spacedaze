import { KAPLAYCtx } from "kaplay";
import { loadout, upgrades } from "./upg";
import { score, timeSeconds } from "./main";
import {
	getEquippedWeaponId,
	getOwnedWeaponIds,
	setWeaponInventory,
} from "./services/weaponService";

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

export async function init(k: KAPLAYCtx) {
	await k.loadRoot("./"); // A good idea for Itch.io publishing later
	await k.loadSprite("ship", "sprites/ship-v2.png");
	await k.loadSprite("crate1", "sprites/crate-v2.png");
	await k.loadSprite("recovery_shop", "sprites/recovery-shop.png");
	await k.loadSprite(
		"facility_contract_terminal",
		"sprites/facilities/facility-contract-terminal.png"
	);
	await k.loadSprite(
		"facility_contract_terminal_destroyed",
		"sprites/facilities/facility-contract-terminal-destroyed.png"
	);
	await k.loadSprite(
		"facility_salvage_forge",
		"sprites/facilities/facility-salvage-forge.png"
	);
	await k.loadSprite(
		"facility_salvage_forge_destroyed",
		"sprites/facilities/facility-salvage-forge-destroyed.png"
	);
	await k.loadSprite(
		"facility_debrief_terminal",
		"sprites/facilities/facility-debrief-terminal.png"
	);
	await k.loadSprite(
		"facility_debrief_terminal_destroyed",
		"sprites/facilities/facility-debrief-terminal-destroyed.png"
	);
	await k.loadSprite(
		"facility_training_range",
		"sprites/facilities/facility-training-range.png"
	);
	await k.loadSprite(
		"facility_training_range_destroyed",
		"sprites/facilities/facility-training-range-destroyed.png"
	);
	await k.loadSprite(
		"facility_blueprint_archive",
		"sprites/facilities/facility-blueprint-archive.png"
	);
	await k.loadSprite(
		"facility_blueprint_archive_destroyed",
		"sprites/facilities/facility-blueprint-archive-destroyed.png"
	);
	await k.loadSprite(
		"facility_warp_zones",
		"sprites/facilities/facility-warp-zones.png"
	);
	await k.loadSprite(
		"facility_warp_zones_destroyed",
		"sprites/facilities/facility-warp-zones-destroyed.png"
	);
	await k.loadSprite("bullet1", "sprites/bullet1.png");
	await k.loadSprite("rocket1", "sprites/rocket1.png");
	await k.loadSprite("follower", "sprites/follower.png");

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

	await k.loadSprite("particle1", "sprites/particle1.png");
	await k.loadSprite("particle2", "sprites/particle2.png");
	await k.loadSprite("particle3", "sprites/particle3.png");
	await k.loadSprite("particle4", "sprites/particle4.png");
	await k.loadSprite("spark1", "sprites/spark1.png");

	await k.loadSprite("debree_part1", "sprites/debree_part1.png");

	await k.loadSprite("blaster1", "sprites/upgrades/laser_cannon1.png");
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
		"phase_capacitor_upg1",
		"sprites/upgrades/phase_capacitor_upg1.png"
	);
	await k.loadSprite(
		"twin_capacitor_upg1",
		"sprites/upgrades/twin_capacitor_upg1.png"
	);
	await k.loadSprite(
		"parallel_blasters_upg1",
		"sprites/upgrades/parallel_blasters_upg1.png"
	);
	await k.loadSprite("follower_upg1", "sprites/upgrades/follower_upg1.png");
	await k.loadSprite(
		"follower_missiles_upg1",
		"sprites/upgrades/follower_missiles_upg1.png"
	);
	await k.loadSprite(
		"follower_blaster_dmg_upg1",
		"sprites/upgrades/follower_blaster_dmg_upg1.png"
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
		"arc_capacitor_upg1",
		"sprites/upgrades/arc_capacitor_upg1.png"
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
	await k.loadSound("click1", "sounds/click.wav");
	await k.loadSound("purchase", "sounds/purchase.wav");
	await k.loadSound("error", "sounds/error.wav");
	await k.loadSound("purchase1", "sounds/purchase1.wav");
	await k.loadSound("powerup1", "sounds/powerup1.wav");
	await k.loadSound("crit1", "sounds/crit1.wav");
	await k.loadSound("slowdown", "sounds/slowdown.wav");
	await k.loadSound("swap_level", "sounds/swap_level.wav");

	await k.loadMusic("arcadia", "songs/arcadia.mp3");
	await k.loadMusic("hub", "songs/hub.mp3");

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
		
		vec4 frag(vec2 pos, vec2 uv, vec4 color, sampler2D tex) {
			if (u_intensity > 0.001) {
				// Strong displacement amount for visible jitter
				float displacementStrength = u_intensity * 15.0;
				
				// Create chaotic jitter displacement with multiple frequencies
				float jitterX = sin(pos.x * 0.2 + u_time * 30.0) * sin(pos.y * 0.5 + u_time * 10.0);
				float jitterY = cos(pos.y * 0.18 + u_time * 25.0) * cos(pos.x * 0.5 + u_time * 12.0);
				
				// Add higher frequency noise for more chaos
				float noise1 = fract(sin(dot(pos, vec2(12.9898, 78.233))) * 43758.5453);
				float noise2 = fract(sin(dot(pos, vec2(39.346, 11.135))) * 73156.3178);
				
				// Combine displacements
				vec2 displacement = vec2(
					(jitterX + (noise1 - 0.5) * 2.0) * displacementStrength,
					(jitterY + (noise2 - 0.5) * 2.0) * displacementStrength
				);
				
				// Convert pixel displacement to UV displacement (approximate texel size)
				vec2 displacedUV = uv + displacement * 0.001;
				
				// Sample from displaced position
				vec4 displacedColor = texture2D(tex, displacedUV);
				
				return displacedColor * color;
			}
			
			return def_frag() * color;
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
