import {
	checkProjectileIntersection,
	clearGame,
	createExplosion,
} from "./game";
import { k } from "./main";
import { starsEmitter, trailEmitter } from "./particles";
import { hasLvlValue, player } from "./player";
import { shootBlaster } from "./projectiles/blaster";
import { shootRocket } from "./projectiles/rocket";
import { lerpAngleBetweenPos, registerHitAnimation } from "./shared";
import { tags } from "./tags";
import { randomExplosion } from "./util";

let blasters = 0;
let bulletIndex = 1;

export function setupPlayer() {
	const playerObj = k.add([
		k.pos(k.center()),
		k.sprite("ship"),
		k.rotate(0),
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
	}
	if (hasLvlValue(player.blasterLvl, 2)) {
		playerObj.add([k.anchor("center"), k.pos(-10, 0)]);
		blasters++;
	}
	if (hasLvlValue(player.blasterLvl, 4)) {
		playerObj.add([k.anchor("center"), k.pos(0, -6)]);
		blasters++;
	}

	playerObj.onDeath(() => {
		k.destroy(playerObj);
		starsEmitter.emitter.position = playerObj.pos;
		starsEmitter.emit(20);
		k.play("explosion1", { volume: 1 });
		clearGame();
	});

	playerObj.onUpdate(() => {
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
				k.play(randomExplosion(), { volume: 0.6 });
				k.shake(3);
			}
		});

		const { dir, lerp } = lerpAngleBetweenPos(
			playerObj.angle,
			playerObj.pos,
			k.mousePos(),
			0.01,
			-90
		);

		playerObj.angle = lerp;

		const playerCurrentDir = k.Vec2.fromAngle(playerObj.angle + 90);
		const emitterPos = k.vec2(
			playerObj.pos.x + 12 * playerCurrentDir.x,
			playerObj.pos.y + 12 * playerCurrentDir.y
		);
		trailEmitter.emitter.position = emitterPos;
		trailEmitter.emitter.direction = k.Vec2.toAngle(dir);
		trailEmitter.emit(1);

		const lerpAngle = k.deg2rad(lerp + 90);
		playerObj.move(
			Math.cos(lerpAngle) *
				(player.speed * player.speedMultiplier * player.speedPwrUpMultiplier) *
				-1,
			Math.sin(lerpAngle) *
				(player.speed * player.speedMultiplier * player.speedPwrUpMultiplier) *
				-1
		);
	});

	playerObj.onHurt(() => {
		k.play("hit2", { volume: 0.4 });
		playerObj.animation.seek(0);
		k.shake(20);
		k.flash(k.RED, 0.4);
	});

	playerObj.onMousePress("left", () => {
		if (hasLvlValue(player.blasterLvl, 1)) {
			if (hasLvlValue(player.blasterLvl, 3)) {
				for (let i = 0; i < blasters; i++) {
					const gunPipe = playerObj.children[i];
					shootBlaster(
						gunPipe.worldPos(),
						k.Vec2.fromAngle(playerObj.angle - 90),
						playerObj.angle,
						player.blasterDmg * player.blasterDmgMultiplier,
						player.blasterSpeedMultiplier,
						[tags.friendly, tags.blaster]
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
				[tags.friendly, tags.blaster]
			);
			bulletIndex++;
		}
	});

	playerObj.onMousePress("right", () => {
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
					player.blasterSpeedMultiplier,
					[tags.friendly, tags.rocket],
					true
				);
			},
			10
		);
	});

	playerObj.onKeyDown("shift", () => {
		player.speedPwrUpMultiplier = 1.8;
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
