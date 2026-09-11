import {
	AnimateComp,
	Color,
	GameObj,
	PosComp,
	RotateComp,
	ScaleComp,
	SpriteComp,
	Vec2,
} from "kaplay";
import {
	k,
	GameState,
	changeGameState,
	addScore,
	mainSoundVolume,
	setTimescale,
} from "./main";
import {
	addScrapArmorProgress,
	getPlayerMaxHealth,
	loadPlayer,
	player,
	resetSession,
	session,
} from "./player";

import { clearPlayer, setupPlayer } from "./setupPlayer";
import { tags } from "./tags";
import {
	clearGameLoopUi,
	setupGameLoopUi,
	showSalvageGain,
	syncPlayerHealthBarCapacity,
	updatePlayerHealthBar,
} from "./ui/gameUi";
import { Component } from "./compose";
import { audioService } from "./services/audio/audioService";
import { gameSoundService } from "./services/audio/gameSoundService"
import { loopService } from "./services/core/loopService";
import { updatePriorityInteraction } from "./comp/interactable";
import {
	activeLevel,
	activeLevelKey,
	loadLevel,
	updateLvl,
	resetCurrentLevel,
	transitionToLevel,
} from "./levels/levels";
import { hideDeathScreen, showDeathScreen } from "./ui/deathScreen";
import { getPlayerDeathCause } from "./services/combat/damageService";
import { resetLevelLoadout } from "./upg";
import {
	clearRecoveryOffers,
	clearRunInventory,
	prepareDeathRecoveryOffers,
} from "./services/runs/runInventoryService";
import { resetPowerupRuntime, respawnCombatDrones } from "./powerups";
import {
	recordDebreeCollected,
	recordPlayerDeath,
} from "./services/runs/runStatsService";
import type { DebreeCollectionState } from "./spawn/spawnDebree";
import {
	findSpatialNearby,
	forEachSpatialNearby,
	getMaxProjectileSweepDistance,
} from "./services/core/runtimeSpatialIndexService";
import {
	findSegmentCircleIntersection,
	type SegmentCircleIntersection,
} from "./services/combat/projectileCollisionService";
import {
	hasEquippedActiveModule,
	resetActiveModuleCooldown,
} from "./services/abilities/activeModuleService";
import {
	hasPendingHubProgression,
	makeStrafeTrainingAvailable,
	shouldStartPrologue,
} from "./services/narrative/narrativeService";
import {
	beginPrologueExperience,
	cancelPrologueExperience,
	finishPrologueOnDeath,
	showHubIntroductionIfNeeded,
	showPrologueHubRepair,
	showPrologueRecoveryDialogue,
} from "./services/narrative/prologueService";
import { hideDialogue } from "./services/narrative/dialogService";
import { saveGame } from "./util";
import { recoverPlayerHealth } from "./services/player/playerHealthService";
import { RUN_HULL_REINFORCEMENT_AMOUNT } from "./services/player/playerHealthBalance";
import {
	clearPendingRunEndSummary,
	completeRun,
	hasPendingHubLevelReveal,
	type RunEndSummary,
} from "./services/runs/runCompletionService";
import { hideDebreeDepositPanel } from "./ui/debreeDepositPanel";
import {
	DebreeRunOutcome,
	loseCarriedDebree,
} from "./services/economy/debreeEconomyService";
import { chargeSalvageBattery } from "./services/progression/shipUpgradeService";
import { tracePrologue } from "./services/narrative/prologueTraceService";
import { spawnFlash } from "./spawn/spawnFlash";
import {
	beginRunSession,
	getRunRouteSnapshot,
} from "./services/runs/runDirectorService";
import { getUnlockedWarpZones } from "./services/world/warpZoneService";
import { showPopover } from "./services/ui/popoverService"

export let playerObj: ReturnType<typeof setupPlayer>;
let timeSinceLastLevel = 0;
let isPlayerDying = false;

export type DebreeObject = GameObj<
	AnimateComp | PosComp | SpriteComp | RotateComp | ScaleComp
> & {
	salvageValue: number
	dir: Vec2
	speed: number
	lifeSpan: number
	collection?: DebreeCollectionState
	carriedBy?: number
	readyForPlayer?: boolean
}

export let debrees: DebreeObject[] = [];
export const projectiles: GameObj<PosComp | any>[] = [];

export function startGame() {
	const startsWithPrologue = shouldStartPrologue();
	resetLevelLoadout();
	resetSession();
	clearRunInventory();
	clearRecoveryOffers();
	resetPowerupRuntime();
	resetActiveModuleCooldown();
	loadPlayer();
	playerObj = setupPlayer({
		arrivalTransition: true,
		arrivalBass: startsWithPrologue,
	});
	setupGameLoopUi(getPlayerMaxHealth(), hasEquippedActiveModule());
	if (startsWithPrologue) {
		loadLevel("level1");
		beginPrologueExperience();
		return;
	}
	k.wait(0.6, () => {
		if (activeLevelKey() !== "hub") return;
		void showHubIntroductionIfNeeded();
	});
}

export function updateGameLoop() {
	if (isPlayerDying) return;

	const deltaTime = k.dt();
	timeSinceLastLevel += deltaTime;

	if (!activeLevel()) {
		loadLevel("hub");
	}

	if (activeLevel()) {
		if (updateLvl()) {
			timeSinceLastLevel = 0;
			transitionToLevel("hub");
		}
	}

	for (let i = 0; i < debrees.length; i++) {
		const d = debrees[i];
		if (!d.exists()) {
			debrees.splice(i, 1);
			i--;
			continue;
		}
		const collectible = d as typeof d & {
			collection?: DebreeCollectionState;
			carriedBy?: number;
			readyForPlayer?: boolean;
			scale: Vec2;
			angle: number;
			salvageValue: number;
			color: Color;
			runtimeVisibilityCulled?: boolean;
		};

		if (collectible.carriedBy !== undefined) continue
		if (collectible.is(tags.stressDebree)) continue
		if (
			collectible.runtimeVisibilityCulled === true &&
			!collectible.collection
		) continue

		if (collectible.collection) {
			const completed = updateDebreeCollection(
				collectible,
				playerObj.pos,
				deltaTime
			);
			if (completed) {
				collectDebreeImmediately(collectible, playerObj.pos.clone());
				i--;
			}
			continue;
		}

		const dist = d.pos.dist(playerObj.pos);

		if (
			collectible.readyForPlayer || dist <
			player.debreeSeekDistance * player.debreeSeekDistanceMultiplier
		) {
			beginDebreeCollection(collectible, playerObj.pos);
		}
	}

	updatePriorityInteraction(k.get("interactable"), playerObj.pos);
}

export function collectDebreeImmediately(
	debris: GameObj & {
		salvageValue?: number;
		color?: Color;
	},
	collectionPos: Vec2
) {
	if (!debris.exists() || debris.carriedBy !== undefined) return 0;
	const salvageValue = debris.salvageValue ?? 1;
	const color = debris.color ?? k.WHITE;
	k.destroy(debris);
	recordDebreeCollected();
	gameSoundService.play("salvage_pickup", {
		volume: mainSoundVolume * k.clamp(0.72 + salvageValue * 0.028, 0.72, 1),
		detune: salvagePickupDetune(salvageValue),
	});
	spawnFlash(
		collectionPos.clone(),
		3 + Math.min(6, salvageValue * 0.6),
		color
	);
	const duplicatedBySet = player.salvageSetBonus && k.chance(0.2);
	const salvageGained = addScore(
		player.scorePerPickup * salvageValue * player.debreeValueMultiplier *
			(duplicatedBySet ? 2 : 1)
	);
	if (duplicatedBySet) spawnFlash(collectionPos.clone(), 7, k.rgb(80, 255, 175));
	addScrapArmorProgress(salvageGained);
	chargeSalvageBattery(playerObj, salvageGained);
	showSalvageGain(salvageGained, color, collectionPos);
	return salvageGained;
}

function salvagePickupDetune(value: number) {
	if (value >= 10) return 500;
	if (value >= 5) return 250;
	if (value >= 3) return 0;
	return -200;
}

function beginDebreeCollection(
	debris: GameObj<PosComp> & {
		collection?: DebreeCollectionState;
		angle: number;
		scale: Vec2;
	},
	playerPos: Vec2
) {
	const approach = playerPos.sub(debris.pos);
	debris.collection = {
		elapsed: 0,
		duration: 0.48,
		startPos: debris.pos.clone(),
		approachDir: approach.len() > 0 ? approach.unit() : k.vec2(0, -1),
		startAngle: debris.angle,
		startScale: debris.scale.x,
		spin: k.chance(0.5) ? 1 : -1,
	};
}

function updateDebreeCollection(
	debris: GameObj<PosComp> & {
		collection?: DebreeCollectionState;
		scale: Vec2;
		angle: number;
	},
	playerPos: Vec2,
	deltaTime: number
) {
	const collection = debris.collection;
	if (!collection) return false;
	collection.elapsed += deltaTime;
	const progress = k.clamp(collection.elapsed / collection.duration, 0, 1);
	const overshootDistance = 26;
	const overshootAt = 0.72;
	const overshootPos = playerPos.add(
		collection.approachDir.scale(overshootDistance)
	);

	if (progress < overshootAt) {
		const pullProgress = progress / overshootAt;
		const eased = pullProgress * pullProgress * pullProgress;
		debris.pos = collection.startPos.add(
			overshootPos.sub(collection.startPos).scale(eased)
		);
		debris.scale = k.vec2(
			collection.startScale * k.lerp(1, 1.45, eased)
		);
		debris.angle = collection.startAngle + collection.spin * 300 * eased;
	} else {
		const snapProgress = (progress - overshootAt) / (1 - overshootAt);
		const eased = 1 - Math.pow(1 - snapProgress, 3);
		debris.pos = overshootPos.add(playerPos.sub(overshootPos).scale(eased));
		debris.scale = k.vec2(
			collection.startScale * k.lerp(1.45, 0.35, eased)
		);
		debris.angle =
			collection.startAngle + collection.spin * k.lerp(300, 440, eased);
	}
	return progress >= 1;
}

export function beginPlayerDeathSequence() {
	if (isPlayerDying) return;
	isPlayerDying = true;
	audioService.pauseMusic();
	gameSoundService.play("player_game_over", {
		volume: mainSoundVolume,
	});
	recordPlayerDeath();
	const deathCause = getPlayerDeathCause();
	const diedInHub = activeLevelKey() === "hub";
	const diedInPrologue = finishPrologueOnDeath();
	const retryZoneId = getRunRouteSnapshot()?.zoneId ??
		getUnlockedWarpZones()[0]?.id;
	if (diedInPrologue) tracePrologue("death:classified-as-prologue");
	let debreeOutcome: DebreeRunOutcome = { deposited: 0, lost: 0 };
	let runEndSummary: RunEndSummary | undefined;
	let hubReturnRequired = false;
	if (diedInPrologue) saveGame("slot1");
	if (!diedInHub && !diedInPrologue) {
		debreeOutcome = loseCarriedDebree();
		runEndSummary = completeRun("DESTROYED", debreeOutcome);
		clearPendingRunEndSummary();
		prepareDeathRecoveryOffers();
		makeStrafeTrainingAvailable();
		hubReturnRequired = hasPendingHubLevelReveal() ||
			runEndSummary.hub.unlocks.length > 0 ||
			hasPendingHubProgression();
	}

	k.shake(8);
	if (diedInPrologue) {
		setTimescale(1, 0, false);
		tracePrologue("death:recovery-dispatch-scheduled", { delay: 1.1 });
		k.wait(1.1, () => {
			if (!isPlayerDying) return;
			tracePrologue("death:recovery-dispatched");
			void recoverFromPrologueDeath();
		});
		return;
	}
	setTimescale(0.15, 1, false);

	k.wait(2, () => {
		if (!isPlayerDying) return;
		showDeathScreen(
			deathCause,
			runEndSummary,
			() => continueAfterPlayerDeath(diedInHub),
			!diedInHub && retryZoneId && !hubReturnRequired
				? () => startNewRunAfterPlayerDeath(retryZoneId, diedInHub)
				: undefined
		);
	});
}

export function respawnPlayerFromExtraLife(
	deathPos: Vec2,
	remainingLives: number
) {
	if (isPlayerDying) return false
	playerObj = setupPlayer({
		spawnPosition: deathPos,
		extraLifeRespawn: true,
		preserveRunState: true,
	})
	syncPlayerHealthBarCapacity(getPlayerMaxHealth())
	updatePlayerHealthBar(getPlayerMaxHealth())
	showPopover({
		title: "PHASE RECALL ACTIVATED",
		message: "SHIP RECONSTRUCTED",
		description: `${remainingLives} RECALL ${remainingLives === 1 ? "CHARGE" : "CHARGES"} REMAINING`,
		sprite: "phase_recall_upg1",
		color: k.rgb(80, 180, 255),
		duration: 3.5,
	})
	k.shake(6)
	return true
}

function startNewRunAfterPlayerDeath(zoneId: string, diedInHub: boolean) {
	if (!isPlayerDying) return;
	hideDeathScreen();
	clearPlayer();
	clearGameLoopUi();
	k.destroyAll(tags.follower);
	resetLevelLoadout();
	resetSession();
	clearRunInventory();
	clearRecoveryOffers();
	resetPowerupRuntime();
	loadPlayer();

	const firstFloor = beginRunSession(zoneId);
	if (!firstFloor) {
		continueAfterPlayerDeath(diedInHub);
		return;
	}

	audioService.stopMusic();
	transitionToLevel(firstFloor.levelKey);
	playerObj = setupPlayer({ arrivalTransition: true });
	setupGameLoopUi(getPlayerMaxHealth(), hasEquippedActiveModule());
	setTimescale(1, 0.4, false);
	isPlayerDying = false;
}

function continueAfterPlayerDeath(diedInHub: boolean) {
	if (!isPlayerDying) return;
	hideDeathScreen();
	const combatDroneCount = diedInHub ? k.get(tags.follower).length : 0;
	clearPlayer();

	if (diedInHub) {
		k.destroyAll(tags.follower);
		transitionToLevel("hub");
		playerObj = setupPlayer({ respawnTransition: true });
		respawnCombatDrones(combatDroneCount);
		updatePlayerHealthBar(getPlayerMaxHealth());
		setTimescale(1, 0.4, false);
		isPlayerDying = false;
		return;
	}

	clearGameLoopUi();
	k.destroyAll(tags.follower);
	resetLevelLoadout();
	resetSession();
	resetPowerupRuntime();
	loadPlayer();
	makeStrafeTrainingAvailable();
	transitionToLevel("hub");
	playerObj = setupPlayer({ respawnTransition: true });
	setupGameLoopUi(getPlayerMaxHealth(), hasEquippedActiveModule());
	setTimescale(1, 0.4, false);
	isPlayerDying = false;
}

export function playerDeathSequenceActive() {
	return isPlayerDying;
}

export function exitRunToHub() {
	if (activeLevelKey() === "hub") return;

	completeRun("ABANDONED", loseCarriedDebree());
	clearPlayer();
	if (playerObj?.exists()) k.destroy(playerObj);
	k.destroyAll(tags.follower);
	clearGameLoopUi();
	resetLevelLoadout();
	resetSession();
	clearRunInventory();
	clearRecoveryOffers();
	resetPowerupRuntime();
	loadPlayer();
	debrees = [];
	transitionToLevel("hub");
	playerObj = setupPlayer({ respawnTransition: true });
	setupGameLoopUi(getPlayerMaxHealth(), hasEquippedActiveModule());
	setTimescale(1, 0.2, false);
}

export function clearGame() {
	isPlayerDying = false;
	hideDebreeDepositPanel(false);
	hideDeathScreen();
	hideDialogue();
	cancelPrologueExperience();
	setTimescale(1, 0.2, false);
	clearPlayer();
	resetLevelLoadout();
	resetSession();
	clearRunInventory();
	clearRecoveryOffers();
	resetPowerupRuntime();
	loadPlayer();
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
	k.destroyAll(tags.damageNumber);
	k.destroyAll(tags.emotion);
	clearGameLoopUi();
	changeGameState(GameState.MainMenu);
}

async function recoverFromPrologueDeath() {
	tracePrologue("game:battlefield-recovery-await-start");
	let recovered = false;
	try {
		recovered = await showPrologueRecoveryDialogue();
	} catch (error) {
		tracePrologue("game:battlefield-recovery-error", {
			error: error instanceof Error ? error.message : String(error),
		});
		throw error;
	}
	tracePrologue("game:battlefield-recovery-await-complete", {
		recovered,
		isPlayerDying,
	});
	if (!recovered || !isPlayerDying) {
		tracePrologue("game:hub-transition-blocked", {
			recovered,
			isPlayerDying,
		});
		return;
	}

	clearPlayer();
	clearGameLoopUi();
	k.destroyAll(tags.follower);
	resetLevelLoadout();
	resetSession();
	clearRunInventory();
	clearRecoveryOffers();
	resetPowerupRuntime();
	loadPlayer();
	audioService.stopMusic();
	tracePrologue("game:hub-transition-start", { target: "hub" });
	transitionToLevel("hub");
	tracePrologue("game:hub-transition-complete", {
		activeLevel: activeLevelKey(),
	});
	const {
		getHubFacilityPositions,
		getHubWormholePosition,
	} = await import("./levels/hub");
	tracePrologue("game:hub-repair-await-start");
	const repairResult = await showPrologueHubRepair(
		getHubFacilityPositions().trainingRange,
		getHubWormholePosition()
	);
	tracePrologue("game:hub-repair-await-complete", {
		repaired: repairResult !== false,
		burtId: repairResult === false ? undefined : repairResult.burt.id,
		isPlayerDying,
	});
	if (!isPlayerDying || !repairResult) {
		tracePrologue("game:respawn-blocked", {
			reason: !isPlayerDying ? "death-state-cleared" : "repair-incomplete",
		});
		return;
	}
	playerObj = setupPlayer({
		arrivalTransition: true,
		arrivalBass: true,
		spawnPosition: repairResult.playerSpawnPosition,
	});
	tracePrologue("game:player-respawned", {
		id: playerObj.id,
		x: Math.round(repairResult.playerSpawnPosition.x),
		y: Math.round(repairResult.playerSpawnPosition.y),
	});
	setupGameLoopUi(getPlayerMaxHealth(), hasEquippedActiveModule());
	setTimescale(1, 0.4, false);
	isPlayerDying = false;
	k.wait(0.65, () => void showHubIntroductionIfNeeded());
}

export function checkProjectileIntersection(
	pos: Vec2,
	dist: number,
	projectilesWithTag: string,
	onHit: (p: GameObj<PosComp | RotateComp | any>) => void
) {
	const queryRadius = dist + getMaxProjectileSweepDistance();
	forEachSpatialNearby(
		pos,
		queryRadius,
		{ allTags: [tags.projectile, projectilesWithTag] },
		(projectile) => {
			const p = projectile as GameObj<PosComp | RotateComp | any>;
			const intersection = getProjectileSweepIntersection(p, pos, dist);
			if (!intersection) return;
			resolveProjectileSweepHit(p, intersection, () => onHit(p));
		}
	);
}

export function getProjectileSweepIntersection(
	projectile: GameObj<PosComp | any>,
	pos: Vec2,
	dist: number
) {
	const start = projectile.activeSweepStartPos ??
		projectile.previousPos ?? projectile.pos;
	const end = projectile.activeSweepEndPos ?? projectile.pos;
	return findSegmentCircleIntersection(start, end, pos, dist);
}

export function resolveProjectileSweepHit(
	projectile: GameObj<PosComp | any>,
	intersection: SegmentCircleIntersection,
	onHit: () => void
) {
	const ownsSweep = !projectile.activeSweepStartPos;
	if (ownsSweep) {
		projectile.activeSweepStartPos = (
			projectile.previousPos ?? projectile.pos
		).clone();
		projectile.activeSweepEndPos = projectile.pos.clone();
	}
	const positionBeforeHit = projectile.pos.clone();
	const impactPosition = k.vec2(
		intersection.point.x,
		intersection.point.y
	);
	const directionBeforeHit = projectile.dir?.clone();
	const bouncesBeforeHit = projectile.bouncesRemaining;
	projectile.pos = impactPosition;
	onHit();
	if (projectile.exists()) {
		const directionUnchanged = !directionBeforeHit ||
			projectile.dir?.dist(directionBeforeHit) < 0.001;
		const bounceStateUnchanged = projectile.bouncesRemaining ===
			bouncesBeforeHit;
		if (
			projectile.pos.dist(impactPosition) < 0.001 &&
			directionUnchanged &&
			bounceStateUnchanged
		) {
			projectile.pos = positionBeforeHit;
		}
	}
	if (ownsSweep) {
		projectile.activeSweepStartPos = undefined;
		projectile.activeSweepEndPos = undefined;
	}
}

export function checkProjectileComponentIntersection(
	pos: Vec2,
	dist: number,
	projectilesWithTag: string,
	components: Component[],
	onHit: (p: GameObj<PosComp | RotateComp | any>, index: number) => void
) {
	const queryRadius = dist + getMaxProjectileSweepDistance();
	forEachSpatialNearby(
		pos,
		queryRadius,
		{ allTags: [tags.projectile, projectilesWithTag] },
		(projectile) => {
			const p = projectile as GameObj<PosComp | RotateComp | any>;
			let closestIntersection: SegmentCircleIntersection | undefined;
			let closestComponentIndex = -1;
			for (let i = 0; i < components.length; i++) {
				if (components[i].obj.hidden) continue;
				const componentPos = pos.add(
					components[i].localPos.rotate(components[i].obj.parent?.angle ?? 0)
				);
				const intersection = getProjectileSweepIntersection(
					p,
					componentPos,
					components[i].hitbox
				);
				if (!intersection) continue;
				if (
					closestIntersection &&
					intersection.progress >= closestIntersection.progress
				) continue;
				closestIntersection = intersection;
				closestComponentIndex = i;
			}
			if (!closestIntersection) return;
			resolveProjectileSweepHit(p, closestIntersection, () => {
				onHit(p, closestComponentIndex);
			});
			return false;
		}
	);
}

export function pickUnitInDistance(
	pos: Vec2,
	dist: number,
	tag: string,
	onFound: (u: GameObj) => void
) {
	const unit = findSpatialNearby(pos, dist, {
		allTags: [tag, tags.unit],
	});
	if (!unit) return false;
	onFound(unit);
	return true;
}

export function addMaxHealth() {
	if (!playerObj) return;

	const previousMaxHealth = getPlayerMaxHealth();
	session.extraHealth += RUN_HULL_REINFORCEMENT_AMOUNT;
	const totalHealth = getPlayerMaxHealth();
	playerObj.maxHP = totalHealth;
	syncPlayerHealthBarCapacity(totalHealth);
	recoverPlayerHealth(playerObj, totalHealth - previousMaxHealth);
}
