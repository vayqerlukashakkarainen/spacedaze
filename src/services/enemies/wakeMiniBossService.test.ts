import assert from "node:assert/strict"
import {
	getWakeMiniBossForDepth,
	getWakeMiniBossRoster,
} from "./wakeMiniBossService"
import { resolveMiniBossWallRecoilDirection } from "./miniBossRamPhysics"

assert.deepEqual(getWakeMiniBossRoster(), [
	"wake-boiler-hulk",
	"wake-magnet-maw",
	"wake-railbreaker-rig",
])
assert.equal(getWakeMiniBossForDepth(1), "wake-boiler-hulk")
assert.equal(getWakeMiniBossForDepth(2), "wake-magnet-maw")
assert.equal(getWakeMiniBossForDepth(3), "wake-railbreaker-rig")

assert.deepEqual(
	resolveMiniBossWallRecoilDirection(
		{ x: -2, y: 0 },
		{ x: 1, y: 0 }
	),
	{ x: -1, y: 0 }
)
assert.deepEqual(
	resolveMiniBossWallRecoilDirection(
		{ x: 1, y: 0 },
		{ x: 1, y: 0 }
	),
	{ x: -1, y: 0 }
)
assert.deepEqual(
	resolveMiniBossWallRecoilDirection(undefined, { x: 0, y: -1 }),
	{ x: 0, y: 1 }
)
