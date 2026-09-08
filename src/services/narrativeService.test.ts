import assert from "node:assert/strict"
import { PROFILE_SAVE_STORAGE_KEY } from "./profileSaveService"

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
narrative.completeStrafeTrainingOffer()
assert.equal(narrative.shouldOfferStrafeTraining(), false)
assert.equal(narrative.shouldSpawnStrafeTrainingModule(), true)

const profile = JSON.parse(localStorage.getItem(PROFILE_SAVE_STORAGE_KEY) ?? "{}")
assert.equal(profile.sections.narrative.burtHubLocation, "center")
assert.equal(profile.sections.narrative.strafeTrainingOfferComplete, true)
assert.equal(localStorage.getItem("spacedaze_narrative_progress_v1"), null)

console.log("Narrative progression tests passed")
