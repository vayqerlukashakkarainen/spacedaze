import type { DialogueLine } from "./dialogService"
import { getHubLevel } from "./hubProgressService"

interface NpcDialogueTrigger {
	run: () => boolean
}

export interface NpcDialogueContext {
	hubLevel: number
}

export interface NpcDialogueVariant {
	id: string
	lines: readonly DialogueLine[]
	minHubLevel?: number
	maxHubLevel?: number
	priority?: number
	isAvailable?: (context: NpcDialogueContext) => boolean
}

const triggers = new Map<string, NpcDialogueTrigger>()
const NPC_DIALOGUE_HISTORY_KEY = "spacedaze_npc_dialogue_history_v1"
let seenDialogueKeys = loadDialogueHistory()

export function registerNpcDialogueTrigger(id: string, run: () => boolean) {
	const normalizedId = normalizeNpcDialogueId(id)
	triggers.set(normalizedId, { run })
	return () => {
		const trigger = triggers.get(normalizedId)
		if (trigger?.run === run) triggers.delete(normalizedId)
	}
}

export function startNpcDialogue(id: string) {
	const normalizedId = normalizeNpcDialogueId(id)
	const trigger = triggers.get(normalizedId)
	if (!trigger) return false
	return trigger.run()
}

export function getAvailableNpcDialogues() {
	return [...triggers.keys()].sort()
}

export function getCurrentNpcDialogue(
	variants: readonly NpcDialogueVariant[],
	context: NpcDialogueContext = { hubLevel: getHubLevel() }
) {
	let selected: NpcDialogueVariant | undefined
	let selectedIndex = -1

	for (let index = 0; index < variants.length; index++) {
		const variant = variants[index]
		if (!npcDialogueAvailable(variant, context)) continue
		if (!selected || compareNpcDialogues(variant, index, selected, selectedIndex) > 0) {
			selected = variant
			selectedIndex = index
		}
	}

	return selected
}

export function getNextNpcDialogue(
	npcId: string,
	variants: readonly NpcDialogueVariant[],
	context: NpcDialogueContext = { hubLevel: getHubLevel() }
) {
	const available = variants.filter((variant) =>
		npcDialogueAvailable(variant, context)
	)
	const unseen = available.find((variant) =>
		!hasSeenNpcDialogue(npcId, variant.id)
	)
	return unseen ?? getCurrentNpcDialogue(available, context)
}

export function hasUnseenNpcDialogue(
	npcId: string,
	variants: readonly NpcDialogueVariant[],
	context: NpcDialogueContext = { hubLevel: getHubLevel() }
) {
	return variants.some((variant) =>
		npcDialogueAvailable(variant, context) &&
		!hasSeenNpcDialogue(npcId, variant.id)
	)
}

export function hasSeenNpcDialogue(npcId: string, dialogueId: string) {
	return seenDialogueKeys.has(dialogueHistoryKey(npcId, dialogueId))
}

export function markNpcDialogueSeen(npcId: string, dialogueId: string) {
	const key = dialogueHistoryKey(npcId, dialogueId)
	if (seenDialogueKeys.has(key)) return false
	seenDialogueKeys.add(key)
	saveDialogueHistory()
	return true
}

export function resetNpcDialogueHistory() {
	seenDialogueKeys = new Set()
	if (typeof localStorage !== "undefined") {
		localStorage.removeItem(NPC_DIALOGUE_HISTORY_KEY)
	}
}

function normalizeNpcDialogueId(id: string) {
	return id.trim().toLowerCase().replaceAll("_", "-")
}

function dialogueHistoryKey(npcId: string, dialogueId: string) {
	return `${normalizeNpcDialogueId(npcId)}:${normalizeNpcDialogueId(dialogueId)}`
}

function loadDialogueHistory() {
	if (typeof localStorage === "undefined") return new Set<string>()
	const saved = localStorage.getItem(NPC_DIALOGUE_HISTORY_KEY)
	if (!saved) return new Set<string>()
	const parsed = JSON.parse(saved)
	if (!Array.isArray(parsed)) return new Set<string>()
	return new Set(parsed.filter((key): key is string => typeof key === "string"))
}

function saveDialogueHistory() {
	if (typeof localStorage === "undefined") return
	localStorage.setItem(
		NPC_DIALOGUE_HISTORY_KEY,
		JSON.stringify([...seenDialogueKeys])
	)
}

function npcDialogueAvailable(
	variant: NpcDialogueVariant,
	context: NpcDialogueContext
) {
	if (context.hubLevel < (variant.minHubLevel ?? 1)) return false
	if (
		variant.maxHubLevel !== undefined
		&& context.hubLevel > variant.maxHubLevel
	) return false
	return variant.isAvailable?.(context) ?? true
}

function compareNpcDialogues(
	a: NpcDialogueVariant,
	aIndex: number,
	b: NpcDialogueVariant,
	bIndex: number
) {
	const priorityDifference = (a.priority ?? 0) - (b.priority ?? 0)
	if (priorityDifference !== 0) return priorityDifference
	const levelDifference = (a.minHubLevel ?? 1) - (b.minHubLevel ?? 1)
	if (levelDifference !== 0) return levelDifference
	return aIndex - bIndex
}
