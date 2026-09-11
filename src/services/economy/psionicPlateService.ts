export type PsionicPlateMiniBossId =
	| "impact-ace"
	| "wake-boiler-hulk"
	| "wake-magnet-maw"
	| "wake-railbreaker-rig"

export interface PsionicPlateProgress {
	plates: number
	firstClearMiniBossIds: PsionicPlateMiniBossId[]
}

export interface PsionicPlateDrop {
	drops: boolean
	guaranteed: boolean
}

export const PSIONIC_PLATE_REPEAT_DROP_CHANCE = 0.2

const MINI_BOSS_IDS: readonly PsionicPlateMiniBossId[] = [
	"impact-ace",
	"wake-boiler-hulk",
	"wake-magnet-maw",
	"wake-railbreaker-rig",
]

let plates = 0
let firstClearMiniBossIds = new Set<PsionicPlateMiniBossId>()

export function getPsionicPlates() {
	return plates
}

export function getPsionicPlateProgress(): PsionicPlateProgress {
	return {
		plates,
		firstClearMiniBossIds: [...firstClearMiniBossIds],
	}
}

export function hasClaimedMiniBossPlate(id: PsionicPlateMiniBossId) {
	return firstClearMiniBossIds.has(id)
}

export function rollPsionicPlateDrop(
	id: PsionicPlateMiniBossId,
	roll: number = Math.random()
): PsionicPlateDrop {
	if (!firstClearMiniBossIds.has(id)) {
		return { drops: true, guaranteed: true }
	}
	return {
		drops: Number.isFinite(roll) && roll < PSIONIC_PLATE_REPEAT_DROP_CHANCE,
		guaranteed: false,
	}
}

export function collectPsionicPlate(id: PsionicPlateMiniBossId) {
	const firstClear = !firstClearMiniBossIds.has(id)
	firstClearMiniBossIds.add(id)
	plates++
	return { firstClear, plates }
}

export function spendPsionicPlates(amount: number) {
	const spent = normalizeAmount(amount)
	if (spent !== amount || plates < spent) return false
	plates -= spent
	return true
}

export function addPsionicPlates(amount: number) {
	const added = normalizeAmount(amount)
	plates += added
	return added
}

export function loadPsionicPlateProgress(
	amount: number,
	claimedMiniBossIds: readonly string[] = []
) {
	plates = normalizeAmount(amount)
	firstClearMiniBossIds = new Set(
		claimedMiniBossIds.filter(isPsionicPlateMiniBossId)
	)
}

export function resetPsionicPlateProgress() {
	plates = 0
	firstClearMiniBossIds.clear()
}

function isPsionicPlateMiniBossId(id: string): id is PsionicPlateMiniBossId {
	return MINI_BOSS_IDS.includes(id as PsionicPlateMiniBossId)
}

function normalizeAmount(amount: number) {
	if (!Number.isFinite(amount) || amount <= 0) return 0
	return Math.floor(amount)
}
