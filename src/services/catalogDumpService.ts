import { GENERATED_CONTENT_REGISTRY } from "../generation/runtime/roomContentRegistry"
import { DROID_REGISTRY } from "../npcs/droidRegistry"
import { getAllUpgradeDefinitions } from "../upgrades/upgradeRegistry"
import { ABILITIES } from "./abilityRegistry"
import { ACTIVE_MODULES } from "./activeModuleService"
import { BOSS_REGISTRY } from "./bossRegistry"
import { PLAYTEST_BUILDS } from "./buildPresets"
import { ENCOUNTER_CATALOG } from "./enemyEncounterCatalogService"
import { ENEMY_PROGRESSION } from "./enemyProgressionService"
import { HUB_FACILITIES, HUB_LEVELS } from "./hubProgressService"
import { HUB_SETTLEMENT_PLOTS } from "./hubSettlementService"
import { getAllRewardDefinitions } from "./rewardService"
import { getRecoveryOffers } from "./runInventoryService"
import { RUN_LEVEL_POOLS } from "./runLevelPool"
import { RUN_LEVEL_BONUSES } from "./runLevelService"
import { WARP_ZONES } from "./warpZoneService"
import { WEAPONS } from "./weaponService"

interface CatalogSection {
	title: string
	rows: readonly unknown[]
}

type FlatRow = Record<string, string | number | boolean | undefined>

export function createCompleteGameDump() {
	const generatedAt = new Date().toISOString()
	const sections: CatalogSection[] = [
		{ title: "REWARDS", rows: getAllRewardDefinitions() },
		{ title: "WEAPONS", rows: WEAPONS },
		{ title: "ACTIVE MODULES", rows: ACTIVE_MODULES },
		{ title: "ABILITIES", rows: ABILITIES },
		{ title: "UPGRADE LEVELS", rows: getUpgradeLevelRows() },
		{ title: "ENEMIES", rows: getEnemyRows() },
		{ title: "BOSSES", rows: Object.values(BOSS_REGISTRY) },
		{ title: "ENCOUNTERS", rows: ENCOUNTER_CATALOG },
		{ title: "NPCS", rows: DROID_REGISTRY },
		{ title: "SHOPS AND FACILITIES", rows: getShopRows() },
		{ title: "CURRENT RECOVERY SHOP OFFERS", rows: getRecoveryOffers() },
		{ title: "HUB LEVELS", rows: HUB_LEVELS },
		{ title: "HUB SETTLEMENT BUILDINGS", rows: HUB_SETTLEMENT_PLOTS },
		{ title: "GENERATED ROOM CONTENT", rows: GENERATED_CONTENT_REGISTRY },
		{ title: "RUN LEVEL BONUSES", rows: RUN_LEVEL_BONUSES },
		{ title: "RUN LEVEL POOLS", rows: RUN_LEVEL_POOLS },
		{ title: "WARP ZONES", rows: WARP_ZONES },
		{ title: "PLAYTEST BUILDS", rows: PLAYTEST_BUILDS },
	]
	const totalRows = sections.reduce((total, section) => total + section.rows.length, 0)
	const body = sections.map(formatSection).join("\n\n")
	return [
		"# SPACEDAZE COMPLETE GAME DATA DUMP",
		`# GENERATED ${generatedAt}`,
		`# SECTIONS ${sections.length}`,
		`# ROWS ${totalRows}`,
		"",
		body,
	].join("\n")
}

export function downloadCompleteGameDump() {
	if (typeof document === "undefined" || typeof URL === "undefined") return undefined
	const report = createCompleteGameDump()
	const generatedAt = new Date().toISOString().replaceAll(":", "-")
	const filename = `spacedaze-complete-dump-${generatedAt}.txt`
	const blob = new Blob([report], { type: "text/plain;charset=utf-8" })
	const url = URL.createObjectURL(blob)
	const link = document.createElement("a")
	link.href = url
	link.download = filename
	document.body.appendChild(link)
	link.click()
	link.remove()
	URL.revokeObjectURL(url)
	console.log(report)
	return filename
}

function getUpgradeLevelRows() {
	return getAllUpgradeDefinitions().flatMap((definition) =>
		definition.levels.map((level, levelIndex) => ({
			toolKey: definition.toolKey,
			toolName: definition.toolName,
			category: definition.category,
			type: definition.type,
			requirements: definition.requirements,
			reward: definition.reward,
			level: levelIndex + 1,
			name: level.name,
			description: level.desc,
			price: level.price,
			sprite: level.sprite,
			effects: level.effects,
		}))
	)
}

function getEnemyRows() {
	return Object.entries(ENEMY_PROGRESSION).map(([id, definition]) => ({
		id,
		...definition,
	}))
}

function getShopRows() {
	return [
		{
			id: "recoveryShop",
			name: "RECOVERY SHOP",
			type: "shop",
			description: "Recover up to three rewards preserved after death",
			inventory: "CURRENT RECOVERY SHOP OFFERS section",
		},
		...HUB_FACILITIES.map((facility) => ({
			...facility,
			type: "hubFacility",
		})),
	]
}

function formatSection(section: CatalogSection) {
	const rows = section.rows.map((row) => flattenRow(row))
	const columns = getColumns(rows)
	const count = rows.length
	const heading = `## ${section.title} (${count})`
	if (columns.length === 0) return `${heading}\n# NO DATA`
	const lines = [
		columns.map(escapeCsv).join(","),
		...rows.map((row) => columns.map((column) => escapeCsv(row[column])).join(",")),
	]
	return `${heading}\n${lines.join("\n")}`
}

function flattenRow(value: unknown) {
	const row: FlatRow = {}
	flattenValue(value, "", row)
	return row
}

function flattenValue(value: unknown, path: string, row: FlatRow) {
	if (value === undefined || value === null) {
		if (path) row[path] = undefined
		return
	}
	if (Array.isArray(value)) {
		row[path || "value"] = JSON.stringify(value, jsonReplacer)
		return
	}
	if (typeof value === "object") {
		for (const [key, child] of Object.entries(value)) {
			flattenValue(child, path ? `${path}.${key}` : key, row)
		}
		return
	}
	if (typeof value === "function") {
		row[path || "value"] = `[function ${value.name || "anonymous"}]`
		return
	}
	row[path || "value"] = value
}

function getColumns(rows: readonly FlatRow[]) {
	const columns = new Set(rows.flatMap((row) => Object.keys(row)))
	const preferred = ["id", "toolKey", "name", "type", "kind", "description"]
	return [
		...preferred.filter((column) => columns.delete(column)),
		...[...columns].sort((left, right) => left.localeCompare(right)),
	]
}

function escapeCsv(value: unknown) {
	if (value === undefined || value === null) return ""
	const text = String(value)
	return /[",\n\r]/.test(text)
		? `"${text.replaceAll('"', '""')}"`
		: text
}

function jsonReplacer(_key: string, value: unknown) {
	return typeof value === "function"
		? `[function ${(value as Function).name || "anonymous"}]`
		: value
}
