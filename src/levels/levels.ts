import { hub } from "./hub";
import { level1 } from "./level1";
import { k } from "../main";
import { tags } from "../tags";
import { clearRecoveryOffers } from "../services/runInventoryService";
import { hideRecoveryShop } from "../ui/recoveryShop";
import {
	finishRunStats,
} from "../services/runStatsService";
import type { CaveGenConfigOverrides } from "../generation/generationTypes";
import {
	endRunSession,
	getRunRouteSnapshot,
	runSessionActive,
} from "../services/runDirectorService";
import { getWarpZone } from "../services/warpZoneService";
import {
	prepareRunFinale,
	resetRunFinale,
	updateRunFinale,
} from "../services/runFinaleService";

const levels = {
	hub,
	level1,
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
	const lvl = levels[levelKey];
	currentLvl = lvl;
	currentLevelKey = levelKey;
	if (currentLvl.onStart) {
		currentLvl.onStart();
	}
	const zoneId = getRunRouteSnapshot()?.zoneId;
	const finaleId = zoneId ? getWarpZone(zoneId)?.finaleId : undefined;
	prepareRunFinale(currentLvl.mapGeneration ? finaleId : undefined);
}

export function transitionToLevel(levelKey: LevelKey) {
	if (levelKey === "hub" && runSessionActive()) {
		finishRunStats("EXTRACTED");
		endRunSession();
	}
	if (currentLvl === hub && levelKey !== "hub") {
		hideRecoveryShop();
		clearRecoveryOffers();
	}

	if (currentLvl) {
		resetLvlData(currentLvl);
		currentLvl = null;
		currentLevelKey = null;
	}

	k.destroyAll(tags.enemy);
	k.destroyAll(tags.props);
	k.destroyAll(tags.levelBg);
	k.destroyAll(tags.debree);
	k.destroyAll(tags.blaster);
	k.destroyAll(tags.rocket);
	k.destroyAll(tags.damageNumber);

	loadLevel(levelKey);
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
		finishRunStats("DESTROYED");
		endRunSession();
	}
	resetLvlData(currentLvl);
	currentLvl = null;
	currentLevelKey = null;
}
export function resetLvlData(lvl: Level) {
	resetRunFinale();
	lvl.reset();
}
