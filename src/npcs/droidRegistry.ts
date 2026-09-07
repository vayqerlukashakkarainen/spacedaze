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
		model: "EXPLORER SHIP",
		role: "INDEPENDENT EXPLORER",
		sprite: "hub_ship_ring_runner",
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
		model: "PATROL SHIP",
		role: "TRAINING RANGE CUSTODIAN",
		sprite: "hub_ship_range_keeper",
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
		sprite: "hub_droid_lamp_keeper",
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
		model: "CARGO SHIP",
		role: "INVENTORY AUDITOR",
		sprite: "hub_ship_gloom",
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
		model: "COURIER SHIP",
		role: "VOLUNTARY CELEBRATION OFFICER",
		sprite: "hub_ship_jubilee",
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
