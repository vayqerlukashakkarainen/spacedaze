import type { GenerationMap, GenCell } from "../../generation/generationTypes"
import { hexDistance, hexNeighbors } from "../../generation/hexUtils"

export const RUN_VILLAGE_ARCHETYPE_COUNT = 8

export interface RunVillagePlot {
	coord: { q: number; r: number }
	archetype: number
	mirrored: boolean
	destroyed: boolean
}

export interface RunVillageZone {
	anchor: { q: number; r: number }
	plots: RunVillagePlot[]
}

const MIN_ZONE_SPACING = 12
const ZONE_RADIUS = 4
const MIN_PLOT_SPACING = 2

export function planRunVillageZones(
	map: GenerationMap,
	seed: number
): RunVillageZone[] {
	const protectedCells = map.getAllCells().filter(isProtectedCell)
	const candidates = map.getAllCells().filter((cell) =>
		isVillageCandidate(map, cell, protectedCells)
	)
	const orderedAnchors = [...candidates].sort(
		(a, b) => villageHash(seed, a.coord, 101) - villageHash(seed, b.coord, 101)
	)
	const targetZoneCount = Math.max(
		1,
		Math.min(3, Math.floor(map.width * map.height / 800))
	)
	const zones: RunVillageZone[] = []

	for (const anchor of orderedAnchors) {
		if (zones.length >= targetZoneCount) break
		if (
			zones.some(
				(zone) => hexDistance(zone.anchor, anchor.coord) < MIN_ZONE_SPACING
			)
		) continue

		const localCandidates = candidates
			.filter((cell) => hexDistance(anchor.coord, cell.coord) <= ZONE_RADIUS)
			.sort(
				(a, b) =>
					villageHash(seed, a.coord, 211) -
					villageHash(seed, b.coord, 211)
			)
		const plotTarget = 2 + villageHash(seed, anchor.coord, 307) % 4
		const selected: GenCell[] = [anchor]

		for (const candidate of localCandidates) {
			if (selected.length >= plotTarget) break
			if (candidate === anchor) continue
			if (
				selected.some(
					(plot) => hexDistance(plot.coord, candidate.coord) < MIN_PLOT_SPACING
				)
			) continue
			selected.push(candidate)
		}
		if (selected.length < 2) continue

		for (const cell of localCandidates) cell.tags.add("village_zone")
		anchor.tags.add("village_anchor")
		for (const cell of selected) cell.tags.add("village_plot")
		zones.push({
			anchor: { ...anchor.coord },
			plots: selected.map((cell) => {
				const hash = villageHash(seed, cell.coord, 401)
				return {
					coord: { ...cell.coord },
					archetype: hash % RUN_VILLAGE_ARCHETYPE_COUNT,
					mirrored: (hash & 0b1000) !== 0,
					destroyed: hash % 100 < 38,
				}
			}),
		})
	}

	return zones
}

function isVillageCandidate(
	map: GenerationMap,
	cell: GenCell,
	protectedCells: GenCell[]
) {
	if (!cell.solid || cell.locked || isProtectedCell(cell)) return false
	if (
		cell.coord.q < 2 ||
		cell.coord.r < 2 ||
		cell.coord.q >= map.width - 2 ||
		cell.coord.r >= map.height - 2
	) return false

	const neighbors = hexNeighbors(cell.coord)
		.map((coord) => map.getCell(coord))
		.filter((neighbor): neighbor is GenCell => neighbor !== undefined)
	const openNeighbors = neighbors.filter((neighbor) => !neighbor.solid).length
	const solidNeighbors = neighbors.filter((neighbor) => neighbor.solid).length
	if (openNeighbors < 1 || openNeighbors > 3 || solidNeighbors < 3) return false

	return protectedCells.every((protectedCell) => {
		const spacing = protectedCell.tags.has("room_anchor") ||
			protectedCell.tags.has("player_spawn") ||
			protectedCell.tags.has("end")
			? 5
			: 3
		return hexDistance(cell.coord, protectedCell.coord) >= spacing
	})
}

function isProtectedCell(cell: GenCell) {
	return cell.tags.has("room_anchor") ||
		cell.tags.has("player_spawn") ||
		cell.tags.has("end") ||
		cell.tags.has("destructible_wall") ||
		cell.tags.has("reward_wall") ||
		cell.tags.has("hidden_cavern")
}

function villageHash(
	seed: number,
	coord: { q: number; r: number },
	salt: number
) {
	let hash = seed ^ (coord.q * 73856093) ^ (coord.r * 19349663) ^ salt
	hash = Math.imul(hash ^ (hash >>> 16), 2246822519)
	return (hash ^ (hash >>> 13)) >>> 0
}
