import { resetNpcDialogueHistory } from "./npcDialogueService"

const NARRATIVE_PROGRESS_KEY = "spacedaze_narrative_progress_v1"

interface NarrativeProgress {
	prologueComplete: boolean
	hubIntroductionComplete: boolean
	asteroidRunnerComplete: boolean
	birthdayEncounterComplete: boolean
	strafeTrainingAvailable: boolean
	strafeTrainingOffered: boolean
	strafeTrainingUnlocked: boolean
	strafeTutorialComplete: boolean
}

const defaultProgress: NarrativeProgress = {
	prologueComplete: false,
	hubIntroductionComplete: false,
	asteroidRunnerComplete: false,
	birthdayEncounterComplete: false,
	strafeTrainingAvailable: false,
	strafeTrainingOffered: false,
	strafeTrainingUnlocked: false,
	strafeTutorialComplete: false,
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

export function shouldOfferStrafeTraining() {
	return progress.strafeTrainingAvailable &&
		!progress.strafeTrainingOffered &&
		!progress.strafeTrainingUnlocked
}

export function makeStrafeTrainingAvailable() {
	if (
		!progress.prologueComplete ||
		progress.strafeTrainingAvailable ||
		progress.strafeTrainingOffered ||
		progress.strafeTrainingUnlocked
	) return false
	progress.strafeTrainingAvailable = true
	saveProgress()
	return true
}

export function beginStrafeTrainingOffer() {
	progress.strafeTrainingAvailable = false
	progress.strafeTrainingOffered = true
	saveProgress()
}

export function shouldSpawnStrafeTrainingModule() {
	return progress.strafeTrainingOffered && !progress.strafeTrainingUnlocked
}

export function isStrafeTrainingUnlocked() {
	return progress.strafeTrainingUnlocked
}

export function unlockStrafeTraining() {
	progress.strafeTrainingAvailable = false
	progress.strafeTrainingOffered = true
	progress.strafeTrainingUnlocked = true
	saveProgress()
}

export function shouldShowStrafeTutorial() {
	return progress.strafeTrainingUnlocked && !progress.strafeTutorialComplete
}

export function completeStrafeTutorial() {
	progress.strafeTutorialComplete = true
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
		strafeTrainingAvailable: parsed.strafeTrainingAvailable === true,
		strafeTrainingOffered: parsed.strafeTrainingOffered === true,
		strafeTrainingUnlocked: parsed.strafeTrainingUnlocked === true,
		strafeTutorialComplete: parsed.strafeTutorialComplete === true,
	}
}

function saveProgress() {
	if (typeof localStorage === "undefined") return
	localStorage.setItem(NARRATIVE_PROGRESS_KEY, JSON.stringify(progress))
}
