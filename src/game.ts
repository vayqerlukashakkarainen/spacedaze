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
import {
	k,
	GameState,
	changeGameState,
	addScore,
	mainSoundVolume,
} from "./main";
import { player, resetSession, session } from "./player";

import { clearPlayer, setupPlayer } from "./setupPlayer";
import { tags } from "./tags";
import {
	addHealthBar,
	clearGameLoopUi,
	setupGameLoopUi,
	updatePlayerHealthBar,
} from "./gameUi";
import { Component } from "./compose";
import { spawnPowerup } from "./spawn/spawnPowerup";
import { getDmg } from "./projectiles/shared";
import { spawnExplosionEffect } from "./spawn/spawnFlash";
import { audioService } from "./services/audioService";
import { loopService } from "./services/loopService";
import { hub } from "./levels/hub";
import {
	activeLevel,
	loadLevel,
	updateLvl,
	resetCurrentLevel,
} from "./levels/levels";

export let playerObj: GameObj<
	PosComp | SpriteComp | RotateComp | AreaComp | AnchorComp | HealthComp
>;
let timeSinceLastLevel = 0;

export let debrees: GameObj<AnimateComp | PosComp | SpriteComp>[] = [];
export const projectiles: GameObj<PosComp | any>[] = [];

export function startGame() {
	playerObj = setupPlayer();
	resetSession();
	setupGameLoopUi(player.maxHealth);
}

export function updateGameLoop() {
	const deltaTime = k.dt();
	timeSinceLastLevel += deltaTime;

	if (!activeLevel()) {
		loadLevel("hub");
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
				audioService.playSound("collect1", { volume: mainSoundVolume });
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
	loopService.cancelAll();
	k.destroyAll(tags.enemy);
	k.destroyAll(tags.blaster);
	k.destroyAll(tags.rocket);
	k.destroyAll(tags.enemy);
	k.destroyAll(tags.levelBg);
	k.destroyAll(tags.unit);
	k.destroyAll(tags.debree);
	k.destroyAll(tags.props);
	clearGameLoopUi();
	changeGameState(GameState.LevelUp);
}

export function createExplosion(
	pos: Vec2,
	radius: number,
	splashDmg: number,
	splashDmgFallof: number,
	splashDmgFallofDist: number
) {
	const enemies = k.query({
		include: [tags.enemy, tags.unit],
		includeOp: "and",
	});
	spawnExplosionEffect(pos, radius);

	for (let i = 0; i < enemies.length; i++) {
		if (enemies[i].pos.dist(pos) < radius) {
			const dmg = getDmg(
				player.critChance,
				splashDmg,
				player.critMultiplier,
				enemies[i].pos
			);
			enemies[i].hurt(dmg);
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

export function addMaxHealth() {
	if (!playerObj) return;

	session.extraHealth++;
	const totalHealth = player.maxHealth + session.extraHealth;
	playerObj.setMaxHP(totalHealth);
	addHealthBar(totalHealth - 1);
	playerObj.heal();
	updatePlayerHealthBar(playerObj.hp());
}
