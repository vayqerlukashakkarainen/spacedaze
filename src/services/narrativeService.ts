import { resetNpcDialogueHistory } from "./npcDialogueService"
import {
	readProfileSection,
	writeProfileSection,
} from "./profileSaveService"

const LEGACY_NARRATIVE_PROGRESS_KEY = "spacedaze_narrative_progress_v1"

interface NarrativeProgress {
	prologueComplete: boolean
	hubIntroductionComplete: boolean
	asteroidRunnerComplete: boolean
	birthdayEncounterComplete: boolean
	burtHubLocation: HubBurtLocation
	strafeTrainingAvailable: boolean
	strafeTrainingOfferComplete: boolean
	strafeTrainingUnlocked: boolean
	strafeTutorialComplete: boolean
}

export type HubBurtLocation = "home" | "phaseStation" | "center"

const defaultProgress: NarrativeProgress = {
	prologueComplete: false,
	hubIntroductionComplete: false,
	asteroidRunnerComplete: false,
	birthdayEncounterComplete: false,
	burtHubLocation: "home",
	strafeTrainingAvailable: false,
	strafeTrainingOfferComplete: false,
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
	if (progress.burtHubLocation === "home") {
		progress.burtHubLocation = "phaseStation"
	}
	saveProgress()
}

export function getHubBurtLocation() {
	return progress.burtHubLocation
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
		!progress.strafeTrainingOfferComplete &&
		!progress.strafeTrainingUnlocked
}

export function makeStrafeTrainingAvailable() {
	if (
		!progress.prologueComplete ||
		progress.strafeTrainingAvailable ||
		progress.strafeTrainingOfferComplete ||
		progress.strafeTrainingUnlocked
	) return false
	progress.strafeTrainingAvailable = true
	progress.burtHubLocation = "center"
	saveProgress()
	return true
}

export function completeStrafeTrainingOffer() {
	progress.strafeTrainingAvailable = false
	progress.strafeTrainingOfferComplete = true
	progress.burtHubLocation = "center"
	saveProgress()
}

export function shouldSpawnStrafeTrainingModule() {
	return progress.strafeTrainingOfferComplete && !progress.strafeTrainingUnlocked
}

export function isStrafeTrainingUnlocked() {
	return progress.strafeTrainingUnlocked
}

export function unlockStrafeTraining() {
	progress.strafeTrainingAvailable = false
	progress.strafeTrainingOfferComplete = true
	progress.strafeTrainingUnlocked = true
	progress.burtHubLocation = "center"
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
	if (progress.burtHubLocation === "home") {
		progress.burtHubLocation = "phaseStation"
	}
	saveProgress()
}

export function resetNarrativeProgress() {
	progress = { ...defaultProgress }
	prologueActive = false
	resetNpcDialogueHistory()
	saveProgress()
}

function loadProgress(): NarrativeProgress {
	const profileProgress = readProfileSection<Partial<NarrativeProgress> & {
		strafeTrainingOffered?: boolean
	}>("narrative")
	const legacyProgress = profileProgress ? undefined : readLegacyProgress()
	const parsed = profileProgress ?? legacyProgress
	if (!parsed) return { ...defaultProgress }
	const strafeTrainingUnlocked = parsed.strafeTrainingUnlocked === true
	const strafeTrainingOfferComplete =
		parsed.strafeTrainingOfferComplete === true || strafeTrainingUnlocked
	const strafeTrainingAvailable = parsed.strafeTrainingAvailable === true ||
		(parsed.strafeTrainingOffered === true && !strafeTrainingOfferComplete)
	const hubIntroductionComplete = parsed.hubIntroductionComplete === true
	const savedBurtLocation = parsed.burtHubLocation
	const burtHubLocation: HubBurtLocation =
		savedBurtLocation === "home" ||
		savedBurtLocation === "phaseStation" ||
		savedBurtLocation === "center"
			? savedBurtLocation
			: strafeTrainingAvailable ||
				strafeTrainingOfferComplete ||
				strafeTrainingUnlocked
					? "center"
					: hubIntroductionComplete
						? "phaseStation"
						: "home"
	const normalizedProgress = {
		prologueComplete: parsed.prologueComplete === true,
		hubIntroductionComplete,
		asteroidRunnerComplete: parsed.asteroidRunnerComplete === true,
		birthdayEncounterComplete: parsed.birthdayEncounterComplete === true,
		burtHubLocation,
		strafeTrainingAvailable,
		strafeTrainingOfferComplete,
		strafeTrainingUnlocked,
		strafeTutorialComplete: parsed.strafeTutorialComplete === true,
	}
	if (legacyProgress) {
		writeProfileSection("narrative", normalizedProgress)
		if (typeof localStorage !== "undefined") {
			localStorage.removeItem(LEGACY_NARRATIVE_PROGRESS_KEY)
		}
	}
	return normalizedProgress
}

function saveProgress() {
	writeProfileSection("narrative", progress)
	if (typeof localStorage !== "undefined") {
		localStorage.removeItem(LEGACY_NARRATIVE_PROGRESS_KEY)
	}
}

function readLegacyProgress() {
	if (typeof localStorage === "undefined") return undefined
	const saved = localStorage.getItem(LEGACY_NARRATIVE_PROGRESS_KEY)
	if (!saved) return undefined
	try {
		return JSON.parse(saved) as Partial<NarrativeProgress> & {
			strafeTrainingOffered?: boolean
		}
	} catch {
		return undefined
	}
}
