import { KAPLAYCtx } from "kaplay";
import { loadout, upgrades } from "./upg";
import { score, timeSeconds } from "./main";

interface SaveSlot {
	time: number;
	score: number;
	loadout: Record<string, number | undefined>;
}

export async function init(k: KAPLAYCtx) {
	await k.loadRoot("./"); // A good idea for Itch.io publishing later
	await k.loadSprite("ship", "sprites/ship.png");
	await k.loadSprite("crate1", "sprites/crate1.png");
	await k.loadSprite("bullet1", "sprites/bullet1.png");
	await k.loadSprite("rocket1", "sprites/rocket1.png");
	await k.loadSprite("follower", "sprites/follower.png");

	await k.loadSprite("asteroid1", "sprites/asteroid1.png");
	await k.loadSprite("enemy_ship1", "sprites/enemy_ship1.png");
	await k.loadSprite("bike1", "sprites/bike1.png");

	await k.loadSprite("particle1", "sprites/particle1.png");
	await k.loadSprite("particle2", "sprites/particle2.png");
	await k.loadSprite("particle3", "sprites/particle3.png");
	await k.loadSprite("particle4", "sprites/particle4.png");
	await k.loadSprite("spark1", "sprites/spark1.png");

	await k.loadSprite("debree_part1", "sprites/debree_part1.png");

	await k.loadSprite("blaster1", "sprites/upgrades/laser_cannon1.png");
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
		"debree_speed_upg1",
		"sprites/upgrades/debree_speed_upg1.png"
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

	await k.loadSprite("bg_moon1", "sprites/bg/moon1.png");
	await k.loadSprite("bg_building1", "sprites/bg/building1.png");

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
		uniform vec2 u_ringCenter;
		uniform float u_ringRadius;
		
		vec4 frag(vec2 pos, vec2 uv, vec4 color, sampler2D tex) {
			// Calculate distance from ring center
			float dist = distance(pos, u_ringCenter);
			float ringDist = abs(dist - u_ringRadius);
			
			// Only apply effect near the ring (within threshold)
			float threshold = 20.0 + u_intensity * 30.0;
			if (ringDist < threshold) {
				// Calculate effect strength based on distance to ring
				float effectStrength = (1.0 - (ringDist / threshold)) * u_intensity;
				
				// Calculate angle and radial direction from ring center
				float angle = atan(pos.y - u_ringCenter.y, pos.x - u_ringCenter.x);
				
				// Strong displacement amount for visible jitter
				float displacementStrength = effectStrength * 15.0;
				
				// Create chaotic jitter displacement with multiple frequencies
				float jitterX = sin(angle * 20.0 + u_time * 30.0) * sin(pos.y * 0.5 + u_time * 10.0);
				float jitterY = cos(angle * 18.0 + u_time * 25.0) * cos(pos.x * 0.5 + u_time * 12.0);
				
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
		loadout,
		score: score,
		time: timeSeconds,
	};
	localStorage.setItem(slot, JSON.stringify(save));
}
export function loadGame(slot: string): SaveSlot | null {
	var p = localStorage.getItem(slot);

	if (!p) return null;

	return JSON.parse(p);
}
