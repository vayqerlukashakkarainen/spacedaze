export const PROFILE_SAVE_STORAGE_KEY = "spacedaze_profile_v1"

export type ProfileSectionId =
	| "player"
	| "hub"
	| "narrative"
	| "dialogue"
	| "unlocks"
	| "preferences"
	| "stats"

interface ProfileSaveDocument {
	version: 1
	updatedAt: number
	sections: Partial<Record<ProfileSectionId, unknown>>
}

const PROFILE_SAVE_VERSION = 1

export function readProfileSection<T>(section: ProfileSectionId) {
	const profile = readProfileDocument()
	return profile.sections[section] as T | undefined
}

export function writeProfileSection<T>(section: ProfileSectionId, value: T) {
	if (typeof localStorage === "undefined") return
	const profile = readProfileDocument()
	profile.sections[section] = value
	profile.updatedAt = Date.now()
	localStorage.setItem(PROFILE_SAVE_STORAGE_KEY, JSON.stringify(profile))
}

export function removeProfileSection(section: ProfileSectionId) {
	if (typeof localStorage === "undefined") return
	const profile = readProfileDocument()
	if (!(section in profile.sections)) return
	delete profile.sections[section]
	profile.updatedAt = Date.now()
	localStorage.setItem(PROFILE_SAVE_STORAGE_KEY, JSON.stringify(profile))
}

function readProfileDocument(): ProfileSaveDocument {
	if (typeof localStorage === "undefined") return createProfileDocument()
	const saved = localStorage.getItem(PROFILE_SAVE_STORAGE_KEY)
	if (!saved) return createProfileDocument()
	try {
		const parsed = JSON.parse(saved) as Partial<ProfileSaveDocument>
		if (
			parsed.version !== PROFILE_SAVE_VERSION ||
			!parsed.sections ||
			typeof parsed.sections !== "object" ||
			Array.isArray(parsed.sections)
		) return createProfileDocument()
		return {
			version: PROFILE_SAVE_VERSION,
			updatedAt: Number.isFinite(parsed.updatedAt) ? parsed.updatedAt! : 0,
			sections: { ...parsed.sections },
		}
	} catch {
		return createProfileDocument()
	}
}

function createProfileDocument(): ProfileSaveDocument {
	return {
		version: PROFILE_SAVE_VERSION,
		updatedAt: 0,
		sections: {},
	}
}
