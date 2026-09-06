import {
	discoverBlueprint,
	isBlueprintDiscovered,
} from "../services/hubProgressService"
import {
	isAsteroidRunnerEncounterComplete,
	isBirthdayEncounterComplete,
} from "../services/narrativeService"
import type { NpcArchiveStatus, NpcDefinition, NpcId } from "./npcTypes"

export type DroidId = NpcId
export type DroidDefinition = NpcDefinition

const DROID_DISCOVERY_PREFIX = "droid:"

export const DROID_REGISTRY: readonly DroidDefinition[] = [
	{
		id: "ring-runner",
		kind: "droid",
		name: "RING RUNNER",
		model: "IMPROVISED RAMMER",
		role: "INDEPENDENT EXPLORER",
		sprite: "enemy_rammer",
		summary: "A reckless droid obsessed with crossing the ancient asteroid rings.",
		archiveNotes: [
			"Claimed the rings had existed longer than the station itself.",
			"Attempted the first recorded direct passage through the field.",
		],
	},
	{
		id: "ring-watcher",
		kind: "droid",
		name: "RANGE KEEPER",
		model: "SURVEY SENTINEL",
		role: "TRAINING RANGE CUSTODIAN",
		sprite: "enemy_sniper",
		summary: "A stubborn range custodian determined to destroy the station's training asteroid.",
		archiveNotes: [
			"Claims the training asteroid is indestructible only because its aim was inadequate.",
			"Frequently fires harmless calibration rounds during maintenance shifts.",
		],
	},
	{
		id: "lamp-keeper",
		kind: "droid",
		name: "LAMP KEEPER",
		model: "RESTORATION TENDER",
		role: "PHASE LAMP CUSTODIAN",
		sprite: "drone_salvager",
		summary: "A patient maintenance droid tending the hub's restoration lamps.",
		archiveNotes: [
			"Tracks the hub's recovery through the eight lamps surrounding its restoration ring.",
			"Believes a completed ring will let the phase crown guide lost ships home again.",
		],
	},
	{
		id: "gloom",
		kind: "droid",
		name: "GLOOM",
		model: "LOGISTICS UNIT",
		role: "INVENTORY AUDITOR",
		sprite: "drone_medic",
		summary: "A private droid with a profound dislike of birthday celebrations.",
		archiveNotes: [
			"Refuses to acknowledge its activation anniversary.",
			"Responds poorly to unsolicited festive music.",
		],
	},
	{
		id: "jubilee",
		kind: "droid",
		name: "JUBILEE",
		model: "MORALE UNIT",
		role: "VOLUNTARY CELEBRATION OFFICER",
		sprite: "drone_combat",
		summary: "An enthusiastic droid convinced every birthday deserves music.",
		archiveNotes: [
			"Discovered Gloom's activation anniversary during a casual conversation.",
			"Played six seconds of celebratory music before being destroyed.",
		],
	},
]

export function getDroidDiscoveryKey(id: DroidId) {
	return `${DROID_DISCOVERY_PREFIX}${id}`
}

export function getDroidDefinitions() {
	return DROID_REGISTRY
}

export function getDroidDefinition(id: DroidId) {
	return DROID_REGISTRY.find((definition) => definition.id === id)
}

export function discoverDroid(id: DroidId) {
	return discoverBlueprint(getDroidDiscoveryKey(id))
}

export function isDroidDiscovered(id: DroidId) {
	return isBlueprintDiscovered(getDroidDiscoveryKey(id))
}

export function getDroidArchiveStatus(id: DroidId): NpcArchiveStatus {
	if (id === "ring-runner") {
		return isAsteroidRunnerEncounterComplete() ? "DESTROYED" : "ACTIVE"
	}
	if (id === "jubilee") {
		return isBirthdayEncounterComplete() ? "DESTROYED" : "ACTIVE"
	}
	return "ACTIVE"
}
