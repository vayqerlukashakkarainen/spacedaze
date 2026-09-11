import assert from "node:assert/strict"
import { PROFILE_SAVE_STORAGE_KEY } from "../progression/profileSaveService"

class MemoryStorage {
	private values = new Map<string, string>()

	getItem(key: string) {
		return this.values.get(key) ?? null
	}

	setItem(key: string, value: string) {
		this.values.set(key, value)
	}

	removeItem(key: string) {
		this.values.delete(key)
	}
}

Object.defineProperty(globalThis, "localStorage", {
	value: new MemoryStorage(),
	configurable: true,
})

localStorage.setItem("spacedaze_narrative_progress_v1", JSON.stringify({
	prologueComplete: true,
	hubIntroductionComplete: true,
	strafeTrainingAvailable: false,
	strafeTrainingOffered: true,
	strafeTrainingUnlocked: false,
}))

const narrative = await import("./narrativeService")

assert.equal(narrative.getHubBurtLocation(), "center")
assert.equal(narrative.shouldOfferStrafeTraining(), true)
assert.equal(narrative.hasPendingHubProgression(), true)
narrative.completeStrafeTrainingOffer()
assert.equal(narrative.shouldOfferStrafeTraining(), false)
assert.equal(narrative.shouldSpawnStrafeTrainingModule(), true)
assert.equal(narrative.hasPendingHubProgression(), true)
narrative.unlockStrafeTraining()
assert.equal(narrative.hasPendingHubProgression(), false)

const profile = JSON.parse(localStorage.getItem(PROFILE_SAVE_STORAGE_KEY) ?? "{}")
assert.equal(profile.sections.narrative.burtHubLocation, "center")
assert.equal(profile.sections.narrative.strafeTrainingOfferComplete, true)
assert.equal(localStorage.getItem("spacedaze_narrative_progress_v1"), null)

assert.equal(narrative.canDiscoverLassoComponent(), true)
assert.equal(narrative.collectLassoComponent(), true)
assert.equal(narrative.canDiscoverLassoComponent(), false)
assert.equal(narrative.shouldOfferLassoConstruction(), true)
assert.equal(narrative.hasPendingHubProgression(), true)
assert.equal(narrative.completeLassoConstruction(), true)
assert.equal(narrative.shouldOfferLassoConstruction(), false)
assert.equal(narrative.shouldSpawnBuiltLasso(), true)
assert.equal(narrative.unlockBuiltLasso(), true)
assert.equal(narrative.shouldSpawnBuiltLasso(), false)
assert.equal(narrative.hasPendingHubProgression(), false)
assert.equal(narrative.shouldShowLassoTutorial(), true)
assert.equal(narrative.completeLassoTutorial(), true)
assert.equal(narrative.shouldShowLassoTutorial(), false)

console.log("Narrative progression tests passed")
