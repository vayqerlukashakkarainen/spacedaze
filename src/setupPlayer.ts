import {
	checkProjectileIntersection,
	clearGame,
	createExplosion,
} from "./game";
import { updatePlayerHealthBar, updateSpecialBar } from "./ui/gameUi";
import { dt, k, mainSoundVolume, timeScale } from "./main";
import { starsEmitter, trailEmitter } from "./particles";
import { hasLvlValue, player, session } from "./player";
import {
	spawnPlayerBlaster,
	spawnPlayerRocket,
} from "./services/projectileHelpers";
import {
	lerpAngleBetweenPos,
	lerpMoveRotateAndScale,
	registerHitAnimation,
} from "./shared";
import { tags } from "./tags";
import { randomExplosion } from "./util";
import { audioService } from "./services/audioService";
import { loopService } from "./services/loopService";
import { timescale } from "./comp/timescale";

let blasters = 0;
let bulletIndex = 1;
let specialTimer = 0;
const rocketSpecialCooldown = 6;
let movementMode: "mouse" | "wasd" = "mouse";
let wasdFacingMode: "movement" | "mouse" = "movement";
const targetOffset = 64;

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
		timescale(),
		tags.friendly,
		tags.gameLoop,
	]);

	const turretObj = playerObj.add([
		k.sprite("ship"),
		k.pos(0, 0),
		k.rotate(0),
		k.anchor("center"),
		k.z(1),
	]);

	const targetObj = k.add([k.pos(k.center()), k.z(1000), tags.gameLoop]);

	registerHitAnimation(playerObj);

	if (hasLvlValue(player.blasterLvl, 1)) {
		turretObj.add([k.anchor("center"), k.pos(10, 0)]);
		blasters++;
		turretObj.add([k.anchor("center"), k.pos(-10, 0)]);
		blasters++;
	} else {
		turretObj.add([k.anchor("center"), k.pos(0, -6)]);
		blasters++;
	}
	if (hasLvlValue(player.blasterLvl, 2)) {
		turretObj.add([k.anchor("center"), k.pos(0, -6)]);
		blasters++;
	}

	playerObj.onDeath(() => {
		k.destroy(playerObj);
		starsEmitter.emitter.position = playerObj.pos;
		starsEmitter.emit(20);
		audioService.playSound("explosion1", { volume: mainSoundVolume });
		clearGame();
	});

	k.onKeyPress("tab", () => {
		movementMode = movementMode === "mouse" ? "wasd" : "mouse";
	});

	k.onKeyPress("r", () => {
		if (movementMode === "wasd") {
			wasdFacingMode = wasdFacingMode === "movement" ? "mouse" : "movement";
		}
	});

	playerObj.onUpdate(() => {
		if (specialTimer < rocketSpecialCooldown) {
			specialTimer += dt();
			updateSpecialBar(specialTimer, rocketSpecialCooldown);
		}

		k.setCamPos(playerObj.pos);

		checkProjectileIntersection(playerObj.pos, 12, tags.enemy, (p) => {
			if (p.tags.includes(tags.blaster)) {
				playerObj.hp -= p.dmg;
			} else if (p.tags.includes(tags.rocket)) {
				playerObj.hp -= p.impactDmg;
				createExplosion(
					p.pos,
					p.splashSize,
					p.splashDmg,
					p.splashDmgFallof,
					p.splashDmgFallofDist
				);
				audioService.playSound(randomExplosion(), { volume: mainSoundVolume });
				k.shake(3);
			}
		});

		if (movementMode === "mouse") {
			const worldMousePos = k.mousePos().sub(k.center().sub(k.getCamPos()));
			targetObj.pos = worldMousePos;
		} else {
			const wasdDir = k.vec2(
				(k.isKeyDown("d") ? 1 : 0) - (k.isKeyDown("a") ? 1 : 0),
				(k.isKeyDown("s") ? 1 : 0) - (k.isKeyDown("w") ? 1 : 0)
			);

			if (wasdDir.len() > 0) {
				targetObj.pos = playerObj.pos.add(wasdDir.unit().scale(targetOffset));
			} else {
				targetObj.pos = playerObj.pos;
			}
		}

		const dist = playerObj.pos.dist(targetObj.pos) - 12;

		let facingTarget = targetObj.pos;
		if (movementMode === "wasd" && wasdFacingMode === "mouse") {
			facingTarget = k.mousePos().sub(k.center().sub(k.getCamPos()));
		}

		const { dir, lerp } = lerpAngleBetweenPos(
			playerObj.angle,
			playerObj.pos,
			facingTarget,
			0.05 * timeScale * playerObj.getTimescale(),
			-90
		);

		// Update turret rotation
		if (movementMode === "wasd") {
			const mouseWorldPos = k.mousePos().sub(k.center().sub(k.getCamPos()));
			const turretLerp = lerpAngleBetweenPos(
				turretObj.angle,
				playerObj.pos,
				mouseWorldPos,
				0.1 * timeScale * playerObj.getTimescale(),
				-90
			);
			turretObj.angle = turretLerp.lerp;
		} else {
			turretObj.angle = playerObj.angle;
		}

		const maxSpeed =
			player.speed * player.speedMultiplier * player.speedPwrUpMultiplier;
		const speed = k.clamp(dist * 4, 0, maxSpeed) * playerObj.getTimescale();

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
		audioService.playSound("hit2", { volume: mainSoundVolume });
		playerObj.animation.seek(0);
		k.shake(20);
		k.flash(k.RED, 0.4);
		updatePlayerHealthBar(playerObj.hp);
	});

	playerObj.onMousePress("left", () => {
		if (hasLvlValue(player.blasterParallel, 1)) {
			for (let i = 0; i < blasters; i++) {
				const gunPipe = turretObj.children[i];
				spawnPlayerBlaster(
					gunPipe.worldPos(),
					k.Vec2.fromAngle(turretObj.angle - 90),
					turretObj.angle
				);
			}
			return;
		}

		const gunPipe = turretObj.children[bulletIndex % blasters];
		spawnPlayerBlaster(
			gunPipe.worldPos(),
			k.Vec2.fromAngle(turretObj.angle - 90),
			turretObj.angle
		);
		bulletIndex++;
	});

	playerObj.onMousePress("right", () => {
		if (player.rocketsLvl === undefined) return;

		if (specialTimer < rocketSpecialCooldown) {
			return;
		}

		specialTimer = 0;
		loopService.loop(
			0.1,
			() => {
				spawnPlayerRocket(
					playerObj.pos,
					k.Vec2.fromAngle(playerObj.angle - 90),
					playerObj.angle
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

	playerObj.onKeyPress("space", () => {
		// Check for nearby interactable objects
		const interactables = k.query({ include: ["interactable"] });
		for (const obj of interactables) {
			const interactable = obj as any;
			if (interactable.isInRange) {
				interactable.onInteract();
				break; // Only interact with one object at a time
			}
		}
	});

	return playerObj;
}

export function clearPlayer() {
	bulletIndex = 0;
	blasters = 0;
	movementMode = "mouse";
	wasdFacingMode = "movement";
}
