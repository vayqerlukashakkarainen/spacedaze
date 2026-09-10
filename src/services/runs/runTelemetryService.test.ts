import assert from "node:assert/strict"
import {
	clearRunTelemetry,
	finishRunTelemetry,
	formatRewardTelemetrySummary,
	getRunTelemetryRecords,
	recordTelemetryAbilityFailure,
	recordTelemetryAbilityUse,
	recordTelemetryChestReroll,
	recordTelemetryChestResult,
	recordTelemetryEnemyKill,
	recordTelemetryEnemyDamage,
	recordTelemetryEnemySpawn,
	recordTelemetryFloor,
	recordTelemetryPlayerDamage,
	recordTelemetryRewardOffered,
	recordTelemetryRewardSelected,
	recordTelemetrySalvageEarned,
	recordTelemetrySalvageSpent,
	sampleRunTelemetry,
	startRunTelemetry,
} from "./runTelemetryService"

const values = new Map<string, string>()
Object.defineProperty(globalThis, "localStorage", {
	value: {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => values.set(key, value),
		removeItem: (key: string) => values.delete(key),
	},
	configurable: true,
})

clearRunTelemetry()
startRunTelemetry({
	zoneId: "zone1",
	poolId: "default",
	baseSeed: 42,
	levelKey: "level1",
	mapSeed: 84,
	contractName: "TEST CONTRACT",
	hubLevel: 3,
	loadout: { primary: "standardBlaster", mobility: "phaseJump" },
	upgrades: { maxHealth: 2 },
})
recordTelemetryFloor(1, "level1", 84)
recordTelemetryEnemySpawn("rammer", true)
recordTelemetryEnemyKill("rammer", true)
recordTelemetryEnemyDamage("rammer", 7)
recordTelemetryPlayerDamage(2.5, "RAMMER")
recordTelemetryAbilityUse("mobility", "phaseJump")
recordTelemetryAbilityFailure("ultimate")
recordTelemetrySalvageEarned(12)
recordTelemetrySalvageSpent(4)
recordTelemetryRewardOffered("upgrade:ricochetRounds:1", {
	source: "level-up",
	category: "upgrade",
	runLevel: 2,
	candidatePoolSize: 3,
})
recordTelemetryRewardSelected("upgrade:ricochetRounds:1", "RARE", false, {
	source: "level-up",
	category: "upgrade",
	runLevel: 2,
})
recordTelemetryChestResult("bezier", 0, true)
recordTelemetryChestReroll()
sampleRunTelemetry(0.016, { tier: 3 } as never)
sampleRunTelemetry(0.06, { tier: 4 } as never)
finishRunTelemetry("EXTRACTED", { deposited: 8, lost: 0 })

const records = getRunTelemetryRecords()
assert.equal(records.length, 1)
const record = records[0]
assert.equal(record.outcome, "EXTRACTED")
assert.equal(record.highestThreatTier, 4)
assert.deepEqual(record.enemies.rammer, {
	spawned: 1,
	killed: 1,
	eliteSpawned: 1,
	eliteKilled: 1,
	damageTaken: 7,
	totalLifetimeSeconds: 0,
})
assert.equal(record.damageTaken.bySource.rammer, 2.5)
assert.equal(record.abilities["mobility:phasejump"].uses, 1)
assert.equal(record.abilities["ultimate:empty"].failedUses, 1)
assert.equal(record.economy.salvageEarned, 12)
assert.equal(record.economy.salvageSpent, 4)
assert.equal(record.economy.salvageDeposited, 8)
assert.equal(record.rewards.offered["upgrade:ricochetRounds:1"], 1)
assert.equal(record.rewards.selected["upgrade:ricochetRounds:1"], 1)
assert.equal(record.rewards.events?.[0].familyId, "upgrade:ricochetRounds")
assert.match(formatRewardTelemetrySummary(), /upgrade:ricochetRounds x1/)
assert.equal(record.chests.perfect, 1)
assert.equal(record.chests.rerolls, 1)
assert.equal(record.performance.stutterCount, 1)

console.log("run telemetry service tests passed")
