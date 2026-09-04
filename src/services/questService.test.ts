import assert from "node:assert/strict"
import {
	clearQuest,
	completeQuest,
	failQuest,
	getActiveQuest,
	startQuest,
	subscribeToQuest,
	updateQuestObjective,
} from "./questService"

const snapshots: Array<ReturnType<typeof getActiveQuest>> = []
const unsubscribe = subscribeToQuest((quest) => snapshots.push(quest))

startQuest({
	id: "test-quest",
	title: "TEST QUEST",
	objective: "BEGIN",
})
assert.equal(getActiveQuest()?.status, "active")
assert.equal(updateQuestObjective("other-quest", "NO"), false)
assert.equal(updateQuestObjective("test-quest", "CONTINUE"), true)
assert.equal(getActiveQuest()?.objective, "CONTINUE")
assert.equal(completeQuest("test-quest"), true)
assert.equal(getActiveQuest()?.status, "completed")
assert.equal(updateQuestObjective("test-quest", "TOO LATE"), false)
assert.equal(clearQuest("test-quest"), true)
assert.equal(getActiveQuest(), undefined)

startQuest({
	id: "failed-quest",
	title: "FAILED QUEST",
	objective: "SURVIVE",
})
assert.equal(failQuest("failed-quest"), true)
assert.equal(getActiveQuest()?.status, "failed")
assert.equal(clearQuest(), true)
assert(snapshots.length >= 7)

unsubscribe()
console.log("Quest service tests passed")
