import type { GameObj } from "kaplay";
import { hub } from "./hub";
import { level1 } from "./level1";
import { level2 } from "./level2";
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
import { audioService } from "../services/audioService";
import { musicVolume } from "../main";
import { loadSongData } from "../web";
import {
	prepareRunFinale,
	resetRunFinale,
	updateRunFinale,
} from "../services/runFinaleService";
import { extractVolatileCargo } from "../services/shipUpgradeService";

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
	const lvl = levels[levelKey];
	currentLvl = lvl;
	currentLevelKey = levelKey;
	const zoneId = getRunRouteSnapshot()?.zoneId;
	const zone = zoneId ? getWarpZone(zoneId) : undefined;
	prepareRunFinale(
		currentLvl.mapGeneration ? zone?.finaleId : undefined,
		zone?.finaleTransitionSeconds
	);
	if (currentLvl.onStart) {
		currentLvl.onStart();
	}
	if (currentLvl.mapGeneration && zone?.explorationMusic) {
		const song = zone.explorationMusic;
		void audioService
			.playOptionalMusic(song.music, song.path, {
				volume: musicVolume,
				loop: true,
			})
			.then((started) => {
				if (!started) return;
				loadSongData(song.title, song.author, song.albumCover ?? "");
			});
	}
}

export function transitionToLevel(levelKey: LevelKey) {
	if (levelKey === "hub" && runSessionActive()) {
		const cargoReward = extractVolatileCargo();
		if (cargoReward > 0) {
			console.log(`Volatile cargo delivered for ${cargoReward} salvage`);
		}
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

	destroyTaggedObjects(tags.enemy);
	destroyTaggedObjects(tags.props);
	destroyTaggedObjects(tags.levelBg);
	destroyTaggedObjects(tags.debree);
	destroyTaggedObjects(tags.blaster);
	destroyTaggedObjects(tags.rocket);
	destroyTaggedObjects(tags.damageNumber);

	loadLevel(levelKey);
}

function destroyTaggedObjects(tag: string) {
	const objects = (k.get(tag) as GameObj[]).sort(
		(a, b) => objectDepth(b) - objectDepth(a)
	);
	for (const obj of objects) {
		if (obj.exists()) k.destroy(obj);
	}
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
