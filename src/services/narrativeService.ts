const NARRATIVE_PROGRESS_KEY = "spacedaze_narrative_progress_v1"

interface NarrativeProgress {
	prologueComplete: boolean
	hubIntroductionComplete: boolean
}

const defaultProgress: NarrativeProgress = {
	prologueComplete: false,
	hubIntroductionComplete: false,
}

let progress = loadProgress()
let prologueActive = false

export function shouldStartPrologue() {
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

export function skipNarrativeIntroduction() {
	prologueActive = false
	progress.prologueComplete = true
	progress.hubIntroductionComplete = true
	saveProgress()
}

export function resetNarrativeProgress() {
	progress = { ...defaultProgress }
	prologueActive = false
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
	}
}

function saveProgress() {
	if (typeof localStorage === "undefined") return
	localStorage.setItem(NARRATIVE_PROGRESS_KEY, JSON.stringify(progress))
}
