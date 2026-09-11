import { strict as assert } from "node:assert"
import { tags } from "../../tags"
import {
	calculatePhysicsImpact,
	resolvePhysicsImpactDamage,
} from "./physicsImpactService"

assert.equal(calculatePhysicsImpact(89, 1, 1).damage, 0)

const barrelImpact = calculatePhysicsImpact(300, 1.1, 1.2)
assert.equal(barrelImpact.damage, 9)

const rockImpact = calculatePhysicsImpact(360, 1.8, 1.2)
assert.equal(rockImpact.damage, 13)

const wallImpact = calculatePhysicsImpact(300, 1.1)
assert.equal(wallImpact.damage, 17)

const sameSpeedHeavierImpact = calculatePhysicsImpact(300, 3, 3)
assert(sameSpeedHeavierImpact.damage > barrelImpact.damage)

assert.equal(resolvePhysicsImpactDamage({ tags: [], hp: 9, maxHP: 9 }, 2), 2)
assert.equal(resolvePhysicsImpactDamage({
	tags: [tags.roomVolatile],
	hp: 4,
	maxHP: 9,
}, 2), 9)
assert.equal(resolvePhysicsImpactDamage({
	tags: [tags.roomVolatile],
	hp: 4,
}, 2), 4)

console.log("Physics impact calculations validated")
