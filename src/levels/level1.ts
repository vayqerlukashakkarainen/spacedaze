import { playerObj } from "../game";
import { dt, dtScaled, getPosAtBorder, k, layers, musicVolume } from "../main";
import { spawnAssasin } from "../spawn/spawnAssasin";
import { spawnMeteorite } from "../spawn/spawnAsteroid";
import { spawnHighway } from "../spawn/spawnHighway";
import { spawnShip1 } from "../spawn/spawnShip1";
import { tags } from "../tags";
import { endSong, loadSongData } from "../web";
import { spawnCrate } from "../spawn/spawnCrate";
import { spawnSpawner } from "../spawn/spawnSpawner";
import { audioService } from "../services/audioService";
import { Level, loadLevel } from "./levels";
import { spawnBackgroundObject } from "../spawn/spawnBackgroundObject";

let lvlData: any = {};
let timer = 0;
let spawned = 0;
let toSpawn = 0;
let bgAsteroidTimer = 0;
export const level1: Level = {
	song: {
		music: "arcadia",
		title: "Arcadia",
		author: "Dunderpatrullen",
		albumCover: "/covers/arcadia_cover.jpg",
		bpm: 0.44,
	},
	title: "",
	introduceSound: "",
	levelLengthSeconds: 190,
	reset: () => {
		lvlData = {};
		audioService.stopMusic();
		endSong();
		bgAsteroidTimer = 0;
		// Return to hub after level completion (5c)
		loadLevel("hub");
	},
	lvlUpd: () => {
		// Continuously spawn background asteroids
		bgAsteroidTimer += dt();

		if (bgAsteroidTimer >= k.rand(1.5, 3)) {
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
	waves: [
		{
			timeStamp: 0,
			begin: () => {
				audioService.playMusic(level1.song.music, { volume: musicVolume });
			},
			upd: () => {},
		},
		{
			timeStamp: 3500,
			begin: () => {
				loadSongData(
					level1.song.title,
					level1.song.author,
					level1.song.albumCover
				);
			},
			upd: () => {},
		},
		{
			timeStamp: 4500,
			begin: (ld) => {
				var txt = k.add([
					k.pos(k.center()),
					k.anchor("center"),
					k.animate(),
					k.text("...INIT SPACEJUMP...", { font: "", size: 42 }),
					tags.gameLoopUi,
				]);

				txt.animate("opacity", [1, 0], {
					loops: 5,
					duration: 0.7,
				});

				lvlData["txt"] = txt;
			},
			upd: () => {},
		},
		{
			timeStamp: 4550,
			duration: 3550,
			begin: () => {
				lvlData["lines"] = [];
				timer = 0;
			},
			upd: (ld) => {
				timer += k.dt();

				if (ld > 2000) {
					k.shake(0.01 * (ld / 100));
				}
				if (timer <= 0.02) return;
				var randomPos = k.rand(k.vec2(k.width(), k.height()));

				var line = k.add([
					k.pos(randomPos),
					k.rect(2, 4 * (ld / 100)),
					k.color(k.WHITE),
					"dust",
				]);

				lvlData["lines"].push(line);

				for (let i = 0; i < lvlData["lines"].length; i++) {
					lvlData["lines"][i].move(0, -10 * (ld / 50) * dtScaled());
				}
			},
		},
		{
			timeStamp: 8120,
			begin: () => {
				k.destroyAll("dust");
				k.flash(k.WHITE, 1);
				k.destroy(lvlData["txt"]);
				delete lvlData["lines"];
				const spawn = 40;

				for (let i = 0; i < spawn; i++) {
					var randomPos = k.rand(k.vec2(k.width(), k.height()));

					if (playerObj.pos.dist(randomPos) < 200) continue;
					spawnMeteorite({
						pos: randomPos,
						dir: k.DOWN,
						scoreOnKill: 1,
						hp: 8,
						speed: k.rand(20, 40),
						splitOnDeath: 2,
					});
				}
				for (let i = 0; i < spawn / 10; i++) {
					var randomPos = k.rand(k.vec2(k.width(), k.height()));

					if (playerObj.pos.dist(randomPos) < 200) continue;
					spawnCrate({
						pos: randomPos,
						am: 1,
						hp: 3,
						powerupMultiplier: 3,
					});
				}

				spawnBackgroundObject({
					parallaxLevel: 3,
					pos: k.vec2(100),
					sprite: "bg_moon1",
					scale: 2,
					opacity: 0.5,
					rotation: 2,
					color: k.rgb(50, 50, 50),
				});

				spawnBackgroundObject({
					parallaxLevel: 2,
					pos: k.vec2(100, 400),
					sprite: "bg_building1",
					scale: 3,
					rotation: 0,
					color: k.rgb(50, 50, 50),
				});
			},
			upd: (ld) => {},
		},
		{
			timeStamp: 16000,
			begin: () => {
				var txt = k.add([
					k.pos(k.center()),
					k.anchor("center"),
					k.animate(),
					k.text("!!THREAT DETECTED!!", { font: "", size: 42 }),
					tags.gameLoopUi,
				]);

				txt.animate("opacity", [1, 0], {
					loops: 10,
					duration: level1.song.bpm,
				});

				lvlData["txt"] = txt;
			},
			upd: (ld) => {},
		},
		{
			timeStamp: 21000,
			begin: () => {
				k.destroy(lvlData["txt"]);
				const max = 6;

				for (let i = 0; i < max; i++) {
					const pos = getPosAtBorder(0.25 * (i / max));

					spawnShip1(pos, k.DOWN, 2, 7, 1, k.rand(40, 60));
				}
			},
			upd: (ld) => {},
		},
		{
			timeStamp: 18790,
			begin: () => {
				k.flash(k.WHITE, level1.song.bpm);
				const max = 12;

				for (let i = 0; i < max; i++) {
					const pos = getPosAtBorder(1 * (i / max));

					spawnShip1(
						pos,
						k.Vec2.fromAngle(pos.angleBetween(k.center())),
						2,
						7,
						1,
						k.rand(40, 60)
					);
				}
			},
			upd: (ld) => {},
		},
		{
			timeStamp: 22790,
			begin: () => {
				k.flash(k.WHITE, level1.song.bpm);
				const max = 12;

				for (let i = 0; i < max; i++) {
					const pos = getPosAtBorder(1 * (i / max));

					spawnShip1(
						pos,
						k.Vec2.fromAngle(pos.angleBetween(k.center())),
						2,
						5,
						1,
						k.rand(40, 60)
					);
				}
			},
			upd: (ld) => {},
		},
		{
			timeStamp: 36744,
			duration: 1000,
			begin: () => {
				k.shake(10);
			},
			upd: (ld) => {
				timer += k.dt();

				if (timer >= 0.05) {
					const rnd = k.rand(1);
					spawnAssasin(getPosAtBorder(rnd), 2, 4, 1);
					timer = 0;
				}
			},
		},
		{
			timeStamp: 43824,
			duration: 1500,
			begin: () => {
				timer = 0;
				spawned = 0;
				toSpawn = 30;
			},
			upd: (ld) => {
				timer += k.dt();

				if (timer >= 0.03 && spawned < toSpawn) {
					const t = 0.25 + 0.25 * (spawned / toSpawn);
					spawnMeteorite({
						pos: getPosAtBorder(t),
						dir: k.LEFT,
						scoreOnKill: 0,
						hp: 3,
						speed: 40,
						splitOnDeath: 2,
					});
					spawned++;
					timer = 0;
				}
			},
		},
		{
			timeStamp: 45600,
			duration: 1500,
			begin: () => {
				timer = 0;
				spawned = 0;
				toSpawn = 30;
			},
			upd: (ld) => {
				timer += k.dt();

				if (timer >= 0.03 && spawned < toSpawn) {
					const t = 0.75 + 0.25 * (spawned / toSpawn);
					spawnMeteorite({
						pos: getPosAtBorder(t),
						dir: k.RIGHT,
						scoreOnKill: 0,
						hp: 3,
						speed: 40,
						splitOnDeath: 2,
					});
					spawned++;
					timer = 0;
				}
			},
		},
		{
			timeStamp: 47000,
			duration: 5000,
			begin: () => {
				timer = 0;
				spawned = 0;
				toSpawn = 40;
				const max = 6;

				for (let i = 0; i < max; i++) {
					const pos = getPosAtBorder(0.25 * (i / max));

					spawnShip1(pos, k.DOWN, 2, 10, 1, k.rand(40, 60));
				}
			},
			upd: (ld) => {
				timer += k.dt();

				if (timer >= 0.03 && spawned < toSpawn) {
					for (let i = 0; i < 2; i++) {
						const t = 0.5 * i + 0.25 * (spawned / toSpawn);
						spawnMeteorite({
							pos: getPosAtBorder(t),
							dir: i == 0 ? k.DOWN : k.UP,
							scoreOnKill: 0,
							hp: 3,
							speed: 40,
							splitOnDeath: 2,
						});
					}

					spawned++;
					timer = 0;
				}
			},
		},
		{
			timeStamp: 66000,
			duration: 14000,
			begin: () => {
				timer = 0;
			},
			upd: (ld) => {
				timer += k.dt();

				if (timer >= level1.song.bpm * 2) {
					const rnd = k.rand(1);
					spawnAssasin(getPosAtBorder(rnd), 2, 2, 1);
					timer = 0;
				}
			},
		},
		{
			timeStamp: 79300,
			begin: () => {
				timer = 0;
				for (let i = 0; i < 2; i++) {
					const yPos = 200 + 300 * i;
					spawnHighway({
						startPos: k.vec2(0, yPos),
						endPos: k.vec2(k.width(), yPos),
						spawnChance: 90,
						destroyAfterKills: 5,
					});
				}
			},
			upd: (ld) => {},
		},
		{
			timeStamp: 86450,
			begin: () => {
				timer = 0;
				for (let i = 0; i < 2; i++) {
					const xPos = 200 + 300 * i;
					spawnHighway({
						startPos: k.vec2(xPos, 0),
						endPos: k.vec2(xPos, k.height()),
						spawnChance: 80,
						destroyAfterKills: 5,
					});
				}

				const max = 14;

				for (let i = 0; i < max; i++) {
					const pos = getPosAtBorder(0.25 * (i / max));

					spawnShip1(pos, k.DOWN, 2, 5, 1, k.rand(40, 60));
				}
			},
			upd: (ld) => {},
		},
		{
			timeStamp: 97340,
			begin: () => {
				k.flash(k.WHITE, 0.5);
			},
			upd: (ld) => {},
		},
		{
			timeStamp: 100700,
			begin: () => {
				k.flash(k.WHITE, 0.5);
			},
			upd: (ld) => {},
		},
		{
			timeStamp: 107900,
			begin: () => {
				k.flash(k.WHITE, 0.5);

				for (let i = 0; i < 4; i++) {
					spawnSpawner({
						maxSpawns: 5,
						onSpawn: (p) => {
							spawnAssasin(p, 2, 6, 1);
						},
						spawnChance: 100,
						pos: k.rand(k.vec2(k.width(), k.height())),
					});
				}
			},
			upd: (ld) => {},
		},
		{
			timeStamp: 115000,
			begin: () => {
				for (let i = 0; i < 4; i++) {
					spawnSpawner({
						maxSpawns: 10,
						onSpawn: (p) => {
							spawnAssasin(p, 2, 6, 1);
						},
						spawnChance: 70,
						pos: k.rand(k.vec2(k.width(), k.height())),
					});
				}
			},
			upd: (ld) => {},
		},
		{
			timeStamp: 125000,
			begin: () => {
				for (let i = 0; i < 6; i++) {
					spawnSpawner({
						maxSpawns: 10,
						onSpawn: (p) => {
							spawnMeteorite({
								pos: p,
								hp: 15,
								dir: k.rand(k.vec2(-1, -1), k.vec2(1, 1)),
								scoreOnKill: 2,
								speed: k.rand(80, 120),
								splitOnDeath: Math.floor(k.rand(3)),
							});
						},
						spawnChance: 50,
						pos: k.rand(k.vec2(k.width(), k.height())),
					});
				}
			},
			upd: (ld) => {},
		},
	],
};
