export type SalvagePickupValue = 1 | 3 | 5 | 10

export const SALVAGE_PICKUP_DENOMINATIONS: readonly SalvagePickupValue[] = [
	10,
	5,
	3,
	1,
]

export function splitSalvageValue(amount: number): SalvagePickupValue[] {
	let remaining = Math.max(0, Math.round(amount))
	const values: SalvagePickupValue[] = []

	while (remaining > 0) {
		const selected = SALVAGE_PICKUP_DENOMINATIONS.find(
			(value) => value <= remaining
		) ?? 1
		values.push(selected)
		remaining -= selected
	}

	return values
}
