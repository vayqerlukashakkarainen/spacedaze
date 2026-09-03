import {
	GenerationMap,
	CaveGenConfig,
	GenCell,
	ROOM_ROLES,
	RoomRole,
	roomRoleTag,
} from "../generationTypes";
import { hexDistance, hexNeighbors } from "../hexUtils";
import { SeededRNG } from "../seededRng";

/**
 * Pass 7: Feature tagging
 * Tags cells for gameplay purposes (spawns, resources, hazards)
 */
export function applyFeatureTagging(
	map: GenerationMap,
	rng: SeededRNG,
	config: CaveGenConfig
): void {
	const { resourceNodeCount, hazardCount, minPoiSpacing } = config.features;

	// Find all empty cells in main region (largest regionId)
	const mainRegion = findMainRegion(map);
	let emptyCells = map
		.getAllCells()
		.filter(
			(c) => !c.solid && c.regionId === mainRegion && !c.tags.has("tunnel")
		);

	if (emptyCells.length === 0) {
		const center = map.getCell({
			q: Math.floor(map.width / 2),
			r: Math.floor(map.height / 2),
		});
		if (!center) return;
		center.solid = false;
		center.hardness = 0;
		center.density = 0;
		center.regionId = 0;
		center.locked = false;
		center.tags.clear();
		emptyCells = [center];
	}

	// Tag player spawn (center-ish of map)
	const playerSpawn = tagPlayerSpawn(map, emptyCells);
	if (!playerSpawn) return;

	// Assign semantic rooms before placing individual cell features. Room tags
	// are consumed by the runtime to populate and color generated runs.
	tagRoomRoles(map, emptyCells, playerSpawn, minPoiSpacing, rng);
	const featureCandidates = emptyCells.filter((cell) => !hasRoomRole(cell));

	// Tag resource nodes
	const resourceCells = placeFeatures(
		featureCandidates,
		resourceNodeCount,
		minPoiSpacing,
		rng
	);
	for (const cell of resourceCells) {
		cell.tags.add("resource_node");
	}

	// Tag hazards
	const hazardCandidates = featureCandidates.filter(
		(cell) =>
			!resourceCells.includes(cell) &&
			resourceCells.every(
				(resource) =>
					hexDistance(cell.coord, resource.coord) >= minPoiSpacing
			)
	);
	const hazardCells = placeFeatures(
		hazardCandidates,
		hazardCount,
		minPoiSpacing,
		rng
	);
	for (const cell of hazardCells) {
		cell.tags.add("hazard");
	}

	// Tag points of interest
	const poiCells = [...resourceCells, ...hazardCells];
	for (const cell of poiCells) {
		cell.tags.add("poi_candidate");
	}

	tagRewardWalls(map, playerSpawn, rng, config);
}

function tagRewardWalls(
	map: GenerationMap,
	playerSpawn: GenCell,
	rng: SeededRNG,
	config: CaveGenConfig
) {
	const candidates = map.getAllCells().filter((cell) => {
		if (!cell.solid || cell.locked) return false;
		if (hexDistance(cell.coord, playerSpawn.coord) < 6) return false;
		const openNeighborCount = hexNeighbors(cell.coord).filter((coord) => {
			const neighbor = map.getCell(coord);
			return neighbor && !neighbor.solid;
		}).length;
		return openNeighborCount === 1;
	});
	rng.shuffle(candidates);

	const targetCount = Math.max(
		1,
		Math.round(map.width * map.height * config.features.rewardWallDensity)
	);
	const candidateByKey = new Map(
		candidates.map((cell) => [cellCoordKey(cell.coord), cell])
	);
	const selected: GenCell[] = [];
	const selectedKeys = new Set<string>();

	for (const anchor of candidates) {
		if (selected.length >= targetCount) break;
		if (selectedKeys.has(cellCoordKey(anchor.coord))) continue;
		if (
			selected.some(
				(cell) =>
					hexDistance(cell.coord, anchor.coord) <
					config.features.rewardWallMinSpacing
			)
		) continue;

		selectRewardWall(anchor, false, selected, selectedKeys);
		if (!rng.nextBool(config.features.rewardWallClusterChance)) continue;

		const minClusterSize = Math.max(
			2,
			config.features.rewardWallClusterMinSize
		);
		const maxClusterSize = Math.max(
			minClusterSize,
			config.features.rewardWallClusterMaxSize
		);
		const clusterTarget = rng.nextInt(minClusterSize, maxClusterSize + 1);
		const cluster: GenCell[] = [anchor];
		while (
			cluster.length < clusterTarget &&
			selected.length < targetCount
		) {
			const adjacent = cluster.flatMap((cell) =>
				hexNeighbors(cell.coord)
					.map((coord) => candidateByKey.get(cellCoordKey(coord)))
					.filter((cell): cell is GenCell => {
						if (!cell) return false;
						return !selectedKeys.has(cellCoordKey(cell.coord));
					})
			);
			if (adjacent.length === 0) break;
			const next = rng.choice(adjacent);
			selectRewardWall(next, true, selected, selectedKeys);
			cluster.push(next);
		}
	}
}

function selectRewardWall(
	cell: GenCell,
	clustered: boolean,
	selected: GenCell[],
	selectedKeys: Set<string>
) {
	cell.tags.add("destructible_wall");
	cell.tags.add("reward_wall");
	if (clustered) cell.tags.add("reward_wall_cluster");
	selected.push(cell);
	selectedKeys.add(cellCoordKey(cell.coord));
}

function cellCoordKey(coord: { q: number; r: number }) {
	return `${coord.q},${coord.r}`;
}

/**
 * Find main region ID (largest region)
 */
function findMainRegion(map: GenerationMap): number {
	const regionSizes = new Map<number, number>();

	for (const cell of map.getAllCells()) {
		if (!cell.solid && cell.regionId >= 0) {
			regionSizes.set(cell.regionId, (regionSizes.get(cell.regionId) || 0) + 1);
		}
	}

	let largestRegion = 0;
	let largestSize = 0;

	for (const [regionId, size] of regionSizes.entries()) {
		if (size > largestSize) {
			largestSize = size;
			largestRegion = regionId;
		}
	}

	return largestRegion;
}

/**
 * Tag player spawn location
 */
function tagPlayerSpawn(
	map: GenerationMap,
	candidates: GenCell[]
): GenCell | undefined {
	// Find cell closest to center
	const centerQ = map.width / 2;
	const centerR = map.height / 2;

	let closest = candidates[0];
	let minDist = Infinity;

	for (const cell of candidates) {
		const dist = Math.sqrt(
			Math.pow(cell.coord.q - centerQ, 2) + Math.pow(cell.coord.r - centerR, 2)
		);
		if (dist < minDist) {
			minDist = dist;
			closest = cell;
		}
	}

	if (closest) {
		closest.tags.add("player_spawn");
	}

	return closest;
}

function tagRoomRoles(
	map: GenerationMap,
	candidates: GenCell[],
	playerSpawn: GenCell,
	minSpacing: number,
	rng: SeededRNG
): void {
	const spacing = Math.max(6, minSpacing);
	const openCandidates = candidates.filter((cell) => {
		const openNeighbors = hexNeighbors(cell.coord).filter((coord) => {
			const neighbor = map.getCell(coord);
			return neighbor && !neighbor.solid;
		}).length;
		return openNeighbors >= 4;
	});
	const roomCandidates = openCandidates.length >= 4 ? openCandidates : candidates;
	const anchors: GenCell[] = [playerSpawn];

	assignRoomArea(map, playerSpawn, "spawn");

	const orderedExitCandidates = [...roomCandidates]
		.filter((cell) => cell !== playerSpawn)
		.sort(
			(a, b) =>
				hexDistance(b.coord, playerSpawn.coord) -
				hexDistance(a.coord, playerSpawn.coord)
		);
	let exitAnchor = orderedExitCandidates.find(
		(cell) => !hasRoomRole(cell) && isFarEnough(cell, anchors, spacing)
	);
	if (!exitAnchor) {
		exitAnchor = orderedExitCandidates.find((cell) => !hasRoomRole(cell));
	}
	if (!exitAnchor) {
		exitAnchor = orderedExitCandidates[0] ?? carveExitNeighbor(map, playerSpawn);
	}

	if (exitAnchor) {
		for (const role of ROOM_ROLES) {
			exitAnchor.tags.delete(roomRoleTag(role));
		}
		exitAnchor.tags.add("end");
		anchors.push(exitAnchor);
		assignRoomArea(map, exitAnchor, "exit");
	}

	const shuffled = rng.shuffle([...roomCandidates]);
	placeRoom(map, shuffled, anchors, "reward", spacing);
	placeRoom(map, shuffled, anchors, "repair", spacing);
	placeRoom(map, shuffled, anchors, "relay", spacing);
	placeRoom(map, shuffled, anchors, "shrine", spacing);
	placeRoom(map, shuffled, anchors, "rift", spacing);
	placeRoom(map, shuffled, anchors, "anomaly", spacing, 3);
	placeRoom(map, shuffled, anchors, "minefield", spacing, 3);
	placeRoom(map, shuffled, anchors, "convoy", spacing);
	placeRoom(map, shuffled, anchors, "asteroid", spacing, 3);
	placeRoom(map, shuffled, anchors, "combat", spacing);
	placeRoom(map, shuffled, anchors, "combat", spacing);
}

function carveExitNeighbor(
	map: GenerationMap,
	playerSpawn: GenCell
): GenCell | undefined {
	for (const coord of hexNeighbors(playerSpawn.coord)) {
		if (!map.inBounds(coord)) continue;
		const cell = map.getCell(coord);
		if (!cell) continue;
		cell.solid = false;
		cell.hardness = 0;
		cell.density = 0;
		cell.regionId = playerSpawn.regionId;
		cell.locked = false;
		cell.tags.clear();
		return cell;
	}
	return undefined;
}

function placeRoom(
	map: GenerationMap,
	candidates: GenCell[],
	anchors: GenCell[],
	role: RoomRole,
	spacing: number,
	radius = 2
): void {
	const anchor = candidates.find(
		(cell) => !hasRoomRole(cell) && isFarEnough(cell, anchors, spacing)
	);
	if (!anchor) return;

	anchors.push(anchor);
	assignRoomArea(map, anchor, role, radius);
}

function isFarEnough(cell: GenCell, anchors: GenCell[], spacing: number) {
	return anchors.every(
		(anchor) => hexDistance(cell.coord, anchor.coord) >= spacing
	);
}

function assignRoomArea(
	map: GenerationMap,
	anchor: GenCell,
	role: RoomRole,
	radius = 2
): void {
	anchor.tags.add("room_anchor");
	anchor.tags.add(roomRoleTag(role));

	for (const cell of map.getAllCells()) {
		if (cell.solid || cell.regionId !== anchor.regionId || hasRoomRole(cell)) {
			continue;
		}
		if (hexDistance(cell.coord, anchor.coord) > radius) continue;
		cell.tags.add(roomRoleTag(role));
	}
}

function hasRoomRole(cell: GenCell): boolean {
	return ROOM_ROLES.some((role) => cell.tags.has(roomRoleTag(role)));
}

/**
 * Place features with minimum spacing
 */
function placeFeatures(
	candidates: any[],
	count: number,
	minSpacing: number,
	rng: SeededRNG
): any[] {
	const placed: any[] = [];
	const shuffled = [...candidates];
	rng.shuffle(shuffled);

	for (const cell of shuffled) {
		if (placed.length >= count) break;

		// Check spacing from existing placed features
		const tooClose = placed.some(
			(p) => hexDistance(cell.coord, p.coord) < minSpacing
		);
		if (tooClose) continue;

		// Avoid player spawn
		if (cell.tags.has("player_spawn")) continue;

		placed.push(cell);
	}

	return placed;
}
