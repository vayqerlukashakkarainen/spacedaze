import type { GameObj, KEventController, PosComp, RotateComp, Vec2 } from "kaplay";
import { beginPlayerDeathSequence, checkProjectileIntersection } from "./game";
import {
	syncPlayerHealthBarCapacity,
	flashEmptySecondarySocket,
	flashEmptyMobilitySocket,
	flashEmptyUltimateSocket,
	updatePlayerHealthBar,
	updatePhaseJumpUi,
	updateSpecialBar,
	updateUltimateUi,
} from "./ui/gameUi";
import {
	dt,
	k,
	layers,
	mainSoundVolume,
	timeScale,
	WORLD_CAMERA_SCALE,
} from "./main";
import {
	boostTrailEmitter,
	starsEmitter,
	trailEmitter,
} from "./particles";
import { getPlayerMaxHealth, hasLvlValue, player, PLAYER_SCALE, session } from "./player";
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
import type { WeaponDefinition } from "./services/weaponService";
import { spawnPlayerDeathDebris } from "./spawn/spawnPlayerDeathDebris";
import { getCarriedDebree } from "./services/debreeEconomyService";
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
import {
	constrainToRunFinaleBattleZone,
} from "./services/runFinaleArenaService";
import { dialogOpen } from "./services/dialogService";
import {
	beginActiveModuleActivation,
	getActiveModuleCooldownRemaining,
	getEquippedActiveModule,
	updateActiveModuleCooldown,
} from "./services/activeModuleService";
import { createExplosion } from "./services/explosionService";
import { damageDestructibleWallsInRadius } from "./services/destructibleWallService";
import { spawnGravityPull } from "./spawn/spawnGravityPull";
import { getEnemyMovementMultiplier } from "./services/enemyMovementModifierService";
import {
	clearPlayerStatusEffects,
	getPlayerStatusMultiplier,
	updatePlayerStatusEffects,
} from "./services/playerStatusEffectService";
import { spawnFollower } from "./spawn/spawnFollower";
import {
	getEquippedMobilityAbilityId,
	getEquippedUltimateAbilityId,
} from "./services/abilityLoadoutService";
import {
	consumeUltimateCharge,
	getUltimateChargeProgress,
} from "./services/ultimateAbilityService";
import { getAbilityDefinition } from "./services/abilityRegistry";
import { playRequirementErrorSound } from "./services/uiSoundService";

let blasters = 0;
let bulletIndex = 1;
const targetOffset = 64;
const playerAcceleration = 420;
const playerDeceleration = 560;
const cameraZoomLerpSpeed = 5;
const multiBlasterMountSpacing = 6;
const overclockShakeInterval = 0.12;
const overclockShakeIntensity = 0.25;
const afterburnerWakeInterval = 0.14;
const phaseJumpAfterimageDuration = 0.18;
const phaseJumpPostInvulnerability = 0.6;
const phaseJumpDuration = 0.12;
const phaseJumpCooldownBarWidth = 22;
const phaseJumpCooldownBarOffset = -22;
const normalCameraFollowSpeed = 16;
const phaseCameraFollowSpeed = 6;
const respawnTransitionDuration = 0.42;
const respawnArrivalInvulnerability = 0.35;
const respawnEntryStretch = 1.7;
const arrivalPulseDuration = 0.52;
const reactivePlatingCooldown = 3;
const empTimescaleModifierId = 87021;
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
let reactivePlatingReadyAt = 0;
let repairPulseGeneration = 0;

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
	repairPulseGeneration++;
	reactivePlatingReadyAt = 0;
	const respawnTarget = k.center();
	const respawnStart = respawnTarget.add(
		-k.width() / (WORLD_CAMERA_SCALE * 2) - 48,
		k.rand(-36, 36)
	);
	const respawnDirection = respawnTarget.sub(respawnStart);
	const respawnAngle = k.Vec2.toAngle(respawnDirection) + 90;
	const arrivalDirection = k.Vec2.fromAngle(-90);
	const arrivalStart = respawnTarget.sub(arrivalDirection.scale(72));
	const arrivalEnd = respawnTarget.add(arrivalDirection.scale(28));
	let respawnTransitionActive = options.respawnTransition === true;
	let respawnTransitionElapsed = 0;
	let arrivalTransitionActive = options.arrivalTransition === true;
	let arrivalTransitionElapsed = 0;
	let arrivalImpactStarted = false;
	const playerObj = k.add([
		k.pos(
			arrivalTransitionActive
				? arrivalStart
				: respawnTransitionActive
					? respawnStart
					: respawnTarget
		),
		k.sprite("ship"),
		k.color(k.WHITE),
		k.rotate(respawnTransitionActive ? respawnAngle : 0),
		k.scale(
			arrivalTransitionActive
				? PLAYER_SCALE * 0.2
				: respawnTransitionActive
				? k.vec2(PLAYER_SCALE * 0.65, PLAYER_SCALE * respawnEntryStretch)
				: PLAYER_SCALE
		),
		k.health(getPlayerMaxHealth()),
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
	clearPlayerStatusEffects();
	const inputControllers: KEventController[] = [];
	const readinessFlashQueue: ReturnType<typeof k.rgb>[] = [];
	let readinessFlashActive = false;
	let readinessStateInitialized = false;
	let previousModuleId = "";
	let moduleWasReady = false;
	let previousMobilityId = "";
	let mobilityWasReady = false;
	let previousUltimateId = "";
	let ultimateWasReady = false;
	const playNextReadinessFlash = () => {
		if (readinessFlashActive || readinessFlashQueue.length === 0) return;
		if (!playerObj.exists()) return;
		const color = readinessFlashQueue.shift();
		if (!color) return;
		readinessFlashActive = true;
		spawnPlayerReadinessFlash(playerObj, color);
		k.wait(0.38, () => {
			readinessFlashActive = false;
			if (!playerObj.exists()) return;
			playNextReadinessFlash();
		});
	};
	const queueReadinessFlash = (color: ReturnType<typeof k.rgb>) => {
		readinessFlashQueue.push(color);
		playNextReadinessFlash();
	};
	const updateAbilityReadinessFeedback = (
		moduleId: string,
		moduleReady: boolean,
		mobilityId: string,
		mobilityReady: boolean,
		ultimateId: string,
		ultimateReady: boolean
	) => {
		if (readinessStateInitialized) {
			if (
				moduleReady &&
				(!moduleWasReady || moduleId !== previousModuleId)
			) queueReadinessFlash(k.rgb(255, 145, 45));
			if (
				mobilityReady &&
				(!mobilityWasReady || mobilityId !== previousMobilityId)
			) queueReadinessFlash(k.rgb(80, 180, 255));
			if (
				ultimateReady &&
				(!ultimateWasReady || ultimateId !== previousUltimateId)
			) queueReadinessFlash(k.rgb(255, 70, 70));
		}
		readinessStateInitialized = true;
		previousModuleId = moduleId;
		moduleWasReady = moduleReady;
		previousMobilityId = mobilityId;
		mobilityWasReady = mobilityReady;
		previousUltimateId = ultimateId;
		ultimateWasReady = ultimateReady;
	};
	let primaryChargeStartedAt: number | undefined;
	let primaryChargeWeaponId = "";
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
		spawnPlayerDeathDebris(deathPos, getCarriedDebree());
		audioService.playSound("explosion1", { volume: mainSoundVolume });
		beginPlayerDeathSequence();
	});
	playerObj.onDestroy(() => {
		for (const controller of inputControllers) controller.cancel();
	});

	playerObj.onUpdate(() => profileSection("external:playerVisuals", () => {
		updatePlayerStatusEffects(dt());
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
		const primaryChargeProgress = currentWeapon.charge &&
			primaryChargeStartedAt !== undefined
			? k.clamp(
				(k.time() - primaryChargeStartedAt) / currentWeapon.charge.maxDuration,
				0,
				1
			)
			: 0;
		weaponVisual.color = k.rgb(
			145 + 90 * primaryChargeProgress,
			155 + 75 * primaryChargeProgress,
			165 + 90 * primaryChargeProgress
		);
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
		} else if (getEquippedMobilityAbilityId() === "thrusterOverdrive") {
			updatePhaseJumpUi(1, 1, 1);
		} else {
			updatePhaseJumpUi(0, 1, 0);
		}

		const desiredMaxHealth = getPlayerMaxHealth();
		if (playerObj.maxHP !== desiredMaxHealth) {
			const addedHealth = Math.max(0, desiredMaxHealth - playerObj.maxHP);
			playerObj.maxHP = desiredMaxHealth;
			if (addedHealth > 0) {
				playerObj.hp = Math.min(playerObj.maxHP, playerObj.hp + addedHealth);
			}
			syncPlayerHealthBarCapacity(desiredMaxHealth);
			updatePlayerHealthBar(playerObj.hp);
		}

		updateActiveModuleCooldown(dt());
		const activeModule = getEquippedActiveModule();
		const activeCooldownRemaining = getActiveModuleCooldownRemaining();
		const activeCooldown = activeModule?.cooldown ?? 1;
		updateSpecialBar(
			activeCooldown - activeCooldownRemaining,
			activeCooldown,
			activeModule
		);
		const ultimateId = getEquippedUltimateAbilityId();
		const ultimateProgress = getUltimateChargeProgress();
		updateUltimateUi(
			ultimateProgress,
			ultimateId ? getAbilityDefinition(ultimateId) : undefined
		);
		const mobilityId = getEquippedMobilityAbilityId();
		updateAbilityReadinessFeedback(
			activeModule?.id ?? "",
			activeModule !== undefined && activeCooldownRemaining <= 0,
			mobilityId ?? "",
			mobilityId === "thrusterOverdrive" ||
				(mobilityId === "phaseJump" && phaseJumpCharges > 0),
			ultimateId ?? "",
			ultimateId !== undefined && ultimateProgress >= 1
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
			playerObj.pos = arrivalStart.lerp(arrivalEnd, impactEase);
			if (!arrivalImpactStarted && arrivalTransitionElapsed >= 0.16) {
				arrivalImpactStarted = true;
				spawnPlayerArrivalImpact(playerObj);
			}
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
				playerObj.pos = arrivalEnd.clone();
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
		constrainToRunFinaleBattleZone(playerObj.pos, 16);
		const isInvulnerable =
			isPhaseJumping || k.time() < phaseJumpInvulnerableUntil;
		setPlayerDamageInvulnerable(isInvulnerable);
		playerObj.opacity = isInvulnerable ? 0.35 : 1;
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
			player.speed *
			player.speedMultiplier *
			player.speedPwrUpMultiplier *
			getEnemyMovementMultiplier();
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
			getEquippedMobilityAbilityId() === "thrusterOverdrive" &&
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
		constrainToRunFinaleBattleZone(playerObj.pos, 16);

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
		repairPulseGeneration++;
		triggerReactivePlating(playerObj);
		audioService.playSound("hit2", { volume: mainSoundVolume });
		playerObj.animation.seek(0);
		k.shake(20);
		k.flash(k.RED, 0.4);
		updatePlayerHealthBar(playerObj.hp);
	});

	const canFirePrimaryWeapon = () => {
		if (dialogOpen()) return;
		if (isPointerOverUi()) return;
		if (levelTransitionActive() || respawnTransitionActive) return;
		return true;
	};

	const fireWeaponVolley = (
		weapon: WeaponDefinition,
		chargeRatio: number,
		playFireSound: boolean
	) => {
		if (!playerObj.exists() || getEquippedWeapon().id !== weapon.id) return;
		if (dialogOpen() || levelTransitionActive() || respawnTransitionActive) return;
		const charge = weapon.charge;
		const damageMultiplier = charge
			? k.lerp(
				charge.minDamageMultiplier,
				charge.maxDamageMultiplier,
				chargeRatio
			)
			: 1;
		const speedMultiplier = charge
			? k.lerp(
				charge.minSpeedMultiplier ?? 1,
				charge.maxSpeedMultiplier ?? 1,
				chargeRatio
			)
			: 1;

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

		const projectileCount = Math.max(
			1,
			Math.floor(weapon.pattern?.projectileCount ?? 1)
		);
		const patternSpread = weapon.pattern?.spreadDegrees ?? 0;
		let shouldPlayFireSound = playFireSound;
		const fireFromMuzzle = (muzzlePos: Vec2) => {
			for (let index = 0; index < projectileCount; index++) {
				const angleOffset = projectileCount === 1
					? 0
					: -patternSpread / 2 + patternSpread * index / (projectileCount - 1);
				spawnPlayerBlaster(
					muzzlePos,
					k.Vec2.fromAngle(turretWorldAngle - 90),
					turretWorldAngle,
					{
						angleOffset,
						damageMultiplier,
						speedMultiplier,
						playFireSound: shouldPlayFireSound,
					}
				);
				shouldPlayFireSound = false;
			}
		};

		if (hasLvlValue(player.blasterParallel, 1)) {
			for (let index = 0; index < blasters; index++) {
				const gunPipe = muzzleObj.children[index];
				fireFromMuzzle(
					getPlayerMuzzlePos(playerObj.pos, gunPipe.pos, turretWorldAngle)
				);
			}
			return;
		}

		const gunPipe = muzzleObj.children[bulletIndex % blasters];
		fireFromMuzzle(
			getPlayerMuzzlePos(playerObj.pos, gunPipe.pos, turretWorldAngle)
		);
		bulletIndex++;
	};

	const firePrimaryWeapon = (chargeRatio: number = 1) => {
		if (!canFirePrimaryWeapon()) return;
		const weapon = getEquippedWeapon();
		const triggerModifier = getWeaponTriggerModifier(weapon);
		if (triggerModifier.usesCooldown) {
			if (k.time() < nextPrimaryFireTime) return;
			nextPrimaryFireTime = k.time() +
				weapon.fireCooldown * getPlayerStatusMultiplier("weaponRecovery");
		}
		const burstCount = Math.max(1, Math.floor(weapon.pattern?.burstCount ?? 1));
		const burstInterval = weapon.pattern?.burstInterval ?? 0;
		for (let index = 0; index < burstCount; index++) {
			const fireRound = () => fireWeaponVolley(
				weapon,
				k.clamp(chargeRatio, 0, 1),
				true
			);
			if (index === 0) fireRound();
			else k.wait(index * burstInterval, fireRound);
		}
	};

	playerObj.onUpdate(() => profileSection("external:playerWeaponHold", () => {
		if (!k.isMouseDown("left")) return;
		if (getWeaponTriggerModifier(getEquippedWeapon()).mode !== "hold") return;
		firePrimaryWeapon();
	}));

	inputControllers.push(k.onMousePress("left", () => {
		const weapon = getEquippedWeapon();
		const mode = getWeaponTriggerModifier(weapon).mode;
		if (mode === "press") {
			firePrimaryWeapon();
			return;
		}
		if (mode !== "charge" || !canFirePrimaryWeapon()) return;
		primaryChargeStartedAt = k.time();
		primaryChargeWeaponId = weapon.id;
	}));

	inputControllers.push(k.onMouseRelease("left", () => {
		if (primaryChargeStartedAt === undefined) return;
		const weapon = getEquippedWeapon();
		const chargeStartedAt = primaryChargeStartedAt;
		primaryChargeStartedAt = undefined;
		if (
			weapon.id !== primaryChargeWeaponId ||
			getWeaponTriggerModifier(weapon).mode !== "charge" ||
			!weapon.charge
		) return;
		const chargeRatio = k.clamp(
			(k.time() - chargeStartedAt) / weapon.charge.maxDuration,
			0,
			1
		);
		firePrimaryWeapon(chargeRatio);
	}));

	inputControllers.push(k.onMousePress("right", () => {
		if (dialogOpen()) return;
		if (levelTransitionActive() || respawnTransitionActive) return;
		if (!getEquippedActiveModule()) {
			flashEmptySecondarySocket();
			playRequirementErrorSound();
			return;
		}
		const activeModule = beginActiveModuleActivation();
		if (!activeModule) return;
		activateModule(activeModule.id, playerObj, turretWorldAngle);
	}));

	playerObj.onKeyDown("shift", () => {
		if (respawnTransitionActive) return;
		if (getEquippedMobilityAbilityId() !== "thrusterOverdrive") return;
		player.speedPwrUpMultiplier = Math.max(1.2, player.sprintSpeedMultiplier);
	});
	playerObj.onKeyRelease("shift", () => {
		player.speedPwrUpMultiplier = 1;
	});

	playerObj.onKeyPress("space", () => {
		if (dialogOpen()) return;
		if (levelTransitionActive() || respawnTransitionActive) return;
		if (!getEquippedMobilityAbilityId()) {
			flashEmptyMobilitySocket();
			playRequirementErrorSound();
			return;
		}
		const config = getPhaseJumpConfig();
		if (!config || phaseJumpCharges <= 0 || phaseJumpEnd) return;

		const jumpDirection = k.Vec2.fromAngle(playerObj.angle - 90);
		const startPos = playerObj.pos.clone();
		const destination = startPos.add(jumpDirection.scale(config.distance));
		constrainToRunFinaleBattleZone(destination, 16);
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
		setPlayerDamageInvulnerable(true);
		phaseJumpStart = startPos;
		phaseJumpEnd = destination;
		phaseJumpElapsed = 0;
		phaseJumpHitTargets.clear();
		spawnPhaseJumpEffect(startPos, destination, playerObj.angle);
	});

	playerObj.onKeyPress("q", () => {
		if (dialogOpen()) return;
		if (levelTransitionActive() || respawnTransitionActive) return;
		const ultimateId = getEquippedUltimateAbilityId();
		if (!ultimateId) {
			flashEmptyUltimateSocket();
			playRequirementErrorSound();
			return;
		}
		if (ultimateId !== "phaseNova") return;
		if (!consumeUltimateCharge()) return;
		activatePhaseNova(playerObj);
	});

	playerObj.onKeyPress("f", () => {
		if (dialogOpen()) return;
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
	startCameraBob({
		strength: 0.09,
		duration: 0.85,
		oscillations: 3.25,
	});
	k.shake(4);
}

function spawnPlayerReadinessFlash(
	playerObj: GameObj,
	color: ReturnType<typeof k.rgb>
) {
	spawnFlash(playerObj.pos.clone(), 8, color);
	playerObj.color = color;
	k.wait(0.1, () => {
		if (playerObj.exists()) playerObj.color = k.WHITE;
	});
	k.wait(0.18, () => {
		if (playerObj.exists()) playerObj.color = color;
	});
	k.wait(0.3, () => {
		if (playerObj.exists()) playerObj.color = k.WHITE;
	});
	const pulse = playerObj.add([
		k.sprite("ship"),
		k.anchor("center"),
		k.color(color),
		k.opacity(0),
		k.scale(1),
		k.z(20),
		k.animate(),
	]);
	pulse.animate("opacity", [0, 1, 0.08, 0.9, 0], {
		duration: 0.36,
		loops: 1,
		timing: [0, 0.18, 0.48, 0.7, 1],
	});
	pulse.animate(
		"scale",
		[k.vec2(1), k.vec2(1.16), k.vec2(1), k.vec2(1.1), k.vec2(1)],
		{
			duration: 0.36,
			loops: 1,
			timing: [0, 0.18, 0.48, 0.7, 1],
		}
	);
	k.wait(0.38, () => {
		if (pulse.exists()) k.destroy(pulse);
	});
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
	if (getEquippedMobilityAbilityId() !== "phaseJump") return undefined;

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

function activateModule(
	moduleId: string,
	playerObj: GameObj<PosComp>,
	turretWorldAngle: number
) {
	const direction = k.Vec2.fromAngle(turretWorldAngle - 90);
	const targetPos = getActiveModuleTarget(playerObj.pos, 220);

	switch (moduleId) {
		case "rocketPod":
			loopService.loop(
				0.1,
				() => {
					if (!playerObj.exists()) return;
					spawnPlayerRocket(
						playerObj.pos,
						direction,
						turretWorldAngle
					);
				},
				player.nrOfRockets + session.extraRockets
			);
			return;

		case "kineticBarrier": {
			playerObj.activeModuleInvulnerable = true;
			const barrier = playerObj.add([
				k.circle(25, { fill: false }),
				k.anchor("center"),
				k.outline(2, k.rgb(90, 200, 255)),
				k.opacity(0.85),
				k.layer(layers.gameEffects),
				k.lifespan(1.6, { fade: 0.35 }),
			]);
			barrier.onUpdate(() => {
				barrier.scale = k.vec2(k.wave(0.94, 1.08, k.time() * 7));
			});
			barrier.onDestroy(() => {
				if (playerObj.exists()) playerObj.activeModuleInvulnerable = false;
			});
			spawnRing({
				pos: playerObj.pos.clone(),
				speed: 180,
				intensity: 0.18,
				maxRadius: 36,
				color: k.rgb(90, 200, 255),
			});
			audioService.playSound("swap_level", {
				volume: mainSoundVolume * 0.6,
				detune: 650,
			});
			return;
		}

		case "gravityCharge": {
			const gravity = spawnGravityPull({
				pos: targetPos,
				radius: 105,
				strength: 42,
				falloff: 1.2,
				visualizePull: true,
				targetTags: [
					tags.enemy,
					tags.projectile,
					tags.debree,
				],
				tagStrengthMultipliers: {
					[tags.projectile]: 1.8,
					[tags.debree]: 1.4,
				},
			});
			const core = k.add([
				k.pos(targetPos),
				k.sprite("active_gravity_charge"),
				k.anchor("center"),
				k.scale(0.75),
				k.rotate(0),
				k.color(150, 100, 255),
				k.layer(layers.gameEffects),
				tags.props,
				tags.gameLoop,
			]);
			core.onUpdate(() => {
				core.angle += 150 * dt();
				core.scale = k.vec2(k.wave(0.65, 0.9, k.time() * 6));
			});
			spawnRing({
				pos: targetPos,
				speed: 55,
				intensity: 0.28,
				maxRadius: 105,
				color: k.rgb(150, 100, 255),
			});
			k.wait(2.4, () => {
				if (gravity.exists()) k.destroy(gravity);
				if (core.exists()) k.destroy(core);
				createExplosion({
					pos: targetPos,
					radius: 58,
					damage: 10,
					visualIntensity: 0.75,
					visualParticleCount: 30,
				});
				audioService.playPositionalSound("explosion1", targetPos, {
					volume: mainSoundVolume,
				});
				k.shake(4);
			});
			return;
		}

		case "breachCharge": {
			const charge = k.add([
				k.pos(targetPos),
				k.sprite("active_breach_charge"),
				k.anchor("center"),
				k.scale(0.75),
				k.rotate(turretWorldAngle),
				k.color(k.WHITE),
				k.opacity(1),
				k.layer(layers.gameEffects),
				tags.props,
				tags.gameLoop,
			]);
			charge.onUpdate(() => {
				charge.opacity = k.wave(0.25, 1, k.time() * 18);
			});
			audioService.playSound("click1", { volume: mainSoundVolume * 0.6 });
			k.wait(0.7, () => {
				if (charge.exists()) k.destroy(charge);
				createExplosion({
					pos: targetPos,
					radius: 70,
					damage: 28,
					visualIntensity: 1,
					visualParticleCount: 42,
				});
				damageDestructibleWallsInRadius(targetPos, 72, 28);
				audioService.playPositionalSound("explosion1", targetPos, {
					volume: mainSoundVolume,
				});
				k.shake(7);
			});
			return;
		}

		case "droneBeacon":
			for (let index = 0; index < 2; index++) {
				const drone = spawnFollower({
					hp: 1,
					blasterDmg: Math.max(1, player.followerBlasterDmg),
					speed: player.speed * 1.15,
					follow: playerObj,
					deploymentStart: targetPos.add(index === 0 ? -12 : 12, 0),
				});
				drone.temporaryActiveModuleDrone = true;
				k.wait(12, () => {
					if (drone.exists()) k.destroy(drone);
				});
			}
			spawnRing({
				pos: targetPos,
				speed: 160,
				intensity: 0.2,
				maxRadius: 52,
				color: k.rgb(80, 220, 150),
			});
			return;

		case "repairPulse": {
			const generation = ++repairPulseGeneration;
			const channelDuration = 1.5;
			const pulseInterval = 0.25;
			for (let step = 1; step <= channelDuration / pulseInterval; step++) {
				k.wait(step * pulseInterval, () => {
					if (!playerObj.exists() || generation !== repairPulseGeneration) return;
					spawnRing({
						pos: playerObj.pos.clone(),
						speed: 90,
						intensity: 0.12,
						maxRadius: 30,
						color: k.rgb(80, 255, 175),
					});
					if (step < channelDuration / pulseInterval) return;
					const maxHp = typeof playerObj.maxHP === "number"
						? playerObj.maxHP
						: player.maxHealth;
					playerObj.hp = Math.min(maxHp, playerObj.hp + 1);
					updatePlayerHealthBar(playerObj.hp);
					spawnFlash(playerObj.pos, 10, k.rgb(80, 255, 175));
					audioService.playSound("collect1", {
						volume: mainSoundVolume * 0.65,
						detune: 420,
					});
				});
			}
			return;
		}

		case "empBeacon": {
			const origin = playerObj.pos.clone();
			spawnRing({
				pos: origin,
				speed: 320,
				intensity: 0.45,
				maxRadius: 150,
				color: k.rgb(75, 205, 255),
			});
			spawnFlash(origin, 12, k.rgb(75, 205, 255));
			forEachSpatialNearby(origin, 150, {
				allTags: [tags.enemy, tags.unit],
			}, (enemy) => {
				if (!(enemy.timescaleModifiers instanceof Map)) return;
				enemy.timescaleModifiers.set(empTimescaleModifierId, 0.05);
				k.wait(3, () => {
					if (enemy.exists() && enemy.timescaleModifiers instanceof Map) {
						enemy.timescaleModifiers.delete(empTimescaleModifierId);
					}
				});
			});
			audioService.playSound("swap_level", {
				volume: mainSoundVolume * 0.75,
				detune: -520,
			});
			return;
		}
	}
}

function triggerReactivePlating(playerObj: GameObj) {
	if (
		player.reactivePlating === undefined ||
		k.time() < reactivePlatingReadyAt
	) return;
	reactivePlatingReadyAt = k.time() + reactivePlatingCooldown;
	createExplosion({
		pos: playerObj.pos.clone(),
		radius: 72,
		damage: 6,
		visualScale: 0.55,
		visualIntensity: 0.22,
		visualParticleCount: 14,
		canCrit: false,
	});
	spawnRing({
		pos: playerObj.pos.clone(),
		speed: 210,
		intensity: 0.2,
		maxRadius: 72,
		color: k.rgb(220, 235, 255),
	});
}

function spawnPhaseEcho(pos: Vec2, angle: number) {
	const gravity = spawnGravityPull({
		pos,
		radius: 105,
		strength: 34,
		falloff: 1.1,
		visualizePull: true,
		targetTags: [tags.enemy],
	});
	const echo = k.add([
		k.pos(pos),
		k.sprite("ship"),
		k.anchor("center"),
		k.rotate(angle),
		k.scale(PLAYER_SCALE),
		k.color(80, 185, 255),
		k.opacity(0.42),
		k.layer(layers.gameEffects),
		tags.gameLoop,
	]);
	echo.onUpdate(() => {
		echo.opacity = k.wave(0.18, 0.55, k.time() * 11);
	});
	k.wait(1.25, () => {
		if (!echo.exists()) {
			if (gravity.exists()) k.destroy(gravity);
			return;
		}
		if (gravity.exists()) k.destroy(gravity);
		k.destroy(echo);
		createExplosion({
			pos,
			radius: 70,
			damage: 8,
			visualIntensity: 0.45,
			visualParticleCount: 22,
		});
		audioService.playPositionalSound("explosion1", pos, {
			volume: mainSoundVolume * 0.55,
		});
	});
}

function getActiveModuleTarget(origin: Vec2, maxDistance: number) {
	const mouseWorldPos = k.toWorld(k.mousePos());
	const offset = mouseWorldPos.sub(origin);
	if (offset.len() <= maxDistance) return mouseWorldPos;
	return origin.add(offset.unit().scale(maxDistance));
}

function activatePhaseNova(playerObj: GameObj<PosComp>) {
	const origin = playerObj.pos.clone();
	spawnFlash(origin, 18, k.WHITE);
	spawnRing({
		pos: origin,
		speed: 520,
		intensity: 0.7,
		maxRadius: 260,
		visualize: true,
		color: k.rgb(205, 130, 255),
	});
	createExplosion({
		pos: origin,
		radius: 260,
		damage: 45,
		visualIntensity: 1.4,
		visualParticleCount: 72,
		damageFalloff: 0.35,
		falloffDistance: 120,
	});
	audioService.playSound("high_rarity_reveal", {
		volume: mainSoundVolume,
		detune: 520,
	});
	audioService.playSound("explosion2", {
		volume: mainSoundVolume,
		detune: -120,
	});
	k.shake(14);
}

function getSpaceJumpConfigLevel() {
	if (getEquippedMobilityAbilityId() !== "phaseJump") return -1;
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
		k.lifespan(phaseJumpAfterimageDuration, { fade: 0.14 }),
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
			k.lifespan(phaseJumpAfterimageDuration, { fade: 0.14 }),
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
		if (player.phaseEcho !== undefined) {
			spawnPhaseEcho(phaseJumpStart.clone(), playerObj.angle);
		}
		if (player.phaseMagazine !== undefined) {
			spawnPhaseMagazineSalvo(playerObj.pos.clone());
		}
		phaseJumpInvulnerableUntil = k.time() + phaseJumpPostInvulnerability;
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
