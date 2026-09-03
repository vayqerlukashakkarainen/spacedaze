export interface RunContract {
	id: string
	name: string
	description: string
	seed: number
	salvageMultiplier: number
	rewardDropMultiplier: number
}

let selectedContract: RunContract | undefined

export function getContractOffers(): RunContract[] {
	return [
		{
			id: "patrol",
			name: "STANDARD PATROL",
			description: "A balanced expedition with standard rewards",
			seed: randomSeed(),
			salvageMultiplier: 1,
			rewardDropMultiplier: 1,
		},
		{
			id: "salvage",
			name: "SALVAGE STORM",
			description: "Debris is worth 50% more salvage",
			seed: randomSeed(),
			salvageMultiplier: 1.5,
			rewardDropMultiplier: 1,
		},
		{
			id: "signal",
			name: "SIGNAL HUNT",
			description: "Reward drops are 75% more likely",
			seed: randomSeed(),
			salvageMultiplier: 1,
			rewardDropMultiplier: 1.75,
		},
	]
}

export function selectContract(contract: RunContract) {
	selectedContract = contract
}

export function getSelectedContract() {
	return selectedContract
}

export function clearSelectedContract() {
	selectedContract = undefined
}

function randomSeed() {
	return Math.floor(Math.random() * 999999) + 1
}
