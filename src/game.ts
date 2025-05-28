import {
	AnchorComp,
	AnimateComp,
	AreaComp,
	GameObj,
	HealthComp,
	PosComp,
	RotateComp,
	SpriteComp,
	Vec2,
} from "kaplay";
import { k, GameState, changeGameState, addScore } from "./main";
import { player } from "./player";
import { explosionEmitter } from "./particles";
import {
	activeLevel,
	Level,
	loadLevel,
	resetCurrentLevel,
	updateLvl,
} from "./wave";
import { clearPlayer, setupPlayer } from "./setupPlayer";
import { level1 } from "./levels/level1";
import { tags } from "./tags";
import { clearGameLoopUi, setupGameLoopUi } from "./gameUi";
import { spawnShip1 } from "./spawn/spawnShip1";
import { Component } from "./compose";
import { spawnFollower } from "./spawn/spawnFollower";

const lengthBetweenLevels = 1;

export let playerObj: GameObj<
	PosComp | SpriteComp | RotateComp | AreaComp | AnchorComp | HealthComp
>;
let timeSinceLastLevel = 0;

export let debrees: GameObj<AnimateComp | PosComp | SpriteComp>[] = [];
export const projectiles: GameObj<PosComp | any>[] = [];

export function startGame() {
	playerObj = setupPlayer();
	setupGameLoopUi(player.maxHealth);
}

export function updateGameLoop() {
	const dt = k.dt();
	timeSinceLastLevel += dt;

	if (timeSinceLastLevel >= lengthBetweenLevels && !activeLevel()) {
		loadLevel(level1);

		for (let i = 0; i < player.nrOfFollowers; i++) {
			spawnFollower({
				follow: playerObj,
				hp: 6,
				pos: k.vec2(k.rand(k.width()), 0),
				speed: k.rand(80, 110),
				blasterDmg:
					player.followerBlasterDmg * player.followerBlasterDmgMultiplier,
				canUseMissiles: player.followerCanUseMissiles !== undefined,
			});
		}
	}

	if (activeLevel()) {
		if (updateLvl()) {
			timeSinceLastLevel = 0;
			resetCurrentLevel();
		}
	}

	for (let i = 0; i < debrees.length; i++) {
		const d = debrees[i];

		const dist = d.pos.dist(playerObj.pos);

		if (
			dist <
			player.debreeSeekDistance * player.debreeSeekDistanceMultiplier
		) {
			d.moveTo(
				playerObj.pos,
				player.debreeSeekSpeed * player.debreeSeekSpeedMultiplier
			);

			if (dist < player.debreePickupDistance) {
				k.destroy(d);
				debrees.splice(i, 1);
				k.play("collect1", { volume: 0.6 });
				addScore(player.scorePerPickup);
				i--;
			}
		}
	}
}

export function clearGame() {
	clearPlayer();
	timeSinceLastLevel = 0;
	debrees = [];
	resetCurrentLevel();
	k.destroyAll(tags.enemy);
	k.destroyAll(tags.blaster);
	k.destroyAll(tags.rocket);
	k.destroyAll(tags.enemy);
	k.destroyAll(tags.levelBg);
	k.destroyAll(tags.unit);
	k.destroyAll(tags.debree);
	clearGameLoopUi();
	changeGameState(GameState.LevelUp);
}

export function createExplosion(
	pos,
	radius,
	splashDmg,
	splashDmgFallof,
	splashDmgFallofDist
) {
	const enemies = k.query({
		include: [tags.enemy, tags.unit],
		includeOp: "and",
	});
	explosionEmitter.emitter.position = pos;
	explosionEmitter.emit(14);

	for (let i = 0; i < enemies.length; i++) {
		if (enemies[i].pos.dist(pos) < radius) {
			enemies[i].hurt(splashDmg);
		}
	}
}

export function checkProjectileIntersection(
	pos: Vec2,
	dist: number,
	projectilesWithTag: string,
	onHit: (p: GameObj<PosComp | RotateComp | any>) => void
) {
	for (let i = 0; i < projectiles.length; i++) {
		const p = projectiles[i];

		if (p.pos.dist(pos) < dist) {
			if (!p.tags.includes(projectilesWithTag)) continue;

			onHit(p);
		}
	}
}
export function checkProjectileComponentIntersection(
	pos: Vec2,
	dist: number,
	projectilesWithTag: string,
	components: Component[],
	onHit: (p: GameObj<PosComp | RotateComp | any>, index: number) => void
) {
	for (let i = 0; i < projectiles.length; i++) {
		const p = projectiles[i];

		if (p.pos.dist(pos) < dist) {
			if (!p.tags.includes(projectilesWithTag)) continue;

			for (let i = 0; i < components.length; i++) {
				if (components[i].obj.hidden) continue;

				if (
					p.pos.dist(pos.sub(components[i].localPos)) < components[i].hitbox
				) {
					onHit(p, i);
					return;
				}
			}
		}
	}
}

export function pickUnitInDistance(
	pos: Vec2,
	dist: number,
	tag: string,
	onFound: (u: GameObj) => void
) {
	const units = k.query({ include: [tag, tags.unit], includeOp: "and" });
	for (let i = 0; i < units.length; i++) {
		const u = units[i];

		if (u.pos.dist(pos) < dist) {
			onFound(u);
			return true;
		}
	}

	return false;
}
