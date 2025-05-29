import { AudioPlay, MusicData } from "kaplay";
import { playerObj } from "../game";
import { getPosAtBorder, k, layers, musicVolume } from "../main";
import { spawnAssasin } from "../spawn/spawnAssasin";
import { spawnMeteorite } from "../spawn/spawnAsteroid";
import { spawnHighway } from "../spawn/spawnHighway";
import { spawnShip1 } from "../spawn/spawnShip1";
import { tags } from "../tags";
import { Level } from "../wave";
import { endSong, loadSongData } from "../web";

let lvlData: any = {};
let timer = 0;
let spawned = 0;
let toSpawn = 0;
let song: AudioPlay;
export const level1: Level = {
	music: "arcadia",
	songTitle: "Arcadia",
	songAuthor: "Dunderpatrullen",
	songAlbumCover: "/covers/arcadia_cover.jpg",
	bpm: 0.44,
	title: "",
	introduceSound: "",
	levelLengthSeconds: 190,
	reset: () => {
		lvlData = {};
		song.stop();
		endSong();
	},
	lvlUpd: () => {},
	waves: [
		{
			timeStamp: 0,
			begin: () => {
				song = k.play(level1.music, { volume: musicVolume });
			},
			upd: () => {},
		},
		{
			timeStamp: 3500,
			begin: () => {
				loadSongData(
					level1.songTitle,
					level1.songAuthor,
					level1.songAlbumCover
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
			},
			upd: (ld) => {
				var randomPos = k.rand(k.vec2(k.width(), k.height()));

				var line = k.add([
					k.pos(randomPos),
					k.rect(2, 4 * (ld / 100)),
					k.color(k.WHITE),
					"dust",
				]);

				lvlData["lines"].push(line);

				for (let i = 0; i < lvlData["lines"].length; i++) {
					lvlData["lines"][i].move(0, -10 * (ld / 50));
				}

				if (ld > 2000) {
					k.shake(0.01 * (ld / 100));
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
						hp: 3,
						speed: k.rand(20, 40),
						splitOnDeath: 2,
					});
				}

				k.add([
					k.pos(100),
					k.color(k.rgb(50, 50, 50)),
					k.sprite("bg_moon1"),
					k.scale(2),
					k.layer(layers.bg),
					tags.levelBg,
				]);

				k.add([
					k.pos(100, 400),
					k.color(k.rgb(50, 50, 50)),
					k.sprite("bg_building1"),
					k.scale(2),
					k.layer(layers.bg),
					tags.levelBg,
				]);
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
					duration: level1.bpm,
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

					spawnShip1(pos, k.DOWN, 3, 5, 1, k.rand(40, 60));
				}
			},
			upd: (ld) => {},
		},
		{
			timeStamp: 18790,
			begin: () => {
				k.flash(k.WHITE, level1.bpm);
				const max = 12;

				for (let i = 0; i < max; i++) {
					const pos = getPosAtBorder(1 * (i / max));

					spawnShip1(
						pos,
						k.Vec2.fromAngle(pos.angleBetween(k.center())),
						3,
						5,
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
				k.flash(k.WHITE, level1.bpm);
				const max = 12;

				for (let i = 0; i < max; i++) {
					const pos = getPosAtBorder(1 * (i / max));

					spawnShip1(
						pos,
						k.Vec2.fromAngle(pos.angleBetween(k.center())),
						3,
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
					spawnAssasin(getPosAtBorder(rnd), 2, 2, 1);
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
						scoreOnKill: 1,
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
						scoreOnKill: 1,
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
				toSpawn = 30;
			},
			upd: (ld) => {
				timer += k.dt();

				if (timer >= 0.03 && spawned < toSpawn) {
					for (let i = 0; i < 2; i++) {
						const t = 0.5 * i + 0.25 * (spawned / toSpawn);
						spawnMeteorite({
							pos: getPosAtBorder(t),
							dir: i == 0 ? k.DOWN : k.UP,
							scoreOnKill: 1,
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

				if (timer >= level1.bpm * 2) {
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
					spawnHighway(k.vec2(0, yPos), k.vec2(k.width(), yPos), 10);
				}
			},
			upd: (ld) => {
				timer += k.dt();

				if (timer >= level1.bpm) {
					const rnd = k.rand(1);
					spawnAssasin(getPosAtBorder(rnd), 2, 2, 1);
					timer = 0;
				}
			},
		},
	],
};
