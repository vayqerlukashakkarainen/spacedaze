export type QuestStatus = "active" | "completed" | "failed"

export interface QuestDefinition {
	id: string
	title: string
	objective: string
}

export interface QuestState extends QuestDefinition {
	status: QuestStatus
}

type QuestListener = (quest: QuestState | undefined) => void

let activeQuest: QuestState | undefined
const listeners = new Set<QuestListener>()

export function startQuest(definition: QuestDefinition) {
	activeQuest = {
		...definition,
		status: "active",
	}
	notifyListeners()
	return activeQuest
}

export function updateQuestObjective(questId: string, objective: string) {
	if (!activeQuest || activeQuest.id !== questId) return false
	if (activeQuest.status !== "active") return false
	activeQuest = { ...activeQuest, objective }
	notifyListeners()
	return true
}

export function completeQuest(questId: string) {
	return setQuestStatus(questId, "completed")
}

export function failQuest(questId: string) {
	return setQuestStatus(questId, "failed")
}

export function clearQuest(questId?: string) {
	if (questId && activeQuest?.id !== questId) return false
	if (!activeQuest) return false
	activeQuest = undefined
	notifyListeners()
	return true
}

export function getActiveQuest() {
	return activeQuest ? { ...activeQuest } : undefined
}

export function subscribeToQuest(listener: QuestListener) {
	listeners.add(listener)
	listener(getActiveQuest())
	return () => listeners.delete(listener)
}

function setQuestStatus(questId: string, status: QuestStatus) {
	if (!activeQuest || activeQuest.id !== questId) return false
	activeQuest = { ...activeQuest, status }
	notifyListeners()
	return true
}

function notifyListeners() {
	const snapshot = getActiveQuest()
	for (const listener of listeners) listener(snapshot)
}
