import type { GameObj, PosComp, RotateComp, Vec2 } from "kaplay";
import { beginPlayerDeathSequence, checkProjectileIntersection } from "./game";
import {
	syncPlayerHealthBarCapacity,
	updatePlayerHealthBar,
	updatePhaseJumpUi,
	updateSpecialBar,
} from "./ui/gameUi";
import {
	dt,
	k,
	mainSoundVolume,
	timeScale,
	WORLD_CAMERA_SCALE,
} from "./main";
import {
	boostTrailEmitter,
	starsEmitter,
	trailEmitter,
} from "./particles";
import { hasLvlValue, player, PLAYER_SCALE, session } from "./player";
import {
	spawnPlayerBlaster,
	spawnPlayerRocket,
	spawnPrimaryLinkedRocket,
} from "./services/projectileHelpers";
import {
	lerpAngleBetweenPos,
	lerpMoveRotateAndScale,
	registerHitAnimation,
} from "./shared";
import { tags } from "./tags";
import { audioService } from "./services/audioService";
import { loopService } from "./services/loopService";
import { applyProjectileDamage } from "./services/projectileService";
import { timescale } from "./comp/timescale";
import { levelTransitionActive } from "./services/levelTransitionService";
import type { InteractableComp } from "./comp/interactable";
import { getEquippedWeapon } from "./services/weaponService";
import { spawnPlayerDeathDebris } from "./spawn/spawnPlayerDeathDebris";

let blasters = 0;
let bulletIndex = 1;
let specialTimer = 0;
const rocketSpecialCooldown = 6;
const targetOffset = 64;
const playerAcceleration = 420;
const playerDeceleration = 560;
const cameraZoomLerpSpeed = 5;
const overclockShakeInterval = 0.12;
const overclockShakeIntensity = 0.25;
const phaseJumpInvulnerability = 0.18;
const phaseJumpDuration = 0.12;
const phaseJumpCooldownBarWidth = 22;
const phaseJumpCooldownBarOffset = -22;
const normalCameraFollowSpeed = 16;
const phaseCameraFollowSpeed = 6;
let currentMoveSpeed = 0;
let currentCameraScale = 1;
let currentCameraPos: Vec2 | undefined;
let configuredBlasterLevel = -2;
let configuredSpaceJumpLevel = -1;
let phaseJumpCharges = 0;
let phaseJumpMaxCharges = 0;
let phaseJumpRechargeTimer = 0;
let phaseJumpInvulnerableUntil = 0;
let phaseJumpStart: Vec2 | undefined;
let phaseJumpEnd: Vec2 | undefined;
let phaseJumpElapsed = 0;
let nextPrimaryFireTime = 0;
let configuredWeaponId = "";
let overclockShakeTimer = 0;

interface PhaseJumpConfig {
	distance: number;
	cooldown: number;
	charges: number;
}

export function setupPlayer() {
	const playerObj = k.add([
		k.pos(k.center()),
		k.sprite("ship"),
		k.rotate(0),
		k.scale(PLAYER_SCALE),
		k.health(player.maxHealth + session.extraHealth),
		k.area(),
		k.anchor("center"),
		k.opacity(1),
		k.animate(),
		timescale(),
		{
			gravitySteerable: true,
			gravityVelocity: k.vec2(0),
			gravitySteeringMultiplier: 0.35,
		},
		tags.friendly,
		tags.gameLoop,
	]);
	const phaseJumpCooldownTrack = k.add([
		k.pos(playerObj.pos),
		k.rect(phaseJumpCooldownBarWidth, 3),
		k.anchor("left"),
		k.color(k.WHITE),
		k.opacity(0),
		k.z(10),
		tags.gameLoop,
	]);
	const phaseJumpCooldownFill = k.add([
		k.pos(playerObj.pos),
		k.rect(phaseJumpCooldownBarWidth, 3),
		k.anchor("left"),
		k.color(80, 180, 255),
		k.opacity(0),
		k.z(11),
		tags.gameLoop,
	]);

	const turretObj = playerObj.add([
		k.pos(0, 0),
		k.rotate(0),
		k.z(-1),
	]);
	const muzzleObj = turretObj.add([k.pos(0, 0)]);
	const equippedWeapon = getEquippedWeapon();
	const weaponVisual = turretObj.add([
		k.pos(0, equippedWeapon.mountOffsetY / PLAYER_SCALE),
		k.sprite(equippedWeapon.icon),
		k.anchor("center"),
		k.scale(equippedWeapon.mountScale / PLAYER_SCALE),
		k.color(145, 155, 165),
		k.z(-1),
	]);
	let turretWorldAngle = playerObj.angle;

	const targetObj = k.add([k.pos(k.center()), k.z(1000), tags.gameLoop]);
	currentCameraPos = playerObj.pos.clone();
	currentCameraScale = WORLD_CAMERA_SCALE;
	k.setCamScale(WORLD_CAMERA_SCALE);

	registerHitAnimation(playerObj);

	configureBlasters(muzzleObj);
	configuredWeaponId = equippedWeapon.id;

	playerObj.onDeath(() => {
		const deathPos = playerObj.pos.clone();
		k.destroy(phaseJumpCooldownTrack);
		k.destroy(phaseJumpCooldownFill);
		k.destroy(playerObj);
		starsEmitter.emitter.position = deathPos;
		starsEmitter.emit(20);
		spawnPlayerDeathDebris(deathPos);
		audioService.playSound("explosion1", { volume: mainSoundVolume });
		beginPlayerDeathSequence();
	});

	playerObj.onUpdate(() => {
		const currentWeapon = getEquippedWeapon();
		if (configuredWeaponId !== currentWeapon.id) {
			weaponVisual.use(k.sprite(currentWeapon.icon));
			weaponVisual.pos.y = currentWeapon.mountOffsetY / PLAYER_SCALE;
			weaponVisual.scale = k.vec2(
				currentWeapon.mountScale / PLAYER_SCALE
			);
			configuredWeaponId = currentWeapon.id;
			configureBlasters(muzzleObj);
		}
		if (configuredBlasterLevel !== (player.blasterLvl ?? -1)) {
			configureBlasters(muzzleObj);
		}
		const spaceJumpConfigLevel = getSpaceJumpConfigLevel();
		if (configuredSpaceJumpLevel !== spaceJumpConfigLevel) {
			configureSpaceJump();
		}

		const phaseJumpConfig = getPhaseJumpConfig();
		let rechargeProgress = 1;
		if (phaseJumpConfig && phaseJumpCharges < phaseJumpMaxCharges) {
			phaseJumpRechargeTimer += dt();
			if (phaseJumpRechargeTimer >= phaseJumpConfig.cooldown) {
				phaseJumpCharges++;
				phaseJumpRechargeTimer -= phaseJumpConfig.cooldown;
				if (phaseJumpCharges >= phaseJumpMaxCharges) {
					phaseJumpRechargeTimer = 0;
				}
			}
		}
		if (phaseJumpConfig) {
			rechargeProgress =
				phaseJumpCharges >= phaseJumpMaxCharges
					? 1
					: phaseJumpRechargeTimer / phaseJumpConfig.cooldown;
			updatePhaseJumpUi(
				phaseJumpCharges,
				phaseJumpMaxCharges,
				rechargeProgress
			);
		}

		const desiredMaxHealth = player.maxHealth + session.extraHealth;
		if (playerObj.maxHP !== desiredMaxHealth) {
			const addedHealth = Math.max(0, desiredMaxHealth - playerObj.maxHP);
			playerObj.setMaxHP(desiredMaxHealth);
			if (addedHealth > 0) playerObj.heal(addedHealth);
			syncPlayerHealthBarCapacity(desiredMaxHealth);
			updatePlayerHealthBar(playerObj.hp());
		}

		if (specialTimer < rocketSpecialCooldown) {
			specialTimer += dt();
		}
		updateSpecialBar(
			specialTimer,
			rocketSpecialCooldown,
			player.rocketsLvl !== undefined
		);
		if (levelTransitionActive()) {
			currentCameraPos = k.getCamPos().clone();
			return;
		}

		const isPhaseJumping = updatePhaseJump(playerObj);
		playerObj.opacity = isPhaseJumping ? 0.35 : 1;
		const cameraFollowSpeed = isPhaseJumping
			? phaseCameraFollowSpeed
			: normalCameraFollowSpeed;
		if (!currentCameraPos) currentCameraPos = playerObj.pos.clone();
		currentCameraPos = currentCameraPos.lerp(
			playerObj.pos,
			1 - Math.exp(-cameraFollowSpeed * dt())
		);
		k.setCamPos(currentCameraPos);

		if (!isPhaseJumping && k.time() >= phaseJumpInvulnerableUntil) {
			checkProjectileIntersection(playerObj.pos, 12, tags.enemy, (p) => {
				const shouldDestroy = applyProjectileDamage(playerObj, p);
				if (shouldDestroy) k.destroy(p);
			});
		}

		const wasdDir = k.vec2(
			(k.isKeyDown("d") ? 1 : 0) - (k.isKeyDown("a") ? 1 : 0),
			(k.isKeyDown("s") ? 1 : 0) - (k.isKeyDown("w") ? 1 : 0)
		);
		const maxSpeed =
			player.speed * player.speedMultiplier * player.speedPwrUpMultiplier;
		const controlVelocity = wasdDir.len() > 0
			? wasdDir.unit().scale(maxSpeed)
			: k.vec2(0);
		const gravityVelocity = playerObj.gravityVelocity.clone();
		playerObj.gravityVelocity = k.vec2(0);
		const currentHeading = k.Vec2.fromAngle(playerObj.angle - 90);
		const headingInertia = currentHeading.scale(
			Math.max(currentMoveSpeed, maxSpeed * 0.5)
		);
		const steeringVelocity = (
			wasdDir.len() > 0 ? controlVelocity : headingInertia
		).add(gravityVelocity);

		let moveDirection = k.Vec2.fromAngle(playerObj.angle + 90);
		let nextPlayerAngle = playerObj.angle;
		let desiredPlayerAngle = playerObj.angle;
		if (steeringVelocity.len() > 0 && !isPhaseJumping) {
			moveDirection = steeringVelocity.unit();
			targetObj.pos = playerObj.pos.add(moveDirection.scale(targetOffset));
			const movementRotation = lerpAngleBetweenPos(
				playerObj.angle,
				playerObj.pos,
				targetObj.pos,
				0.05 * timeScale * playerObj.getTimescale(),
				-90
			);
			nextPlayerAngle = movementRotation.lerp;
			desiredPlayerAngle = movementRotation.correctedDesiredRot;
		} else {
			targetObj.pos = playerObj.pos;
		}

		playerObj.angle = nextPlayerAngle;

		// The turret angle is local to the rotating player, while aiming uses a
		// world angle. Keep both coordinate spaces separate.
		if (hasLvlValue(player.mouseAim, 1)) {
			const mouseWorldPos = k.toWorld(k.mousePos());
			const turretLerp = lerpAngleBetweenPos(
				turretWorldAngle,
				playerObj.pos,
				mouseWorldPos,
				0.1 * timeScale * playerObj.getTimescale(),
				-90
			);
			turretWorldAngle = turretLerp.lerp;
			turretObj.angle = turretWorldAngle - playerObj.angle;
		} else {
			turretWorldAngle = playerObj.angle;
			turretObj.angle = 0;
		}

		const isBoosting =
			!isPhaseJumping &&
			player.canSprint !== undefined &&
			k.isKeyDown("shift") &&
			wasdDir.len() > 0;
		if (isBoosting) {
			overclockShakeTimer += dt();
			if (overclockShakeTimer >= overclockShakeInterval) {
				overclockShakeTimer %= overclockShakeInterval;
				k.shake(overclockShakeIntensity);
			}
		} else {
			overclockShakeTimer = 0;
		}
		const targetCameraScale = isBoosting
			? WORLD_CAMERA_SCALE * 0.9
			: WORLD_CAMERA_SCALE;
		currentCameraScale = k.lerp(
			currentCameraScale,
			targetCameraScale,
			1 - Math.exp(-cameraZoomLerpSpeed * dt())
		);
		k.setCamScale(currentCameraScale);

		const targetSpeed = isPhaseJumping
			? 0
			: wasdDir.len() > 0
				? controlVelocity.add(gravityVelocity).len()
				: gravityVelocity.len();
		const acceleration =
			targetSpeed > currentMoveSpeed ? playerAcceleration : playerDeceleration;
		const speedStep = acceleration * dt() * playerObj.getTimescale();
		if (currentMoveSpeed < targetSpeed) {
			currentMoveSpeed = Math.min(currentMoveSpeed + speedStep, targetSpeed);
		} else {
			currentMoveSpeed = Math.max(currentMoveSpeed - speedStep, targetSpeed);
		}
		const speed = currentMoveSpeed * playerObj.getTimescale();

		const playerCurrentDir = k.Vec2.fromAngle(playerObj.angle + 90);
		const emitterPos = k.vec2(
			playerObj.pos.x + 12 * playerCurrentDir.x,
			playerObj.pos.y + 12 * playerCurrentDir.y
		);

		if (speed > 4 && !isPhaseJumping) {
			const activeTrailEmitter = isBoosting
				? boostTrailEmitter
				: trailEmitter;
			activeTrailEmitter.emitter.position = emitterPos;
			activeTrailEmitter.emitter.direction = k.Vec2.toAngle(moveDirection);
			activeTrailEmitter.emit(1);
		}

		if (!isPhaseJumping) {
			lerpMoveRotateAndScale(
				playerObj,
				nextPlayerAngle,
				speed,
				desiredPlayerAngle,
				PLAYER_SCALE
			);
		}

		const isPhaseJumpRecharging =
			phaseJumpConfig !== undefined && phaseJumpCharges < phaseJumpMaxCharges;
		const cooldownBarPos = playerObj.pos.add(
			-phaseJumpCooldownBarWidth / 2,
			phaseJumpCooldownBarOffset
		);
		phaseJumpCooldownTrack.pos = cooldownBarPos;
		phaseJumpCooldownFill.pos = cooldownBarPos;
		phaseJumpCooldownTrack.opacity = isPhaseJumpRecharging ? 0.25 : 0;
		phaseJumpCooldownFill.opacity = isPhaseJumpRecharging ? 1 : 0;
		phaseJumpCooldownFill.width =
			phaseJumpCooldownBarWidth * k.clamp(rechargeProgress, 0, 1);
	});

	playerObj.onHurt(() => {
		audioService.playSound("hit2", { volume: mainSoundVolume });
		playerObj.animation.seek(0);
		k.shake(20);
		k.flash(k.RED, 0.4);
		updatePlayerHealthBar(playerObj.hp());
	});

	const firePrimaryWeapon = () => {
		if (levelTransitionActive()) return;
		const weapon = getEquippedWeapon();
		if (k.time() < nextPrimaryFireTime) return;
		nextPrimaryFireTime = k.time() + weapon.fireCooldown;
		if (
			session.primaryRocketChance > 0 &&
			k.chance(k.clamp(session.primaryRocketChance, 0, 1))
		) {
			spawnPrimaryLinkedRocket(
				playerObj.pos.clone(),
				k.Vec2.fromAngle(turretWorldAngle - 90),
				turretWorldAngle
			);
		}
		if (hasLvlValue(player.blasterParallel, 1)) {
			for (let i = 0; i < blasters; i++) {
				const gunPipe = muzzleObj.children[i];
				spawnPlayerBlaster(
					getPlayerMuzzlePos(playerObj.pos, gunPipe.pos, turretWorldAngle),
					k.Vec2.fromAngle(turretWorldAngle - 90),
					turretWorldAngle
				);
			}
			return;
		}

		const gunPipe = muzzleObj.children[bulletIndex % blasters];
		spawnPlayerBlaster(
			getPlayerMuzzlePos(playerObj.pos, gunPipe.pos, turretWorldAngle),
			k.Vec2.fromAngle(turretWorldAngle - 90),
			turretWorldAngle
		);
		bulletIndex++;
	};

	playerObj.onUpdate(() => {
		if (!k.isMouseDown("left")) return;
		firePrimaryWeapon();
	});

	playerObj.onMousePress("right", () => {
		if (levelTransitionActive()) return;
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
					k.Vec2.fromAngle(turretWorldAngle - 90),
					turretWorldAngle
				);
			},
			player.nrOfRockets + session.extraRockets
		);
	});

	playerObj.onKeyDown("shift", () => {
		if (player.canSprint === undefined) return;
		player.speedPwrUpMultiplier = player.sprintSpeedMultiplier;
	});
	playerObj.onKeyRelease("shift", () => {
		player.speedPwrUpMultiplier = 1;
	});

	playerObj.onKeyPress("space", () => {
		if (levelTransitionActive()) return;
		const config = getPhaseJumpConfig();
		if (!config || phaseJumpCharges <= 0 || phaseJumpEnd) return;

		const inputDirection = k.vec2(
			(k.isKeyDown("d") ? 1 : 0) - (k.isKeyDown("a") ? 1 : 0),
			(k.isKeyDown("s") ? 1 : 0) - (k.isKeyDown("w") ? 1 : 0)
		);
		const jumpDirection =
			inputDirection.len() > 0
				? inputDirection.unit()
				: k.Vec2.fromAngle(playerObj.angle - 90);
		const startPos = playerObj.pos.clone();
		const destination = startPos.add(jumpDirection.scale(config.distance));

		phaseJumpCharges--;
		if (phaseJumpCharges === phaseJumpMaxCharges - 1) {
			phaseJumpRechargeTimer = 0;
		}
		phaseJumpInvulnerableUntil = k.time() + phaseJumpInvulnerability;
		phaseJumpStart = startPos;
		phaseJumpEnd = destination;
		phaseJumpElapsed = 0;
		spawnPhaseJumpEffect(startPos, destination, playerObj.angle);
	});

	playerObj.onKeyPress("f", () => {
		if (levelTransitionActive()) return;
		let closestInteractable:
			| GameObj<InteractableComp | PosComp>
			| undefined;
		let closestDistance = Infinity;

		for (const obj of k.get("interactable")) {
			const interactable = obj as GameObj<InteractableComp | PosComp>;
			if (!interactable.pos || !interactable.isInRange) continue;

			const distance = interactable.pos.dist(playerObj.pos);
			if (distance >= closestDistance) continue;

			closestInteractable = interactable;
			closestDistance = distance;
		}

		closestInteractable?.onInteract();
	});

	return playerObj;
}

function getPlayerMuzzlePos(
	playerPos: Vec2,
	localMuzzlePos: Vec2,
	worldAngle: number
): Vec2 {
	const localX = k.Vec2.fromAngle(worldAngle).scale(localMuzzlePos.x);
	const localY = k.Vec2.fromAngle(worldAngle + 90).scale(localMuzzlePos.y);
	return playerPos.add(localX).add(localY);
}

export function clearPlayer() {
	bulletIndex = 0;
	blasters = 0;
	currentMoveSpeed = 0;
	currentCameraScale = WORLD_CAMERA_SCALE;
	currentCameraPos = undefined;
	k.setCamScale(WORLD_CAMERA_SCALE);
	configuredBlasterLevel = -2;
	configuredSpaceJumpLevel = -1;
	phaseJumpCharges = 0;
	phaseJumpMaxCharges = 0;
	phaseJumpRechargeTimer = 0;
	phaseJumpInvulnerableUntil = 0;
	phaseJumpStart = undefined;
	phaseJumpEnd = undefined;
	phaseJumpElapsed = 0;
	nextPrimaryFireTime = 0;
	configuredWeaponId = "";
}

function configureBlasters(muzzleObj: GameObj<PosComp>) {
	muzzleObj.removeAll();
	blasters = 0;
	bulletIndex = 1;
	configuredBlasterLevel = player.blasterLvl ?? -1;
	const muzzleOffsetY = getEquippedWeapon().muzzleOffsetY;

	if (hasLvlValue(player.blasterLvl, 1)) {
		muzzleObj.add([k.anchor("center"), k.pos(10, muzzleOffsetY)]);
		muzzleObj.add([k.anchor("center"), k.pos(-10, muzzleOffsetY)]);
		blasters = 2;
	} else {
		muzzleObj.add([k.anchor("center"), k.pos(0, muzzleOffsetY)]);
		blasters = 1;
	}
	if (hasLvlValue(player.blasterLvl, 2)) {
		muzzleObj.add([k.anchor("center"), k.pos(0, muzzleOffsetY)]);
		blasters++;
	}
}

function getPhaseJumpConfig(): PhaseJumpConfig | undefined {
	if (player.spaceJumpLvl === undefined) return undefined;

	switch (player.spaceJumpUpgradeLvl) {
		case undefined:
			return { distance: 75, cooldown: 2.5, charges: 1 };
		case 1:
			return { distance: 90, cooldown: 2.1, charges: 1 };
		case 2:
			return { distance: 90, cooldown: 3, charges: 2 };
		default:
			return undefined;
	}
}

function configureSpaceJump() {
	const previousMaxCharges = phaseJumpMaxCharges;
	configuredSpaceJumpLevel = getSpaceJumpConfigLevel();
	const config = getPhaseJumpConfig();
	phaseJumpMaxCharges = config?.charges ?? 0;
	phaseJumpCharges = Math.min(
		phaseJumpCharges + Math.max(0, phaseJumpMaxCharges - previousMaxCharges),
		phaseJumpMaxCharges
	);
}

function getSpaceJumpConfigLevel() {
	if (player.spaceJumpLvl === undefined) return 0;
	return (player.spaceJumpUpgradeLvl ?? 0) + 1;
}

function spawnPhaseJumpEffect(start: Vec2, end: Vec2, angle: number) {
	const delta = end.sub(start);

	boostTrailEmitter.emitter.position = start;
	boostTrailEmitter.emit(8);
	boostTrailEmitter.emitter.position = end;
	boostTrailEmitter.emit(8);

	k.add([
		k.pos(start),
		k.opacity(0.8),
		k.lifespan(phaseJumpInvulnerability, { fade: 0.14 }),
		{
			draw() {
				k.drawLine({
					p1: k.vec2(),
					p2: delta,
					width: 2,
					color: k.rgb(80, 180, 255),
					opacity: this.opacity,
				});
			},
		},
		tags.gameLoop,
	]);

	for (const pos of [start, end]) {
		k.add([
			k.pos(pos),
			k.sprite("ship"),
			k.anchor("center"),
			k.rotate(angle),
			k.color(80, 180, 255),
			k.opacity(0.65),
			k.lifespan(phaseJumpInvulnerability, { fade: 0.14 }),
			tags.gameLoop,
		]);
	}

	k.shake(2);
	audioService.playSound("swap_level", {
		volume: 0.25,
		detune: 500,
	});
}

function updatePhaseJump(playerObj: GameObj<PosComp>): boolean {
	if (!phaseJumpStart || !phaseJumpEnd) return false;

	phaseJumpElapsed += dt();
	const progress = k.clamp(phaseJumpElapsed / phaseJumpDuration, 0, 1);
	const easedProgress = 1 - Math.pow(1 - progress, 3);
	playerObj.pos = phaseJumpStart.lerp(phaseJumpEnd, easedProgress);
	boostTrailEmitter.emitter.position = playerObj.pos;
	boostTrailEmitter.emitter.direction = k.Vec2.toAngle(
		phaseJumpEnd.sub(phaseJumpStart)
	);
	boostTrailEmitter.emit(2);

	if (progress >= 1) {
		phaseJumpStart = undefined;
		phaseJumpEnd = undefined;
		phaseJumpElapsed = 0;
	}

	return true;
}

export function phaseJumpActive() {
	return phaseJumpStart !== undefined && phaseJumpEnd !== undefined;
}
