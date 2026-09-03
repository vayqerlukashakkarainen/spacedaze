import assert from "node:assert/strict"
import {
	formatConsoleMarkdown,
	formatConsoleMarkdownWithSprites,
} from "./consoleMarkdown"

const markdown = [
	"| Icon | Reward |",
	"| --- | --- |",
	"| :sprite(fragmentation_core_upg1): | Fragmentation |",
	"| :sprite(void_lance_upg1): | Void lance |",
].join("\n")

const output = formatConsoleMarkdownWithSprites(markdown, 80)
assert.equal(output.sprites.length, 2)
assert.deepEqual(
	output.sprites.map((sprite) => sprite.sprite),
	["fragmentation_core_upg1", "void_lance_upg1"]
)
assert.ok(output.sprites.every((sprite) => sprite.column === 0))
assert.ok(!output.text.includes(":sprite"))
assert.ok(!formatConsoleMarkdown(markdown, 80).includes(":sprite"))

console.log("Console sprite markdown tests passed")
