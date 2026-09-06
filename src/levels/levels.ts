import type { GameObj } from "kaplay";
import { hub } from "./hub";
import { level1 } from "./level1";
import { level2 } from "./level2";
import { k } from "../main";
import { tags } from "../tags";
import { clearRecoveryOffers } from "../services/runInventoryService";
import { hideRecoveryShop } from "../ui/recoveryShop";
import type { CaveGenConfigOverrides } from "../generation/generationTypes";
import {
	getRunRouteSnapshot,
	runSessionActive,
} from "../services/runDirectorService";
import { getWarpZone } from "../services/warpZoneService";
import { musicVolume } from "../main";
import { playZoneExplorationMusic } from "../services/explorationMusicService";
import {
	prepareRunFinale,
	resetRunFinale,
	updateRunFinale,
} from "../services/runFinaleService";
import { extractVolatileCargo } from "../services/shipUpgradeService";
import { spawnGameplaySpaceAmbience } from "../spawn/spaceAmbience";
import { saveGame } from "../util";
import {
	extractDebreeRun,
	loseCarriedDebree,
} from "../services/debreeEconomyService";
import { completeRun } from "../services/runCompletionService";
import { cancelActiveCutscene } from "../services/cutsceneService";
import { runtimeDebug } from "../services/runtimeDebugService";

const levels = {
	hub,
	level1,
	level2,
} as const;

export type LevelKey = keyof typeof levels;

export interface GeneratedMapConfig {
	width: number;
	height: number;
	hexSize: number;
	generator?: CaveGenConfigOverrides;
}

export interface Level {
	lvlUpd: () => void;
	reset: () => void;
	onStart?: () => void;
	mapGeneration?: GeneratedMapConfig;
}

let currentLvl: Level | null = null;
let currentLevelKey: LevelKey | null = null;
export function loadLevel(levelKey: LevelKey) {
	runtimeDebug.log("level", "level:load-start", {
		level: levelKey,
		previous: currentLevelKey,
	});
	const lvl = levels[levelKey];
	currentLvl = lvl;
	currentLevelKey = levelKey;
	const zoneId = getRunRouteSnapshot()?.zoneId;
	const runDepth = getRunRouteSnapshot()?.depth;
	const zone = zoneId ? getWarpZone(zoneId) : undefined;
	prepareRunFinale(
		currentLvl.mapGeneration ? zone?.finaleId : undefined,
		zone?.finaleTransitionSeconds
	);
	spawnGameplaySpaceAmbience();
	if (currentLvl.onStart) {
		currentLvl.onStart();
	}
	if (currentLvl.mapGeneration && zone?.explorationMusic) {
		void playZoneExplorationMusic(
			zone.id,
			runDepth === 1,
			musicVolume
		);
	}
	runtimeDebug.log("level", "level:load-complete", { level: levelKey });
}

export function transitionToLevel(levelKey: LevelKey) {
	runtimeDebug.log("level", "level:transition-request", {
		from: currentLevelKey,
		to: levelKey,
	});
	cancelActiveCutscene();
	if (levelKey === "hub" && runSessionActive()) {
		const cargoReward = extractVolatileCargo();
		if (cargoReward > 0) {
			console.log(`Volatile cargo delivered for ${cargoReward} salvage`);
		}
		completeRun("EXTRACTED", extractDebreeRun());
		saveGame("slot1");
	}
	if (currentLvl === hub && levelKey !== "hub") {
		hideRecoveryShop(false);
		clearRecoveryOffers();
	}

	if (currentLvl) {
		resetLvlData(currentLvl);
		currentLvl = null;
		currentLevelKey = null;
	}

	destroyTaggedObjects(tags.enemy);
	destroyTaggedObjects(tags.props);
	destroyTaggedObjects(tags.levelBg);
	destroyTaggedObjects(tags.debree);
	destroyTaggedObjects(tags.blaster);
	destroyTaggedObjects(tags.rocket);
	destroyTaggedObjects(tags.damageNumber);
	destroyTaggedObjects(tags.emotion);
	destroyTaggedObjects(tags.hubRestoration);
	destroyTaggedObjects(tags.hubRepairDrone);
	destroyTaggedObjects(tags.hubBoundary);
	destroyTaggedObjects(tags.hubPhaseField);

	loadLevel(levelKey);
	runtimeDebug.log("level", "level:transition-complete", {
		active: currentLevelKey,
	});
}

function destroyTaggedObjects(tag: string) {
	const objects = (k.get(tag) as GameObj[]).sort(
		(a, b) => objectDepth(b) - objectDepth(a)
	);
	const destroyedIds = new Set<number>();
	for (const obj of objects) {
		destroyObjectTree(obj, destroyedIds);
	}
}

function destroyObjectTree(obj: GameObj, destroyedIds: Set<number>) {
	if (destroyedIds.has(obj.id) || !obj.exists()) return;
	for (const child of [...obj.children]) {
		destroyObjectTree(child, destroyedIds);
	}
	if (!obj.exists()) return;
	destroyedIds.add(obj.id);
	k.destroy(obj);
}

function objectDepth(obj: GameObj) {
	let depth = 0;
	let parent = obj.parent;
	while (parent) {
		depth++;
		parent = parent.parent;
	}
	return depth;
}

export function updateLvl() {
	if (!currentLvl) return false;
	currentLvl.lvlUpd();
	updateRunFinale();
	return false;
}

export function activeLevel() {
	return currentLvl != null;
}

export function activeLevelKey() {
	return currentLevelKey;
}

export function resetCurrentLevel() {
	if (!currentLvl) return;
	if (runSessionActive()) {
		completeRun("DESTROYED", loseCarriedDebree());
	}
	resetLvlData(currentLvl);
	currentLvl = null;
	currentLevelKey = null;
}
export function resetLvlData(lvl: Level) {
	resetRunFinale();
	lvl.reset();
}
