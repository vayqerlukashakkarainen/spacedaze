import type { Vec2 } from "kaplay";
import { playerObj } from "../game";
import { dt, k, layers, musicVolume } from "../main";
import { spawnAssasin } from "../spawn/spawnAssasin";
import { spawnMeteorite } from "../spawn/spawnAsteroid";
import { spawnHighway } from "../spawn/spawnHighway";
import { spawnShip1 } from "../spawn/spawnShip1";
import { tags } from "../tags";
import { endSong, loadSongData } from "../web";
import { spawnCrate } from "../spawn/spawnCrate";
import { spawnSpawner } from "../spawn/spawnSpawner";
import { audioService } from "../services/audioService";
import type { FinaleDefinition } from "./finaleTypes";
import { spawnBackgroundObject } from "../spawn/spawnBackgroundObject";
import {
	getThreatSnapshot,
	scaleThreatSpawnCount,
} from "../services/threatService";

let lvlData: any = {};
let timer = 0;
let spawned = 0;
let toSpawn = 0;
export const zone1Finale: FinaleDefinition = {
	id: "level1Ending",
	song: {
		music: "arcadia",
		title: "Arcadia",
		author: "Dunderpatrullen",
		albumCover: "/covers/arcadia_cover.jpg",
		bpm: 0.44,
	},
	fallbackDurationSeconds: 190,
	durationSeconds: () => audioService.getCurrentMusic()?.duration(),
	reset: () => {
		lvlData = {};
		audioService.stopMusic();
		endSong();
	},
	start: () => {
		audioService.playMusic(zone1Finale.song.music, { volume: musicVolume });
	},
	events: [
		{
			timeStamp: 3500,
			begin: () => {
				loadSongData(
					zone1Finale.song.title,
					zone1Finale.song.author,
					zone1Finale.song.albumCover
				);
			},
			upd: () => {},
		},
		{
			timeStamp: 8120,
			begin: () => {
				k.flash(k.WHITE, 1);
				const spawn = scaleThreatSpawnCount(40);

				for (let i = 0; i < spawn; i++) {
					const randomPos = getRandomPlayerViewportPos();

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
				for (let i = 0; i < 4; i++) {
					const randomPos = getRandomPlayerViewportPos();

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
					pos: getPlayerViewportPos(k.vec2(100)),
					sprite: "bg_moon1",
					scale: 2,
					opacity: 0.5,
					rotation: 2,
					color: k.rgb(50, 50, 50),
				});

				spawnBackgroundObject({
					parallaxLevel: 2,
					pos: getPlayerViewportPos(k.vec2(100, 400)),
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
					k.fixed(),
					k.layer(layers.ui),
					tags.gameLoopUi,
				]);

				txt.animate("opacity", [1, 0], {
					loops: 10,
					duration: zone1Finale.song.bpm,
				});

				lvlData["txt"] = txt;
			},
			upd: (ld) => {},
		},
		{
			timeStamp: 21000,
			begin: () => {
				k.destroy(lvlData["txt"]);
				const max = scaleThreatSpawnCount(6);

				for (let i = 0; i < max; i++) {
					const pos = getPlayerBorderPos(0.25 * (i / max));

					spawnShip1(pos, k.DOWN, 2, 7, 1, k.rand(40, 60));
				}
			},
			upd: (ld) => {},
		},
		{
			timeStamp: 18790,
			begin: () => {
				k.flash(k.WHITE, zone1Finale.song.bpm);
				const max = scaleThreatSpawnCount(12);

				for (let i = 0; i < max; i++) {
					const pos = getPlayerBorderPos(1 * (i / max));

					spawnShip1(
						pos,
						playerObj.pos.sub(pos).unit(),
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
				k.flash(k.WHITE, zone1Finale.song.bpm);
				const max = scaleThreatSpawnCount(12);

				for (let i = 0; i < max; i++) {
					const pos = getPlayerBorderPos(1 * (i / max));

					spawnShip1(
						pos,
						playerObj.pos.sub(pos).unit(),
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

				if (
					timer >=
					0.05 / getThreatSnapshot().spawnCountMultiplier
				) {
					const rnd = k.rand(1);
					spawnAssasin(getPlayerBorderPos(rnd), 2, 4, 1);
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
				toSpawn = scaleThreatSpawnCount(30);
			},
			upd: (ld) => {
				timer += k.dt();

				if (timer >= 0.03 && spawned < toSpawn) {
					const t = 0.25 + 0.25 * (spawned / toSpawn);
					spawnMeteorite({
						pos: getPlayerBorderPos(t),
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
				toSpawn = scaleThreatSpawnCount(30);
			},
			upd: (ld) => {
				timer += k.dt();

				if (timer >= 0.03 && spawned < toSpawn) {
					const t = 0.75 + 0.25 * (spawned / toSpawn);
					spawnMeteorite({
						pos: getPlayerBorderPos(t),
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
				toSpawn = scaleThreatSpawnCount(40);
				const max = scaleThreatSpawnCount(6);

				for (let i = 0; i < max; i++) {
					const pos = getPlayerBorderPos(0.25 * (i / max));

					spawnShip1(pos, k.DOWN, 2, 10, 1, k.rand(40, 60));
				}
			},
			upd: (ld) => {
				timer += k.dt();

				if (timer >= 0.03 && spawned < toSpawn) {
					for (let i = 0; i < 2; i++) {
						const t = 0.5 * i + 0.25 * (spawned / toSpawn);
						spawnMeteorite({
							pos: getPlayerBorderPos(t),
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

				if (
					timer >=
					(zone1Finale.song.bpm * 2) /
						getThreatSnapshot().spawnCountMultiplier
				) {
					const rnd = k.rand(1);
					spawnAssasin(getPlayerBorderPos(rnd), 2, 2, 1);
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
						startPos: getPlayerViewportPos(k.vec2(0, yPos)),
						endPos: getPlayerViewportPos(k.vec2(k.width(), yPos)),
						spawnChance:
							90 / getThreatSnapshot().spawnCountMultiplier,
						destroyAfterKills: scaleThreatSpawnCount(5),
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
						startPos: getPlayerViewportPos(k.vec2(xPos, 0)),
						endPos: getPlayerViewportPos(k.vec2(xPos, k.height())),
						spawnChance:
							80 / getThreatSnapshot().spawnCountMultiplier,
						destroyAfterKills: scaleThreatSpawnCount(5),
					});
				}

				const max = scaleThreatSpawnCount(14);

				for (let i = 0; i < max; i++) {
					const pos = getPlayerBorderPos(0.25 * (i / max));

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
						maxSpawns: scaleThreatSpawnCount(5),
						onSpawn: (p) => {
							spawnAssasin(p, 2, 6, 1);
						},
						spawnChance: 100,
						pos: getRandomPlayerViewportPos(),
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
						maxSpawns: scaleThreatSpawnCount(10),
						onSpawn: (p) => {
							spawnAssasin(p, 2, 6, 1);
						},
						spawnChance: 70,
						pos: getRandomPlayerViewportPos(),
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
						maxSpawns: scaleThreatSpawnCount(10),
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
						pos: getRandomPlayerViewportPos(),
					});
				}
			},
			upd: (ld) => {},
		},
	],
};

function getPlayerViewportPos(screenPos: Vec2) {
	const viewportSize = getWorldViewportSize();
	return playerObj.pos.add(
		(screenPos.x / k.width() - 0.5) * viewportSize.x,
		(screenPos.y / k.height() - 0.5) * viewportSize.y
	);
}

function getRandomPlayerViewportPos() {
	const viewportSize = getWorldViewportSize();
	return playerObj.pos.add(
		k.rand(-viewportSize.x / 2, viewportSize.x / 2),
		k.rand(-viewportSize.y / 2, viewportSize.y / 2)
	);
}

function getPlayerBorderPos(t: number) {
	const viewportSize = getWorldViewportSize();
	const margin = 18;
	const halfWidth = viewportSize.x / 2 + margin;
	const halfHeight = viewportSize.y / 2 + margin;
	const corners = [
		k.vec2(-halfWidth, -halfHeight),
		k.vec2(halfWidth, -halfHeight),
		k.vec2(halfWidth, halfHeight),
		k.vec2(-halfWidth, halfHeight),
	];
	const wrapped = ((t % 1) + 1) % 1;
	const sideProgress = wrapped * corners.length;
	const side = Math.floor(sideProgress);
	const nextSide = (side + 1) % corners.length;
	return playerObj.pos.add(
		corners[side].lerp(corners[nextSide], sideProgress - side)
	);
}

function getWorldViewportSize() {
	const cameraScale = k.getCamScale();
	return k.vec2(
		k.width() / Math.max(cameraScale.x, 0.001),
		k.height() / Math.max(cameraScale.y, 0.001)
	);
}
