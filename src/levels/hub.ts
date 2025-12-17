import { endSong } from "../web";
import { audioService } from "../services/audioService";
import { spawnLevel } from "../spawn/spawnLevel";
import { k } from "../main";
import { Level } from "./levels";
import { spawnBackgroundObject } from "../spawn/spawnBackgroundObject";

let lvlData: any = {};
let bgAsteroidTimer = 0;
export const hub: Level = {
	song: {
		music: "hub",
		title: "",
		author: "",
		albumCover: "",
		bpm: 0,
	},
	title: "",
	introduceSound: "",
	levelLengthSeconds: 999,
	reset: () => {
		lvlData = {};
		audioService.stopMusic();
		endSong();
	},
	onStart: () => {
		audioService.playMusic(hub.song.music, { volume: 1, loop: true });
		spawnLevel({
			pos: k.vec2(0, 0),
			levelName: "level1",
			spriteName: "more_missiles_upg1",
		});
		spawnBackgroundObject({
			parallaxLevel: 4,
			pos: k.vec2(100),
			sprite: "bg_moon1",
			scale: 2,
			opacity: 1,
			rotationSpeed: 0.05,
			color: k.rgb(40, 40, 40),
		});

		spawnBackgroundObject({
			parallaxLevel: 2,
			pos: k.vec2(200, 100),
			sprite: "bg_building1",
			scale: 3,
			opacity: 1,
			rotation: 120,
			color: k.rgb(15, 15, 15),
		});
	},
	lvlUpd: () => {
		// Continuously spawn background asteroids
		bgAsteroidTimer += k.dt();

		if (bgAsteroidTimer >= 2) {
			bgAsteroidTimer = 0;

			// Randomly choose spawn side and direction
			const side = k.rand(0, 4);
			let startPos: any;
			let endPos: any;

			if (side < 1) {
				// Spawn from left, move right
				startPos = k.vec2(-50, k.rand(0, k.height()));
				endPos = k.vec2(k.width() + 50, k.rand(0, k.height()));
			} else if (side < 2) {
				// Spawn from right, move left
				startPos = k.vec2(k.width() + 50, k.rand(0, k.height()));
				endPos = k.vec2(-50, k.rand(0, k.height()));
			} else if (side < 3) {
				// Spawn from top, move down
				startPos = k.vec2(k.rand(0, k.width()), -50);
				endPos = k.vec2(k.rand(0, k.width()), k.height() + 50);
			} else {
				// Spawn from bottom, move up
				startPos = k.vec2(k.rand(0, k.width()), k.height() + 50);
				endPos = k.vec2(k.rand(0, k.width()), -50);
			}

			spawnBackgroundObject({
				pos: startPos,
				moveTo: endPos,
				speed: k.rand(1, 2),
				sprite: "asteroid1",
				scale: k.rand(0.5, 1.5),
				color: k.rgb(k.rand(80, 120), k.rand(80, 120), k.rand(80, 120)),
				parallaxLevel: k.rand(4, 10),
				opacity: k.rand(0.3, 0.7),
				rotation: k.rand(0, 360),
				rotationSpeed: k.rand(-0.5, 0.5),
			});
		}
	},
	waves: [],
};
