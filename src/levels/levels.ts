import { hub } from "./hub";
import { level1 } from "./level1";
import { k } from "../main";

const levels = {
	hub,
	level1,
} as const;

export type LevelKey = keyof typeof levels;

interface SongData {
	title: string;
	author: string;
	albumCover: string;
	music: string;
	bpm: number;
}

export interface Level {
	song: SongData;
	title: string; // Main title which introduces the level
	introduceSound: string; // What sound is played when the level is introduced?
	levelLengthSeconds: number;
	waves: Wave[]; // Used for spawning enemies
	lvlUpd: () => void;
	reset: () => void;
	onStart?: () => void;
}

interface Wave {
	timeStamp: number; // timestamp in milliseconds
	duration?: number; // Duration of wave in milliseconds
	upd: (levelDuration: number) => void;
	begin?: (levelDuration: number) => void;
}

let currentLvl: Level | null = null;
let nextWaveIndex = -1;
let currentWaveIndex = -1;
let firstWaveTriggered = false;
let timeDuringLevel = 0;
export function loadLevel(levelKey: LevelKey) {
	const lvl = levels[levelKey];
	currentLvl = lvl;
	nextWaveIndex = 0;
	currentWaveIndex = -1;
	timeDuringLevel = 0;
	firstWaveTriggered = false;

	if (currentLvl.onStart) {
		currentLvl.onStart();
	}
}

export function updateLvl() {
	if (!currentLvl) return false;
	timeDuringLevel += k.dt() * 1000;

	// Level ended
	if (currentLvl.levelLengthSeconds < timeDuringLevel / 1000) {
		return true;
	}
	currentLvl.lvlUpd();

	if (nextWaveIndex < currentLvl.waves.length) {
		const nextTimestamp = currentLvl.waves[nextWaveIndex].timeStamp;

		// Timestamp reached, begin wave
		if (nextTimestamp < timeDuringLevel && currentWaveIndex != nextWaveIndex) {
			currentWaveIndex = nextWaveIndex;
			nextWaveIndex++;
			if (currentLvl.waves[currentWaveIndex].begin) {
				currentLvl.waves[currentWaveIndex].begin!(timeDuringLevel);
			}
		}
	}

	if (currentWaveIndex > 0 && currentWaveIndex < currentLvl.waves.length) {
		const waveEndedTimestamp =
			(currentLvl.waves[currentWaveIndex].duration ?? 0) +
			currentLvl.waves[currentWaveIndex].timeStamp;

		if (timeDuringLevel < waveEndedTimestamp) {
			currentLvl.waves[currentWaveIndex].upd(
				timeDuringLevel - currentLvl.waves[currentWaveIndex].timeStamp
			);

			return false;
		}
	}

	return false;
}

export function activeLevel() {
	return currentLvl != null;
}

export function resetCurrentLevel() {
	if (!currentLvl) return;
	resetLvlData(currentLvl);
	currentLvl = null;
	timeDuringLevel = 0;
}
export function resetLvlData(lvl: Level) {
	nextWaveIndex = -1;
	currentWaveIndex = -1;
	lvl.reset();
	firstWaveTriggered = false;
}
