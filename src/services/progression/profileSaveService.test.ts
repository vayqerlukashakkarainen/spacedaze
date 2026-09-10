import assert from "node:assert/strict"
import {
	PROFILE_SAVE_STORAGE_KEY,
	readProfileSection,
	removeProfileSection,
	writeProfileSection,
} from "./profileSaveService"

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

writeProfileSection("narrative", { prologueComplete: true })
writeProfileSection("hub", { level: 3 })
assert.deepEqual(readProfileSection("narrative"), { prologueComplete: true })
assert.deepEqual(readProfileSection("hub"), { level: 3 })

removeProfileSection("narrative")
assert.equal(readProfileSection("narrative"), undefined)
assert.deepEqual(readProfileSection("hub"), { level: 3 })

localStorage.setItem(PROFILE_SAVE_STORAGE_KEY, "corrupt")
assert.equal(readProfileSection("hub"), undefined)

console.log("Profile save service tests passed")
