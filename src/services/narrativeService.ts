import { resetNpcDialogueHistory } from "./npcDialogueService"

const NARRATIVE_PROGRESS_KEY = "spacedaze_narrative_progress_v1"

interface NarrativeProgress {
	prologueComplete: boolean
	hubIntroductionComplete: boolean
	asteroidRunnerComplete: boolean
	birthdayEncounterComplete: boolean
}

const defaultProgress: NarrativeProgress = {
	prologueComplete: false,
	hubIntroductionComplete: false,
	asteroidRunnerComplete: false,
	birthdayEncounterComplete: false,
}

let progress = loadProgress()
let prologueActive = false

export function shouldStartPrologue() {
	if (
		import.meta.env.DEV
		&& typeof window !== "undefined"
		&& new URLSearchParams(window.location.search).get("prologue") === "1"
	) return true
	return !progress.prologueComplete
}

export function beginNarrativePrologue() {
	prologueActive = true
}

export function narrativePrologueActive() {
	return prologueActive
}

export function completeNarrativePrologue() {
	prologueActive = false
	progress.prologueComplete = true
	saveProgress()
}

export function cancelNarrativePrologue() {
	prologueActive = false
}

export function shouldShowHubIntroduction() {
	return progress.prologueComplete && !progress.hubIntroductionComplete
}

export function completeHubIntroduction() {
	progress.hubIntroductionComplete = true
	saveProgress()
}

export function shouldShowAsteroidRunnerEncounter() {
	return !progress.asteroidRunnerComplete
}

export function isAsteroidRunnerEncounterComplete() {
	return progress.asteroidRunnerComplete
}

export function completeAsteroidRunnerEncounter() {
	progress.asteroidRunnerComplete = true
	saveProgress()
}

export function shouldShowBirthdayEncounter() {
	return !progress.birthdayEncounterComplete
}

export function isBirthdayEncounterComplete() {
	return progress.birthdayEncounterComplete
}

export function completeBirthdayEncounter() {
	progress.birthdayEncounterComplete = true
	saveProgress()
}

export function skipNarrativeIntroduction() {
	prologueActive = false
	progress.prologueComplete = true
	progress.hubIntroductionComplete = true
	saveProgress()
}

export function resetNarrativeProgress() {
	progress = { ...defaultProgress }
	prologueActive = false
	resetNpcDialogueHistory()
	saveProgress()
}

function loadProgress(): NarrativeProgress {
	if (typeof localStorage === "undefined") return { ...defaultProgress }
	const saved = localStorage.getItem(NARRATIVE_PROGRESS_KEY)
	if (!saved) return { ...defaultProgress }
	const parsed = JSON.parse(saved) as Partial<NarrativeProgress>
	return {
		prologueComplete: parsed.prologueComplete === true,
		hubIntroductionComplete: parsed.hubIntroductionComplete === true,
		asteroidRunnerComplete: parsed.asteroidRunnerComplete === true,
		birthdayEncounterComplete: parsed.birthdayEncounterComplete === true,
	}
}

function saveProgress() {
	if (typeof localStorage === "undefined") return
	localStorage.setItem(NARRATIVE_PROGRESS_KEY, JSON.stringify(progress))
}
