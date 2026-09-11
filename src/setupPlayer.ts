import type {
	AudioPlay,
	Color,
	GameObj,
	HealthComp,
	PosComp,
	RotateComp,
	Vec2,
} from "kaplay";
import {
	beginPlayerDeathSequence,
	checkProjectileIntersection,
	respawnPlayerFromExtraLife,
} from "./game";
import {
	syncPlayerHealthBarCapacity,
	flashEmptySecondarySocket,
	flashEmptyMobilitySocket,
	flashEmptyUltimateSocket,
	updatePlayerHealthBar,
	updatePlayerSteeringModeUi,
	updatePhaseJumpUi,
	updateSpecialBar,
	updateUltimateUi,
} from "./ui/gameUi";
import {
	BULLET_SPEED,
	dt,
	k,
	layers,
	mainSoundVolume,
	timeScale,
	velocityScale,
	WORLD_CAMERA_SCALE,
} from "./main";
import {
	boostTrailEmitter,
	starsEmitter,
	trailEmitter,
} from "./particles";
import { getPlayerMaxHealth, hasLvlValue, player, PLAYER_SCALE, session } from "./player";
import {
	getPlayerWeaponProjectileSpeed,
	spawnPlayerBlaster,
	spawnPlayerRocket,
	spawnPhaseMagazineSalvo,
	spawnPrimaryLinkedRocket,
} from "./services/combat/projectileHelpers";
import {
	applySteeringLean,
	lerpAngleBetweenPos,
	steerMoveRotateAndLean,
	registerHitAnimation,
} from "./shared";
import { tags } from "./tags";
import { audioService } from "./services/audio/audioService";
import { gameSoundService } from "./services/audio/gameSoundService"
import {
	getPlayerThrusterSoundMix,
	PLAYER_THRUSTER_SOUND_UPDATE_INTERVAL,
} from "./services/audio/playerThrusterSound"
import { loopService } from "./services/core/loopService";
import { frameRateIndependentBlend } from "./services/core/frameRateService"
import { profileSection } from "./services/debug/frameProfilerService";
import {
	applyKnockbackImpulse,
	applyProjectileDamage,
} from "./services/combat/projectileService";
import {
	applyDamage,
	resetPlayerDeathCause,
} from "./services/combat/damageService";
import { timescale } from "./comp/timescale";
import { addShipThruster } from "./comp/shipThruster"
import { registerBatchedEntityUpdate } from "./services/core/entityUpdateService"
import { recoverPlayerHealth } from "./services/player/playerHealthService"
import {
	getDamageFromPrimaryRatio,
	getPrimaryWeaponDamage,
} from "./services/player/playerCombatScalingService"
import {
	BASE_PLAYER_HEALTH,
	HULL_UPGRADE_AMOUNT,
	REPAIR_PULSE_RECOVERY_RATIO,
} from "./services/player/playerHealthBalance"
import type { GridCollisionComp } from "./comp/gridCollision";
import { levelTransitionActive } from "./services/world/levelTransitionService";
import { getPriorityInteraction } from "./comp/interactable";
import {
	cycleEquippedWeapon,
	equipWeapon,
	getEquippedWeapon,
	getWeaponTriggerModifier,
} from "./services/player/weaponService";
import type { WeaponDefinition } from "./services/player/weaponService";
import { spawnPlayerDeathDebris } from "./spawn/spawnPlayerDeathDebris";
import { getCarriedDebree } from "./services/economy/debreeEconomyService";
import {
	isStrafeTrainingUnlocked,
	narrativePrologueActive,
} from "./services/narrative/narrativeService";
import { spawnAfterburnerWake } from "./spawn/spawnAfterburnerWake";
import { spawnPhaseWake } from "./spawn/spawnPhaseWake"
import { spawnEnemyDeathEffect } from "./spawn/spawnEnemyDeathEffect";
import { spawnFlash } from "./spawn/spawnFlash";
import { spawnRing } from "./spawn/spawnRing";
import {
	PLAYER_DIRECTIONAL_SPRITES,
	PLAYER_VISUAL,
} from "./visuals/playerVisualCatalog";
import { requirePrimaryVisualSprite } from "./visuals/visualRepresentation";
import { spawnEmpDischarge } from "./spawn/spawnEmpDischarge"
import {
	resetPlayerDamageState,
	setPlayerDamageInvulnerable,
} from "./services/player/playerDamageState";
import {
	forEachSpatialNearby,
	querySpatialNearby,
} from "./services/core/runtimeSpatialIndexService";
import { isPointerOverUi } from "./services/input/uiPointerService";
import {
	findClosestPlayerTarget,
	getTargetHitRadius,
	getTargetWorldPosition,
	isPlayerTargetable,
} from "./services/combat/targetingService";
import {
	addCameraKick,
	clearCameraBob,
	clearCameraKick,
	getCameraBobScale,
	getCameraKickOffset,
	startCameraBob,
} from "./services/player/cameraEffectService";
import { dialogCapturesInput } from "./services/narrative/dialogService";
import { cutsceneActive } from "./services/narrative/cutsceneService";
import { uiState } from "./ui/uiState";
import {
	beginActiveModuleActivation,
	getActiveModuleCooldownRemaining,
	getEquippedActiveModule,
	resetActiveModuleCooldown,
	updateActiveModuleCooldown,
} from "./services/abilities/activeModuleService";
import { createExplosion } from "./services/combat/explosionService";
import { damageDestructibleWallsInRadius } from "./services/world/destructibleWallService";
import { spawnGravityPull } from "./spawn/spawnGravityPull";
import { addWormholeEffect } from "./spawn/spawnLevel";
import { getEnemyMovementMultiplier } from "./services/enemies/enemyMovementModifierService";
import { getPilotProtocolValue } from "./services/hub/pilotProtocolService";
import { applyHubCameraInterest } from "./services/hub/hubCameraInterestService";
import {
	clearPlayerStatusEffects,
	getPlayerStatusMultiplier,
	updatePlayerStatusEffects,
} from "./services/player/playerStatusEffectService";
import { spawnFollower } from "./spawn/spawnFollower";
import { spawnActiveModuleCarrier } from "./spawn/spawnActiveModuleCarrier"
import { installUltimateChargeOrbFeedback } from "./spawn/spawnUltimateChargeOrb"
import {
	getEquippedMobilityAbilityId,
	getEquippedUltimateAbilityId,
	type AbilityId,
} from "./services/abilities/abilityLoadoutService";
import {
	recordTelemetryAbilityFailure,
	recordTelemetryAbilityUse,
} from "./services/runs/runTelemetryService";
import {
	consumeUltimateCharge,
	getUltimateChargeProgress,
} from "./services/abilities/ultimateAbilityService";
import {
	activateGhostFleet,
	activateGravitonCollapse,
	activateScrapColossus,
	recordGhostFleetShot,
} from "./services/abilities/playerUltimateRuntime"
import {
	getAbilityDefinition,
	RETRO_BURST_CHARGE_COUNT,
} from "./services/abilities/abilityRegistry";
import { playRequirementErrorSound } from "./services/audio/uiSoundService";
import {
	getAbilityTierValues,
	type AbilityTierValues,
} from "./services/abilities/abilityTierService";
import {
	resetPassiveUpgradeRuntime,
	updatePassiveUpgradeRuntime,
} from "./services/abilities/passiveUpgradeRuntimeService";
import {
	activateDroneFrenzy,
	DRONE_FRENZY_DAMAGE_MULTIPLIER,
	DRONE_FRENZY_DURATION_SECONDS,
	DRONE_FRENZY_FIRE_RATE_MULTIPLIER,
	resetDroneFrenzy,
	updateDroneFrenzy,
} from "./services/abilities/droneFrenzyService"
import {
	createThrusterOverdriveState,
	updateThrusterOverdrive,
} from "./services/abilities/thrusterOverdriveService";
import {
	clampTurretWorldAngle,
	DRIFT_HULL_RESPONSE,
	easeAngle,
	getMovementModeSpeedMultiplier,
	getPlayerTurretLimitDegrees,
	getSignedAngleDelta,
	resolveStrafeInputActive,
	setPlayerTargetModeAimPosition,
	setPlayerTargetModeActive,
	shouldTurnHullForStationaryAim,
	TURRET_AIM_RESPONSE,
} from "./services/input/playerSteeringModeService"
import { addPlayerDamageEffects } from "./services/player/playerDamageEffectService"
import { applyEnemyEmpDisruption } from "./services/enemies/enemyEmpService"
import {
	getPlayerTargetInterceptPoint,
	setPlayerTargetLock,
	updatePlayerTargetMotion,
} from "./services/player/playerTargetLockService"
import { consumeExtraLife } from "./services/progression/extraLifeService"
import {
	getStrafeInputMode,
	isInputActionDown,
	onInputActionPress,
	onInputActionRelease,
	type InputController,
} from "./services/input/inputBindingService"
import {
	installWeaponWheel,
	weaponWheelOpen,
} from "./ui/weaponWheel"
import {
	completePlayerLassoRoomTransfer,
	getPlayerLassoThrusterLoad,
	installPlayerLasso,
	syncPlayerLassoRoomTransfer,
} from "./services/player/playerLassoService"
import { getEffectiveUpgradeLevel, getPermanentUpgradeLevel } from "./upg"
import { getLassoRigRank } from "./services/hub/lassoRigService"

let blasters = 0;
let bulletIndex = 1;
const targetOffset = 64;
const playerAcceleration = 420;
const playerDeceleration = 560;
const cameraZoomLerpSpeed = 5;
const strafeCameraZoomMultiplier = 1.2;
const normalCameraPointerWeight = 0.05;
const strafeCameraPointerWeight = 0.25;
const strafeTargetQueryRadius = 72;
const strafeTargetMinimumRadius = 14;
const strafeTargetPadding = 5;
const strafeTargetReleasePadding = 64;
const strafeTargetEaseResponse = 14;
const strafeTargetReleaseEaseDuration = 0.18;
const strafeTargetCritChanceBonus = 25;
const strafeTargetCritScaleMultiplier = 1.35;
const multiBlasterMountSpacing = 6;
const playerForwardLaunchOffset = 16;
const weaponRecoilReturnSpeed = 20;
const maxWeaponRecoilDistance = 8;
const overclockShakeInterval = 0.12;
const overclockShakeIntensity = 0.25;
const lowHealthSoundThreshold = 0.5;
const lowHealthFullVolumeThreshold = 0.3;
const lowHealthFlashThreshold = 0.5;
const lowHealthWarningStartVolume = 0.1;
const lowHealthWarningMaxVolume = 0.3;
const lowHealthFlashInterval = [1.4, 0.28] as const;
const lowHealthFlashDuration = 0.16;
const afterburnerWakeInterval = 0.14;
const phaseJumpAfterimageDuration = 0.18;
const phaseJumpPostInvulnerability = 0.6;
const phaseJumpDuration = 0.12;
const phaseSurgeDuration = 2
const phaseSurgeSpeedMultiplier = 1.4
const phaseSurgeCooldown = 8
const phaseSurgeFadeDuration = 0.16
const phaseSurgeReturnFadeDuration = 0.18
const phaseSurgeParticleInterval = 0.035
const gravitySlingRange = 150;
const gravitySlingHookSpeed = 760;
const gravitySlingBaseDamage = 14;
const gravitySlingReleaseSpeedMultiplier = 1.8;
const gravitySlingReleaseDrag = 1.35;
const phaseJumpCooldownBarWidth = 22;
const phaseJumpCooldownBarOffset = -22;
const primaryHeatBarWidth = 24;
const primaryHeatBarOffset = -27;
const retroBurstKnockbackForce = 48;
const normalCameraFollowSpeed = 16;
const phaseCameraFollowSpeed = 6;
const respawnTransitionDuration = 0.42;
const respawnArrivalInvulnerability = 0.35;
const respawnEntryStretch = 1.7;
const arrivalPulseDuration = 0.52;
const reactivePlatingCooldown = 3;
const weaponSwitchLabelOffset = 25
const weaponSwitchLabelFadeInDuration = 0.06
const weaponSwitchLabelHoldDuration = 0.18
const weaponSwitchLabelFadeOutDuration = 0.24
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
let phaseSurgeStartedAt = 0
let phaseSurgeActiveUntil = 0
let phaseSurgeReturnStartedAt = 0
let phaseSurgeReturnUntil = 0
let phaseSurgeParticleTimer = 0
let phaseSurgeWasActive = false
let retroBurstStart: Vec2 | undefined;
let retroBurstEnd: Vec2 | undefined;
let retroBurstElapsed = 0;
interface GravitySlingState {
	phase: "hook" | "sling";
	target?: GameObj<PosComp>;
	anchorPos: Vec2;
	hookStart: Vec2;
	hookVisual: GameObj<PosComp>;
	tetherVisual: GameObj<PosComp> & { endPos: Vec2 };
	elapsed: number;
	duration: number;
	slingStart?: Vec2;
	slingEnd?: Vec2;
	slingDirection?: Vec2;
	arcSide: number;
	damage: number;
	speedMultiplier: number;
	hitTargets: Set<number>;
}
let gravitySlingState: GravitySlingState | undefined;
let gravitySlingReleaseVelocity: Vec2;
let graviticImpalerTarget: GameObj<PosComp> | undefined
let graviticImpalerDamageMultiplier = 1
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
	extraLifeRespawn?: boolean;
	preserveRunState?: boolean;
}

type PlayerRuntimeObject = GameObj<PosComp | RotateComp | HealthComp> & {
	gravityVelocity: Vec2
	activeModuleInvulnerable?: boolean
}

interface PlayerRespawnTransitionOptions {
	startPosition?: Vec2
}

let activePlayerRespawnTransition:
	| ((target: Vec2, options?: PlayerRespawnTransitionOptions) => void)
	| undefined

export function playPlayerRespawnTransition(
	target: Vec2,
	options: PlayerRespawnTransitionOptions = {}
) {
	if (!activePlayerRespawnTransition) return false
	activePlayerRespawnTransition(target, options)
	return true
}

function phaseSurgeActive() {
	return k.time() < phaseSurgeActiveUntil
}

function getPlayerShipDirectionIndex(angle: number) {
	const safeAngle = Number.isFinite(angle) ? angle : 0
	return ((Math.round(safeAngle / 45) % 8) + 8) % 8
}

function getWasdDirection() {
	return k.vec2(
		(isInputActionDown("moveRight") ? 1 : 0) -
			(isInputActionDown("moveLeft") ? 1 : 0),
		(isInputActionDown("moveDown") ? 1 : 0) -
			(isInputActionDown("moveUp") ? 1 : 0)
	)
}

export function setupPlayer(options: SetupPlayerOptions = {}) {
	setPlayerTargetLock()
	setPlayerTargetModeActive(false)
	resetPlayerDeathCause();
	if (!options.preserveRunState) resetPassiveUpgradeRuntime();
	if (!options.preserveRunState) resetDroneFrenzy()
	clearGravitySlingState();
	gravitySlingReleaseVelocity = k.vec2(0);
	if (!options.preserveRunState) {
		graviticImpalerTarget = undefined
		graviticImpalerDamageMultiplier = 1
	}
	repairPulseGeneration++;
	reactivePlatingReadyAt = 0;
	let respawnTarget = options.spawnPosition?.clone() ?? k.center();
	let respawnStart = respawnTarget.add(
		-k.width() / (WORLD_CAMERA_SCALE * 2) - 48,
		k.rand(-36, 36)
	);
	let respawnDirection = respawnTarget.sub(respawnStart);
	let respawnAngle = respawnDirection.angle() + 90;
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
		k.sprite(requirePrimaryVisualSprite(PLAYER_VISUAL)),
		k.color(k.WHITE),
		k.rotate(respawnTransitionActive ? respawnAngle : 0),
		k.scale(
			arrivalTransitionActive
				? k.vec2(PLAYER_SCALE * 0.2)
				: respawnTransitionActive
				? k.vec2(PLAYER_SCALE * 0.65, PLAYER_SCALE * respawnEntryStretch)
				: k.vec2(PLAYER_SCALE)
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
			playerHullVisual: undefined as GameObj | undefined,
		},
		tags.friendly,
		tags.player,
		tags.gameLoop,
	]);
	let playerHullDirection = getPlayerShipDirectionIndex(playerObj.angle)
	const playerHullObj = playerObj.add([
		k.sprite(PLAYER_DIRECTIONAL_SPRITES[playerHullDirection]),
		k.anchor("center"),
		k.rotate(-playerHullDirection * 45),
		k.color(k.WHITE),
		k.opacity(playerObj.opacity),
		k.z(0),
	])
	playerObj.playerHullVisual = playerHullObj
	playerHullObj.onUpdate(() => {
		const nextDirection = getPlayerShipDirectionIndex(playerObj.angle)
		if (nextDirection !== playerHullDirection) {
			playerHullObj.use(k.sprite(PLAYER_DIRECTIONAL_SPRITES[nextDirection]))
			playerHullDirection = nextDirection
		}
		// Cancel only the selected frame's baked angle. The parent keeps the
		// remaining rotation, so the hull still follows the exact 360° heading.
		playerHullObj.angle = -playerHullDirection * 45
		playerHullObj.color = playerObj.color
		playerHullObj.opacity = playerObj.opacity
	})
	const weaponSwitchLabel = k.add([
		k.pos(playerObj.pos.add(0, weaponSwitchLabelOffset)),
		k.text("", {
			font: "unscii",
			size: 7,
		}),
		k.anchor("center"),
		k.color(k.WHITE),
		k.opacity(0),
		k.z(120),
		k.layer(layers.gameText),
		tags.gameLoop,
	])
	let weaponSwitchLabelElapsed = Infinity
	const showWeaponSwitchLabel = (weapon: WeaponDefinition) => {
		weaponSwitchLabel.text = weapon.name
		weaponSwitchLabelElapsed = 0
	}
	weaponSwitchLabel.onUpdate(() => {
		weaponSwitchLabel.pos = playerObj.pos.add(0, weaponSwitchLabelOffset)
		weaponSwitchLabelElapsed += k.dt()
		const fadeOutStart = weaponSwitchLabelFadeInDuration +
			weaponSwitchLabelHoldDuration
		const totalDuration = fadeOutStart + weaponSwitchLabelFadeOutDuration
		if (weaponSwitchLabelElapsed < weaponSwitchLabelFadeInDuration) {
			weaponSwitchLabel.opacity = k.clamp(
				weaponSwitchLabelElapsed / weaponSwitchLabelFadeInDuration,
				0,
				1
			)
			return
		}
		if (weaponSwitchLabelElapsed < fadeOutStart) {
			weaponSwitchLabel.opacity = 1
			return
		}
		weaponSwitchLabel.opacity = 1 - k.clamp(
			(weaponSwitchLabelElapsed - fadeOutStart) /
				weaponSwitchLabelFadeOutDuration,
			0,
			1
		)
		if (weaponSwitchLabelElapsed >= totalDuration) {
			weaponSwitchLabel.opacity = 0
		}
	})
	clearPlayerStatusEffects();
	player.speedPwrUpMultiplier = 1;
	const thruster = addShipThruster(playerObj, playerObj.height / 2 - 2)
	const thrusterOverdriveState = createThrusterOverdriveState()
	let playerThrusterSound: AudioPlay | null = null
	let playerThrusterSoundElapsed = PLAYER_THRUSTER_SOUND_UPDATE_INTERVAL
	let playerThrusterVolume = 0
	let playerThrusterPlaybackSpeed = 1
	const updatePlayerThrusterSound = (movementSpeed: number, deltaSeconds: number) => {
		playerThrusterSoundElapsed += deltaSeconds
		if (playerThrusterSoundElapsed < PLAYER_THRUSTER_SOUND_UPDATE_INTERVAL) return
		const updateDelta = playerThrusterSoundElapsed
		playerThrusterSoundElapsed = 0
		const target = getPlayerThrusterSoundMix(movementSpeed, player.speed)
		const response = 1 - Math.exp(-10 * updateDelta)
		const nextVolume = k.lerp(
			playerThrusterVolume,
			mainSoundVolume * target.volume,
			response
		)
		const nextPlaybackSpeed = k.lerp(
			playerThrusterPlaybackSpeed,
			target.speed,
			response
		)
		const volumeChanged = Math.abs(nextVolume - playerThrusterVolume) >= 0.002
		const speedChanged = Math.abs(
			nextPlaybackSpeed - playerThrusterPlaybackSpeed
		) >= 0.003
		playerThrusterVolume = nextVolume
		playerThrusterPlaybackSpeed = nextPlaybackSpeed
		if (!playerThrusterSound) {
			playerThrusterSound = gameSoundService.play("player_thruster_loop", {
				loop: true,
				volume: playerThrusterVolume,
				speed: playerThrusterPlaybackSpeed,
			})
			return
		}
		if (!volumeChanged && !speedChanged) return
		gameSoundService.update(playerThrusterSound, {
			volume: playerThrusterVolume,
			speed: playerThrusterPlaybackSpeed,
		})
	}
	const stopPlayerThrusterSound = () => {
		gameSoundService.stop(playerThrusterSound, "player-destroyed")
		playerThrusterSound = null
	}
	let lowHealthWarningSound: AudioPlay | null | undefined
	let lowHealthWarningActive = false
	let lowHealthFlashActive = false
	let lowHealthFlashTimer = 0
	let lowHealthFlashGeneration = 0
	const stopLowHealthWarning = () => {
		if (!lowHealthWarningActive && !lowHealthWarningSound) return
		if (lowHealthWarningSound) {
			audioService.stopSound(lowHealthWarningSound, "health-recovered")
			lowHealthWarningSound = undefined
		}
		lowHealthWarningActive = false
		lowHealthFlashActive = false
		lowHealthFlashTimer = 0
		lowHealthFlashGeneration++
		playerObj.color = k.WHITE
	}
	const syncLowHealthWarning = () => {
		const healthRatio = playerObj.maxHP > 0
			? playerObj.hp / playerObj.maxHP
			: 0
		const lowHealth = playerObj.hp > 0 &&
			healthRatio <= lowHealthSoundThreshold
		if (!lowHealth) {
			stopLowHealthWarning()
			return
		}
		lowHealthWarningActive = true
		const volumeProgress = k.clamp(
			(lowHealthSoundThreshold - healthRatio) /
				(lowHealthSoundThreshold - lowHealthFullVolumeThreshold),
			0,
			1
		)
		const warningVolume = k.lerp(
			lowHealthWarningStartVolume,
			lowHealthWarningMaxVolume,
			volumeProgress
		)
		if (!lowHealthWarningSound) {
			lowHealthWarningSound = gameSoundService.play("low_health_warning", {
				volume: warningVolume,
				loop: true,
			})
		} else {
			gameSoundService.update(lowHealthWarningSound, {
				volume: warningVolume,
			})
		}
		if (healthRatio > lowHealthFlashThreshold) {
			if (lowHealthFlashActive) {
				lowHealthFlashActive = false
				lowHealthFlashTimer = 0
				lowHealthFlashGeneration++
				playerObj.color = k.WHITE
			}
			return
		}
		lowHealthFlashActive = true
		const flashUrgency = k.clamp(
			(lowHealthFlashThreshold - healthRatio) / lowHealthFlashThreshold,
			0,
			1
		)
		const flashInterval = k.lerp(
			lowHealthFlashInterval[0],
			lowHealthFlashInterval[1],
			Math.pow(flashUrgency, 0.75)
		)
		lowHealthFlashTimer = Math.min(lowHealthFlashTimer, flashInterval)
		lowHealthFlashTimer -= k.dt()
		if (lowHealthFlashTimer > 0) return
		lowHealthFlashTimer = flashInterval
		const flashGeneration = ++lowHealthFlashGeneration
		playerObj.color = k.rgb(255, 45, 45)
		k.wait(lowHealthFlashDuration, () => {
			if (
				playerObj.exists() &&
				flashGeneration === lowHealthFlashGeneration
			) playerObj.color = k.WHITE
		})
	}
	const inputControllers: InputController[] = [];
	inputControllers.push(installUltimateChargeOrbFeedback(playerObj));
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
	let primarySustainStartedAt: number | undefined;
	let primarySustainWeaponId = "";
	interface PrimaryHeatState {
		heat: number
		overheated: boolean
		coolingPerSecond: number
		recoveryThreshold: number
	}
	const primaryHeatStates = new Map<string, PrimaryHeatState>();
	const getPrimaryHeatState = (weapon: WeaponDefinition) => {
		const overheat = weapon.sustainedFire?.overheat;
		if (!overheat) return undefined;
		let state = primaryHeatStates.get(weapon.id);
		if (!state) {
			state = {
				heat: 0,
				overheated: false,
				coolingPerSecond: overheat.coolingPerSecond,
				recoveryThreshold: overheat.recoveryThreshold,
			};
			primaryHeatStates.set(weapon.id, state);
		}
		return state;
	};
	const isPrimaryWeaponOverheated = (weapon: WeaponDefinition) =>
		getPrimaryHeatState(weapon)?.overheated === true;
	const getPrimaryHeatColor = (heatState: PrimaryHeatState) => {
		if (heatState.overheated) {
			const pulse = (Math.sin(k.time() * 18) + 1) / 2;
			return k.rgb(255, 45 + 40 * pulse, 45 + 20 * pulse);
		}
		return heatState.heat >= 0.7
			? k.rgb(255, 145, 45)
			: k.rgb(75, 205, 255);
	};
	let nextPrimaryChargeParticleAt = 0;
	let primaryChargeReadySoundPlayed = false;
	let primaryChargeSound: AudioPlay | null | undefined;
	let primaryChargeSoundSpeed = 0;
	const stopPrimaryChargeSound = () => {
		if (!primaryChargeSound) return;
		gameSoundService.stop(primaryChargeSound, "primary-charge-ended");
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
	const primaryHeatTrack = k.add([
		k.pos(playerObj.pos),
		k.rect(primaryHeatBarWidth, 3),
		k.anchor("left"),
		k.color(35, 48, 58),
		k.opacity(0),
		k.z(10),
		tags.gameLoop,
	]);
	const primaryHeatFill = k.add([
		k.pos(playerObj.pos),
		k.rect(primaryHeatBarWidth, 3),
		k.anchor("left"),
		k.color(75, 205, 255),
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
	let driftMoveDirection = k.Vec2.fromAngle(playerObj.angle - 90)
	let weaponRecoilOffset = 0;

	const targetObj = k.add([k.pos(k.center()), k.z(1000), tags.gameLoop]);
	let strafeTarget: GameObj<PosComp> | undefined
	let strafeTargetMarker: GameObj | undefined
	let strafeAimPos = playerObj.pos.clone()
	let strafeAimActive = false
	let strafeModeToggled = false
	let strafeTargetReleaseEaseRemaining = 0
	let strafeModeWasActive = false
	let strafeTargetCritActive = false
	const setStrafeTarget = (nextTarget?: GameObj<PosComp>) => {
		if (nextTarget?.id === strafeTarget?.id) return
		const acquiredTarget = Boolean(nextTarget)
		const releasedTarget = Boolean(strafeTarget) && !nextTarget
		strafeTarget = nextTarget
		setPlayerTargetLock(nextTarget)
		if (releasedTarget) {
			strafeTargetReleaseEaseRemaining = strafeTargetReleaseEaseDuration
		}
		if (!acquiredTarget) return
		gameSoundService.play("target_lock", {
			volume: mainSoundVolume * 0.7,
		})
	}
	currentCameraPos = respawnTarget.clone();
	currentCameraScale = WORLD_CAMERA_SCALE;
	k.setCamPos(respawnTarget);
	k.setCamScale(WORLD_CAMERA_SCALE);
	const beginRespawnTransition = (
		target: Vec2,
		transitionOptions: PlayerRespawnTransitionOptions = {}
	) => {
		respawnTarget = target.clone()
		respawnStart = transitionOptions.startPosition?.clone() ?? respawnTarget.add(
			-k.width() / (WORLD_CAMERA_SCALE * 2) - 48,
			k.rand(-36, 36)
		)
		respawnDirection = respawnTarget.sub(respawnStart)
		respawnAngle = respawnDirection.angle() + 90
		respawnTransitionElapsed = 0
		respawnTransitionActive = true
		phaseJumpStart = undefined
		phaseJumpEnd = undefined
		phaseJumpElapsed = 0
		phaseSurgeStartedAt = 0
		phaseSurgeActiveUntil = 0
		phaseSurgeReturnStartedAt = 0
		phaseSurgeReturnUntil = 0
		phaseSurgeParticleTimer = 0
		phaseSurgeWasActive = false
		retroBurstStart = undefined
		retroBurstEnd = undefined
		retroBurstElapsed = 0
		clearGravitySlingState()
		gravitySlingReleaseVelocity = k.vec2(0)
		currentMoveSpeed = 0
		driftMoveDirection = k.Vec2.fromAngle(respawnAngle - 90)
		playerObj.pos = respawnStart.clone()
		playerObj.gravityVelocity = k.vec2(0)
		playerObj.angle = respawnAngle
		playerObj.scale = k.vec2(
			PLAYER_SCALE * 0.65,
			PLAYER_SCALE * respawnEntryStretch
		)
		playerObj.opacity = 0.3
		currentCameraPos = respawnTarget.clone()
		k.setCamPos(respawnTarget)
		setPlayerDamageInvulnerable(true)
		spawnRespawnJumpEffect(respawnStart, respawnTarget, respawnAngle)
	}
	activePlayerRespawnTransition = beginRespawnTransition
	if (respawnTransitionActive) {
		beginRespawnTransition(respawnTarget, { startPosition: respawnStart })
	}
	if (arrivalTransitionActive) {
		setPlayerDamageInvulnerable(true);
	}
	if (options.extraLifeRespawn) {
		phaseJumpInvulnerableUntil = k.time() + 1.25
		setPlayerDamageInvulnerable(true)
		starsEmitter.emitter.position = respawnTarget
		starsEmitter.emit(24)
		spawnFlash(respawnTarget, 12, k.rgb(80, 180, 255))
		spawnRing({
			pos: respawnTarget,
			speed: 150,
			intensity: 0.2,
			maxRadius: 48,
			effectWidth: 8,
			outlineWidth: 2,
			visualOpacity: 0.8,
			color: k.rgb(80, 180, 255),
		})
	}

	registerHitAnimation(playerObj);
	addPlayerDamageEffects(playerObj)

	configureBlasters(muzzleObj);
	configuredWeaponId = equippedWeapon.id;

	playerObj.onDeath(() => {
		const deathPos = playerObj.pos.clone();
		const extraLife = consumeExtraLife()
		k.destroy(phaseJumpCooldownTrack);
		k.destroy(phaseJumpCooldownFill);
		k.destroy(playerObj);
		starsEmitter.emitter.position = deathPos;
		starsEmitter.emit(20);
		gameSoundService.play("explosion1", { volume: mainSoundVolume });
		if (extraLife) {
			respawnPlayerFromExtraLife(deathPos, extraLife.remaining)
			return
		}
		spawnPlayerDeathDebris(
			deathPos,
			getCarriedDebree(),
			narrativePrologueActive()
		);
		beginPlayerDeathSequence();
	});
	playerObj.onDestroy(() => {
		if (activePlayerRespawnTransition === beginRespawnTransition) {
			activePlayerRespawnTransition = undefined
		}
		stopPlayerThrusterSound()
		stopLowHealthWarning()
		stopPrimaryChargeSound();
		setStrafeTarget()
		setPlayerTargetModeActive(false)
		if (weaponSwitchLabel.exists()) k.destroy(weaponSwitchLabel)
		for (const controller of inputControllers) controller.cancel();
	});

	playerObj.onUpdate(() => profileSection("external:playerVisuals", () => {
		setPlayerTargetModeActive(false)
		syncLowHealthWarning()
		// Clear before transition early returns so jumps never leave a stale flame.
		if (levelTransitionActive() || arrivalTransitionActive || respawnTransitionActive) {
			strafeModeToggled = false
			updatePlayerThrusterSound(0, dt())
			setStrafeTarget()
			thruster.update(0, 0)
			thruster.setColor(k.WHITE)
			player.speedPwrUpMultiplier = 1
			stopPrimaryChargeSound();
			primaryChargeStartedAt = undefined;
			primaryChargeWeaponId = "";
			primarySustainStartedAt = undefined;
			primarySustainWeaponId = "";
		}
		updatePlayerStatusEffects(dt());
		cargoObj = updateShipRewardVisuals(
			playerObj,
			scrapArmorPlates,
			cargoObj
		);
		const currentWeapon = getEquippedWeapon();
		for (const [weaponId, heatState] of primaryHeatStates) {
			const activelySustaining =
				currentWeapon.id === weaponId &&
				primarySustainStartedAt !== undefined &&
				primarySustainWeaponId === weaponId &&
				!heatState.overheated;
			if (!activelySustaining) {
				heatState.heat = Math.max(
					0,
					heatState.heat - heatState.coolingPerSecond * dt()
				);
			}
			if (
				heatState.overheated &&
				heatState.heat <= heatState.recoveryThreshold
			) heatState.overheated = false;
		}
		const currentHeatState = getPrimaryHeatState(currentWeapon);
		const showPrimaryHeat = currentHeatState !== undefined && (
			currentHeatState.heat > 0 ||
			primarySustainWeaponId === currentWeapon.id
		);
		const heatBarPos = playerObj.pos.add(
			-primaryHeatBarWidth / 2,
			primaryHeatBarOffset
		);
		primaryHeatTrack.pos = heatBarPos;
		primaryHeatFill.pos = heatBarPos;
		primaryHeatTrack.opacity = showPrimaryHeat ? 0.65 : 0;
		primaryHeatFill.opacity = showPrimaryHeat ? 1 : 0;
		primaryHeatFill.width = primaryHeatBarWidth *
			(currentHeatState?.heat ?? 0);
		primaryHeatFill.color = currentHeatState
			? getPrimaryHeatColor(currentHeatState)
			: k.rgb(75, 205, 255);
		if (configuredWeaponId !== currentWeapon.id) {
			weaponVisual.use(k.sprite(currentWeapon.icon));
			weaponRecoilOffset = 0;
			weaponVisual.scale = k.vec2(
				currentWeapon.mountScale / PLAYER_SCALE
			);
			configuredWeaponId = currentWeapon.id;
			configureBlasters(muzzleObj);
		}
		weaponRecoilOffset = k.lerp(
			weaponRecoilOffset,
			0,
			1 - Math.exp(-weaponRecoilReturnSpeed * dt())
		);
		if (weaponRecoilOffset < 0.01) weaponRecoilOffset = 0;
		weaponVisual.pos.y =
			(currentWeapon.mountOffsetY + weaponRecoilOffset) / PLAYER_SCALE;
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
				stopPrimaryChargeSound();
				const muzzlePos = getPlayerMuzzlePos(
					playerObj.pos,
					k.vec2(0, currentWeapon.muzzleOffsetY),
					turretWorldAngle
				);
				spawnFlash(muzzlePos, 5, chargeColor);
				spawnPlayerReadinessFlash(playerObj, chargeColor);
				gameSoundService.play("rail_lance_ready", {
					volume: mainSoundVolume,
					detune: 200,
				});
			}
		} else if (!currentWeapon.charge || primaryChargeStartedAt === undefined) {
			stopPrimaryChargeSound();
		}
		weaponVisual.color = currentHeatState && currentHeatState.heat > 0
			? getPrimaryHeatColor(currentHeatState)
			: k.rgb(
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
				recoverPlayerHealth(playerObj, addedHealth);
			}
			syncPlayerHealthBarCapacity(desiredMaxHealth);
			updatePlayerHealthBar(playerObj.hp);
		}

		updateActiveModuleCooldown(dt());
		updateDroneFrenzy(dt())
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
			syncPlayerLassoRoomTransfer(playerObj.pos)
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
				completePlayerLassoRoomTransfer()
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
		const isGravitySlinging = updateGravitySling(playerObj);
		const isPhaseSurging = phaseSurgeActive()
		if (phaseSurgeWasActive && !isPhaseSurging) {
			phaseSurgeReturnStartedAt = k.time()
			phaseSurgeReturnUntil = k.time() + phaseSurgeReturnFadeDuration
			spawnPhaseSurgeReturnEffect(playerObj.pos.clone())
		}
		phaseSurgeWasActive = isPhaseSurging
		if (isPhaseSurging) {
			phaseSurgeParticleTimer -= dt()
			if (phaseSurgeParticleTimer <= 0) {
				emitPhaseSurgeParticles(playerObj)
				phaseSurgeParticleTimer += phaseSurgeParticleInterval
			}
		}
		const isMobilityMoving =
			isPhaseJumping || isRetroBursting || isGravitySlinging;
		const strafeInputMode = getStrafeInputMode()
		if (strafeInputMode === "hold") strafeModeToggled = false
		const driftModeActive =
			!isMobilityMoving &&
			isStrafeTrainingUnlocked() &&
			!gameplayInputBlocked() &&
			resolveStrafeInputActive(
				strafeInputMode,
				isInputActionDown("strafe"),
				strafeModeToggled
			)
		updatePlayerSteeringModeUi(driftModeActive)
		const pointerWorldPos = k.toWorld(k.mousePos())
		strafeAimActive = driftModeActive
		setPlayerTargetModeActive(strafeAimActive)
		setStrafeTarget(
			strafeAimActive
				? findHoveredStrafeTarget(pointerWorldPos, strafeTarget)
				: undefined
		)
		if (strafeAimActive) {
			if (!strafeModeWasActive) {
				strafeAimPos = pointerWorldPos.clone()
				strafeTargetReleaseEaseRemaining = 0
			}
			if (!strafeTargetMarker?.exists()) {
				strafeTargetMarker = spawnStrafeTargetMarker(strafeAimPos)
			}
			const lockedTarget = strafeTarget?.exists() ? strafeTarget : undefined
			strafeTargetCritActive = Boolean(
				lockedTarget && pointerIsOverTarget(pointerWorldPos, lockedTarget)
			)
			if (lockedTarget) updatePlayerTargetMotion(lockedTarget, dt())
			const equippedProjectileSpeed = getPlayerWeaponProjectileSpeed()
			const desiredAimPos = lockedTarget
				? getPlayerTargetInterceptPoint(
					playerObj.pos,
					lockedTarget,
					equippedProjectileSpeed
				)
				: pointerWorldPos
			if (lockedTarget || strafeTargetReleaseEaseRemaining > 0) {
				const blend = 1 - Math.exp(-strafeTargetEaseResponse * dt())
				strafeAimPos = strafeAimPos.lerp(desiredAimPos, blend)
				strafeTargetReleaseEaseRemaining = Math.max(
					0,
					strafeTargetReleaseEaseRemaining - dt()
				)
			} else {
				strafeAimPos = pointerWorldPos.clone()
			}
			strafeTargetMarker.pos = strafeAimPos.clone()
			strafeTargetMarker.angle += 90 * dt()
			const huntersGeometryActive = strafeTargetCritActive &&
				getEffectiveUpgradeLevel("huntersGeometry") !== undefined
			const markerScale = k.wave(0.9, 1.08, k.time() * 7) *
				(strafeTargetCritActive
					? strafeTargetCritScaleMultiplier *
						(huntersGeometryActive ? 1.14 : 1)
					: 1)
			strafeTargetMarker.scale = k.vec2(markerScale)
			strafeTargetMarker.color = strafeTargetCritActive
				? huntersGeometryActive
					? k.rgb(155, 100, 255)
					: k.rgb(0, 210, 255)
				: lockedTarget
					? k.rgb(255, 70, 70)
					: k.WHITE
		} else if (strafeTargetMarker?.exists()) {
			k.destroy(strafeTargetMarker)
			strafeTargetMarker = undefined
		}
		setPlayerTargetModeAimPosition(
			strafeAimActive ? strafeAimPos : undefined
		)
		if (!strafeAimActive) strafeTargetCritActive = false
		strafeModeWasActive = strafeAimActive
		const isInvulnerable =
			isPhaseJumping || isGravitySlinging || isPhaseSurging ||
			k.time() < phaseJumpInvulnerableUntil;
		setPlayerDamageInvulnerable(isInvulnerable);
		if (isPhaseSurging) {
			const fadeProgress = k.clamp(
				(k.time() - phaseSurgeStartedAt) / phaseSurgeFadeDuration,
				0,
				1
			)
			playerObj.opacity = k.lerp(1, 0.16, fadeProgress)
		} else if (k.time() < phaseSurgeReturnUntil) {
			const returnProgress = k.clamp(
				(k.time() - phaseSurgeReturnStartedAt) / phaseSurgeReturnFadeDuration,
				0,
				1
			)
			playerObj.opacity = k.lerp(0.16, 1, returnProgress)
		} else {
			playerObj.opacity = isInvulnerable ? 0.35 : 1
		}
		if (cutsceneActive()) {
			currentCameraPos = k.getCamPos().clone()
		} else {
			const cameraFollowSpeed = isMobilityMoving
				? phaseCameraFollowSpeed
				: normalCameraFollowSpeed;
			const cameraPointerWeight = driftModeActive
				? strafeCameraPointerWeight
				: normalCameraPointerWeight
			const playerCameraTarget = playerObj.pos.lerp(
				pointerWorldPos,
				cameraPointerWeight
			)
			const cameraTarget = applyHubCameraInterest(
				playerCameraTarget,
				playerObj.pos
			)
			if (!currentCameraPos) currentCameraPos = playerObj.pos.clone();
			currentCameraPos = currentCameraPos.lerp(
				cameraTarget,
				1 - Math.exp(-cameraFollowSpeed * dt())
			);
			k.setCamPos(currentCameraPos.add(getCameraKickOffset()));
		}

		if (!isInvulnerable) {
			checkProjectileIntersection(playerObj.pos, 12, tags.enemy, (p) => {
				const shouldDestroy = applyProjectileDamage(playerObj, p);
				if (shouldDestroy) k.destroy(p);
			});
		}

		const wasdDir = getWasdDirection();
		const overdriveTier = getAbilityTierValues("thrusterOverdrive");
		const overdriveWasOverused = thrusterOverdriveState.overused;
		const overdriveUpdate = updateThrusterOverdrive(
			thrusterOverdriveState,
			!isMobilityMoving &&
				mobilityId === "thrusterOverdrive" &&
				isInputActionDown("mobility") &&
				wasdDir.len() > 0,
			dt(),
			overdriveTier.recovery
		);
		if (!overdriveWasOverused && overdriveUpdate.overused) {
			gameSoundService.play("player_overheated", {
				volume: mainSoundVolume * 0.55,
			});
		}
		const isBoosting = overdriveUpdate.active;
		player.speedPwrUpMultiplier = isPhaseSurging
			? phaseSurgeSpeedMultiplier
			: isBoosting
				? 1.2 * overdriveTier.speed
				: 1;
		const maxSpeed =
			player.speed *
			getMovementModeSpeedMultiplier(
				player.speedMultiplier,
				player.strafeSpeedMultiplier,
				driftModeActive
			) *
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
		const worldMovementVelocity = controlVelocity.add(gravityVelocity)
		if (worldMovementVelocity.len() > 0.001) {
			driftMoveDirection = worldMovementVelocity.unit()
		}
		const steeringVelocity = driftModeActive
			? worldMovementVelocity.len() > 0.001
				? worldMovementVelocity
				: driftMoveDirection.scale(currentMoveSpeed)
			: (wasdDir.len() > 0 ? controlVelocity : headingInertia)
				.add(gravityVelocity)
				.add(gravitySlingReleaseVelocity);

		let moveDirection = k.Vec2.fromAngle(playerObj.angle + 90);
		let nextPlayerAngle = playerObj.angle;
		let desiredPlayerAngle = playerObj.angle;
		if (steeringVelocity.len() > 0.001 && !isMobilityMoving) {
			moveDirection = steeringVelocity.unit();
			targetObj.pos = playerObj.pos.add(moveDirection.scale(targetOffset));
			if (!driftModeActive) {
				const movementRotation = lerpAngleBetweenPos(
					playerObj.angle,
					playerObj.pos,
					targetObj.pos,
					frameRateIndependentBlend(
						0.05 * timeScale * playerObj.getTimescale(),
						k.dt()
					),
					-90
				);
				nextPlayerAngle = movementRotation.lerp;
				desiredPlayerAngle = movementRotation.correctedDesiredRot;
			}
		} else {
			targetObj.pos = playerObj.pos;
		}

		// The turret angle is local to the rotating player, while aiming uses a
		// world angle. Keep both coordinate spaces separate.
		const turretAimWorldPos = strafeAimActive
			? strafeAimPos
			: k.toWorld(k.mousePos());
		const desiredTurretWorldAngle = lerpAngleBetweenPos(
			turretWorldAngle,
			playerObj.pos,
			turretAimWorldPos,
			1,
			-90
		).correctedDesiredRot;
		const steeringDelta = dt() * timeScale * playerObj.getTimescale()
		const turretTraverseRank = (getPermanentUpgradeLevel("turretTraverse") ?? -1) + 1
		const turretLimitDegrees = getPlayerTurretLimitDegrees(turretTraverseRank)
		if (driftModeActive) {
			turretWorldAngle = easeAngle(
				turretWorldAngle,
				desiredTurretWorldAngle,
				TURRET_AIM_RESPONSE,
				steeringDelta
			)
			nextPlayerAngle = easeAngle(
				playerObj.angle,
				turretWorldAngle,
				DRIFT_HULL_RESPONSE,
				steeringDelta
			)
			desiredPlayerAngle = turretWorldAngle
		} else {
			if (shouldTurnHullForStationaryAim(
				nextPlayerAngle,
				desiredTurretWorldAngle,
				wasdDir.len() <= 0.001,
				turretLimitDegrees
			)) {
				nextPlayerAngle = easeAngle(
					nextPlayerAngle,
					desiredTurretWorldAngle,
					DRIFT_HULL_RESPONSE,
					steeringDelta
				)
				desiredPlayerAngle = desiredTurretWorldAngle
			}
			const constrainedTurretAngle = clampTurretWorldAngle(
				nextPlayerAngle,
				desiredTurretWorldAngle,
				turretLimitDegrees
			)
			turretWorldAngle = easeAngle(
				turretWorldAngle,
				constrainedTurretAngle,
				TURRET_AIM_RESPONSE,
				steeringDelta
			)
			turretWorldAngle = clampTurretWorldAngle(
				nextPlayerAngle,
				turretWorldAngle,
				turretLimitDegrees
			)
		}
		playerObj.angle = nextPlayerAngle;
		turretObj.angle = getSignedAngleDelta(playerObj.angle, turretWorldAngle);

		thruster.setColor(
			isBoosting || isPhaseSurging ? k.rgb(80, 210, 255) : k.WHITE
		)
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
		const targetCameraScale = driftModeActive
			? WORLD_CAMERA_SCALE * strafeCameraZoomMultiplier
			: isBoosting
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
		const slingReleaseSpeed = gravitySlingReleaseVelocity.len() *
			playerObj.getTimescale();
		updatePlayerThrusterSound(speed + slingReleaseSpeed, dt())
		// Hull reinforcement and attached armor stand in for visual weight;
		// this affects exhaust only, leaving movement balance unchanged.
		const thrustWeight = 1 + Math.min(0.75,
			Math.max(
				0,
					(getPlayerMaxHealth() - BASE_PLAYER_HEALTH) /
					HULL_UPGRADE_AMOUNT
			) * 0.08 +
			session.scrapArmorCharges * 0.1
		)
		const lassoThrusterLoad = getPlayerLassoThrusterLoad()
		const emitThrusterParticle = thruster.update(
			isMobilityMoving ? 0 : speed + slingReleaseSpeed,
			dt(),
			thrustWeight,
			lassoThrusterLoad
		)

		if (!isMobilityMoving) {
			if (driftModeActive) {
				playerObj.move(
					moveDirection.scale(speed * velocityScale())
				)
				playerObj.angle = nextPlayerAngle
				applySteeringLean(
					playerObj,
					nextPlayerAngle,
					desiredPlayerAngle,
					PLAYER_SCALE
				)
			} else {
				steerMoveRotateAndLean(
					playerObj,
					nextPlayerAngle,
					speed,
					desiredPlayerAngle,
					PLAYER_SCALE
				);
			}
			if (gravitySlingReleaseVelocity.len() > 0) {
				playerObj.move(
					gravitySlingReleaseVelocity.scale(
						velocityScale() * playerObj.getTimescale()
					)
				)
				gravitySlingReleaseVelocity = gravitySlingReleaseVelocity.scale(
					Math.exp(
						-gravitySlingReleaseDrag * dt() * playerObj.getTimescale()
					)
				)
				if (gravitySlingReleaseVelocity.len() < 6) {
					gravitySlingReleaseVelocity = k.vec2(0)
				}
			}
		}
		if (emitThrusterParticle && !isMobilityMoving) {
			const activeTrailEmitter = isBoosting || isPhaseSurging
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
		gameSoundService.play("hit2", { volume: mainSoundVolume });
		playerObj.animation.seek(0);
		k.shake(20);
		updatePlayerHealthBar(playerObj.hp);
	});

	const gameplayInputBlocked = () =>
		dialogCapturesInput() ||
		isPointerOverUi() ||
		uiState.modalOpen ||
		uiState.pauseMenuOpen ||
		cutsceneActive() ||
		k.get("chestUI").length > 0 ||
		levelTransitionActive() ||
		respawnTransitionActive;
	const combatInputBlocked = () =>
		gameplayInputBlocked() || weaponWheelOpen() || phaseSurgeActive()
	inputControllers.push(onInputActionPress("strafe", () => {
		if (gameplayInputBlocked() || !isStrafeTrainingUnlocked()) return
		if (getStrafeInputMode() !== "toggle") return
		strafeModeToggled = !strafeModeToggled
	}))
	const canFirePrimaryWeapon = () => !combatInputBlocked();
	const kickWeaponVisual = (weapon: WeaponDefinition, chargeRatio: number) => {
		const projectileCount = Math.max(
			1,
			Math.floor(weapon.pattern?.projectileCount ?? 1)
		);
		const salvoMultiplier = 1 + Math.min(0.45, (projectileCount - 1) * 0.1);
		const chargeMultiplier = weapon.charge
			? k.lerp(0.7, 1.35, k.clamp(chargeRatio, 0, 1))
			: 1;
		const recoilDistance = k.clamp(
			(2 + weapon.damageMultiplier * 2.2) *
				salvoMultiplier * chargeMultiplier,
			2.5,
			maxWeaponRecoilDistance
		);
		weaponRecoilOffset = Math.max(weaponRecoilOffset, recoilDistance);
	};
	const kickCameraForWeapon = (
		weapon: WeaponDefinition,
		chargeRatio: number,
		burstDamageMultiplier: number
	) => {
		const projectileCount = Math.max(
			1,
			Math.floor(weapon.pattern?.projectileCount ?? 1)
		)
		const salvoMultiplier = 1 + Math.min(
			0.35,
			(projectileCount - 1) * 0.08
		)
		const chargeMultiplier = weapon.charge
			? k.lerp(
				weapon.charge.minDamageMultiplier,
				weapon.charge.maxDamageMultiplier,
				k.clamp(chargeRatio, 0, 1)
			)
			: 1
		const strength = k.clamp(
			0.35 +
				weapon.damageMultiplier *
				chargeMultiplier *
				burstDamageMultiplier *
				salvoMultiplier *
				0.55,
			0.65,
			3.1
		)
		addCameraKick(
			k.Vec2.fromAngle(turretWorldAngle + 90),
			strength
		)
	}

	const fireWeaponVolley = (
		weapon: WeaponDefinition,
		chargeRatio: number,
		playFireSound: boolean,
		burstDamageMultiplier: number = 1,
		sustainedFireRatio: number = 0
	) => {
		if (!playerObj.exists() || getEquippedWeapon().id !== weapon.id) return;
		if (combatInputBlocked()) return;
		const charge = weapon.charge;
		const chargeDamageMultiplier = charge
			? k.lerp(
				charge.minDamageMultiplier,
				charge.maxDamageMultiplier,
				chargeRatio
			)
			: 1;
		const damageMultiplier = chargeDamageMultiplier * burstDamageMultiplier;
		const alteredTargeting = strafeTargetCritActive &&
			getEffectiveUpgradeLevel("huntersGeometry") !== undefined
		const impalerTarget = weapon.id === "railLance" &&
			getEffectiveUpgradeLevel("graviticImpaler") !== undefined &&
			graviticImpalerTarget?.exists()
			? graviticImpalerTarget
			: undefined
		const shotDamageMultiplier = damageMultiplier *
			(impalerTarget ? graviticImpalerDamageMultiplier : 1)
		if (impalerTarget) {
			graviticImpalerTarget = undefined
			graviticImpalerDamageMultiplier = 1
		}
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
		kickWeaponVisual(weapon, chargeRatio);
		kickCameraForWeapon(weapon, chargeRatio, burstDamageMultiplier)
		if (weapon.id === "railgun" && chargeRatio >= 1) {
			k.shake(5)
		}

		if (
			session.primaryRocketChance > 0 &&
			k.chance(k.clamp(session.primaryRocketChance, 0, 1))
		) {
			const rocketMuzzlePos = getPlayerMuzzlePos(
				playerObj.pos,
				k.vec2(0, weapon.muzzleOffsetY),
				turretWorldAngle
			)
			spawnPrimaryLinkedRocket(
				rocketMuzzlePos,
				k.Vec2.fromAngle(turretWorldAngle - 90),
				turretWorldAngle,
				strafeTarget?.exists() ? strafeTarget : undefined
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
						damageMultiplier: shotDamageMultiplier,
						speedMultiplier,
						playFireSound: shouldPlayFireSound,
						fireSoundDetune,
						isFullyCharged: chargeRatio >= 1,
						chargeRatio,
						critChanceBonus: strafeTargetCritActive
							? strafeTargetCritChanceBonus + getPilotProtocolValue("strafeDoctrine") + (alteredTargeting ? 20 : 0)
							: 0,
						alteredTargeting,
						preferredTarget: impalerTarget ?? (
							strafeTarget?.exists() ? strafeTarget : undefined
						),
						splitTargetPosition:
							strafeAimActive && !strafeTarget?.exists()
								? strafeAimPos.clone()
								: undefined,
						wigglePhase: hasPatternWiggle
							? index * Math.PI
							: undefined,
						spreadMultiplier: weapon.sustainedFire
							? k.lerp(
								1,
								weapon.sustainedFire.maximumSpreadMultiplier,
								sustainedFireRatio
							)
							: 1,
					}
				);
				recordGhostFleetShot(
					k.Vec2.fromAngle(turretWorldAngle - 90 + angleOffset),
					turretWorldAngle + angleOffset,
					chargeRatio
				)
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
		const heatState = getPrimaryHeatState(weapon);
		if (heatState?.overheated) return;
		const triggerModifier = getWeaponTriggerModifier(weapon);
		const sustainedFireRatio = weapon.sustainedFire &&
			primarySustainStartedAt !== undefined &&
			primarySustainWeaponId === weapon.id
			? k.clamp(
				(k.time() - primarySustainStartedAt) /
					weapon.sustainedFire.spoolDuration,
				0,
				1
			)
			: 0;
		const sustainedCooldownMultiplier = weapon.sustainedFire
			? k.lerp(
				1,
				weapon.sustainedFire.minimumCooldownMultiplier,
				sustainedFireRatio
			)
			: 1;
		const cooldown = cooldownOverride ?? (
			triggerModifier.usesCooldown
				? weapon.fireCooldown * sustainedCooldownMultiplier
				: undefined
		);
		if (cooldown !== undefined) {
			if (k.time() < nextPrimaryFireTime) return;
			nextPrimaryFireTime = k.time() +
				cooldown * getPlayerStatusMultiplier("weaponRecovery");
		}
		const overheat = weapon.sustainedFire?.overheat;
		if (heatState && overheat) {
			heatState.heat = Math.min(1, heatState.heat + overheat.heatPerShot);
			if (heatState.heat >= 1) {
				heatState.overheated = true;
				primarySustainStartedAt = undefined;
				primarySustainWeaponId = "";
				gameSoundService.play("player_overheated", {
					volume: mainSoundVolume * 0.55,
				});
			}
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
				burstDamageMultiplier,
				sustainedFireRatio
			);
			if (index === 0) fireRound();
			else k.wait(index * burstInterval, fireRound);
		}
	};

	playerObj.onUpdate(() => {
		if (primaryChargeStartedAt === undefined) return
		const weapon = getEquippedWeapon()
		if (
			weapon.id !== primaryChargeWeaponId ||
			!weapon.charge ||
			weapon.charge.autoFireDelay === undefined
		) return
		const autoFireAt = weapon.charge.maxDuration + weapon.charge.autoFireDelay
		if (k.time() - primaryChargeStartedAt < autoFireAt) return
		primaryChargeStartedAt = undefined
		stopPrimaryChargeSound()
		firePrimaryWeapon(1)
	})

	playerObj.onUpdate(() => profileSection("external:playerWeaponHold", () => {
		if (!isInputActionDown("primary")) return;
		const weapon = getEquippedWeapon();
		const triggerModifier = getWeaponTriggerModifier(weapon);
		if (triggerModifier.mode === "hold") {
			if (
				primarySustainStartedAt === undefined &&
				!isPrimaryWeaponOverheated(weapon)
			) {
				primarySustainStartedAt = k.time();
				primarySustainWeaponId = weapon.id;
			}
			firePrimaryWeapon();
			return;
		}
		if (triggerModifier.holdCooldown !== undefined) {
			firePrimaryWeapon(1, triggerModifier.holdCooldown);
		}
	}));

	inputControllers.push(onInputActionPress("primary", () => {
		if (combatInputBlocked()) return
		const weapon = getEquippedWeapon();
		const mode = getWeaponTriggerModifier(weapon).mode;
		if (mode === "hold") {
			if (!isPrimaryWeaponOverheated(weapon)) {
				primarySustainStartedAt = k.time();
				primarySustainWeaponId = weapon.id;
			}
			return;
		}
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
		primaryChargeSound = gameSoundService.play("player_primary_charge", {
			volume: mainSoundVolume * 0.45,
			loop: true,
			speed: primaryChargeSoundSpeed,
		});
	}));

	inputControllers.push(onInputActionRelease("primary", () => {
		primarySustainStartedAt = undefined;
		primarySustainWeaponId = "";
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

	inputControllers.push(installWeaponWheel({
		player: playerObj,
		inputBlocked: () => gameplayInputBlocked() || phaseSurgeActive(),
			onOpen: () => {
				primaryChargeStartedAt = undefined
				primaryChargeWeaponId = ""
				primarySustainStartedAt = undefined
				primarySustainWeaponId = ""
			stopPrimaryChargeSound()
		},
		onQuickSwap: () => {
			const previousWeaponId = getEquippedWeapon().id
			const weapon = cycleEquippedWeapon(1)
			if (weapon.id === previousWeaponId) return
			primaryChargeStartedAt = undefined
			primaryChargeWeaponId = ""
			stopPrimaryChargeSound()
			spawnFlash(playerObj.pos.clone(), 5, k.rgb(75, 205, 255))
			showWeaponSwitchLabel(weapon)
			gameSoundService.play("click1", {
				volume: mainSoundVolume * 0.65,
				detune: 100,
			})
		},
		onSelect: (weapon) => {
			const previousWeaponId = getEquippedWeapon().id
			if (!equipWeapon(weapon.id) || weapon.id === previousWeaponId) return
			spawnFlash(playerObj.pos.clone(), 5, k.rgb(75, 205, 255))
			showWeaponSwitchLabel(weapon)
			gameSoundService.play("click1", {
				volume: mainSoundVolume * 0.65,
				detune: 100,
			})
		},
	}))

	inputControllers.push(installPlayerLasso({
		player: playerObj,
		inputBlocked: combatInputBlocked,
		isUnlocked: () => getPermanentUpgradeLevel("salvageLasso") !== undefined,
		canPullShipParts: () => getLassoRigRank("partExtractor") > 0,
		isStrafeModeActive: () => strafeAimActive,
		getStrafeAimPosition: () => strafeAimPos.clone(),
	}))

	inputControllers.push(onInputActionPress("secondary", () => {
		if (combatInputBlocked()) return;
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
		activateModule(
			activeModule.id,
			playerObj,
			turretWorldAngle,
			strafeTarget?.exists() ? strafeTarget : undefined
		);
	}));

	inputControllers.push(onInputActionPress("mobility", () => {
		if (combatInputBlocked()) return;
		if (!getEquippedMobilityAbilityId()) {
			recordTelemetryAbilityFailure("mobility");
			flashEmptyMobilitySocket();
			playRequirementErrorSound();
			return;
		}
		const mobilityId = getEquippedMobilityAbilityId();
		if (mobilityId === "thrusterOverdrive") {
			if (thrusterOverdriveState.overused) {
				recordTelemetryAbilityFailure("mobility", "thrusterOverdrive");
				playRequirementErrorSound();
				return;
			}
			recordTelemetryAbilityUse("mobility", "thrusterOverdrive");
			return;
		}
		const config = getMobilityChargeConfig();
		if (
			!config ||
			phaseJumpCharges <= 0 ||
			phaseJumpEnd ||
			retroBurstEnd ||
			gravitySlingState
		) {
			recordTelemetryAbilityFailure("mobility", mobilityId);
			return;
		}
		if (mobilityId === "gravitySling") {
			const tier = getAbilityTierValues(mobilityId);
			const mouseOffset = k.toWorld(k.mousePos()).sub(playerObj.pos);
			const aimDirection = mouseOffset.len() > 0.001
				? mouseOffset.unit()
				: k.Vec2.fromAngle(playerObj.angle - 90);
			beginGravitySling(playerObj, aimDirection, tier);
			consumeMobilityCharge();
			recordTelemetryAbilityUse("mobility", mobilityId);
			return;
		}
		if (mobilityId === "phaseSurge") {
			recordTelemetryAbilityUse("mobility", mobilityId)
			consumeMobilityCharge()
			primaryChargeStartedAt = undefined
			primaryChargeWeaponId = ""
			primarySustainStartedAt = undefined
			primarySustainWeaponId = ""
			stopPrimaryChargeSound()
			phaseSurgeStartedAt = k.time()
			phaseSurgeActiveUntil = phaseSurgeStartedAt + phaseSurgeDuration
			phaseSurgeReturnStartedAt = 0
			phaseSurgeReturnUntil = 0
			phaseSurgeParticleTimer = 0
			phaseSurgeWasActive = true
			setPlayerDamageInvulnerable(true)
			spawnPhaseSurgeStartEffect(playerObj.pos.clone())
			return
		}

		const wasdDirection = getWasdDirection();
		const phaseJumpDirection = wasdDirection.len() > 0
			? wasdDirection.unit()
			: k.Vec2.fromAngle(playerObj.angle - 90);
		const jumpDirection = mobilityId === "retroBurst"
			? k.Vec2.fromAngle(turretWorldAngle + 90)
			: phaseJumpDirection;
		const startPos = playerObj.pos.clone();
		const destination = startPos.add(
			jumpDirection.scale(config.distance ?? 0)
		);
		const gridCollision = playerObj.has("gridCollision")
			? (playerObj.c("gridCollision") as GridCollisionComp)
			: undefined;
		if (gridCollision && !gridCollision.canMoveTo(destination)) {
			recordTelemetryAbilityFailure("mobility", mobilityId);
			spawnFlash(destination, 6, k.rgb(255, 70, 70));
			gameSoundService.play("error", { volume: mainSoundVolume * 0.35 });
			return;
		}
		recordTelemetryAbilityUse("mobility", mobilityId);
		consumeMobilityCharge();
		if (mobilityId === "retroBurst") {
			const tier = getAbilityTierValues(mobilityId);
			retroBurstStart = startPos;
			retroBurstEnd = destination;
			retroBurstElapsed = 0;
			spawnRetroBurstEffect(startPos, destination, playerObj.angle);
			forEachSpatialNearby(startPos, 72, {
				allTags: [tags.enemy, tags.unit],
			}, (enemy) => {
				const away = enemy.pos.sub(startPos);
				if (away.len() <= 0) return;
				applyKnockbackImpulse(
					enemy,
					away,
					retroBurstKnockbackForce * tier.power
				);
			});
			return;
		}

		setPlayerDamageInvulnerable(true);
		phaseJumpStart = startPos;
		phaseJumpEnd = destination;
		phaseJumpElapsed = 0;
		phaseJumpHitTargets.clear();
		spawnPhaseJumpEffect(startPos, destination, playerObj.angle);
	}));

	inputControllers.push(onInputActionPress("ultimate", () => {
		if (combatInputBlocked()) return;
		const ultimateId = getEquippedUltimateAbilityId();
		if (!ultimateId) {
			recordTelemetryAbilityFailure("ultimate");
			flashEmptyUltimateSocket();
			playRequirementErrorSound();
			return;
		}
		if (!consumeUltimateCharge()) {
			recordTelemetryAbilityFailure("ultimate", ultimateId);
			return;
		}
		recordTelemetryAbilityUse("ultimate", ultimateId);
		if (ultimateId === "phaseNova") activatePhaseNova(playerObj);
		else if (ultimateId === "gravitonCollapse") {
			activateGravitonCollapse(playerObj)
		} else if (ultimateId === "ghostFleet") {
			activateGhostFleet(playerObj)
		} else if (ultimateId === "scrapColossus") {
			activateScrapColossus(playerObj)
		}
	}));

	inputControllers.push(onInputActionPress("interact", () => {
		if (dialogCapturesInput()) return;
		if (levelTransitionActive() || respawnTransitionActive) return;
		getPriorityInteraction()?.onInteract();
	}));

	return playerObj;
}

function spawnPlayerArrivalImpact(
	playerObj: PlayerRuntimeObject,
	playWarpLandingBass: boolean
) {
	gameSoundService.play("player_arrival_impact", {
		volume: mainSoundVolume,
	});
	if (playWarpLandingBass) {
		gameSoundService.play("warp_landing_bass", {
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
		k.sprite(PLAYER_DIRECTIONAL_SPRITES[0]),
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
	clearCameraKick()
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
	phaseSurgeStartedAt = 0
	phaseSurgeActiveUntil = 0
	phaseSurgeReturnStartedAt = 0
	phaseSurgeReturnUntil = 0
	phaseSurgeParticleTimer = 0
	phaseSurgeWasActive = false
	retroBurstStart = undefined;
	retroBurstEnd = undefined;
	retroBurstElapsed = 0;
	gravitySlingReleaseVelocity = k.vec2(0);
	activeScrapMine = undefined;
	resetPlayerDamageState();
	nextPrimaryFireTime = 0;
	configuredWeaponId = "";
	afterburnerWakeTimer = 0;
}

function updateShipRewardVisuals(
	playerObj: PlayerRuntimeObject,
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
	const cooldownMultiplier = 1 - getPilotProtocolValue("phaseCycler") / 100;
	if (mobilityId === "retroBurst") {
		return {
			distance: 68 * tier.speed,
			cooldown: 3.2 / tier.recovery * cooldownMultiplier,
			charges: RETRO_BURST_CHARGE_COUNT,
		};
	}
	if (mobilityId === "gravitySling") {
		return { cooldown: 5 / tier.recovery * cooldownMultiplier, charges: 1 };
	}
	if (mobilityId === "phaseSurge") {
		return {
			cooldown: phaseSurgeCooldown / tier.recovery * cooldownMultiplier,
			charges: 1,
		}
	}

	switch (player.spaceJumpUpgradeLvl) {
		case undefined:
			return {
				distance: 75 * tier.speed,
				cooldown: 2.5 / tier.recovery * cooldownMultiplier,
				charges: 1,
			};
		case 1:
			return {
				distance: 90 * tier.speed,
				cooldown: 2.1 / tier.recovery * cooldownMultiplier,
				charges: 1,
			};
		case 2:
			return {
				distance: 90 * tier.speed,
				cooldown: 3 / tier.recovery * cooldownMultiplier,
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

function findHoveredStrafeTarget(
	pointerWorldPos: Vec2,
	currentTarget?: GameObj<PosComp>
) {
	const closestTarget = findClosestPlayerTarget(
		pointerWorldPos,
		strafeTargetQueryRadius
	)
	if (closestTarget) return closestTarget
	if (
		currentTarget?.exists() &&
		isStrafeTarget(currentTarget) &&
		pointerIsOverTarget(
			pointerWorldPos,
			currentTarget,
			strafeTargetReleasePadding
		)
	) return currentTarget
	return undefined
}

function isStrafeTarget(target: GameObj) {
	return isPlayerTargetable(target)
}

function pointerIsOverTarget(
	pointerWorldPos: Vec2,
	target: GameObj,
	padding = strafeTargetPadding
) {
	const hitRadius = getTargetHitRadius(target)
	return getTargetWorldPosition(target as GameObj<PosComp>).dist(pointerWorldPos) <=
		Math.max(strafeTargetMinimumRadius, hitRadius) + padding
}

function spawnStrafeTargetMarker(pos: Vec2) {
	return k.add([
		k.pos(pos.clone()),
		k.sprite("crosshair_precision"),
		k.anchor("center"),
		k.rotate(0),
		k.scale(1),
		k.color(255, 70, 70),
		k.opacity(0.95),
		k.layer(layers.gameEffects),
		k.z(24),
		tags.props,
		tags.gameLoop,
	])
}

function activateModule(
	moduleId: string,
		playerObj: PlayerRuntimeObject,
	turretWorldAngle: number,
	preferredTarget?: GameObj<PosComp>
) {
	const tier = getAbilityTierValues(moduleId as AbilityId);
	const direction = k.Vec2.fromAngle(turretWorldAngle - 90);
	const lockedTarget = preferredTarget?.exists() ? preferredTarget : undefined
	const targetPos = lockedTarget?.pos.clone() ?? k.toWorld(k.mousePos());
	const playerFacing = k.Vec2.fromAngle(playerObj.angle - 90)
	const launchTargetedPayload = (
		payloadSprite: string,
		color: Color,
		onArrive: (deploymentPos: Vec2) => void
	) => spawnActiveModuleCarrier({
		pos: playerObj.pos.add(playerFacing.scale(12)),
		launchDirection: playerFacing,
		targetPos,
		target: lockedTarget,
		payloadSprite,
		color,
		onArrive,
	})

	switch (moduleId) {
		case "rocketPod":
			loopService.loop(
				0.1 / tier.recovery,
				() => {
					if (!playerObj.exists()) return;
					const rocketMuzzlePos = playerObj.pos.add(
						direction.scale(playerForwardLaunchOffset)
					)
					spawnPlayerRocket(
						rocketMuzzlePos,
						direction,
						turretWorldAngle,
						lockedTarget
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
			gameSoundService.play("swap_level", {
				volume: mainSoundVolume * 0.65,
				detune: -280,
			});
			k.shake(2);
			return;
		}

		case "decoyBeacon": {
			const decoyColor = k.rgb(95, 220, 255)
			launchTargetedPayload(
				"active_decoy_beacon",
				decoyColor,
				(deploymentPos) => {
					const decoy = k.add([
						k.pos(deploymentPos),
						k.sprite("active_decoy_beacon"),
						k.anchor("center"),
						k.scale(0.85),
						k.color(decoyColor),
						k.opacity(0.72),
						k.layer(layers.gameEffects),
						k.lifespan(5 * tier.power, { fade: 0.45 }),
						tags.props,
						tags.gameLoop,
					])
					decoy.onUpdate(() => {
						decoy.opacity = k.wave(0.3, 0.82, k.time() * 9)
						forEachSpatialNearby(decoy.pos, 210 * tier.speed, {
							allTags: [tags.enemy, tags.unit],
						}, (enemy) => {
							const towardDecoy = decoy.pos.sub(enemy.pos)
							if (towardDecoy.len() <= 1) return
							enemy.pos = enemy.pos.add(
								towardDecoy.unit().scale(26 * tier.power * dt())
							)
						})
					})
					spawnRing({
						pos: deploymentPos,
						speed: 120,
						intensity: 0.18,
						maxRadius: 46,
						color: decoyColor,
					})
					gameSoundService.play("click1", {
						volume: mainSoundVolume * 0.55,
						detune: 420,
					})
				}
			)
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
					combatCredit: {
						kind: "secondary",
						id: "scrapMine",
						explosive: true,
					},
					visualIntensity: 0.55,
					visualParticleCount: 20,
				});
				gameSoundService.playPositional("explosion2", explosionPos, {
					volume: mainSoundVolume * 0.65,
				});
				k.shake(2);
			});
			gameSoundService.play("click1", {
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
				k.scale(1),
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
			gameSoundService.play("swap_level", {
				volume: mainSoundVolume * 0.6,
				detune: 650,
			});
			return;
		}

		case "gravityCharge": {
			const chargeDuration = 2.4 * tier.power
			const gravityColor = k.rgb(150, 100, 255)
			launchTargetedPayload(
				"active_gravity_charge",
				gravityColor,
				(deploymentPos) => {
					const gravity = spawnGravityPull({
						pos: deploymentPos,
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
					})
					const charge = k.add([
						k.pos(deploymentPos),
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
					])
					addWormholeEffect(charge, {
						color: gravityColor,
						postEffect: false,
						secondaryPostEffect: true,
						ambience: false,
					})
					const chargeSprite = charge.add([
						k.sprite("active_gravity_charge"),
						k.anchor("center"),
						k.scale(0.75),
						k.rotate(0),
						k.color(gravityColor),
						k.layer(layers.gameEffects),
						k.z(3),
					])
					charge.onUpdate(() => {
						charge.chargeElapsed += k.dt()
						const progress = k.clamp(
							charge.chargeElapsed / chargeDuration,
							0,
							1
						)
						charge.portalProgress = progress
						charge.transitionIntensity = progress
						chargeSprite.angle += k.lerp(90, 420, progress) * dt()
						const pulseSpeed = k.lerp(4, 16, progress)
						const pulseRange = k.lerp(0.08, 0.24, progress)
						chargeSprite.scale = k.vec2(k.wave(
							0.75 - pulseRange,
							0.75 + pulseRange,
							k.time() * pulseSpeed
						))
					})
					k.wait(chargeDuration, () => {
						if (gravity.exists()) k.destroy(gravity)
						if (charge.exists()) k.destroy(charge)
						createExplosion({
							pos: deploymentPos,
							radius: 58 * tier.speed,
							damage: 10 * tier.power,
							combatCredit: {
								kind: "secondary",
								id: "gravityCharge",
								explosive: true,
							},
							visualColor: gravityColor,
							visualIntensity: 0.75,
							visualParticleCount: 30,
						})
						gameSoundService.playPositional("explosion1", deploymentPos, {
							volume: mainSoundVolume,
						})
						k.shake(4)
					})
				}
			)
			return
		}

		case "breachCharge": {
			const breachColor = k.rgb(255, 210, 120)
			launchTargetedPayload(
				"active_breach_charge",
				breachColor,
				(deploymentPos) => {
					const charge = k.add([
						k.pos(deploymentPos),
						k.sprite("active_breach_charge"),
						k.anchor("center"),
						k.scale(0.75),
						k.rotate(turretWorldAngle),
						k.color(k.WHITE),
						k.opacity(1),
						k.layer(layers.gameEffects),
						tags.props,
						tags.gameLoop,
					])
					charge.onUpdate(() => {
						charge.opacity = k.wave(0.25, 1, k.time() * 18)
					})
					gameSoundService.play("click1", {
						volume: mainSoundVolume * 0.6,
					})
					k.wait(0.7, () => {
						if (charge.exists()) k.destroy(charge)
						createExplosion({
							pos: deploymentPos,
							radius: 70 * tier.speed,
							damage: 28 * tier.power,
							combatCredit: {
								kind: "secondary",
								id: "breachCharge",
								explosive: true,
							},
							visualIntensity: 1,
							visualParticleCount: 42,
						})
						damageDestructibleWallsInRadius(
							deploymentPos,
							72 * tier.speed,
							28 * tier.power,
							{ explosive: true }
						)
						gameSoundService.playPositional("explosion1", deploymentPos, {
							volume: mainSoundVolume,
						})
						k.shake(7)
					})
				}
			)
			return
		}

		case "droneBeacon": {
			const droneColor = k.rgb(80, 220, 150)
			launchTargetedPayload(
				"active_drone_beacon",
				droneColor,
				(deploymentPos) => {
					for (let index = 0; index < 2; index++) {
						const drone = spawnFollower({
							hp: 1,
							blasterDmg: Math.max(
								1,
								getPrimaryWeaponDamage() *
								player.followerBlasterDmg *
								tier.power
							),
							speed: player.speed * 1.15 * tier.speed,
							follow: playerObj,
							deploymentStart: deploymentPos.add(
								index === 0 ? -12 : 12,
								0
							),
						})
						drone.temporaryActiveModuleDrone = true
						k.wait(12 * tier.power, () => {
							if (!drone.exists()) return
							const despawnPos = drone.pos.clone()
							spawnEnemyDeathEffect(despawnPos, 0.5)
							gameSoundService.playPositional("explosion1", despawnPos, {
								volume: mainSoundVolume * 0.35,
							})
							k.destroy(drone)
						})
					}
					spawnRing({
						pos: deploymentPos,
						speed: 160,
						intensity: 0.2,
						maxRadius: 52,
						color: droneColor,
					})
				}
			)
			return
		}

		case "droidFrenzy": {
			const frenzyColor = k.rgb(255, 70, 70)
			activateDroneFrenzy({
				duration: DRONE_FRENZY_DURATION_SECONDS,
				damageMultiplier: 1 +
					(DRONE_FRENZY_DAMAGE_MULTIPLIER - 1) * tier.power,
				fireRateMultiplier: 1 +
					(DRONE_FRENZY_FIRE_RATE_MULTIPLIER - 1) * tier.speed,
			})
			for (const drone of k.get(tags.follower) as GameObj[]) {
				if (!drone.exists()) continue
				spawnFlash(drone.pos.clone(), drone.fusionCore ? 12 : 7, frenzyColor)
			}
			spawnRing({
				pos: playerObj.pos.clone(),
				speed: 210,
				intensity: 0.32,
				maxRadius: 72,
				color: frenzyColor,
			})
			spawnFlash(playerObj.pos.clone(), 9, frenzyColor)
			gameSoundService.play("swap_level", {
				volume: mainSoundVolume * 0.72,
				detune: -360,
			})
			return
		}

		case "repairPulse": {
			const generation = ++repairPulseGeneration;
			const channelDuration = 1.5;
			const chargePulse = k.add([
				k.pos(playerObj.pos),
				k.circle(28),
				k.anchor("center"),
				k.color(80, 255, 175),
				k.opacity(0.12),
				k.scale(1),
				k.layer(layers.gameEffects),
				k.z(-3),
				{
					elapsed: 0,
				},
			]);
			registerBatchedEntityUpdate("effects", chargePulse, () => {
				if (generation !== repairPulseGeneration) {
					k.destroy(chargePulse);
					return;
				}
				chargePulse.pos = playerObj.pos;
				chargePulse.elapsed += k.dt();
				const progress = k.clamp(
					chargePulse.elapsed / channelDuration,
					0,
					1
				);
				const wave = (Math.sin(chargePulse.elapsed * Math.PI * 4) + 1) / 2;
				const easedWave = wave * wave * (3 - 2 * wave);
				chargePulse.scale = k.vec2(k.lerp(0.88, 1.18, easedWave));
				chargePulse.opacity = k.lerp(0.08, 0.2, easedWave) *
					k.lerp(0.65, 1, progress);
			});
			k.wait(channelDuration, () => {
				if (!playerObj.exists() || generation !== repairPulseGeneration) return;
				if (chargePulse.exists()) k.destroy(chargePulse);
				recoverPlayerHealth(
					playerObj,
						Math.round(
							playerObj.maxHP * REPAIR_PULSE_RECOVERY_RATIO * tier.power
						)
				);
				spawnFlash(playerObj.pos, 10, k.rgb(80, 255, 175));
				gameSoundService.play("collect1", {
					volume: mainSoundVolume * 0.65,
					detune: 420,
				});
			});
			return;
		}

		case "empBeacon": {
			const origin = playerObj.pos.clone();
			const radius = 150 * tier.speed;
			const duration = 3 * tier.power;
			const affectedTargets: Vec2[] = [];
			spawnFlash(origin, 12, k.rgb(75, 205, 255));
			forEachSpatialNearby(origin, radius, {
				allTags: [tags.enemy, tags.unit],
			}, (enemy) => {
				affectedTargets.push(enemy.pos.clone());
				applyEnemyEmpDisruption(enemy, duration);
			});
			spawnEmpDischarge({ pos: origin, radius, targets: affectedTargets });
			gameSoundService.play("swap_level", {
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
			damage: getDamageFromPrimaryRatio(3, {
				includeGlassReactor: false,
			}),
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
		k.sprite(PLAYER_DIRECTIONAL_SPRITES[0]),
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
				damage: getDamageFromPrimaryRatio(4, {
					includeGlassReactor: false,
				}),
			combatCredit: {
				kind: "mobility",
				id: "phaseJump",
				explosive: true,
			},
			visualIntensity: 0.45,
			visualParticleCount: 22,
		});
		gameSoundService.playPositional("explosion1", pos, {
			volume: mainSoundVolume * 0.55,
		});
	});
}

function activatePhaseNova(playerObj: PlayerRuntimeObject) {
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
		combatCredit: {
			kind: "ultimate",
			id: "phaseNova",
			explosive: true,
		},
		visualIntensity: 1.4,
		visualParticleCount: 72,
		damageFalloff: 0.35,
		falloffDistance: 120,
	});
	gameSoundService.play("high_rarity_reveal", {
		volume: mainSoundVolume,
		detune: 520,
	});
	gameSoundService.play("explosion2", {
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

function emitPhaseSurgeParticles(playerObj: PlayerRuntimeObject) {
	const trailDirection = k.Vec2.fromAngle(playerObj.angle + 90)
	const side = trailDirection.normal().scale(k.rand(-10, 10))
	boostTrailEmitter.emitter.position = playerObj.pos
		.add(side)
		.add(trailDirection.scale(k.rand(-8, 5)))
	boostTrailEmitter.emitter.direction = k.rand(0, 360)
	boostTrailEmitter.emit(3)
}

function spawnPhaseSurgeStartEffect(pos: Vec2) {
	boostTrailEmitter.emitter.position = pos
	for (let direction = 0; direction < 360; direction += 60) {
		boostTrailEmitter.emitter.direction = direction
		boostTrailEmitter.emit(2)
	}
	spawnFlash(pos, 8, k.rgb(80, 210, 255))
	spawnRing({
		pos,
		speed: 230,
		intensity: 0.3,
		maxRadius: 36,
		color: k.rgb(80, 210, 255),
	})
	gameSoundService.play("mobility_phase_jump", {
		volume: mainSoundVolume * 0.6,
		detune: 260,
	})
}

function spawnPhaseSurgeReturnEffect(pos: Vec2) {
	boostTrailEmitter.emitter.position = pos
	for (let direction = 0; direction < 360; direction += 45) {
		boostTrailEmitter.emitter.direction = direction
		boostTrailEmitter.emit(4)
	}
	spawnFlash(pos, 14, k.rgb(80, 225, 255))
	spawnRing({
		pos,
		speed: 380,
		intensity: 0.62,
		maxRadius: 68,
		color: k.rgb(80, 225, 255),
		outlineWidth: 2,
		visualOpacity: 0.9,
	})
	spawnEmpDischarge({ pos, radius: 58, targets: [] })
	gameSoundService.play("mobility_phase_jump", {
		volume: mainSoundVolume * 0.75,
		detune: -80,
	})
	k.shake(4)
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
			k.sprite(PLAYER_DIRECTIONAL_SPRITES[0]),
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
	gameSoundService.play("mobility_phase_jump", {
		volume: mainSoundVolume * 0.65,
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
	gameSoundService.play("mobility_phase_jump", {
		volume: mainSoundVolume * 0.65,
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
			k.sprite(PLAYER_DIRECTIONAL_SPRITES[0]),
			k.anchor("center"),
			k.rotate(angle),
			k.scale(PLAYER_SCALE * k.lerp(0.7, 1, progress)),
			k.color(80, 180, 255),
			k.opacity(k.lerp(0.16, 0.48, progress)),
			k.lifespan(respawnTransitionDuration, { fade: 0.25 }),
			tags.gameLoop,
		]);
	}

	gameSoundService.play("swap_level", {
		volume: 0.45,
		detune: 350,
	});
}

function beginGravitySling(
	playerObj: PlayerRuntimeObject,
	aimDirection: Vec2,
	tier: AbilityTierValues
) {
	gravitySlingReleaseVelocity = k.vec2(0);
	const direction = aimDirection.len() > 0
		? aimDirection.unit()
		: k.Vec2.fromAngle(playerObj.angle - 90);
	const range = gravitySlingRange * tier.speed;
	const target = findGravitySlingTarget(playerObj, direction, range);

	const hookStart = playerObj.pos.clone();
	const anchorPos = target?.pos.clone() ?? hookStart.add(direction.scale(range));
	const hookVisual = k.add([
		k.pos(hookStart),
		k.sprite("mobility_gravity_sling"),
		k.anchor("center"),
		k.scale(0.46),
		k.rotate(k.Vec2.toAngle(direction) + 90),
		k.color(120, 210, 255),
		k.opacity(0.95),
		k.layer(layers.gameEffects),
		k.z(10),
		tags.gameLoop,
	]);
	const tetherVisual = k.add([
		k.pos(hookStart),
		k.layer(layers.gameEffects),
		k.z(9),
		{
			endPos: hookStart.clone(),
			draw() {
				const end = this.endPos.sub(this.pos);
				k.drawLine({
					p1: k.vec2(),
					p2: end,
					width: 3,
					color: k.rgb(10, 28, 38),
					opacity: 0.85,
				});
				k.drawLine({
					p1: k.vec2(),
					p2: end,
					width: 1,
					color: k.rgb(120, 210, 255),
					opacity: 0.95,
				});
			},
		},
		tags.gameLoop,
	]);
	const currentDirection = k.Vec2.fromAngle(playerObj.angle - 90);
	const cross = direction.x * currentDirection.y - direction.y * currentDirection.x;

	gravitySlingState = {
		phase: "hook",
		target: target as GameObj<PosComp> | undefined,
		anchorPos,
		hookStart,
		hookVisual,
		tetherVisual,
		elapsed: 0,
		duration: k.clamp(hookStart.dist(anchorPos) / gravitySlingHookSpeed, 0.12, 0.42),
		arcSide: Math.abs(cross) > 0.05 ? Math.sign(cross) : 1,
		damage: gravitySlingBaseDamage * tier.power,
		speedMultiplier: tier.speed,
		hitTargets: new Set<number>(),
	};
	gameSoundService.play("mobility_phase_jump", {
		volume: mainSoundVolume * 0.48,
		detune: -520,
	});
}

function findGravitySlingTarget(
	playerObj: PlayerRuntimeObject,
	direction: Vec2,
	range: number
) {
	const queryCenter = playerObj.pos.add(direction.scale(range * 0.5));
	const candidates = querySpatialNearby(queryCenter, range * 0.5 + 56, {
		anyTags: [tags.unit],
	});
	let target: GameObj | undefined;
	let targetScore = Number.POSITIVE_INFINITY;
	for (const candidate of candidates) {
		if (
			candidate.id === playerObj.id ||
			candidate.is(tags.friendly) ||
			candidate.is(tags.projectile) ||
			!candidate.pos
		) continue;
		const offset = candidate.pos.sub(playerObj.pos);
		const forwardDistance = offset.dot(direction);
		if (forwardDistance < 18 || forwardDistance > range) continue;
		const closestPoint = playerObj.pos.add(direction.scale(forwardDistance));
		const targetRadius = Math.max(
			14,
			Number(candidate.hb) || 0,
			Math.min(36, Math.max(Number(candidate.width) || 0, Number(candidate.height) || 0) * 0.35)
		);
		const lateralDistance = candidate.pos.dist(closestPoint);
		if (lateralDistance > targetRadius + 18) continue;
		const score = forwardDistance + lateralDistance * 2;
		if (score >= targetScore) continue;
		target = candidate;
		targetScore = score;
	}
	return target;
}

function updateGravitySling(playerObj: PlayerRuntimeObject) {
	const state = gravitySlingState;
	if (!state) return false;
	if (!state.hookVisual.exists() || !state.tetherVisual.exists()) {
		clearGravitySlingState();
		return false;
	}

	if (state.target?.exists()) state.anchorPos = state.target.pos.clone();
	state.elapsed += dt();
	state.tetherVisual.pos = playerObj.pos.clone();

	if (state.phase === "hook") {
		const progress = k.clamp(state.elapsed / state.duration, 0, 1);
		const easedProgress = 1 - Math.pow(1 - progress, 3);
		state.hookVisual.pos = state.hookStart.lerp(state.anchorPos, easedProgress);
		state.tetherVisual.endPos = state.hookVisual.pos.clone();
		if (progress < 1) return false;

		state.phase = "sling";
		state.elapsed = 0;
		state.slingStart = playerObj.pos.clone();
		const toAnchor = state.anchorPos.sub(state.slingStart);
		state.slingDirection = toAnchor.len() > 0.001
			? toAnchor.unit()
			: k.Vec2.fromAngle(playerObj.angle - 90);
		state.slingEnd = resolveGravitySlingEnd(
			playerObj,
			state.anchorPos,
			state.slingDirection,
			Math.max(90, state.slingStart.dist(state.anchorPos) * 0.62) *
				state.speedMultiplier
		);
		const travelDistance = state.slingStart.dist(state.slingEnd);
		state.duration = k.clamp(
			travelDistance / (500 * state.speedMultiplier),
			0.34,
			0.68
		);
		state.hookVisual.pos = state.anchorPos.clone();
		spawnRing({
			pos: state.anchorPos.clone(),
			speed: 150,
			intensity: 0.28,
			maxRadius: 34,
			color: k.rgb(120, 210, 255),
		});
		spawnFlash(state.anchorPos.clone(), 6, k.rgb(120, 210, 255));
		k.shake(2);
	}

	if (!state.slingStart || !state.slingEnd || !state.slingDirection) return false;
	const previousPos = playerObj.pos.clone();
	const progress = k.clamp(state.elapsed / state.duration, 0, 1);
	const acceleratedProgress = progress * (0.55 + progress * 0.45);
	const perpendicular = k.vec2(-state.slingDirection.y, state.slingDirection.x);
	const arcHeight = Math.min(
		32,
		state.slingStart.dist(state.anchorPos) * 0.14
	) * state.arcSide;
	const nextPos = state.slingStart
		.lerp(state.slingEnd, acceleratedProgress)
		.add(perpendicular.scale(Math.sin(progress * Math.PI) * arcHeight));
	const gridCollision = playerObj.has("gridCollision")
		? playerObj.c("gridCollision") as GridCollisionComp
		: undefined;
	if (gridCollision && !gridCollision.canMoveTo(nextPos)) {
		gravitySlingReleaseVelocity = k.vec2(0);
		spawnFlash(previousPos, 6, k.rgb(120, 210, 255));
		clearGravitySlingState();
		return true;
	}
	playerObj.pos = nextPos;
	state.tetherVisual.pos = playerObj.pos.clone();
	const movement = playerObj.pos.sub(previousPos);
	if (movement.len() > 0.001) playerObj.angle = k.Vec2.toAngle(movement) + 90;
	playerObj.gravityVelocity = k.vec2(0);
	state.tetherVisual.endPos = state.anchorPos.clone();
	state.hookVisual.pos = state.anchorPos.clone();
	applyGravitySlingDamage(previousPos, playerObj.pos, state);
	boostTrailEmitter.emitter.position = playerObj.pos;
	boostTrailEmitter.emitter.direction = k.Vec2.toAngle(movement.scale(-1));
	boostTrailEmitter.emit(2);

	if (progress < 1) return true;
	const releaseDirection = state.slingDirection
		.add(perpendicular.scale(-state.arcSide * 0.6))
		.unit();
	const releaseSpeed = player.speed * player.speedMultiplier *
		gravitySlingReleaseSpeedMultiplier * state.speedMultiplier;
	if (
		graviticImpalerTarget?.exists() &&
		getEffectiveUpgradeLevel("graviticImpaler") !== undefined
	) {
		const baseSpeed = Math.max(1, player.speed * player.speedMultiplier)
		graviticImpalerDamageMultiplier = 1 + k.clamp(
			releaseSpeed / baseSpeed - 1,
			0,
			2
		) * 0.5
	}
	playerObj.angle = k.Vec2.toAngle(releaseDirection) + 90;
	gravitySlingReleaseVelocity = releaseDirection.scale(releaseSpeed);
	phaseJumpInvulnerableUntil = Math.max(
		phaseJumpInvulnerableUntil,
		k.time() + 0.12
	);
	spawnRing({
		pos: playerObj.pos.clone(),
		speed: 260,
		intensity: 0.3,
		maxRadius: 44,
		color: k.rgb(120, 210, 255),
	});
	spawnFlash(playerObj.pos.clone(), 8, k.rgb(120, 210, 255));
	gameSoundService.play("mobility_phase_jump", {
		volume: mainSoundVolume * 0.65,
		detune: 180,
	});
	k.shake(4);
	clearGravitySlingState();
	return true;
}

function resolveGravitySlingEnd(
	playerObj: PlayerRuntimeObject,
	anchorPos: Vec2,
	direction: Vec2,
	desiredDistance: number
) {
	const gridCollision = playerObj.has("gridCollision")
		? playerObj.c("gridCollision") as GridCollisionComp
		: undefined;
	if (!gridCollision) return anchorPos.add(direction.scale(desiredDistance));
	const startPos = playerObj.pos.clone();
	const fullDistance = startPos.dist(anchorPos) + desiredDistance;
	for (let distance = fullDistance; distance >= 0; distance -= 12) {
		const candidate = startPos.add(direction.scale(distance));
		if (gridCollision.canMoveTo(candidate)) return candidate;
	}
	return startPos;
}

function applyGravitySlingDamage(
	start: Vec2,
	end: Vec2,
	state: GravitySlingState
) {
	const midpoint = start.lerp(end, 0.5);
	const radius = start.dist(end) * 0.5 + 56;
	forEachSpatialNearby(midpoint, radius, {
		allTags: [tags.unit, tags.enemy],
	}, (target) => {
		if (
			state.hitTargets.has(target.id) ||
			typeof target.hp !== "number"
		) return;
		const hitRadius = Math.max(12, Number(target.hb) || 0) + 10;
		if (distanceToSegment(target.pos, start, end) > hitRadius) return;
		if (!applyDamage(target, state.damage, {
			position: end,
			combatCredit: { kind: "mobility", id: "gravitySling" },
		})) return;
		state.hitTargets.add(target.id);
		if (
			getEffectiveUpgradeLevel("graviticImpaler") !== undefined &&
			!graviticImpalerTarget?.exists()
		) {
			graviticImpalerTarget = target as GameObj<PosComp>
			spawnRing({
				pos: target.pos.clone(),
				speed: 35,
				intensity: 0.48,
				maxRadius: Math.max(18, Number(target.hb) || 18),
				color: k.rgb(155, 100, 255),
			})
		}
		spawnFlash(target.pos.clone(), 8, k.rgb(120, 210, 255));
	});
}

function clearGravitySlingState() {
	const state = gravitySlingState;
	gravitySlingState = undefined;
	if (!state) return;
	if (state.hookVisual.exists()) k.destroy(state.hookVisual);
	if (state.tetherVisual.exists()) k.destroy(state.tetherVisual);
}

function updatePhaseJump(playerObj: PlayerRuntimeObject): boolean {
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
		if (getEffectiveUpgradeLevel("phaseWake") !== undefined) {
			spawnPhaseWake({
				start: phaseJumpStart.clone(),
				end: phaseJumpEnd.clone(),
				player: playerObj,
				onPlayerCross: (wakeDirection) => {
					const inputDirection = getWasdDirection()
					const boostDirection = inputDirection.len() > 0.001
						? inputDirection.unit()
						: wakeDirection
					const baseSpeed = player.speed * player.speedMultiplier
					currentMoveSpeed = Math.max(currentMoveSpeed, baseSpeed * 1.35)
					gravitySlingReleaseVelocity = gravitySlingReleaseVelocity.add(
						boostDirection.scale(baseSpeed * 0.75)
					)
					boostTrailEmitter.emitter.position = playerObj.pos.clone()
					boostTrailEmitter.emitter.direction = k.Vec2.toAngle(
						boostDirection.scale(-1)
					)
					boostTrailEmitter.emit(12)
					spawnFlash(playerObj.pos.clone(), 8, k.rgb(80, 210, 255))
				},
			})
		}
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

function updateRetroBurst(playerObj: PlayerRuntimeObject): boolean {
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
	const damageRatio = Math.max(
		player.spaceJumpDamageRatio,
		player.kineticRam === undefined ? 0 : 3,
		player.mobilitySetBonus ? 2 : 0
	);
	if (damageRatio <= 0) return;
	const damage = getDamageFromPrimaryRatio(damageRatio, {
		movementMultiplier: player.speedMultiplier,
	});
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
		if (!applyDamage(target, damage, {
			combatCredit: { kind: "mobility", id: "phaseJump" },
		})) return;

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
