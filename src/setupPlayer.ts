import type { AudioPlay, GameObj, KEventController, PosComp, RotateComp, Vec2 } from "kaplay";
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
import { addShipThruster } from "./comp/shipThruster"
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
import { narrativePrologueActive } from "./services/narrativeService";
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
import { dialogCapturesInput } from "./services/dialogService";
import {
	beginActiveModuleActivation,
	getActiveModuleCooldownRemaining,
	getEquippedActiveModule,
	resetActiveModuleCooldown,
	updateActiveModuleCooldown,
} from "./services/activeModuleService";
import { createExplosion } from "./services/explosionService";
import { damageDestructibleWallsInRadius } from "./services/destructibleWallService";
import { spawnGravityPull } from "./spawn/spawnGravityPull";
import { addWormholeEffect } from "./spawn/spawnLevel";
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
	type AbilityId,
} from "./services/abilityLoadoutService";
import {
	recordTelemetryAbilityFailure,
	recordTelemetryAbilityUse,
} from "./services/runTelemetryService";
import {
	consumeUltimateCharge,
	getUltimateChargeProgress,
} from "./services/ultimateAbilityService";
import { getAbilityDefinition } from "./services/abilityRegistry";
import { playRequirementErrorSound } from "./services/uiSoundService";
import { getAbilityTierValues } from "./services/abilityTierService";
import {
	resetPassiveUpgradeRuntime,
	updatePassiveUpgradeRuntime,
} from "./services/passiveUpgradeRuntimeService";
import {
	createThrusterOverdriveState,
	updateThrusterOverdrive,
} from "./services/thrusterOverdriveService";

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
const PLAYER_SHIP_DIRECTION_SPRITES = [
	"ship",
	"ship_north_east",
	"ship_east",
	"ship_south_east",
	"ship_south",
	"ship_south_west",
	"ship_west",
	"ship_north_west",
] as const
let currentMoveSpeed = 0;
let currentCameraScale = 1;
let currentCameraPos: Vec2 | undefined;
let configuredBlasterLevel = -2;
let configuredSpaceJumpLevel = "";
let configuredMobilityId = "";
let phaseJumpCharges = 0;
let phaseJumpMaxCharges = 0;
let phaseJumpRechargeTimer = 0;
let phaseJumpInvulnerableUntil = 0;
let phaseJumpStart: Vec2 | undefined;
let phaseJumpEnd: Vec2 | undefined;
let phaseJumpElapsed = 0;
const phaseJumpHitTargets = new Set<number>();
let retroBurstStart: Vec2 | undefined;
let retroBurstEnd: Vec2 | undefined;
let retroBurstElapsed = 0;
let nextPrimaryFireTime = 0;
let configuredWeaponId = "";
let overclockShakeTimer = 0;
let afterburnerWakeTimer = 0;
let reactivePlatingReadyAt = 0;
let repairPulseGeneration = 0;
let activeScrapMine: GameObj | undefined;

interface PhaseJumpConfig {
	distance?: number;
	cooldown: number;
	charges: number;
}

interface SetupPlayerOptions {
	respawnTransition?: boolean;
	arrivalTransition?: boolean;
	arrivalBass?: boolean;
	spawnPosition?: Vec2;
}

function getPlayerShipDirectionIndex(angle: number) {
	const safeAngle = Number.isFinite(angle) ? angle : 0
	return ((Math.round(safeAngle / 45) % 8) + 8) % 8
}

export function setupPlayer(options: SetupPlayerOptions = {}) {
	resetPlayerDeathCause();
	resetPassiveUpgradeRuntime();
	repairPulseGeneration++;
	reactivePlatingReadyAt = 0;
	const respawnTarget = options.spawnPosition?.clone() ?? k.center();
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
		k.sprite("ship_root"),
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
	let playerHullDirection = getPlayerShipDirectionIndex(playerObj.angle)
	const playerHullObj = playerObj.add([
		k.sprite(PLAYER_SHIP_DIRECTION_SPRITES[playerHullDirection]),
		k.anchor("center"),
		k.rotate(-playerHullDirection * 45),
		k.color(k.WHITE),
		k.opacity(playerObj.opacity),
		k.z(0),
	])
	playerHullObj.onUpdate(() => {
		const nextDirection = getPlayerShipDirectionIndex(playerObj.angle)
		if (nextDirection !== playerHullDirection) {
			playerHullObj.use(k.sprite(PLAYER_SHIP_DIRECTION_SPRITES[nextDirection]))
			playerHullDirection = nextDirection
		}
		// Cancel only the selected frame's baked angle. The parent keeps the
		// remaining rotation, so the hull still follows the exact 360° heading.
		playerHullObj.angle = -playerHullDirection * 45
		playerHullObj.color = playerObj.color
		playerHullObj.opacity = playerObj.opacity
	})
	clearPlayerStatusEffects();
	player.speedPwrUpMultiplier = 1;
	const thruster = addShipThruster(playerObj, playerObj.height / 2 - 2)
	let overclockWasActive = false
	const thrusterOverdriveState = createThrusterOverdriveState()
	let overclockSound: AudioPlay | undefined
	const stopOverclockSound = () => {
		if (!overclockSound) return
		audioService.stopSound(overclockSound, "overclock-ended")
		overclockSound = undefined
	}
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
	let nextPrimaryChargeParticleAt = 0;
	let primaryChargeReadySoundPlayed = false;
	let primaryChargeSound: AudioPlay | undefined;
	let primaryChargeSoundSpeed = 0;
	const stopPrimaryChargeSound = () => {
		if (!primaryChargeSound) return;
		audioService.stopSound(primaryChargeSound, "primary-charge-ended");
		primaryChargeSound = undefined;
		primaryChargeSoundSpeed = 0;
	};
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
		spawnPlayerDeathDebris(
			deathPos,
			getCarriedDebree(),
			narrativePrologueActive()
		);
		audioService.playSound("explosion1", { volume: mainSoundVolume });
		beginPlayerDeathSequence();
	});
	playerObj.onDestroy(() => {
		stopOverclockSound()
		stopPrimaryChargeSound();
		for (const controller of inputControllers) controller.cancel();
	});

	playerObj.onUpdate(() => profileSection("external:playerVisuals", () => {
		// Clear before transition early returns so jumps never leave a stale flame.
		if (levelTransitionActive() || arrivalTransitionActive || respawnTransitionActive) {
			thruster.update(0, 0)
			thruster.setColor(k.WHITE)
			overclockWasActive = false
			player.speedPwrUpMultiplier = 1
			stopOverclockSound()
			stopPrimaryChargeSound();
			primaryChargeStartedAt = undefined;
			primaryChargeWeaponId = "";
		}
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
			primaryChargeStartedAt !== undefined &&
			currentWeapon.id === primaryChargeWeaponId
			? k.clamp(
				(k.time() - primaryChargeStartedAt) / currentWeapon.charge.maxDuration,
				0,
				1
			)
			: 0;
		if (currentWeapon.charge && primaryChargeProgress > 0) {
			const now = k.time();
			const chargeColor = currentWeapon.projectileTint
				? k.rgb(...currentWeapon.projectileTint)
				: k.rgb(80, 180, 255);
			if (primaryChargeSound) {
				const chargeSoundSpeed = k.lerp(
					0.75,
					1.45,
					primaryChargeProgress
				);
				if (Math.abs(chargeSoundSpeed - primaryChargeSoundSpeed) >= 0.035) {
					primaryChargeSoundSpeed = chargeSoundSpeed;
					audioService.updateSound(primaryChargeSound, {
						speed: chargeSoundSpeed,
					});
				}
			}
			if (now >= nextPrimaryChargeParticleAt) {
				const chargeMuzzlePos = () => playerObj.exists()
					? getPlayerMuzzlePos(
						playerObj.pos,
						k.vec2(0, currentWeapon.muzzleOffsetY),
						turretWorldAngle
					)
					: undefined;
				spawnPrimaryChargeParticle(
					chargeMuzzlePos,
					primaryChargeProgress,
					chargeColor
				);
				nextPrimaryChargeParticleAt = now + k.lerp(
					0.1,
					0.025,
					primaryChargeProgress
				);
			}
			if (primaryChargeProgress >= 1 && !primaryChargeReadySoundPlayed) {
				primaryChargeReadySoundPlayed = true;
				const muzzlePos = getPlayerMuzzlePos(
					playerObj.pos,
					k.vec2(0, currentWeapon.muzzleOffsetY),
					turretWorldAngle
				);
				spawnFlash(muzzlePos, 5, chargeColor);
				spawnPlayerReadinessFlash(playerObj, chargeColor);
				audioService.playSound("rail_lance_ready", {
					volume: mainSoundVolume,
					detune: 200,
				});
			}
		} else if (!currentWeapon.charge || primaryChargeStartedAt === undefined) {
			stopPrimaryChargeSound();
		}
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

		const phaseJumpConfig = getMobilityChargeConfig();
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
			rechargeProgress = thrusterOverdriveState.charge;
			updatePhaseJumpUi(
				thrusterOverdriveState.overused ? 0 : 1,
				1,
				rechargeProgress
			);
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
			mobilityId === "thrusterOverdrive"
				? !thrusterOverdriveState.overused
				: phaseJumpCharges > 0,
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
				spawnPlayerArrivalImpact(playerObj, options.arrivalBass === true);
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
		const isRetroBursting = updateRetroBurst(playerObj);
		const isMobilityMoving = isPhaseJumping || isRetroBursting;
		constrainToRunFinaleBattleZone(playerObj.pos, 16);
		const isInvulnerable =
			isPhaseJumping || k.time() < phaseJumpInvulnerableUntil;
		setPlayerDamageInvulnerable(isInvulnerable);
		playerObj.opacity = isInvulnerable ? 0.35 : 1;
		const cameraFollowSpeed = isMobilityMoving
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
		const overdriveTier = getAbilityTierValues("thrusterOverdrive");
		const overdriveUpdate = updateThrusterOverdrive(
			thrusterOverdriveState,
			!isMobilityMoving &&
				mobilityId === "thrusterOverdrive" &&
				k.isKeyDown("shift") &&
				wasdDir.len() > 0,
			dt(),
			overdriveTier.recovery
		);
		const isBoosting = overdriveUpdate.active;
		player.speedPwrUpMultiplier = isBoosting
			? Math.max(
				1.2 * overdriveTier.speed,
				player.sprintSpeedMultiplier * overdriveTier.speed
			)
			: 1;
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
		if (steeringVelocity.len() > 0 && !isMobilityMoving) {
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

		if (isBoosting !== overclockWasActive) {
			thruster.setColor(isBoosting ? k.rgb(80, 180, 255) : k.WHITE)
			if (isBoosting) {
				overclockSound = audioService.playSound("going_fast", {
					volume: mainSoundVolume * 0.5,
					loop: true,
				})
			} else {
				stopOverclockSound()
			}
			overclockWasActive = isBoosting
		}
		updatePassiveUpgradeRuntime(playerObj, isBoosting);
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

		const targetSpeed = isMobilityMoving
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
		// Hull reinforcement and attached armor stand in for visual weight;
		// this affects exhaust only, leaving movement balance unchanged.
		const thrustWeight = 1 + Math.min(0.75,
			Math.max(0, player.maxHealth + session.extraHealth - 3) * 0.08 +
			session.scrapArmorCharges * 0.1
		)
		const emitThrusterParticle = thruster.update(
			isMobilityMoving ? 0 : speed,
			dt(),
			thrustWeight
		)

		if (!isMobilityMoving) {
			steerMoveRotateAndLean(
				playerObj,
				nextPlayerAngle,
				speed,
				desiredPlayerAngle,
				PLAYER_SCALE
			);
		}
		constrainToRunFinaleBattleZone(playerObj.pos, 16);

		if (emitThrusterParticle && !isMobilityMoving) {
			const activeTrailEmitter = isBoosting
				? boostTrailEmitter
				: trailEmitter
			// Follow the flame tip even during its off flash and at boost length.
			activeTrailEmitter.emitter.position = thruster.getExhaustPosition()
			activeTrailEmitter.emitter.direction = playerObj.angle + 90
			activeTrailEmitter.emit(1)
		}

		const isPhaseJumpRecharging =
			phaseJumpConfig !== undefined && phaseJumpCharges < phaseJumpMaxCharges;
		const isOverdriveRecharging =
			mobilityId === "thrusterOverdrive" &&
			thrusterOverdriveState.charge < 1;
		const showMobilityResource =
			isPhaseJumpRecharging || isOverdriveRecharging;
		const cooldownBarPos = playerObj.pos.add(
			-phaseJumpCooldownBarWidth / 2,
			phaseJumpCooldownBarOffset
		);
		phaseJumpCooldownTrack.pos = cooldownBarPos;
		phaseJumpCooldownFill.pos = cooldownBarPos;
		phaseJumpCooldownTrack.opacity = showMobilityResource ? 0.25 : 0;
		phaseJumpCooldownFill.opacity = showMobilityResource ? 1 : 0;
		phaseJumpCooldownFill.color =
			mobilityId === "thrusterOverdrive" && thrusterOverdriveState.overused
			? k.rgb(255, 70, 70)
			: k.rgb(80, 180, 255);
		phaseJumpCooldownFill.width =
			phaseJumpCooldownBarWidth * k.clamp(
				mobilityId === "thrusterOverdrive"
					? thrusterOverdriveState.charge
					: rechargeProgress,
				0,
				1
			);
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
		if (dialogCapturesInput()) return;
		if (isPointerOverUi()) return;
		if (levelTransitionActive() || respawnTransitionActive) return;
		return true;
	};

	const fireWeaponVolley = (
		weapon: WeaponDefinition,
		chargeRatio: number,
		playFireSound: boolean,
		burstDamageMultiplier: number = 1
	) => {
		if (!playerObj.exists() || getEquippedWeapon().id !== weapon.id) return;
		if (
			dialogCapturesInput() ||
			levelTransitionActive() ||
			respawnTransitionActive
		) return;
		const charge = weapon.charge;
		const chargeDamageMultiplier = charge
			? k.lerp(
				charge.minDamageMultiplier,
				charge.maxDamageMultiplier,
				chargeRatio
			)
			: 1;
		const damageMultiplier = chargeDamageMultiplier * burstDamageMultiplier;
		const speedMultiplier = charge
			? k.lerp(
				charge.minSpeedMultiplier ?? 1,
				charge.maxSpeedMultiplier ?? 1,
				chargeRatio
			)
			: 1;
		const fireSoundDetune = charge?.fireSoundDetune
			? k.lerp(
				charge.fireSoundDetune.min,
				charge.fireSoundDetune.max,
				chargeRatio
			)
			: undefined;

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
		const lateralSpacing = weapon.pattern?.lateralSpacing ?? 0;
		const hasPatternWiggle = weapon.pattern?.wiggle !== undefined;
		let shouldPlayFireSound = playFireSound;
		const fireFromMuzzle = (muzzlePos: Vec2) => {
			for (let index = 0; index < projectileCount; index++) {
				const angleOffset = projectileCount === 1
					? 0
					: -patternSpread / 2 + patternSpread * index / (projectileCount - 1);
				const lateralOffset = projectileCount === 1
					? 0
					: -lateralSpacing / 2 +
						lateralSpacing * index / (projectileCount - 1);
				const projectilePos = muzzlePos.add(
					k.Vec2.fromAngle(turretWorldAngle).scale(lateralOffset)
				);
				spawnPlayerBlaster(
					projectilePos,
					k.Vec2.fromAngle(turretWorldAngle - 90),
					turretWorldAngle,
					{
						angleOffset,
						damageMultiplier,
						speedMultiplier,
						playFireSound: shouldPlayFireSound,
						fireSoundDetune,
						isFullyCharged: chargeRatio >= 1,
						wigglePhase: hasPatternWiggle
							? index * Math.PI
							: undefined,
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

	const firePrimaryWeapon = (
		chargeRatio: number = 1,
		cooldownOverride?: number
	) => {
		if (!canFirePrimaryWeapon()) return;
		const weapon = getEquippedWeapon();
		const triggerModifier = getWeaponTriggerModifier(weapon);
		const cooldown = cooldownOverride ?? (
			triggerModifier.usesCooldown ? weapon.fireCooldown : undefined
		);
		if (cooldown !== undefined) {
			if (k.time() < nextPrimaryFireTime) return;
			nextPrimaryFireTime = k.time() +
				cooldown * getPlayerStatusMultiplier("weaponRecovery");
		}
		recordTelemetryAbilityUse("primary", weapon.id);
		const burstCount = Math.max(1, Math.floor(weapon.pattern?.burstCount ?? 1));
		const burstInterval = weapon.pattern?.burstInterval ?? 0;
		const burstDamageStep = Math.max(0, weapon.pattern?.burstDamageStep ?? 0);
		for (let index = 0; index < burstCount; index++) {
			const burstDamageMultiplier = 1 + burstDamageStep * index;
			const fireRound = () => fireWeaponVolley(
				weapon,
				k.clamp(chargeRatio, 0, 1),
				true,
				burstDamageMultiplier
			);
			if (index === 0) fireRound();
			else k.wait(index * burstInterval, fireRound);
		}
	};

	playerObj.onUpdate(() => profileSection("external:playerWeaponHold", () => {
		if (!k.isMouseDown("left")) return;
		const triggerModifier = getWeaponTriggerModifier(getEquippedWeapon());
		if (triggerModifier.mode === "hold") {
			firePrimaryWeapon();
			return;
		}
		if (triggerModifier.holdCooldown !== undefined) {
			firePrimaryWeapon(1, triggerModifier.holdCooldown);
		}
	}));

	inputControllers.push(k.onMousePress("left", () => {
		const weapon = getEquippedWeapon();
		const mode = getWeaponTriggerModifier(weapon).mode;
		if (mode === "press") {
			firePrimaryWeapon();
			const holdCooldown = getWeaponTriggerModifier(weapon).holdCooldown;
			if (holdCooldown !== undefined) {
				nextPrimaryFireTime = k.time() +
					holdCooldown * getPlayerStatusMultiplier("weaponRecovery");
			}
			return;
		}
		if (mode !== "charge" || !canFirePrimaryWeapon()) return;
		primaryChargeStartedAt = k.time();
		primaryChargeWeaponId = weapon.id;
		nextPrimaryChargeParticleAt = k.time();
		primaryChargeReadySoundPlayed = false;
		primaryChargeSoundSpeed = 0.75;
		primaryChargeSound = audioService.playSound("primary_weapon_charge", {
			volume: mainSoundVolume * 0.45,
			loop: true,
			speed: primaryChargeSoundSpeed,
		});
	}));

	inputControllers.push(k.onMouseRelease("left", () => {
		if (primaryChargeStartedAt === undefined) return;
		const weapon = getEquippedWeapon();
		const chargeStartedAt = primaryChargeStartedAt;
		primaryChargeStartedAt = undefined;
		stopPrimaryChargeSound();
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
		if (dialogCapturesInput()) return;
		if (levelTransitionActive() || respawnTransitionActive) return;
		if (!getEquippedActiveModule()) {
			recordTelemetryAbilityFailure("secondary");
			flashEmptySecondarySocket();
			playRequirementErrorSound();
			return;
		}
		const activeModule = beginActiveModuleActivation();
		if (!activeModule) {
			recordTelemetryAbilityFailure(
				"secondary",
				getEquippedActiveModule()?.id ?? "empty"
			);
			return;
		}
		recordTelemetryAbilityUse("secondary", activeModule.id);
		activateModule(activeModule.id, playerObj, turretWorldAngle);
	}));

	playerObj.onKeyPress("shift", () => {
		if (dialogCapturesInput()) return;
		if (levelTransitionActive() || respawnTransitionActive) return;
		const mobilityId = getEquippedMobilityAbilityId();
		if (!mobilityId) {
			recordTelemetryAbilityFailure("mobility");
			flashEmptyMobilitySocket();
			playRequirementErrorSound();
			return;
		}
		if (mobilityId !== "thrusterOverdrive") return;
		if (thrusterOverdriveState.overused) {
			recordTelemetryAbilityFailure("mobility", "thrusterOverdrive");
			playRequirementErrorSound();
			return;
		}
		recordTelemetryAbilityUse("mobility", "thrusterOverdrive");
	});

	playerObj.onKeyPress("space", () => {
		if (dialogCapturesInput()) return;
		if (levelTransitionActive() || respawnTransitionActive) return;
		if (!getEquippedMobilityAbilityId()) {
			recordTelemetryAbilityFailure("mobility");
			flashEmptyMobilitySocket();
			playRequirementErrorSound();
			return;
		}
		const mobilityId = getEquippedMobilityAbilityId();
		const config = getMobilityChargeConfig();
		if (
			!config ||
			phaseJumpCharges <= 0 ||
			phaseJumpEnd ||
			retroBurstEnd
		) {
			recordTelemetryAbilityFailure("mobility", mobilityId);
			return;
		}
		if (mobilityId === "driftBrake") {
			consumeMobilityCharge();
			currentMoveSpeed = 0;
			playerObj.gravityVelocity = k.vec2(0);
			phaseJumpInvulnerableUntil = Math.max(
				phaseJumpInvulnerableUntil,
				k.time() + 0.18
			);
			spawnRing({
				pos: playerObj.pos.clone(),
				speed: 230,
				intensity: 0.24,
				maxRadius: 40,
				color: k.rgb(180, 230, 255),
			});
			spawnFlash(playerObj.pos.clone(), 7, k.rgb(180, 230, 255));
			audioService.playSound("swap_level", {
				volume: mainSoundVolume * 0.5,
				detune: -180,
			});
			recordTelemetryAbilityUse("mobility", mobilityId);
			return;
		}
		if (mobilityId === "gravitySling") {
			consumeMobilityCharge();
			const tier = getAbilityTierValues(mobilityId);
			const targetPos = getActiveModuleTarget(
				playerObj.pos,
				180 * tier.speed
			);
			const gravity = spawnGravityPull({
				pos: targetPos,
				radius: 230 * tier.speed,
				strength: 68 * tier.power,
				falloff: 0.7,
				visualizePull: true,
				targetTags: [tags.player],
			});
			const sling = k.add([
				k.pos(targetPos),
				k.sprite("mobility_gravity_sling"),
				k.anchor("center"),
				k.scale(0.72),
				k.color(120, 190, 255),
				k.opacity(0.8),
				k.rotate(0),
				k.layer(layers.gameEffects),
				tags.gameLoop,
			]);
			sling.onUpdate(() => {
				sling.angle += 180 * dt();
				sling.opacity = k.wave(0.38, 0.9, k.time() * 8);
			});
			k.wait(1.15 * tier.power, () => {
				if (gravity.exists()) k.destroy(gravity);
				if (sling.exists()) k.destroy(sling);
			});
			spawnRing({
				pos: targetPos,
				speed: 80,
				intensity: 0.22,
				maxRadius: 48,
				color: k.rgb(120, 190, 255),
			});
			audioService.playSound("swap_level", {
				volume: mainSoundVolume * 0.55,
				detune: -420,
			});
			recordTelemetryAbilityUse("mobility", mobilityId);
			return;
		}

		const jumpDirection = mobilityId === "retroBurst"
			? k.Vec2.fromAngle(turretWorldAngle + 90)
			: k.Vec2.fromAngle(playerObj.angle - 90);
		const startPos = playerObj.pos.clone();
		const destination = startPos.add(
			jumpDirection.scale(config.distance ?? 0)
		);
		constrainToRunFinaleBattleZone(destination, 16);
		const gridCollision = playerObj.has("gridCollision")
			? (playerObj.c("gridCollision") as GridCollisionComp)
			: undefined;
		if (gridCollision && !gridCollision.canMoveTo(destination)) {
			recordTelemetryAbilityFailure("mobility", mobilityId);
			spawnFlash(destination, 6, k.rgb(255, 70, 70));
			audioService.playSound("error", { volume: mainSoundVolume * 0.35 });
			return;
		}
		recordTelemetryAbilityUse("mobility", mobilityId);
		consumeMobilityCharge();
		if (mobilityId === "retroBurst") {
			retroBurstStart = startPos;
			retroBurstEnd = destination;
			retroBurstElapsed = 0;
			spawnRetroBurstEffect(startPos, destination, playerObj.angle);
			forEachSpatialNearby(startPos, 72, {
				allTags: [tags.enemy, tags.unit],
			}, (enemy) => {
				const away = enemy.pos.sub(startPos);
				if (away.len() <= 0) return;
				enemy.pos = enemy.pos.add(away.unit().scale(30));
			});
			return;
		}

		setPlayerDamageInvulnerable(true);
		phaseJumpStart = startPos;
		phaseJumpEnd = destination;
		phaseJumpElapsed = 0;
		phaseJumpHitTargets.clear();
		spawnPhaseJumpEffect(startPos, destination, playerObj.angle);
	});

	playerObj.onKeyPress("q", () => {
		if (dialogCapturesInput()) return;
		if (levelTransitionActive() || respawnTransitionActive) return;
		const ultimateId = getEquippedUltimateAbilityId();
		if (!ultimateId) {
			recordTelemetryAbilityFailure("ultimate");
			flashEmptyUltimateSocket();
			playRequirementErrorSound();
			return;
		}
		if (ultimateId !== "phaseNova") return;
		if (!consumeUltimateCharge()) {
			recordTelemetryAbilityFailure("ultimate", ultimateId);
			return;
		}
		recordTelemetryAbilityUse("ultimate", ultimateId);
		activatePhaseNova(playerObj);
	});

	playerObj.onKeyPress("f", () => {
		if (dialogCapturesInput()) return;
		if (levelTransitionActive() || respawnTransitionActive) return;
		let closestInteractable:
			| GameObj<InteractableComp | PosComp>
			| undefined;
		let closestDistance = Infinity;
		let highestPriority = -Infinity;

		for (const obj of k.get("interactable")) {
			const interactable = obj as GameObj<InteractableComp | PosComp>;
			if (!interactable.pos || !interactable.isInRange) continue;

			const priority = interactable.interactionPriority;
			if (priority < highestPriority) continue;
			if (priority > highestPriority) closestDistance = Infinity;
			const distance = interactable.pos.dist(playerObj.pos);
			if (distance >= closestDistance) continue;

			closestInteractable = interactable;
			closestDistance = distance;
			highestPriority = priority;
		}

		closestInteractable?.onInteract();
	});

	return playerObj;
}

function spawnPlayerArrivalImpact(
	playerObj: GameObj<PosComp>,
	playWarpLandingBass: boolean
) {
	audioService.playSound("player_arrival_impact", {
		volume: mainSoundVolume,
	});
	if (playWarpLandingBass) {
		audioService.playSound("warp_landing_bass", {
			volume: mainSoundVolume,
		})
	}
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

function spawnPrimaryChargeParticle(
	getTarget: () => Vec2 | undefined,
	intensity: number,
	color: ReturnType<typeof k.rgb>
) {
	const target = getTarget();
	if (!target) return;
	const normalizedIntensity = k.clamp(intensity, 0, 1);
	const angle = k.rand(0, 360);
	const direction = k.Vec2.fromAngle(angle);
	const tangent = k.Vec2.fromAngle(angle + 90);
	const distance = k.rand(
		k.lerp(18, 26, normalizedIntensity),
		k.lerp(30, 44, normalizedIntensity)
	);
	const start = target.add(direction.scale(distance));
	const travelDuration = k.lerp(0.38, 0.18, normalizedIntensity);
	const bend = k.rand(-5, 5) * (0.7 + normalizedIntensity * 0.3);
	const baseOpacity = k.lerp(0.45, 0.95, normalizedIntensity);
	const pixelSize = normalizedIntensity > 0.72 && k.chance(0.35) ? 2 : 1;
	let elapsed = 0;
	const particle = k.add([
		k.pos(start),
		k.rect(pixelSize, pixelSize),
		k.anchor("center"),
		k.color(color),
		k.opacity(baseOpacity),
		k.layer(layers.gameEffects),
		k.z(15),
		tags.gameLoop,
	]);
	particle.onUpdate(() => {
		const currentTarget = getTarget();
		if (!currentTarget) {
			k.destroy(particle);
			return;
		}
		elapsed += k.dt();
		const progress = k.clamp(elapsed / travelDuration, 0, 1);
		const eased = 1 - Math.pow(1 - progress, 2);
		const curve = tangent.scale(Math.sin(progress * Math.PI) * bend);
		particle.pos = start.lerp(currentTarget, eased).add(curve);
		particle.opacity = baseOpacity * (1 - progress * 0.75);
		if (progress >= 1) k.destroy(particle);
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
	configuredSpaceJumpLevel = "";
	configuredMobilityId = "";
	phaseJumpCharges = 0;
	phaseJumpMaxCharges = 0;
	phaseJumpRechargeTimer = 0;
	phaseJumpInvulnerableUntil = 0;
	phaseJumpStart = undefined;
	phaseJumpEnd = undefined;
	phaseJumpElapsed = 0;
	phaseJumpHitTargets.clear();
	retroBurstStart = undefined;
	retroBurstEnd = undefined;
	retroBurstElapsed = 0;
	activeScrapMine = undefined;
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

function getMobilityChargeConfig(): PhaseJumpConfig | undefined {
	const mobilityId = getEquippedMobilityAbilityId();
	if (!mobilityId || mobilityId === "thrusterOverdrive") return undefined;
	const tier = getAbilityTierValues(mobilityId);
	if (mobilityId === "retroBurst") {
		return {
			distance: 68 * tier.speed,
			cooldown: 3.2 / tier.recovery,
			charges: 1,
		};
	}
	if (mobilityId === "driftBrake") {
		return { cooldown: 3.6 / tier.recovery, charges: 1 };
	}
	if (mobilityId === "gravitySling") {
		return { cooldown: 5 / tier.recovery, charges: 1 };
	}

	switch (player.spaceJumpUpgradeLvl) {
		case undefined:
			return {
				distance: 75 * tier.speed,
				cooldown: 2.5 / tier.recovery,
				charges: 1,
			};
		case 1:
			return {
				distance: 90 * tier.speed,
				cooldown: 2.1 / tier.recovery,
				charges: 1,
			};
		case 2:
			return {
				distance: 90 * tier.speed,
				cooldown: 3 / tier.recovery,
				charges: 2,
			};
		default:
			return undefined;
	}
}

function configureSpaceJump() {
	const previousMaxCharges = phaseJumpMaxCharges;
	const mobilityId = getEquippedMobilityAbilityId() ?? "";
	const mobilityChanged = configuredMobilityId !== mobilityId;
	configuredSpaceJumpLevel = getSpaceJumpConfigLevel();
	configuredMobilityId = mobilityId;
	const config = getMobilityChargeConfig();
	phaseJumpMaxCharges = config?.charges ?? 0;
	if (mobilityChanged) {
		phaseJumpCharges = phaseJumpMaxCharges;
		phaseJumpRechargeTimer = 0;
		return;
	}
	phaseJumpCharges = Math.min(
		phaseJumpCharges + Math.max(0, phaseJumpMaxCharges - previousMaxCharges),
		phaseJumpMaxCharges
	);
}

function consumeMobilityCharge() {
	phaseJumpCharges = Math.max(0, phaseJumpCharges - 1);
	if (phaseJumpCharges === phaseJumpMaxCharges - 1) {
		phaseJumpRechargeTimer = 0;
	}
}

function activateModule(
	moduleId: string,
	playerObj: GameObj<PosComp>,
	turretWorldAngle: number
) {
	const tier = getAbilityTierValues(moduleId as AbilityId);
	const direction = k.Vec2.fromAngle(turretWorldAngle - 90);
	const targetPos = getActiveModuleTarget(playerObj.pos, 220 * tier.speed);

	switch (moduleId) {
		case "rocketPod":
			loopService.loop(
				0.1 / tier.recovery,
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

		case "repulsorPulse": {
			const origin = playerObj.pos.clone();
			const radius = 100 * tier.speed;
			forEachSpatialNearby(origin, radius, {
				anyTags: [tags.enemy, tags.projectile],
			}, (target) => {
				if (target.id === playerObj.id || !target.pos) return;
				if (target.is(tags.projectile) && target.is(tags.friendly)) return;
				const offset = target.pos.sub(origin);
				if (offset.len() <= 0) return;
				const strength = target.is(tags.projectile)
					? 58 * tier.power
					: 34 * tier.power;
				target.pos = target.pos.add(offset.unit().scale(strength));
			});
			spawnRing({
				pos: origin,
				speed: 360,
				intensity: 0.38,
				maxRadius: radius,
				color: k.rgb(100, 220, 255),
			});
			spawnFlash(origin, 9, k.rgb(100, 220, 255));
			audioService.playSound("swap_level", {
				volume: mainSoundVolume * 0.65,
				detune: -280,
			});
			k.shake(2);
			return;
		}

		case "decoyBeacon": {
			const decoy = k.add([
				k.pos(targetPos),
				k.sprite("active_decoy_beacon"),
				k.anchor("center"),
				k.scale(0.85),
				k.color(95, 220, 255),
				k.opacity(0.72),
				k.layer(layers.gameEffects),
				k.lifespan(5 * tier.power, { fade: 0.45 }),
				tags.props,
				tags.gameLoop,
			]);
			decoy.onUpdate(() => {
				decoy.opacity = k.wave(0.3, 0.82, k.time() * 9);
				forEachSpatialNearby(decoy.pos, 210 * tier.speed, {
					allTags: [tags.enemy, tags.unit],
				}, (enemy) => {
					const towardDecoy = decoy.pos.sub(enemy.pos);
					if (towardDecoy.len() <= 1) return;
					enemy.pos = enemy.pos.add(
						towardDecoy.unit().scale(26 * tier.power * dt())
					);
				});
			});
			spawnRing({
				pos: targetPos,
				speed: 120,
				intensity: 0.18,
				maxRadius: 46,
				color: k.rgb(95, 220, 255),
			});
			audioService.playSound("click1", {
				volume: mainSoundVolume * 0.55,
				detune: 420,
			});
			return;
		}

		case "scrapMine": {
			if (activeScrapMine?.exists()) k.destroy(activeScrapMine);
			const minePos = playerObj.pos.add(
				k.Vec2.fromAngle(playerObj.angle + 90).scale(18)
			);
			let armedElapsed = 0;
			let detonated = false;
			const mine = k.add([
				k.pos(minePos),
				k.sprite("active_scrap_mine"),
				k.anchor("center"),
				k.rotate(playerObj.angle),
				k.scale(0.8),
				k.color(150, 160, 170),
				k.opacity(0.9),
				k.layer(layers.gameEffects),
				tags.props,
				tags.gameLoop,
			]);
			activeScrapMine = mine;
			mine.onDestroy(() => {
				if (activeScrapMine?.id === mine.id) activeScrapMine = undefined;
			});
			mine.onUpdate(() => {
				armedElapsed += dt();
				mine.angle += 28 * dt();
				if (armedElapsed < 0.55 || detonated) return;
				mine.color = k.rgb(90, 225, 255);
				let targetFound = false;
				forEachSpatialNearby(mine.pos, 46 * tier.speed, {
					allTags: [tags.enemy, tags.unit],
				}, () => {
					targetFound = true;
					return false;
				});
				if (!targetFound) return;
				detonated = true;
				const explosionPos = mine.pos.clone();
				k.destroy(mine);
				createExplosion({
					pos: explosionPos,
					radius: 60 * tier.speed,
					damage: 16 * tier.power,
					visualIntensity: 0.55,
					visualParticleCount: 20,
				});
				audioService.playPositionalSound("explosion2", explosionPos, {
					volume: mainSoundVolume * 0.65,
				});
				k.shake(2);
			});
			audioService.playSound("click1", {
				volume: mainSoundVolume * 0.5,
			});
			return;
		}

		case "kineticBarrier": {
			playerObj.activeModuleInvulnerable = true;
			const barrier = playerObj.add([
				k.circle(25, { fill: false }),
				k.anchor("center"),
				k.outline(2, k.rgb(90, 200, 255)),
				k.opacity(0.85),
				k.layer(layers.gameEffects),
				k.lifespan(1.6 * tier.power, { fade: 0.35 }),
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
			const chargeDuration = 2.4 * tier.power;
			const gravityColor = k.rgb(150, 100, 255);
			const gravity = spawnGravityPull({
				pos: targetPos,
				radius: 105 * tier.speed,
				strength: 42 * tier.power,
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
			const charge = k.add([
				k.pos(targetPos),
				k.anchor("center"),
				k.rotate(0),
				k.scale(1),
				timescale(),
				{
					portalState: "charging",
					portalProgress: 0,
					transitionIntensity: 0,
					chargeElapsed: 0,
				},
				tags.props,
				tags.gameLoop,
			]);
			addWormholeEffect(charge, {
				color: gravityColor,
				postEffect: false,
				secondaryPostEffect: true,
				ambience: false,
			});
			const chargeSprite = charge.add([
				k.sprite("active_gravity_charge"),
				k.anchor("center"),
				k.scale(0.75),
				k.rotate(0),
				k.color(gravityColor),
				k.layer(layers.gameEffects),
				k.z(3),
			]);
			charge.onUpdate(() => {
				charge.chargeElapsed += k.dt();
				const progress = k.clamp(
					charge.chargeElapsed / chargeDuration,
					0,
					1
				);
				charge.portalProgress = progress;
				charge.transitionIntensity = progress;
				chargeSprite.angle += k.lerp(90, 420, progress) * dt();
				const pulseSpeed = k.lerp(4, 16, progress);
				const pulseRange = k.lerp(0.08, 0.24, progress);
				chargeSprite.scale = k.vec2(k.wave(
					0.75 - pulseRange,
					0.75 + pulseRange,
					k.time() * pulseSpeed
				));
			});
			k.wait(chargeDuration, () => {
				if (gravity.exists()) k.destroy(gravity);
				if (charge.exists()) k.destroy(charge);
				createExplosion({
					pos: targetPos,
					radius: 58 * tier.speed,
					damage: 10 * tier.power,
					visualColor: gravityColor,
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
					radius: 70 * tier.speed,
					damage: 28 * tier.power,
					visualIntensity: 1,
					visualParticleCount: 42,
				});
				damageDestructibleWallsInRadius(
					targetPos,
					72 * tier.speed,
					28 * tier.power
				);
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
					blasterDmg: Math.max(1, player.followerBlasterDmg * tier.power),
					speed: player.speed * 1.15 * tier.speed,
					follow: playerObj,
					deploymentStart: targetPos.add(index === 0 ? -12 : 12, 0),
				});
				drone.temporaryActiveModuleDrone = true;
				k.wait(12 * tier.power, () => {
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
					playerObj.hp = Math.min(
						maxHp,
						playerObj.hp + Math.max(1, Math.round(tier.power))
					);
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
				maxRadius: 150 * tier.speed,
				color: k.rgb(75, 205, 255),
			});
			spawnFlash(origin, 12, k.rgb(75, 205, 255));
			forEachSpatialNearby(origin, 150 * tier.speed, {
				allTags: [tags.enemy, tags.unit],
			}, (enemy) => {
				if (!(enemy.timescaleModifiers instanceof Map)) return;
				enemy.timescaleModifiers.set(empTimescaleModifierId, 0.05);
				k.wait(3 * tier.power, () => {
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
	const tier = getAbilityTierValues("phaseNova");
	const radius = 260 * tier.speed;
	spawnFlash(origin, 18, k.WHITE);
	spawnRing({
		pos: origin,
		speed: 520,
		intensity: 0.7,
		maxRadius: radius,
		visualize: true,
		color: k.rgb(205, 130, 255),
	});
	createExplosion({
		pos: origin,
		radius,
		damage: 45 * tier.power,
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
	const mobilityId = getEquippedMobilityAbilityId();
	if (!mobilityId) return "none";
	if (mobilityId !== "phaseJump") return mobilityId;
	if (player.spaceJumpLvl === undefined) return "phaseJump:0";
	return `phaseJump:${(player.spaceJumpUpgradeLvl ?? 0) + 1}`;
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
			k.scale(PLAYER_SCALE),
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

function spawnRetroBurstEffect(start: Vec2, end: Vec2, angle: number) {
	const delta = end.sub(start);
	boostTrailEmitter.emitter.position = start;
	boostTrailEmitter.emitter.direction = k.Vec2.toAngle(delta.scale(-1));
	boostTrailEmitter.emit(12);
	spawnRing({
		pos: start,
		speed: 260,
		intensity: 0.26,
		maxRadius: 48,
		color: k.rgb(210, 235, 255),
	});
	k.add([
		k.pos(start),
		k.opacity(0.62),
		k.lifespan(0.2, { fade: 0.16 }),
		{
			draw() {
				k.drawLine({
					p1: k.vec2(),
					p2: delta,
					width: 2,
					color: k.rgb(210, 235, 255),
					opacity: this.opacity,
				});
			},
		},
		tags.gameLoop,
	]);
	audioService.playSound("swap_level", {
		volume: mainSoundVolume * 0.55,
		detune: 180,
	});
	k.shake(2);
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
		if (player.phaseEcho !== undefined || player.mobilitySetBonus) {
			spawnPhaseEcho(phaseJumpStart.clone(), playerObj.angle);
		}
		if (player.mobilitySetBonus) resetActiveModuleCooldown();
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

function updateRetroBurst(playerObj: GameObj<PosComp>): boolean {
	if (!retroBurstStart || !retroBurstEnd) return false;

	retroBurstElapsed += dt();
	const progress = k.clamp(retroBurstElapsed / 0.16, 0, 1);
	const easedProgress = 1 - Math.pow(1 - progress, 3);
	playerObj.pos = retroBurstStart.lerp(retroBurstEnd, easedProgress);
	boostTrailEmitter.emitter.position = playerObj.pos;
	boostTrailEmitter.emitter.direction = k.Vec2.toAngle(
		retroBurstEnd.sub(retroBurstStart).scale(-1)
	);
	boostTrailEmitter.emit(2);

	if (progress >= 1) {
		retroBurstStart = undefined;
		retroBurstEnd = undefined;
		retroBurstElapsed = 0;
	}
	return true;
}

function applyPhaseRamDamage(start: Vec2, end: Vec2) {
	const damage = Math.max(
		player.spaceJumpDamage,
		player.kineticRam === undefined ? 0 : 6,
		player.mobilitySetBonus ? 4 : 0
	);
	if (damage <= 0) return;
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
		if (!applyDamage(target, damage)) return;

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
