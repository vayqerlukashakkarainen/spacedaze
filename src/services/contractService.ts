export type ContractChallenge =
	| "fragileDelivery"
	| "overchargedShrines"
	| "convoySiege"

export interface RunContract {
	id: string
	name: string
	description: string
	seed: number
	challenge: ContractChallenge
	rewardCount: number
}

let selectedContract: RunContract | undefined

export function getContractOffers(): RunContract[] {
	return [
		{
			id: "delivery",
			name: "FRAGILE DELIVERY",
			description: "Deliver the package without taking hull damage. Awards 2 rewards",
			seed: randomSeed(),
			challenge: "fragileDelivery",
			rewardCount: 2,
		},
		{
			id: "shrines",
			name: "SHRINE OVERLOAD",
			description: "Shrines deploy twice as many hostiles. Awards 2 rewards",
			seed: randomSeed(),
			challenge: "overchargedShrines",
			rewardCount: 2,
		},
		{
			id: "convoy",
			name: "CONVOY SIEGE",
			description: "Lost convoys draw twice as many attackers. Awards 2 rewards",
			seed: randomSeed(),
			challenge: "convoySiege",
			rewardCount: 2,
		},
	]
}

export function selectContract(contract: RunContract) {
	selectedContract = contract
}

export function getSelectedContract() {
	return selectedContract
}

export function contractChallengeActive(challenge: ContractChallenge) {
	return selectedContract?.challenge === challenge
}

export function getContractChallengeMultiplier(challenge: ContractChallenge) {
	return selectedContract?.challenge === challenge ? 2 : 1
}

export function getContractChallengeRewardCount(challenge: ContractChallenge) {
	return selectedContract?.challenge === challenge
		? selectedContract.rewardCount
		: 1
}

export function clearSelectedContract() {
	selectedContract = undefined
}

function randomSeed() {
	return Math.floor(Math.random() * 999999) + 1
}
