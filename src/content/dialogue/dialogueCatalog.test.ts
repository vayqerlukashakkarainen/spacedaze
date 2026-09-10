import assert from "node:assert/strict"
import { dialogue, validateDialogueCatalog } from "./dialogueCatalog"

assert.deepEqual(validateDialogueCatalog(), [])
assert.ok(dialogue.prologue.spacejumpFailure.length > 0)
assert.ok(dialogue.rangeKeeper.variants.length > 0)
assert.ok(dialogue.strafeTraining.tutorial("SPACE").explanation.length > 0)
assert.deepEqual(
	validateDialogueCatalog(dialogue.strafeTraining.tutorial("SPACE")),
	[]
)
assert.deepEqual(validateDialogueCatalog(dialogue.lampKeeper(3, 8)), [])
assert.ok(validateDialogueCatalog([
	{ id: "duplicate", lines: [{ speaker: "A", text: "First" }] },
	{ id: "duplicate", lines: [{ speaker: "B", text: "Second" }] },
]).some((error) => error.includes("duplicate id")))
