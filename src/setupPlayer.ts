import {
	checkProjectileIntersection,
	clearGame,
	createExplosion,
} from "./game";
import { updatePlayerHealthBar, updateSpecialBar } from "./gameUi";
import { k, mainSoundVolume } from "./main";
import { starsEmitter, trailEmitter } from "./particles";
import { hasLvlValue, player, session } from "./player";
import { shootBlaster } from "./projectiles/blaster";
import { shootRocket } from "./projectiles/rocket";
import {
	lerpAngleBetweenPos,
	lerpMoveRotateAndScale,
	registerHitAnimation,
} from "./shared";
import { tags } from "./tags";
import { randomExplosion } from "./util";

let blasters = 0;
let bulletIndex = 1;
let specialTimer = 0;
const rocketSpecialCooldown = 6;
export function setupPlayer() {
	const playerObj = k.add([
		k.pos(k.center()),
		k.sprite("ship"),
		k.rotate(0),
		k.scale(),
		k.health(player.maxHealth),
		k.area(),
		k.anchor("center"),
		k.animate(),
		tags.friendly,
	]);

	registerHitAnimation(playerObj);

	if (hasLvlValue(player.blasterLvl, 1)) {
		playerObj.add([k.anchor("center"), k.pos(10, 0)]);
		blasters++;
		playerObj.add([k.anchor("center"), k.pos(-10, 0)]);
		blasters++;
	} else {
		playerObj.add([k.anchor("center"), k.pos(0, -6)]);
		blasters++;
	}
	if (hasLvlValue(player.blasterLvl, 2)) {
		playerObj.add([k.anchor("center"), k.pos(0, -6)]);
		blasters++;
	}

	playerObj.onDeath(() => {
		k.destroy(playerObj);
		starsEmitter.emitter.position = playerObj.pos;
		starsEmitter.emit(20);
		k.play("explosion1", { volume: mainSoundVolume });
		clearGame();
	});

	playerObj.onUpdate(() => {
		if (specialTimer < rocketSpecialCooldown) {
			specialTimer += k.dt();
			updateSpecialBar(specialTimer, rocketSpecialCooldown);
		}

		checkProjectileIntersection(playerObj.pos, 12, tags.enemy, (p) => {
			k.destroy(p);
			if (p.tags.includes(tags.blaster)) {
				playerObj.hurt(p.dmg);
			} else if (p.tags.includes(tags.rocket)) {
				playerObj.hurt(p.impactDmg);
				createExplosion(
					p.pos,
					p.splashSize,
					p.splashDmg,
					p.splashDmgFallof,
					p.splashDmgFallofDist
				);
				k.play(randomExplosion(), { volume: mainSoundVolume });
				k.shake(3);
			}
		});

		// If rockets have a target for too long, find new target
		const dist = playerObj.pos.dist(k.mousePos()) - 12;
		const { dir, lerp } = lerpAngleBetweenPos(
			playerObj.angle,
			playerObj.pos,
			k.mousePos(),
			0.05,
			-90
		);

		const maxSpeed =
			player.speed * player.speedMultiplier * player.speedPwrUpMultiplier;
		const speed = k.clamp(dist * 4, 0, maxSpeed);

		playerObj.angle = lerp;

		const playerCurrentDir = k.Vec2.fromAngle(playerObj.angle + 90);
		const emitterPos = k.vec2(
			playerObj.pos.x + 12 * playerCurrentDir.x,
			playerObj.pos.y + 12 * playerCurrentDir.y
		);

		if (speed > 4) {
			trailEmitter.emitter.position = emitterPos;
			trailEmitter.emitter.direction = k.Vec2.toAngle(dir);
			trailEmitter.emit(1);
		}

		lerpMoveRotateAndScale(playerObj, lerp, speed);
	});

	playerObj.onHurt(() => {
		k.play("hit2", { volume: mainSoundVolume });
		playerObj.animation.seek(0);
		k.shake(20);
		k.flash(k.RED, 0.4);
		updatePlayerHealthBar(playerObj.hp());
	});

	playerObj.onMousePress("left", () => {
		if (hasLvlValue(player.blasterParallel, 1)) {
			for (let i = 0; i < blasters; i++) {
				const gunPipe = playerObj.children[i];
				shootBlaster(
					gunPipe.worldPos(),
					k.Vec2.fromAngle(playerObj.angle - 90),
					playerObj.angle,
					player.blasterDmg * player.blasterDmgMultiplier,
					player.blasterSpeedMultiplier,
					[tags.friendly, tags.blaster],
					true
				);
			}
			return;
		}

		const gunPipe = playerObj.children[bulletIndex % blasters];
		shootBlaster(
			gunPipe.worldPos(),
			k.Vec2.fromAngle(playerObj.angle - 90),
			playerObj.angle,
			player.blasterDmg * player.blasterDmgMultiplier,
			player.blasterSpeedMultiplier,
			[tags.friendly, tags.blaster],
			true
		);
		bulletIndex++;
	});

	playerObj.onMousePress("right", () => {
		if (player.rocketsLvl === undefined) return;

		if (specialTimer < rocketSpecialCooldown) {
			return;
		}

		specialTimer = 0;
		k.loop(
			0.1,
			() => {
				shootRocket(
					playerObj.pos,
					k.Vec2.fromAngle(playerObj.angle - 90),
					playerObj.angle,
					player.rocketImpactDmg * player.rocketDmgMultiplier,
					player.rocketSplashDmg * player.rocketDmgMultiplier,
					player.rocketSplashSize * player.rocketSplashSizeMultiplier,
					player.rocketSplashDmgFallDistanceValue,
					player.rocketSplashDmgFallOverDistance,
					1,
					[tags.friendly, tags.rocket],
					true
				);
			},
			player.nrOfRockets + session.extraRockets
		);
	});

	playerObj.onKeyDown("shift", () => {
		if (player.canSprint === undefined) return;
		player.speedPwrUpMultiplier = 1.8 * player.sprintSpeedMultiplier;
	});
	playerObj.onKeyRelease("shift", () => {
		player.speedPwrUpMultiplier = 1;
	});

	return playerObj;
}

export function clearPlayer() {
	bulletIndex = 0;
	blasters = 0;
}
