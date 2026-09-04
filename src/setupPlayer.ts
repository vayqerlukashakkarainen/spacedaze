import type { GameObj, KEventController, PosComp, RotateComp, Vec2 } from "kaplay";
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
	spawnPhaseMagazineSalvo,
	spawnPrimaryLinkedRocket,
} from "./services/projectileHelpers";
import {
	lerpAngleBetweenPos,
	steerMoveRotateAndLean,
	registerHitAnimation,
} from "./shared";
import { tags } from "./tags";
import { audioService } from "./services/audioService";
import { loopService } from "./services/loopService";
import { profileSection } from "./services/frameProfilerService";
import { applyProjectileDamage } from "./services/projectileService";
import {
	applyDamage,
	resetPlayerDeathCause,
} from "./services/damageService";
import { timescale } from "./comp/timescale";
import type { GridCollisionComp } from "./comp/gridCollision";
import { levelTransitionActive } from "./services/levelTransitionService";
import type { InteractableComp } from "./comp/interactable";
import {
	getEquippedWeapon,
	getWeaponTriggerModifier,
} from "./services/weaponService";
import { spawnPlayerDeathDebris } from "./spawn/spawnPlayerDeathDebris";
import { spawnAfterburnerWake } from "./spawn/spawnAfterburnerWake";
import { spawnFlash } from "./spawn/spawnFlash";
import { spawnRing } from "./spawn/spawnRing";
import {
	resetPlayerDamageState,
	setPlayerDamageInvulnerable,
} from "./services/playerDamageState";
import { forEachSpatialNearby } from "./services/runtimeSpatialIndexService";
import { isPointerOverUi } from "./services/uiPointerService";
import {
	clearCameraBob,
	getCameraBobScale,
	startCameraBob,
} from "./services/cameraEffectService";

let blasters = 0;
let bulletIndex = 1;
let specialTimer = 0;
const rocketSpecialCooldown = 6;
const targetOffset = 64;
const playerAcceleration = 420;
const playerDeceleration = 560;
const cameraZoomLerpSpeed = 5;
const multiBlasterMountSpacing = 6;
const overclockShakeInterval = 0.12;
const overclockShakeIntensity = 0.25;
const afterburnerWakeInterval = 0.14;
const phaseJumpInvulnerability = 0.18;
const phaseJumpDuration = 0.12;
const phaseJumpCooldownBarWidth = 22;
const phaseJumpCooldownBarOffset = -22;
const normalCameraFollowSpeed = 16;
const phaseCameraFollowSpeed = 6;
const respawnTransitionDuration = 0.42;
const respawnArrivalInvulnerability = 0.35;
const respawnEntryStretch = 1.7;
const arrivalPulseDuration = 0.52;
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
const phaseJumpHitTargets = new Set<number>();
let nextPrimaryFireTime = 0;
let configuredWeaponId = "";
let overclockShakeTimer = 0;
let afterburnerWakeTimer = 0;

interface PhaseJumpConfig {
	distance: number;
	cooldown: number;
	charges: number;
}

interface SetupPlayerOptions {
	respawnTransition?: boolean;
	arrivalTransition?: boolean;
}

export function setupPlayer(options: SetupPlayerOptions = {}) {
	resetPlayerDeathCause();
	const respawnTarget = k.center();
	const respawnStart = respawnTarget.add(
		-k.width() / (WORLD_CAMERA_SCALE * 2) - 48,
		k.rand(-36, 36)
	);
	const respawnDirection = respawnTarget.sub(respawnStart);
	const respawnAngle = k.Vec2.toAngle(respawnDirection) + 90;
	let respawnTransitionActive = options.respawnTransition === true;
	let respawnTransitionElapsed = 0;
	let arrivalTransitionActive = options.arrivalTransition === true;
	let arrivalTransitionElapsed = 0;
	const playerObj = k.add([
		k.pos(respawnTransitionActive ? respawnStart : respawnTarget),
		k.sprite("ship"),
		k.rotate(respawnTransitionActive ? respawnAngle : 0),
		k.scale(
			arrivalTransitionActive
				? PLAYER_SCALE * 0.2
				: respawnTransitionActive
				? k.vec2(PLAYER_SCALE * 0.65, PLAYER_SCALE * respawnEntryStretch)
				: PLAYER_SCALE
		),
		k.health(player.maxHealth + session.extraHealth),
		k.anchor("center"),
		k.opacity(arrivalTransitionActive ? 0 : respawnTransitionActive ? 0.3 : 1),
		k.animate(),
		timescale(),
		{
			gravitySteerable: true,
			gravityVelocity: k.vec2(0),
			gravitySteeringMultiplier: 0.35,
		},
		tags.friendly,
		tags.player,
		tags.gameLoop,
	]);
	const inputControllers: KEventController[] = [];
	const scrapArmorPlates: GameObj[] = [];
	let cargoObj: GameObj | undefined;
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
	currentCameraPos = respawnTarget.clone();
	currentCameraScale = WORLD_CAMERA_SCALE;
	k.setCamPos(respawnTarget);
	k.setCamScale(WORLD_CAMERA_SCALE);
	if (respawnTransitionActive) {
		setPlayerDamageInvulnerable(true);
		spawnRespawnJumpEffect(respawnStart, respawnTarget, respawnAngle);
	}
	if (arrivalTransitionActive) {
		setPlayerDamageInvulnerable(true);
		spawnPlayerArrivalImpact(playerObj);
	}

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
	playerObj.onDestroy(() => {
		for (const controller of inputControllers) controller.cancel();
	});

	playerObj.onUpdate(() => profileSection("external:playerVisuals", () => {
		cargoObj = updateShipRewardVisuals(
			playerObj,
			scrapArmorPlates,
			cargoObj
		);
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
			playerObj.maxHP = desiredMaxHealth;
			if (addedHealth > 0) {
				playerObj.hp = Math.min(playerObj.maxHP, playerObj.hp + addedHealth);
			}
			syncPlayerHealthBarCapacity(desiredMaxHealth);
			updatePlayerHealthBar(playerObj.hp);
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
		if (arrivalTransitionActive) {
			arrivalTransitionElapsed += k.dt();
			const progress = k.clamp(
				arrivalTransitionElapsed / arrivalPulseDuration,
				0,
				1
			);
			const impactProgress = k.clamp(arrivalTransitionElapsed / 0.2, 0, 1);
			const settleProgress = k.clamp(
				(arrivalTransitionElapsed - 0.2) / (arrivalPulseDuration - 0.2),
				0,
				1
			);
			const impactEase = 1 - Math.pow(1 - impactProgress, 3);
			const settleEase = 1 - Math.pow(1 - settleProgress, 3);
			const pulseScale = arrivalTransitionElapsed < 0.2
				? k.lerp(0.2, 1.28, impactEase)
				: k.lerp(1.28, 1, settleEase);
			playerObj.scale = k.vec2(PLAYER_SCALE * pulseScale);
			playerObj.opacity = k.clamp(arrivalTransitionElapsed / 0.1, 0, 1);
			currentCameraPos = playerObj.pos.clone();
			currentCameraScale = WORLD_CAMERA_SCALE;
			k.setCamPos(currentCameraPos);
			k.setCamScale(getCameraBobScale(currentCameraScale));
			setPlayerDamageInvulnerable(true);

			if (progress >= 1) {
				arrivalTransitionActive = false;
				playerObj.scale = k.vec2(PLAYER_SCALE);
				playerObj.opacity = 1;
				phaseJumpInvulnerableUntil =
					k.time() + respawnArrivalInvulnerability;
			}
			return;
		}
		if (respawnTransitionActive) {
			respawnTransitionElapsed += k.dt();
			const progress = k.clamp(
				respawnTransitionElapsed / respawnTransitionDuration,
				0,
				1
			);
			const easedProgress = 1 - Math.pow(1 - progress, 3);
			playerObj.pos = respawnStart.lerp(respawnTarget, easedProgress);
			playerObj.angle = respawnAngle;
			playerObj.opacity = k.lerp(0.3, 1, progress);
			playerObj.scale = k.vec2(
				PLAYER_SCALE * k.lerp(0.65, 1, easedProgress),
				PLAYER_SCALE * k.lerp(respawnEntryStretch, 1, easedProgress)
			);
			currentCameraPos = respawnTarget.clone();
			currentCameraScale = WORLD_CAMERA_SCALE;
			k.setCamPos(respawnTarget);
			k.setCamScale(WORLD_CAMERA_SCALE);
			setPlayerDamageInvulnerable(true);

			boostTrailEmitter.emitter.position = playerObj.pos;
			boostTrailEmitter.emitter.direction = k.Vec2.toAngle(respawnDirection);
			boostTrailEmitter.emit(3);

			if (progress >= 1) {
				respawnTransitionActive = false;
				playerObj.pos = respawnTarget.clone();
				playerObj.scale = k.vec2(PLAYER_SCALE);
				playerObj.opacity = 1;
				phaseJumpInvulnerableUntil =
					k.time() + respawnArrivalInvulnerability;
				starsEmitter.emitter.position = respawnTarget;
				starsEmitter.emit(24);
				spawnFlash(respawnTarget, 10, k.rgb(80, 180, 255));
				k.shake(3);
			}
			return;
		}

		const isPhaseJumping = updatePhaseJump(playerObj);
		setPlayerDamageInvulnerable(
			isPhaseJumping || k.time() < phaseJumpInvulnerableUntil
		);
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
		if (isBoosting && player.afterburnerWake !== undefined) {
			afterburnerWakeTimer -= dt();
			if (afterburnerWakeTimer <= 0) {
				spawnAfterburnerWake({
					pos: playerObj.pos.add(
						k.Vec2.fromAngle(playerObj.angle + 90).scale(14)
					),
					enhanced: player.mobilitySetBonus,
				});
				afterburnerWakeTimer = afterburnerWakeInterval;
			}
		} else {
			afterburnerWakeTimer = 0;
		}
		const targetCameraScale = isBoosting
			? WORLD_CAMERA_SCALE * 0.9
			: WORLD_CAMERA_SCALE;
		currentCameraScale = k.lerp(
			currentCameraScale,
			targetCameraScale,
			1 - Math.exp(-cameraZoomLerpSpeed * dt())
		);
		k.setCamScale(getCameraBobScale(currentCameraScale));

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
			steerMoveRotateAndLean(
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
	}));

	playerObj.onHurt(() => {
		audioService.playSound("hit2", { volume: mainSoundVolume });
		playerObj.animation.seek(0);
		k.shake(20);
		k.flash(k.RED, 0.4);
		updatePlayerHealthBar(playerObj.hp);
	});

	const firePrimaryWeapon = () => {
		if (isPointerOverUi()) return;
		if (levelTransitionActive() || respawnTransitionActive) return;
		const weapon = getEquippedWeapon();
		const triggerModifier = getWeaponTriggerModifier(weapon);
		if (triggerModifier.usesCooldown) {
			if (k.time() < nextPrimaryFireTime) return;
			nextPrimaryFireTime = k.time() + weapon.fireCooldown;
		}
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

	playerObj.onUpdate(() => profileSection("external:playerWeaponHold", () => {
		if (!k.isMouseDown("left")) return;
		if (getWeaponTriggerModifier(getEquippedWeapon()).mode !== "hold") return;
		firePrimaryWeapon();
	}));

	inputControllers.push(k.onMousePress("left", () => {
		if (getWeaponTriggerModifier(getEquippedWeapon()).mode !== "press") return;
		firePrimaryWeapon();
	}));

	inputControllers.push(k.onMousePress("right", () => {
		if (levelTransitionActive() || respawnTransitionActive) return;
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
	}));

	playerObj.onKeyDown("shift", () => {
		if (respawnTransitionActive) return;
		if (player.canSprint === undefined) return;
		player.speedPwrUpMultiplier = player.sprintSpeedMultiplier;
	});
	playerObj.onKeyRelease("shift", () => {
		player.speedPwrUpMultiplier = 1;
	});

	playerObj.onKeyPress("space", () => {
		if (levelTransitionActive() || respawnTransitionActive) return;
		const config = getPhaseJumpConfig();
		if (!config || phaseJumpCharges <= 0 || phaseJumpEnd) return;

		const jumpDirection = k.Vec2.fromAngle(playerObj.angle - 90);
		const startPos = playerObj.pos.clone();
		const destination = startPos.add(jumpDirection.scale(config.distance));
		const gridCollision = playerObj.has("gridCollision")
			? (playerObj.c("gridCollision") as GridCollisionComp)
			: undefined;
		if (gridCollision && !gridCollision.canMoveTo(destination)) {
			spawnFlash(destination, 6, k.rgb(255, 70, 70));
			audioService.playSound("error", { volume: mainSoundVolume * 0.35 });
			return;
		}

		phaseJumpCharges--;
		if (phaseJumpCharges === phaseJumpMaxCharges - 1) {
			phaseJumpRechargeTimer = 0;
		}
		phaseJumpInvulnerableUntil = k.time() + phaseJumpInvulnerability;
		setPlayerDamageInvulnerable(true);
		phaseJumpStart = startPos;
		phaseJumpEnd = destination;
		phaseJumpElapsed = 0;
		phaseJumpHitTargets.clear();
		spawnPhaseJumpEffect(startPos, destination, playerObj.angle);
	});

	playerObj.onKeyPress("f", () => {
		if (levelTransitionActive() || respawnTransitionActive) return;
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

function spawnPlayerArrivalImpact(playerObj: GameObj<PosComp>) {
	audioService.playSound("player_arrival_impact", {
		volume: mainSoundVolume,
	});
	starsEmitter.emitter.position = playerObj.pos;
	starsEmitter.emit(32);
	spawnFlash(playerObj.pos, 14, k.rgb(150, 235, 255));
	spawnRing({
		pos: playerObj.pos.clone(),
		speed: 820,
		intensity: 1.15,
		maxRadius: 620,
		effectWidth: 72,
		outlineWidth: 5,
		visualOpacity: 0.95,
		visualize: true,
		color: k.rgb(120, 225, 255),
		shader: "arrivalShockwave",
		affectAllSprites: true,
		excludeIds: [playerObj.id],
	});
	startCameraBob({
		strength: 0.09,
		duration: 0.85,
		oscillations: 3.25,
	});
	k.shake(4);
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
	clearCameraBob();
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
	phaseJumpHitTargets.clear();
	resetPlayerDamageState();
	nextPrimaryFireTime = 0;
	configuredWeaponId = "";
	afterburnerWakeTimer = 0;
}

function updateShipRewardVisuals(
	playerObj: GameObj<PosComp>,
	plates: GameObj[],
	cargo: GameObj | undefined
) {
	while (plates.length < session.scrapArmorCharges) {
		plates.push(
			playerObj.add([
				k.sprite("particle2"),
				k.anchor("center"),
				k.scale(1.05),
				k.color(90, 210, 255),
				k.z(2),
			])
		);
	}
	while (plates.length > session.scrapArmorCharges) {
		const plate = plates.pop();
		if (plate) k.destroy(plate);
	}
	for (let index = 0; index < plates.length; index++) {
		const angle = k.time() * 70 + index * (360 / plates.length);
		plates[index].pos = k.Vec2.fromAngle(angle).scale(18 / PLAYER_SCALE);
	}

	const shouldShowCargo =
		session.volatileCargoActive &&
		session.volatileCargoIntact &&
		!session.volatileCargoDelivered;
	if (shouldShowCargo && !cargo) {
		cargo = playerObj.add([
			k.pos(0, 19 / PLAYER_SCALE),
			k.sprite("crate1"),
			k.anchor("center"),
			k.rotate(0),
			k.scale(0.38 / PLAYER_SCALE),
			k.color(255, 145, 45),
			k.z(-2),
		]);
	}
	if (!shouldShowCargo && cargo) {
		k.destroy(cargo);
		cargo = undefined;
	}
	if (cargo) cargo.angle = -playerObj.angle + k.wave(-4, 4, k.time() * 2);
	return cargo;
}

function configureBlasters(muzzleObj: GameObj<PosComp>) {
	muzzleObj.removeAll();
	blasters = 0;
	bulletIndex = 1;
	configuredBlasterLevel = player.blasterLvl ?? -1;
	const muzzleOffsetY = getEquippedWeapon().muzzleOffsetY;

	if (hasLvlValue(player.blasterLvl, 1)) {
		muzzleObj.add([
			k.anchor("center"),
			k.pos(multiBlasterMountSpacing, muzzleOffsetY),
		]);
		muzzleObj.add([
			k.anchor("center"),
			k.pos(-multiBlasterMountSpacing, muzzleOffsetY),
		]);
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

function spawnRespawnJumpEffect(start: Vec2, end: Vec2, angle: number) {
	const delta = end.sub(start);
	const afterimageCount = 6;

	boostTrailEmitter.emitter.position = start;
	boostTrailEmitter.emitter.direction = k.Vec2.toAngle(delta);
	boostTrailEmitter.emit(16);

	k.add([
		k.pos(start),
		k.opacity(0.75),
		k.lifespan(respawnTransitionDuration, { fade: 0.28 }),
		{
			draw() {
				k.drawLine({
					p1: k.vec2(),
					p2: delta,
					width: 3,
					color: k.rgb(80, 180, 255),
					opacity: this.opacity,
				});
			},
		},
		tags.gameLoop,
	]);

	for (let index = 0; index < afterimageCount; index++) {
		const progress = (index + 1) / (afterimageCount + 1);
		k.add([
			k.pos(start.lerp(end, progress)),
			k.sprite("ship"),
			k.anchor("center"),
			k.rotate(angle),
			k.scale(PLAYER_SCALE * k.lerp(0.7, 1, progress)),
			k.color(80, 180, 255),
			k.opacity(k.lerp(0.16, 0.48, progress)),
			k.lifespan(respawnTransitionDuration, { fade: 0.25 }),
			tags.gameLoop,
		]);
	}

	audioService.playSound("swap_level", {
		volume: 0.45,
		detune: 350,
	});
}

function updatePhaseJump(playerObj: GameObj<PosComp>): boolean {
	if (!phaseJumpStart || !phaseJumpEnd) return false;

	phaseJumpElapsed += dt();
	const progress = k.clamp(phaseJumpElapsed / phaseJumpDuration, 0, 1);
	const easedProgress = 1 - Math.pow(1 - progress, 3);
	const previousPos = playerObj.pos.clone();
	playerObj.pos = phaseJumpStart.lerp(phaseJumpEnd, easedProgress);
	applyPhaseRamDamage(previousPos, playerObj.pos);
	boostTrailEmitter.emitter.position = playerObj.pos;
	boostTrailEmitter.emitter.direction = k.Vec2.toAngle(
		phaseJumpEnd.sub(phaseJumpStart)
	);
	boostTrailEmitter.emit(2);

	if (progress >= 1) {
		if (player.phaseMagazine !== undefined) {
			spawnPhaseMagazineSalvo(playerObj.pos.clone());
		}
		phaseJumpStart = undefined;
		phaseJumpEnd = undefined;
		phaseJumpElapsed = 0;
		phaseJumpHitTargets.clear();
	}

	return true;
}

function applyPhaseRamDamage(start: Vec2, end: Vec2) {
	if (player.spaceJumpDamage <= 0) return;
	const midpoint = start.lerp(end, 0.5);
	const candidateRadius = start.dist(end) * 0.5 + 72;
	forEachSpatialNearby(midpoint, candidateRadius, {
		allTags: [tags.unit, tags.enemy],
	}, (target) => {
		if (
			!target.exists() ||
			phaseJumpHitTargets.has(target.id) ||
			typeof target.hp !== "number"
		) return;

		const hitRadius = Math.max(10, Number(target.hb) || 0) + 8;
		if (distanceToSegment(target.pos, start, end) > hitRadius) return;
		if (!applyDamage(target, player.spaceJumpDamage)) return;

		phaseJumpHitTargets.add(target.id);
		spawnFlash(target.pos.clone(), 7, k.rgb(80, 180, 255));
	});
}

function distanceToSegment(point: Vec2, start: Vec2, end: Vec2) {
	const deltaX = end.x - start.x;
	const deltaY = end.y - start.y;
	const lengthSquared = deltaX * deltaX + deltaY * deltaY;
	if (lengthSquared <= 0) return point.dist(start);

	const projection = k.clamp(
		((point.x - start.x) * deltaX + (point.y - start.y) * deltaY) /
			lengthSquared,
		0,
		1
	);
	return point.dist(k.vec2(
		start.x + deltaX * projection,
		start.y + deltaY * projection
	));
}

export function phaseJumpActive() {
	return phaseJumpStart !== undefined && phaseJumpEnd !== undefined;
}
