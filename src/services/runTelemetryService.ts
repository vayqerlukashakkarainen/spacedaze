import type { AbilityLoadout } from "./abilityLoadoutService"
import type { DebreeRunOutcome } from "./debreeEconomyService"
import type { ThreatSnapshot } from "./threatService"

const TELEMETRY_STORAGE_KEY = "spacedaze_run_telemetry_v1"
const TELEMETRY_SCHEMA_VERSION = 2
const MAX_STORED_RUNS = 100
const MAX_FRAME_SAMPLES = 900
const MAX_REWARD_EVENTS = 500

export type RewardTelemetrySource =
	| "level-up"
	| "chest"
	| "enemy-drop"
	| "boss-drop"
	| "world-pickup"
	| "secret"
	| "challenge"
	| "unknown"

export interface RewardTelemetryDetails {
	source?: RewardTelemetrySource
	category?: string
	familyId?: string
	rarity?: string
	runLevel?: number
	candidatePoolSize?: number
}

export interface RewardTelemetryEvent extends RewardTelemetryDetails {
	type: "OFFERED" | "SELECTED"
	rewardId: string
	familyId: string
	elapsedSeconds: number
}

export interface RunTelemetryContext {
	zoneId: string
	poolId: string
	baseSeed: number
	levelKey: string
	mapSeed: number
	contractId?: string
	contractName: string
	contractChallenge?: string
	hubLevel: number
	loadout: AbilityLoadout
	upgrades: Record<string, number | undefined>
	synthetic?: {
		profile: string
		seed: number
		index: number
		modelVersion?: number
		targetDepth?: number
		requestedHubLevel?: number
	}
}

export interface EnemyTelemetry {
	spawned: number
	killed: number
	eliteSpawned: number
	eliteKilled: number
	damageTaken: number
	totalLifetimeSeconds: number
}

export interface AbilityTelemetry {
	uses: number
	failedUses: number
}

export interface RunTelemetryRecord {
	schemaVersion: number
	runId: string
	startedAt: string
	completedAt: string
	outcome: "EXTRACTED" | "DESTROYED" | "ABANDONED"
	durationSeconds: number
	context: RunTelemetryContext
	floors: Array<{
		depth: number
		levelKey: string
		mapSeed: number
		startedAtSeconds: number
		threatTierAtEntry: number
	}>
	highestThreatTier: number
	enemies: Record<string, EnemyTelemetry>
	damageTaken: {
		total: number
		bySource: Record<string, number>
	}
	healingReceived: number
	abilities: Record<string, AbilityTelemetry>
	economy: {
		salvageEarned: number
		salvageSpent: number
		salvageDeposited: number
		salvageLost: number
	}
	rewards: {
		offered: Record<string, number>
		selected: Record<string, number>
		discovered: Record<string, number>
		selectedRarities: Record<string, number>
		events?: RewardTelemetryEvent[]
	}
	chests: {
		opened: number
		perfect: number
		failedAttempts: number
		rerolls: number
		retries: number
		byChallenge: Record<string, number>
	}
	performance: {
		averageFrameMs: number
		p95FrameMs: number
		maxFrameMs: number
		lowFpsSeconds: number
		stutterCount: number
	}
}

interface ActiveRunTelemetry extends Omit<
	RunTelemetryRecord,
	"completedAt" | "outcome" | "durationSeconds" | "performance"
> {
	startedAtMs: number
	frameSamples: number[]
	frameSampleCursor: number
	frameTotalMs: number
	frameCount: number
	maxFrameMs: number
	lowFpsSeconds: number
	stutterCount: number
}

let activeRun: ActiveRunTelemetry | undefined

export function startRunTelemetry(context: RunTelemetryContext) {
	activeRun = {
		schemaVersion: TELEMETRY_SCHEMA_VERSION,
		runId: createRunId(),
		startedAt: new Date().toISOString(),
		startedAtMs: nowMilliseconds(),
		context: {
			...context,
			loadout: { ...context.loadout },
			upgrades: { ...context.upgrades },
		},
		floors: [],
		highestThreatTier: 1,
		enemies: {},
		damageTaken: { total: 0, bySource: {} },
		healingReceived: 0,
		abilities: {},
		economy: {
			salvageEarned: 0,
			salvageSpent: 0,
			salvageDeposited: 0,
			salvageLost: 0,
		},
		rewards: {
			offered: {},
			selected: {},
			discovered: {},
			selectedRarities: {},
			events: [],
		},
		chests: {
			opened: 0,
			perfect: 0,
			failedAttempts: 0,
			rerolls: 0,
			retries: 0,
			byChallenge: {},
		},
		frameSamples: [],
		frameSampleCursor: 0,
		frameTotalMs: 0,
		frameCount: 0,
		maxFrameMs: 0,
		lowFpsSeconds: 0,
		stutterCount: 0,
	}
	return activeRun.runId
}

export function recordTelemetryFloor(
	depth: number,
	levelKey: string,
	mapSeed: number,
	threatTierAtEntry = 1
) {
	if (!activeRun) return
	activeRun.floors.push({
		depth,
		levelKey,
		mapSeed,
		startedAtSeconds: elapsedSeconds(),
		threatTierAtEntry,
	})
}

export function sampleRunTelemetry(
	deltaSeconds: number,
	threat?: ThreatSnapshot
) {
	if (!activeRun || !Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return
	const frameMs = deltaSeconds * 1000
	activeRun.frameTotalMs += frameMs
	activeRun.frameCount++
	activeRun.maxFrameMs = Math.max(activeRun.maxFrameMs, frameMs)
	if (frameMs > 1000 / 50) activeRun.lowFpsSeconds += deltaSeconds
	if (frameMs >= 50) activeRun.stutterCount++
	if (activeRun.frameSamples.length < MAX_FRAME_SAMPLES) {
		activeRun.frameSamples.push(frameMs)
	} else {
		activeRun.frameSamples[activeRun.frameSampleCursor] = frameMs
		activeRun.frameSampleCursor =
			(activeRun.frameSampleCursor + 1) % MAX_FRAME_SAMPLES
	}
	if (threat) {
		activeRun.highestThreatTier = Math.max(
			activeRun.highestThreatTier,
			threat.tier
		)
	}
}

export function recordTelemetryEnemySpawn(type: string, elite = false) {
	const stats = enemyStats(type)
	if (!stats) return
	stats.spawned++
	if (elite) stats.eliteSpawned++
}

export function recordTelemetryEnemyKill(
	type: string,
	elite = false,
	lifetimeSeconds = 0
) {
	const stats = enemyStats(type)
	if (!stats) return
	stats.killed++
	if (elite) stats.eliteKilled++
	if (Number.isFinite(lifetimeSeconds) && lifetimeSeconds > 0) {
		stats.totalLifetimeSeconds += lifetimeSeconds
	}
}

export function recordTelemetryEnemyDamage(type: string, amount: number) {
	const stats = enemyStats(type)
	if (!stats || !Number.isFinite(amount) || amount <= 0) return
	stats.damageTaken += amount
}

export function recordTelemetryPlayerDamage(amount: number, source: string) {
	if (!activeRun || !Number.isFinite(amount) || amount <= 0) return
	activeRun.damageTaken.total += amount
	increment(activeRun.damageTaken.bySource, normalizeKey(source), amount)
}

export function recordTelemetryHealing(amount: number) {
	if (!activeRun || !Number.isFinite(amount) || amount <= 0) return
	activeRun.healingReceived += amount
}

export function recordTelemetryAbilityUse(slot: string, abilityId: string) {
	const stats = abilityStats(slot, abilityId)
	if (stats) stats.uses++
}

export function recordTelemetryAbilityFailure(slot: string, abilityId = "empty") {
	const stats = abilityStats(slot, abilityId)
	if (stats) stats.failedUses++
}

export function recordTelemetrySalvageEarned(amount: number) {
	if (!activeRun || !Number.isFinite(amount) || amount <= 0) return
	activeRun.economy.salvageEarned += amount
}

export function recordTelemetrySalvageSpent(amount: number) {
	if (!activeRun || !Number.isFinite(amount) || amount <= 0) return
	activeRun.economy.salvageSpent += amount
}

export function recordTelemetryRewardOffered(
	id: string,
	details: RewardTelemetryDetails = {}
) {
	if (!activeRun) return
	increment(activeRun.rewards.offered, id)
	recordRewardEvent("OFFERED", id, details)
}

export function recordTelemetryRewardSelected(
	id: string,
	rarity: string,
	discovery = false,
	details: RewardTelemetryDetails = {}
) {
	if (!activeRun) return
	increment(activeRun.rewards.selected, id)
	increment(activeRun.rewards.selectedRarities, rarity)
	if (discovery) increment(activeRun.rewards.discovered, id)
	recordRewardEvent("SELECTED", id, { ...details, rarity })
}

export function recordTelemetryChestResult(
	challenge: string,
	failedAttempts: number,
	perfect: boolean
) {
	if (!activeRun) return
	activeRun.chests.opened++
	activeRun.chests.failedAttempts += Math.max(0, Math.round(failedAttempts))
	if (perfect) activeRun.chests.perfect++
	increment(activeRun.chests.byChallenge, challenge)
}

export function recordTelemetryChestReroll() {
	if (activeRun) activeRun.chests.rerolls++
}

export function recordTelemetryChestRetry() {
	if (activeRun) activeRun.chests.retries++
}

export function finishRunTelemetry(
	outcome: RunTelemetryRecord["outcome"],
	debree: DebreeRunOutcome
) {
	if (!activeRun) return
	activeRun.economy.salvageDeposited = debree.deposited
	activeRun.economy.salvageLost = debree.lost
	const record: RunTelemetryRecord = {
		schemaVersion: activeRun.schemaVersion,
		runId: activeRun.runId,
		startedAt: activeRun.startedAt,
		completedAt: new Date().toISOString(),
		outcome,
		durationSeconds: elapsedSeconds(),
		context: activeRun.context,
		floors: activeRun.floors,
		highestThreatTier: activeRun.highestThreatTier,
		enemies: activeRun.enemies,
		damageTaken: activeRun.damageTaken,
		healingReceived: activeRun.healingReceived,
		abilities: activeRun.abilities,
		economy: activeRun.economy,
		rewards: activeRun.rewards,
		chests: activeRun.chests,
		performance: {
			averageFrameMs: activeRun.frameCount > 0
				? activeRun.frameTotalMs / activeRun.frameCount
				: 0,
			p95FrameMs: percentile(activeRun.frameSamples, 0.95),
			maxFrameMs: activeRun.maxFrameMs,
			lowFpsSeconds: activeRun.lowFpsSeconds,
			stutterCount: activeRun.stutterCount,
		},
	}
	activeRun = undefined
	const records = getRunTelemetryRecords()
	records.push(record)
	saveRecords(records.slice(-MAX_STORED_RUNS))
	return record
}

export function getRunTelemetryRecords(): RunTelemetryRecord[] {
	const storage = getStorage()
	const saved = storage?.getItem(TELEMETRY_STORAGE_KEY)
	if (!saved) return []
	try {
		const parsed = JSON.parse(saved)
		return Array.isArray(parsed) ? parsed as RunTelemetryRecord[] : []
	} catch {
		return []
	}
}

export function getActiveRunTelemetry() {
	return activeRun
}

export function clearRunTelemetry() {
	activeRun = undefined
	getStorage()?.removeItem(TELEMETRY_STORAGE_KEY)
}

export function formatRunTelemetrySummary() {
	const records = getRunTelemetryRecords()
	if (records.length === 0) {
		return activeRun
			? `1 active run, 0 completed telemetry records`
			: "No run telemetry recorded"
	}
	const completed = records.filter((record) => record.outcome === "EXTRACTED").length
	const latest = records[records.length - 1]
	return [
		`${records.length} completed run telemetry record${records.length === 1 ? "" : "s"}${activeRun ? " + 1 active" : ""}`,
		`Extraction rate ${Math.round(completed / records.length * 100)}%`,
		`Latest: ${latest.outcome} | ${latest.durationSeconds.toFixed(1)}s | ${totalKills(latest)} kills | threat ${latest.highestThreatTier}`,
	].join("\n")
}

export function formatLatestRunTelemetry() {
	const records = getRunTelemetryRecords()
	const latest = records[records.length - 1]
	if (!latest) return "No completed run telemetry recorded"
	return JSON.stringify(latest, null, 2)
}

export function formatRewardTelemetrySummary() {
	const records = getRunTelemetryRecords()
	const sources = activeRun ? [...records, activeRun] : records
	const events = sources.flatMap((record) => record.rewards.events ?? [])
	if (events.length === 0) {
		return records.length === 0
			? "No reward telemetry recorded"
			: "No detailed reward events recorded yet; complete or continue a run with telemetry schema 2"
	}

	const offered = events.filter((event) => event.type === "OFFERED")
	const selected = events.filter((event) => event.type === "SELECTED")
	const offerFamilies = countRewardFamilies(offered)
	const selectedFamilies = countRewardFamilies(selected)
	const sourceCounts: Record<string, number> = {}
	for (const event of offered) increment(sourceCounts, event.source ?? "unknown")
	const constrainedOffers = offered.filter(
		(event) => event.candidatePoolSize !== undefined && event.candidatePoolSize <= 2
	).length

	return [
		`${sources.length} run${sources.length === 1 ? "" : "s"} | ${offered.length} offers | ${selected.length} selections`,
		`Top offers: ${formatRewardCounts(offerFamilies)}`,
		`Top selections: ${formatRewardCounts(selectedFamilies)}`,
		`Offer sources: ${formatRewardCounts(sourceCounts)}`,
		`Constrained offers (pool <= 2): ${constrainedOffers}`,
	].join("\n")
}

export function formatSimulationTelemetrySummary() {
	const records = getRunTelemetryRecords().filter((record) => record.context.synthetic)
	if (records.length === 0) return "No synthetic run telemetry recorded"
	const extracted = records.filter((record) => record.outcome === "EXTRACTED").length
	const enemies: Record<string, number> = {}
	const deaths: Record<string, number> = {}
	for (const record of records) {
		for (const [id, stats] of Object.entries(record.enemies)) {
			increment(enemies, id, stats.spawned)
		}
		if (record.outcome !== "DESTROYED") continue
		const cause = Object.entries(record.damageTaken.bySource)
			.sort((left, right) => right[1] - left[1])[0]?.[0] ?? "unknown"
		increment(deaths, cause)
	}
	return [
		`${records.length} synthetic runs | extraction ${Math.round(extracted / records.length * 100)}%`,
		`Death causes: ${formatRewardCounts(deaths)}`,
		`Enemy spawns: ${formatRewardCounts(enemies)}`,
	].join("\n")
}

export function downloadRunTelemetry() {
	const records = getRunTelemetryRecords()
	if (typeof document === "undefined" || typeof URL === "undefined") return false
	const blob = new Blob([JSON.stringify(records, null, 2)], {
		type: "application/json",
	})
	const url = URL.createObjectURL(blob)
	const link = document.createElement("a")
	link.href = url
	const timestamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-")
	link.download = `spacedaze-telemetry-${timestamp}.json`
	link.click()
	URL.revokeObjectURL(url)
	return true
}

function enemyStats(type: string) {
	if (!activeRun) return undefined
	const key = normalizeKey(type)
	activeRun.enemies[key] ??= {
		spawned: 0,
		killed: 0,
		eliteSpawned: 0,
		eliteKilled: 0,
		damageTaken: 0,
		totalLifetimeSeconds: 0,
	}
	return activeRun.enemies[key]
}

function abilityStats(slot: string, abilityId: string) {
	if (!activeRun) return undefined
	const key = `${normalizeKey(slot)}:${normalizeKey(abilityId)}`
	activeRun.abilities[key] ??= { uses: 0, failedUses: 0 }
	return activeRun.abilities[key]
}

function increment(target: Record<string, number>, key: string, amount = 1) {
	target[key] = (target[key] ?? 0) + amount
}

function recordRewardEvent(
	type: RewardTelemetryEvent["type"],
	rewardId: string,
	details: RewardTelemetryDetails
) {
	if (!activeRun) return
	const events = activeRun.rewards.events ??= []
	events.push({
		...details,
		type,
		rewardId,
		familyId: details.familyId ?? rewardFamilyId(rewardId),
		elapsedSeconds: elapsedSeconds(),
	})
	if (events.length > MAX_REWARD_EVENTS) events.shift()
}

function rewardFamilyId(rewardId: string) {
	const upgrade = /^upgrade:([^:]+):\d+$/i.exec(rewardId)
	return upgrade ? `upgrade:${upgrade[1]}` : rewardId
}

function countRewardFamilies(events: readonly RewardTelemetryEvent[]) {
	const counts: Record<string, number> = {}
	for (const event of events) increment(counts, event.familyId)
	return counts
}

function formatRewardCounts(counts: Record<string, number>) {
	const entries = Object.entries(counts)
		.sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
		.slice(0, 6)
	return entries.length > 0
		? entries.map(([id, count]) => `${id} x${count}`).join(", ")
		: "none"
}

function normalizeKey(value: string) {
	return value.trim().replace(/\s+/g, "_").toLowerCase() || "unknown"
}

function elapsedSeconds() {
	if (!activeRun) return 0
	return Math.max(0, (nowMilliseconds() - activeRun.startedAtMs) / 1000)
}

function nowMilliseconds() {
	return typeof performance === "undefined" ? Date.now() : performance.now()
}

function createRunId() {
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function percentile(samples: number[], ratio: number) {
	if (samples.length === 0) return 0
	const sorted = [...samples].sort((a, b) => a - b)
	return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))]
}

function totalKills(record: RunTelemetryRecord) {
	return Object.values(record.enemies).reduce((total, enemy) => total + enemy.killed, 0)
}

function getStorage() {
	return typeof localStorage === "undefined" ? undefined : localStorage
}

function saveRecords(records: RunTelemetryRecord[]) {
	getStorage()?.setItem(TELEMETRY_STORAGE_KEY, JSON.stringify(records))
}
