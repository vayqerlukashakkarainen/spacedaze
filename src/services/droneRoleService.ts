export type DroneType =
	| "combat"
	| "missile"
	| "interceptor"
	| "gunship"
	| "medic"
	| "salvager"

export interface DroneSpecializationSlots {
	missile: number
	interceptor: number
	gunship: number
	medic: number
	salvager: number
}

const specializationOrder: readonly (keyof DroneSpecializationSlots)[] = [
	"missile",
	"interceptor",
	"gunship",
	"medic",
	"salvager",
]

export function assignDroneTypes(
	followerCount: number,
	slots: DroneSpecializationSlots
): DroneType[] {
	const assignments: DroneType[] = []
	for (const specialization of specializationOrder) {
		const count = Math.max(0, Math.floor(slots[specialization] ?? 0))
		for (let index = 0; index < count; index++) {
			if (assignments.length >= followerCount) return assignments
			assignments.push(specialization)
		}
	}
	while (assignments.length < followerCount) assignments.push("combat")
	return assignments
}
