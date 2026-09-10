import assert from "node:assert/strict"
import test from "node:test"
import { findSegmentCircleIntersection } from "./projectileCollisionService"

test("detects a hit when both frame positions are outside the hitbox", () => {
	const hit = findSegmentCircleIntersection(
		{ x: -100, y: 0 },
		{ x: 100, y: 0 },
		{ x: 0, y: 0 },
		10
	)

	assert.ok(hit)
	assert.equal(hit.progress, 0.45)
	assert.deepEqual(hit.point, { x: -10, y: 0 })
})

test("rejects a high-speed near miss", () => {
	const hit = findSegmentCircleIntersection(
		{ x: -100, y: 11 },
		{ x: 100, y: 11 },
		{ x: 0, y: 0 },
		10
	)

	assert.equal(hit, undefined)
})

test("reports an immediate hit when the projectile starts inside", () => {
	const hit = findSegmentCircleIntersection(
		{ x: 2, y: 3 },
		{ x: 100, y: 3 },
		{ x: 0, y: 0 },
		10
	)

	assert.deepEqual(hit, {
		point: { x: 2, y: 3 },
		progress: 0,
	})
})

test("handles stationary projectiles", () => {
	assert.deepEqual(
		findSegmentCircleIntersection(
			{ x: 1, y: 1 },
			{ x: 1, y: 1 },
			{ x: 0, y: 0 },
			2
		),
		{
			point: { x: 1, y: 1 },
			progress: 0,
		}
	)
	assert.equal(
		findSegmentCircleIntersection(
			{ x: 3, y: 3 },
			{ x: 3, y: 3 },
			{ x: 0, y: 0 },
			2
		),
		undefined
	)
})
