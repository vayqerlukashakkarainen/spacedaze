import assert from "node:assert/strict"
import {
	getCurrentNpcDialogue,
	getNextNpcDialogue,
	hasSeenNpcDialogue,
	hasUnseenNpcDialogue,
	markNpcDialogueSeen,
	resetNpcDialogueHistory,
	type NpcDialogueVariant,
} from "./npcDialogueService"

const dialogues: readonly NpcDialogueVariant[] = [
	{ id: "base", minHubLevel: 1, lines: [] },
	{ id: "level-three", minHubLevel: 3, lines: [] },
	{ id: "level-five", minHubLevel: 5, lines: [] },
]

assert.equal(getCurrentNpcDialogue(dialogues, { hubLevel: 1 })?.id, "base")
assert.equal(getCurrentNpcDialogue(dialogues, { hubLevel: 4 })?.id, "level-three")
assert.equal(getCurrentNpcDialogue(dialogues, { hubLevel: 8 })?.id, "level-five")

const conditionalDialogues: readonly NpcDialogueVariant[] = [
	{ id: "fallback", lines: [] },
	{
		id: "locked",
		priority: 10,
		lines: [],
		isAvailable: () => false,
	},
	{
		id: "event",
		priority: 5,
		lines: [],
		isAvailable: ({ hubLevel }) => hubLevel >= 2,
	},
]

assert.equal(
	getCurrentNpcDialogue(conditionalDialogues, { hubLevel: 2 })?.id,
	"event"
)

const boundedDialogues: readonly NpcDialogueVariant[] = [
	{ id: "fallback", lines: [] },
	{ id: "temporary", minHubLevel: 2, maxHubLevel: 3, lines: [] },
]

assert.equal(getCurrentNpcDialogue(boundedDialogues, { hubLevel: 3 })?.id, "temporary")
assert.equal(getCurrentNpcDialogue(boundedDialogues, { hubLevel: 4 })?.id, "fallback")
assert.equal(getCurrentNpcDialogue([], { hubLevel: 1 }), undefined)

resetNpcDialogueHistory()
assert.equal(hasUnseenNpcDialogue("keeper", dialogues, { hubLevel: 4 }), true)
assert.equal(hasSeenNpcDialogue("keeper", "level-three"), false)
assert.equal(markNpcDialogueSeen("keeper", "level-three"), true)
assert.equal(markNpcDialogueSeen("keeper", "level-three"), false)
assert.equal(hasSeenNpcDialogue("keeper", "level-three"), true)
assert.equal(hasUnseenNpcDialogue("keeper", dialogues, { hubLevel: 4 }), true)
assert.equal(
	getNextNpcDialogue("keeper", dialogues, { hubLevel: 4 })?.id,
	"base"
)
markNpcDialogueSeen("keeper", "base")
assert.equal(hasUnseenNpcDialogue("keeper", dialogues, { hubLevel: 4 }), false)
assert.equal(hasUnseenNpcDialogue("keeper", dialogues, { hubLevel: 8 }), true)
assert.equal(getCurrentNpcDialogue(dialogues, { hubLevel: 8 })?.id, "level-five")
assert.equal(
	getNextNpcDialogue("keeper", dialogues, { hubLevel: 8 })?.id,
	"level-five"
)
resetNpcDialogueHistory()

console.log("npcDialogueService tests passed")
