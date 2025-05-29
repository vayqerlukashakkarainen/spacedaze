import { KAPLAYCtx } from "kaplay";
import { loadout, upgrades } from "./upg";
import { score, timeSeconds } from "./main";

interface SaveSlot {
	time: number;
	score: number;
	loadout: Record<string, number | undefined>;
}

export async function init(k: KAPLAYCtx<{}, never>) {
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

	await k.loadMusic("arcadia", "songs/arcadia.mp3");

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
}

const explArr = ["explosion1", "explosion2", "explosion3"];

export function randomExplosion() {
	const r = Math.floor(Math.random() * explArr.length);
	return explArr[r];
}

export function adjustedTarget(from, to) {
	return from + shortestAngleDelta(from, to);
}

export function shortestAngleDelta(from, to) {
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
