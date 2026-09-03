import type { Vec2 } from "kaplay";
import { generateCave } from "../generation/caveGenerator";
import { generationMapToHexGrid } from "../generation/gridConversion";
import {
	GenerationMap,
	GenCell,
	ROOM_ROLES,
	RoomRole,
	roomRoleTag,
} from "../generation/generationTypes";
import { hexDistance, hexNeighbors } from "../generation/hexUtils";
import { gridCollision } from "../comp/gridCollision";
import { gridRegistry } from "../grid/gridRegistry";
import { ACTIVE_RUN_GRID_KEY } from "../grid/gridKeys";
import { CellType, HexGrid } from "../grid/hexGrid";
import { playerObj } from "../game";
import { resetVolatileCargoObjective, session } from "../player";
import {
	k,
	layers,
	mainSoundVolume,
	subSoundVolume,
	velocityScale,
} from "../main";
import { tags } from "../tags";
import { ASTEROID_SPRITES } from "../asteroidSprites";
import { spawnMeteorite } from "../spawn/spawnAsteroid";
import { spawnChest } from "../spawn/spawnChest";
import { spawnLevel } from "../spawn/spawnLevel";
import { spawnCrate } from "../spawn/spawnCrate";
import { spawnBoss1 } from "../spawn/spawnBoss1";
import { spawnShrine } from "../spawn/shrine/spawnShrine";
import { spawnDamageShrine } from "../spawn/shrine/spawnDamageShrine";
import { getShrineLevelConfig } from "../spawn/shrine/shrineLevel";
import { spawnTimescaleZone } from "../spawn/spawnTimescaleZone";
import { spawnRewardPickup } from "../spawn/spawnPowerup";
import { rollCrateReward } from "../services/rewardService";
import type { GeneratedMapConfig } from "./levels";
import {
	activateRunFinale,
	getRunFinaleRampProgress,
	getRunFinaleTransitionSecondsRemaining,
	getRunPhase,
} from "../services/runFinaleService";
import { getHexWallTopology } from "./hexWallTiles";
import {
	advanceRunSession,
	getCurrentRunFloor,
	getRunRouteSnapshot,
	setNextRunSeed,
} from "../services/runDirectorService";
import {
	GeneratedContentId,
	selectGeneratedContent,
} from "../generation/runtime/roomContentRegistry";
import { spawnDebree } from "../spawn/spawnDebree";
import {
	clearDestructibleWalls,
	DestructibleWallState,
	registerDestructibleWall,
} from "../services/destructibleWallService";
import {
	getRecentPlayerPath,
	recordPlayerPathPosition,
	resetPlayerPath,
} from "../services/playerPathService";
import { spawnGeneratedParallax } from "../generation/runtime/spawnGeneratedParallax";
import { spawnExplosionEffect } from "../spawn/spawnFlash";
import {
	debreeRocketEmitter,
	explosionEmitter,
	starsEmitter,
} from "../particles";
import { audioService } from "../services/audioService";
import { randomExplosion } from "../util";
import { spawnThreatEncounter } from "../services/enemyEncounterService";
import { spawnGravityPull } from "../spawn/spawnGravityPull";
import { spawnRiftJunction } from "../spawn/rooms/spawnRiftJunction";
import { spawnDroneRepairZone } from "../spawn/rooms/spawnDroneRepairZone";
import { spawnGravityAnomaly } from "../spawn/rooms/spawnGravityAnomaly";
import { spawnMinefield } from "../spawn/rooms/spawnMinefield";
import { spawnLostConvoy } from "../spawn/rooms/spawnLostConvoy";
import { spawnSignalRelay } from "../spawn/rooms/spawnSignalRelay";
import { spawnVolatileCargoObjective } from "../spawn/spawnVolatileCargoObjective";
import {
	addThreatTime,
	getThreatRomanNumeral,
	getThreatSnapshot,
	scaleThreatSpawnCount,
	startThreatLevel,
	stopThreatLevel,
	updateThreatLevel,
} from "../services/threatService";

export const RUN_GRID_KEY = ACTIVE_RUN_GRID_KEY;
const RUN_RENDER_CHUNK_SIZE = 6;
const RUN_RENDER_PADDING_CELLS = 2;
const RUN_MAP_REVEAL_RADIUS = 4;
const WALL_EXPLOSION_SOUND_REPEAT_WINDOW = 0.4;
const WALL_EXPLOSION_SOUND_REPEAT_CHANCE = 0.25;
let currentRunSeed: number | undefined;
let currentGeneratedMap: GenerationMap | undefined;
let currentFloorExitPosition: Vec2 | undefined;
let currentVolatileCargoCoord: { q: number; r: number } | undefined;
let revealedRunMapCells = new Set<string>();
let currentHiddenCaverns: HiddenCavern[] = [];
let currentRewardWalls: RewardWall[] = [];
let refreshRunMapWallTopology:
	| ((coord: { q: number; r: number }) => void)
	| undefined;
let lastWallExplosionSoundAt = Number.NEGATIVE_INFINITY;

interface HiddenCavern {
	entrance: { q: number; r: number };
	cells: Array<{ q: number; r: number }>;
	opened: boolean;
	wallState?: DestructibleWallState;
}

interface RewardWall {
	coord: { q: number; r: number };
	wallState?: DestructibleWallState;
}

export interface GeneratedRunMapCell {
	q: number;
	r: number;
	solid: boolean;
	role?: RoomRole;
	roomAnchor: boolean;
	revealed: boolean;
	destructible: boolean;
	volatileCargoObjective: boolean;
}

export interface GeneratedRunMapSnapshot {
	width: number;
	height: number;
	seed: number;
	cells: GeneratedRunMapCell[];
	playerCoord: { q: number; r: number };
	playerPosition: Vec2;
	playerPath: Vec2[];
}

export function setNextGeneratedRunSeed(seed: number) {
	setNextRunSeed(seed);
}

export function startGeneratedRunMap(
	config: GeneratedMapConfig,
	seed?: number
) {
	clearGeneratedRunMap();

	const selectedSeed = seed ?? Math.floor(k.rand(1, 1000000));
	currentRunSeed = selectedSeed;
	const generatedMap = generateCave(
		selectedSeed,
		config.width,
		config.height,
		config.generator
	);
	const depth = getCurrentRunFloor()?.depth ?? 1;
	if (depth === 1) resetVolatileCargoObjective();
	if (isMilestoneBossFloor(depth)) promoteExitToBossRoom(generatedMap);
	const spawnCoord = getPlayerSpawn(generatedMap);
	currentHiddenCaverns = createHiddenCaverns(
		generatedMap,
		selectedSeed,
		spawnCoord
	);
	currentRewardWalls = getGeneratedRewardWalls(generatedMap);
	currentGeneratedMap = generatedMap;
	const grid = generationMapToHexGrid(
		generatedMap,
		config.hexSize,
		0,
		0
	);

	const uncenteredSpawn = grid.hexToScreen(spawnCoord);
	grid.config.offset = k.center().sub(uncenteredSpawn);

	gridRegistry.register(RUN_GRID_KEY, grid, false);
	setupDestructibleWalls(grid, generatedMap, selectedSeed, depth);
	renderRunMap(grid, generatedMap);
	spawnGeneratedParallax(
		grid,
		generatedMap.width,
		generatedMap.height,
		selectedSeed
	);

	playerObj.pos = grid.hexToScreen(spawnCoord);
	resetPlayerPath(playerObj.pos);
	playerObj.use(gridCollision(RUN_GRID_KEY));
	startThreatLevel(depth);
	startRunMapExploration(grid, spawnCoord);
	populateRunMap(
		grid,
		generatedMap,
		config.hexSize,
		selectedSeed,
		depth
	);
	spawnCargoDeliveryIndicator();
	spawnThreatDirector(grid, generatedMap, config.hexSize);

	console.log(`Started generated run with seed ${selectedSeed}`);
	return selectedSeed;
}

export function clearGeneratedRunMap() {
	if (playerObj && playerObj.has("gridCollision")) {
		playerObj.unuse("gridCollision");
	}

	gridRegistry.unregister(RUN_GRID_KEY);
	clearDestructibleWalls(RUN_GRID_KEY);
	stopThreatLevel();
	k.destroyAll(tags.runMap);
	currentGeneratedMap = undefined;
	currentFloorExitPosition = undefined;
	currentVolatileCargoCoord = undefined;
	revealedRunMapCells.clear();
	currentHiddenCaverns = [];
	currentRewardWalls = [];
	refreshRunMapWallTopology = undefined;
	lastWallExplosionSoundAt = Number.NEGATIVE_INFINITY;
}

export function teleportPlayerToGeneratedRunExit() {
	if (!currentGeneratedMap || !currentFloorExitPosition) return false;
	playerObj.pos = currentFloorExitPosition.clone();
	resetPlayerPath(playerObj.pos);
	return true;
}

export function getGeneratedRunSummary(): string {
	if (!currentGeneratedMap || currentRunSeed === undefined) {
		return "No generated run is active";
	}

	const roleCounts = ROOM_ROLES.map((role) => {
		const count = currentGeneratedMap!
			.getAllCells()
			.filter(
				(cell) =>
					cell.tags.has("room_anchor") &&
					cell.tags.has(roomRoleTag(role))
			).length;
		return `${role}: ${count}`;
	});
	const resourceCount = currentGeneratedMap
		.getAllCells()
		.filter((cell) => cell.tags.has("resource_node")).length;
	const hazardCount = currentGeneratedMap
		.getAllCells()
		.filter((cell) => cell.tags.has("hazard")).length;
	const route = getRunRouteSnapshot();
	const routeSummary = route
		? ` | Depth ${route.depth} | Visited ${route.visitedLevelKeys.join(", ")}`
		: "";
	const threat = getThreatSnapshot();
	const threatSummary = threat.active
		? ` | Threat ${getThreatRomanNumeral(threat.tier)}`
		: "";

	return `Seed ${currentRunSeed}${routeSummary}${threatSummary} | ${roleCounts.join(
		" | "
	)} | resources: ${resourceCount} | hazards: ${hazardCount}`;
}

export function getGeneratedRunMapSnapshot(): GeneratedRunMapSnapshot | undefined {
	if (!currentGeneratedMap || currentRunSeed === undefined) return undefined;
	const grid = gridRegistry.get(RUN_GRID_KEY);
	if (!grid) return undefined;

	return {
		width: currentGeneratedMap.width,
		height: currentGeneratedMap.height,
		seed: currentRunSeed,
		cells: currentGeneratedMap.getAllCells().map((cell) => ({
			q: cell.coord.q,
			r: cell.coord.r,
			solid: cell.solid,
			role: getRoomRole(cell),
			roomAnchor: cell.tags.has("room_anchor"),
			revealed: revealedRunMapCells.has(runMapCellKey(cell.coord)),
			destructible:
				cell.solid && cell.tags.has("destructible_wall"),
			volatileCargoObjective:
				currentVolatileCargoCoord !== undefined &&
				runMapCellKey(cell.coord) === runMapCellKey(currentVolatileCargoCoord),
		})),
		playerCoord: grid.screenToHex(playerObj.pos),
		playerPosition: toRunMapPosition(grid, playerObj.pos),
		playerPath: getRecentPlayerPath(playerObj.pos).map((position) =>
			toRunMapPosition(grid, position)
		),
	};
}

export function revealEntireGeneratedRunMap(): number | undefined {
	if (!currentGeneratedMap) return undefined;
	let revealedCount = 0;
	for (const cell of currentGeneratedMap.getAllCells()) {
		const key = runMapCellKey(cell.coord);
		if (revealedRunMapCells.has(key)) continue;
		revealedRunMapCells.add(key);
		revealedCount++;
	}
	return revealedCount;
}

function startRunMapExploration(
	grid: HexGrid,
	spawnCoord: { q: number; r: number }
) {
	let lastPlayerCellKey = "";
	const updateExploration = (coord: { q: number; r: number }) => {
		const key = runMapCellKey(coord);
		if (key === lastPlayerCellKey) return;
		lastPlayerCellKey = key;
		revealRunMapAround(coord);
	};

	updateExploration(spawnCoord);
	k.add([
		{
			update() {
				recordPlayerPathPosition(playerObj.pos);
				updateExploration(grid.screenToHex(playerObj.pos));
			},
		},
		tags.runMap,
		tags.gameLoop,
	]);
}

function toRunMapPosition(grid: HexGrid, worldPosition: Vec2) {
	return worldPosition
		.sub(grid.config.offset)
		.scale(1 / grid.config.hexSize);
}

function revealRunMapAround(center: { q: number; r: number }) {
	if (!currentGeneratedMap) return;
	for (
		let q = center.q - RUN_MAP_REVEAL_RADIUS;
		q <= center.q + RUN_MAP_REVEAL_RADIUS;
		q++
	) {
		for (
			let r = center.r - RUN_MAP_REVEAL_RADIUS;
			r <= center.r + RUN_MAP_REVEAL_RADIUS;
			r++
		) {
			const coord = { q, r };
			if (hexDistance(center, coord) > RUN_MAP_REVEAL_RADIUS) continue;
			if (!currentGeneratedMap.getCell(coord)) continue;
			revealedRunMapCells.add(runMapCellKey(coord));
		}
	}
}

function runMapCellKey(coord: { q: number; r: number }) {
	return `${coord.q},${coord.r}`;
}

const CAVERN_DIRECTIONS = [
	{ q: 1, r: 0 },
	{ q: 1, r: -1 },
	{ q: 0, r: -1 },
	{ q: -1, r: 0 },
	{ q: -1, r: 1 },
	{ q: 0, r: 1 },
];

function createHiddenCaverns(
	map: GenerationMap,
	seed: number,
	spawnCoord: { q: number; r: number }
) {
	const candidates: Array<HiddenCavern & { score: number }> = [];
	const rewardWallCells = map
		.getAllCells()
		.filter((cell) => cell.tags.has("reward_wall"));
	for (const entranceCell of map.getAllCells()) {
		if (!entranceCell.solid || entranceCell.locked) continue;
		if (entranceCell.tags.has("reward_wall")) continue;
		if (hexDistance(entranceCell.coord, spawnCoord) < 8) continue;
		if (
			rewardWallCells.some(
				(cell) => hexDistance(cell.coord, entranceCell.coord) < 3
			)
		) continue;

		const neighbors = hexNeighbors(entranceCell.coord);
		for (let frontIndex = 0; frontIndex < neighbors.length; frontIndex++) {
			const frontCell = map.getCell(neighbors[frontIndex]);
			if (!frontCell || frontCell.solid) continue;

			const backIndex = (frontIndex + 3) % CAVERN_DIRECTIONS.length;
			const back = CAVERN_DIRECTIONS[backIndex];
			const sideA = CAVERN_DIRECTIONS[(backIndex + 1) % 6];
			const sideB = CAVERN_DIRECTIONS[(backIndex + 5) % 6];
			const firstCell = addHexCoord(entranceCell.coord, back);
			const cavernCells = [
				firstCell,
				addHexCoord(firstCell, back),
				addHexCoord(firstCell, sideA),
				addHexCoord(firstCell, sideB),
			];
			const cavernKeys = new Set(cavernCells.map(runMapCellKey));
			if (
				cavernCells.some((coord) => {
					const cell = map.getCell(coord);
					return (
						!cell ||
						!cell.solid ||
						cell.locked ||
						cell.tags.has("reward_wall")
					);
				})
			) continue;

			const sealed = cavernCells.every((coord) =>
				hexNeighbors(coord).every((neighbor) => {
					if (cavernKeys.has(runMapCellKey(neighbor))) return true;
					if (runMapCellKey(neighbor) === runMapCellKey(entranceCell.coord)) {
						return true;
					}
					const neighborCell = map.getCell(neighbor);
					return (
						!neighborCell ||
						(neighborCell.solid && !neighborCell.tags.has("reward_wall"))
					);
				})
			);
			if (!sealed) continue;

			candidates.push({
				entrance: { ...entranceCell.coord },
				cells: cavernCells,
				opened: false,
				score: cavernHash(seed, entranceCell.coord, frontIndex),
			});
		}
	}

	const targetCount = Math.max(1, Math.min(4, Math.floor(map.width * map.height / 500)));
	const selected: HiddenCavern[] = [];
	const reserved = new Set<string>();
	for (const candidate of candidates.sort((a, b) => a.score - b.score)) {
		if (selected.length >= targetCount) break;
		const occupied = [candidate.entrance, ...candidate.cells];
		if (occupied.some((coord) => reserved.has(runMapCellKey(coord)))) continue;
		if (
			selected.some(
				(cavern) => hexDistance(cavern.entrance, candidate.entrance) < 8
			)
		) continue;

		selected.push(candidate);
		for (const coord of occupied) reserved.add(runMapCellKey(coord));
	}

	for (const cavern of selected) {
		map.getCell(cavern.entrance)?.tags.add("destructible_wall");
		for (const coord of cavern.cells) {
			const cell = map.getCell(coord);
			if (!cell) continue;
			cell.solid = false;
			cell.hardness = 0;
			cell.density = 0;
			cell.locked = true;
			cell.tags.add("hidden_cavern");
		}
	}
	return selected;
}

function getGeneratedRewardWalls(map: GenerationMap): RewardWall[] {
	return map
		.getAllCells()
		.filter((cell) => cell.tags.has("reward_wall"))
		.map((cell) => ({ coord: { ...cell.coord } }));
}

function setupDestructibleWalls(
	grid: HexGrid,
	map: GenerationMap,
	seed: number,
	depth: number
) {
	for (const cavern of currentHiddenCaverns) {
		const maxHp = 8 + depth * 2;
		cavern.wallState = registerDestructibleWall({
			gridKey: RUN_GRID_KEY,
			coord: cavern.entrance,
			maxHp,
			onDamaged: (state, impactPos) => {
				if (state.hp <= 0 || !impactPos) return;
				spawnDestructibleWallHitEffect(grid, cavern.entrance, impactPos);
			},
			onDestroyed: () => {
				cavern.opened = true;
				const entranceCell = map.getCell(cavern.entrance);
				if (entranceCell) entranceCell.solid = false;
				grid.setCell(cavern.entrance, CellType.Empty);
				refreshRunMapWallTopology?.(cavern.entrance);
				spawnDestructibleWallBreakEffects(grid, cavern.entrance, seed);
				audioService.playSound("secret_cavern_reveal", {
					volume: mainSoundVolume,
				});
				spawnHiddenCavernLoot(grid, cavern, seed);
			},
		});
	}

	for (const rewardWall of currentRewardWalls) {
		rewardWall.wallState = registerDestructibleWall({
			gridKey: RUN_GRID_KEY,
			coord: rewardWall.coord,
			maxHp: 5 + depth,
			onDamaged: (state, impactPos) => {
				if (state.hp <= 0 || !impactPos) return;
				spawnDestructibleWallHitEffect(grid, rewardWall.coord, impactPos);
			},
			onDestroyed: () => {
				const cell = map.getCell(rewardWall.coord);
				if (cell) cell.solid = false;
				grid.setCell(rewardWall.coord, CellType.Empty);
				refreshRunMapWallTopology?.(rewardWall.coord);
				spawnDestructibleWallBreakEffects(grid, rewardWall.coord, seed);
				spawnRewardWallLoot(grid, rewardWall, seed);
			},
		});
	}
}

function spawnDestructibleWallHitEffect(
	grid: HexGrid,
	coord: { q: number; r: number },
	impactPos: Vec2
) {
	const outward = impactPos.sub(grid.hexToScreen(coord));
	debreeRocketEmitter.emitter.position = impactPos;
	debreeRocketEmitter.emitter.direction =
		outward.len() > 0 ? k.Vec2.toAngle(outward) : k.rand(0, 360);
	debreeRocketEmitter.emit(6);
}

function spawnDestructibleWallBreakEffects(
	grid: HexGrid,
	coord: { q: number; r: number },
	seed: number
) {
	const pos = grid.hexToScreen(coord);
	const now = k.time();
	const isRapidRepeat =
		now - lastWallExplosionSoundAt < WALL_EXPLOSION_SOUND_REPEAT_WINDOW;
	if (!isRapidRepeat || k.chance(WALL_EXPLOSION_SOUND_REPEAT_CHANCE)) {
		audioService.playSound(randomExplosion(), { volume: subSoundVolume });
	}
	lastWallExplosionSoundAt = now;
	k.shake(3);
	spawnExplosionEffect(pos, grid.config.hexSize * 0.85);
	spawnBouncingWallDebris(grid, pos, cavernHash(seed, coord, 79));
}

function spawnBouncingWallDebris(grid: HexGrid, pos: Vec2, hash: number) {
	const shardSprites = ASTEROID_SPRITES.slice(1);
	const shardCount = 10 + (hash % 6);

	for (let index = 0; index < shardCount; index++) {
		const shardHash = cavernHash(hash, { q: index, r: shardCount }, 97);
		const angle = (shardHash % 360) + index * (360 / shardCount);
		const direction = k.Vec2.fromAngle(angle);
		const shard = k.add([
			k.pos(pos.add(direction.scale(grid.config.hexSize * 0.18))),
			k.sprite(shardSprites[shardHash % shardSprites.length]),
			k.anchor("center"),
			k.rotate(shardHash % 360),
			k.scale(0.5 + ((shardHash >> 5) % 26) / 100),
			k.opacity(1),
			k.layer(layers.game),
			{
				velocity: direction.scale(105 + ((shardHash >> 9) % 95)),
				rotationSpeed: -240 + ((shardHash >> 17) % 480),
				elapsed: 0,
				bounceCount: 0,
			},
			tags.runMap,
			tags.gameLoop,
		]);

		shard.onUpdate(() => {
			const scaledDt = k.dt() * velocityScale();
			const movement = shard.velocity.scale(scaledDt);
			const nextPos = shard.pos.add(movement);
			const collision = findWallDebrisCollision(grid, shard.pos, nextPos);

			if (collision) {
				shard.pos = collision.safePos;
				const dot = shard.velocity.dot(collision.normal);
				shard.velocity = shard.velocity
					.sub(collision.normal.scale(2 * dot))
					.scale(0.58);
				shard.bounceCount++;
			} else {
				shard.pos = nextPos;
			}

			shard.angle += shard.rotationSpeed * scaledDt;
			shard.elapsed += scaledDt;
			shard.opacity = k.clamp(1 - shard.elapsed / 1.6, 0, 1);
			if (
				shard.elapsed >= 1.6 ||
				shard.bounceCount >= 4 ||
				shard.velocity.len() < 18
			) {
				k.destroy(shard);
			}
		});
	}
}

function findWallDebrisCollision(grid: HexGrid, start: Vec2, end: Vec2) {
	const distance = start.dist(end);
	const sampleSpacing = Math.max(3, grid.config.hexSize * 0.15);
	const sampleCount = Math.max(1, Math.ceil(distance / sampleSpacing));
	let safePos = start.clone();

	for (let index = 1; index <= sampleCount; index++) {
		const samplePos = start.lerp(end, index / sampleCount);
		const coord = grid.screenToHex(samplePos);
		if (!grid.inBounds(coord) || !grid.isWalkable(coord)) {
			const normal = samplePos.sub(grid.hexToScreen(coord));
			return {
				safePos,
				normal:
					normal.len() > 0
						? normal.unit()
						: end.sub(start).unit().scale(-1),
			};
		}
		safePos = samplePos;
	}

	return undefined;
}

function spawnHiddenCavernLoot(
	grid: HexGrid,
	cavern: HiddenCavern,
	seed: number
) {
	const lootHash = cavernHash(seed, cavern.entrance, 17);
	const debrisCoord = cavern.cells[0];
	const rewardCoord = cavern.cells[cavern.cells.length - 1];
	spawnDebree(grid.hexToScreen(debrisCoord), 3 + (lootHash % 5));
	const reward = rollCrateReward(1 + (lootHash % 3));
	if (reward) {
		spawnRewardPickup(grid.hexToScreen(rewardCoord), reward, {
			stationary: true,
			label: "HIDDEN CACHE",
		});
	}
}

function spawnRewardWallLoot(
	grid: HexGrid,
	rewardWall: RewardWall,
	seed: number
) {
	const lootHash = cavernHash(seed, rewardWall.coord, 43);
	const pos = grid.hexToScreen(rewardWall.coord);
	const reward = rollCrateReward(1 + (lootHash % 2));
	if (!reward) {
		spawnDebree(pos, 4 + (lootHash % 4));
		return;
	}
	spawnRewardPickup(pos, reward, {
		stationary: true,
		label: "ROCK CACHE",
	});
}

function addHexCoord(
	a: { q: number; r: number },
	b: { q: number; r: number }
) {
	return { q: a.q + b.q, r: a.r + b.r };
}

function getRunDestructibleWallState(coord: { q: number; r: number }) {
	const key = runMapCellKey(coord);
	const cavern = currentHiddenCaverns.find(
		(candidate) => runMapCellKey(candidate.entrance) === key
	);
	if (cavern) return cavern.wallState;
	return currentRewardWalls.find(
		(candidate) => runMapCellKey(candidate.coord) === key
	)?.wallState;
}

function cavernHash(
	seed: number,
	coord: { q: number; r: number },
	salt: number
) {
	let hash = seed ^ (coord.q * 73856093) ^ (coord.r * 19349663) ^ salt;
	hash = Math.imul(hash ^ (hash >>> 16), 2246822519);
	return (hash ^ (hash >>> 13)) >>> 0;
}

function getPlayerSpawn(map: GenerationMap) {
	const spawnCell = map
		.getAllCells()
		.find((cell) => cell.tags.has("player_spawn"));

	return spawnCell?.coord ?? {
		q: Math.floor(map.width / 2),
		r: Math.floor(map.height / 2),
	};
}

function renderRunMap(grid: HexGrid, map: GenerationMap) {
	interface RockWallTile {
		center: Vec2;
		corners: Vec2[];
		typeId: string;
		connectionCount: number;
		destructible?: DestructibleWallState;
		edges: Array<{
			outline: Vec2[];
			ridge: Vec2[];
			cracks: Array<{ p1: Vec2; p2: Vec2 }>;
		}>;
	}

	interface RenderChunk {
		walls: RockWallTile[];
		cavernCovers: Array<{ corners: Vec2[]; cavern: HiddenCavern }>;
	}

	const chunks = new Map<string, RenderChunk>();
	const wallEdgeCornerIndices = [
		[0, 1],
		[5, 0],
		[4, 5],
		[3, 4],
		[2, 3],
		[1, 2],
	];

	for (const genCell of map.getAllCells()) {
		const corners = grid.getHexScreenCorners(genCell.coord);
		const chunkKey = getRunRenderChunkKey(genCell.coord.q, genCell.coord.r);
		let chunk = chunks.get(chunkKey);
		if (!chunk) {
			chunk = { walls: [], cavernCovers: [] };
			chunks.set(chunkKey, chunk);
		}
		const hiddenCavern = currentHiddenCaverns.find((cavern) =>
			cavern.cells.some(
				(coord) => runMapCellKey(coord) === runMapCellKey(genCell.coord)
			)
		);
		if (hiddenCavern) {
			chunk.cavernCovers.push({ corners, cavern: hiddenCavern });
		}
	}

	const wallVisuals = new Map<
		string,
		{ chunk: RenderChunk; visual: RockWallTile }
	>();
	const createWallVisual = (genCell: GenCell): RockWallTile => {
		const center = grid.hexToScreen(genCell.coord);
		const corners = grid.getHexScreenCorners(genCell.coord);
		const tileHash = Math.abs(
			genCell.coord.q * 73 +
				genCell.coord.r * 151 +
				(currentRunSeed ?? 0)
		);
		const neighbors = hexNeighbors(genCell.coord);
		const connectionMask = neighbors.reduce((mask, coord, index) => {
			const neighbor = map.getCell(coord);
			return !neighbor || neighbor.solid ? mask | (1 << index) : mask;
		}, 0);
		const topology = getHexWallTopology(connectionMask);
		const edges = neighbors.flatMap((_, direction) => {
			if ((connectionMask & (1 << direction)) !== 0) return [];
			const [startIndex, endIndex] = wallEdgeCornerIndices[direction];
			return [
				createRockWallEdge(
					corners[startIndex],
					corners[endIndex],
					center,
					tileHash + direction * 41,
					topology.connectionCount
				),
			];
		});
		return {
			center,
			corners,
			typeId: topology.typeId,
			connectionCount: topology.connectionCount,
			destructible: getRunDestructibleWallState(genCell.coord),
			edges,
		};
	};
	const addWallVisual = (genCell: GenCell) => {
		const chunk = chunks.get(
			getRunRenderChunkKey(genCell.coord.q, genCell.coord.r)
		);
		if (!chunk) return;
		const visual = createWallVisual(genCell);
		chunk.walls.push(visual);
		wallVisuals.set(runMapCellKey(genCell.coord), { chunk, visual });
	};

	for (const genCell of map.getAllCells()) {
		if (genCell.solid) addWallVisual(genCell);
	}

	const rebuildWallAndNeighbors = (coord: { q: number; r: number }) => {
		for (const affectedCoord of [coord, ...hexNeighbors(coord)]) {
			const key = runMapCellKey(affectedCoord);
			const existing = wallVisuals.get(key);
			if (existing) {
				const index = existing.chunk.walls.indexOf(existing.visual);
				if (index >= 0) existing.chunk.walls.splice(index, 1);
				wallVisuals.delete(key);
			}

			const genCell = map.getCell(affectedCoord);
			if (genCell?.solid) addWallVisual(genCell);
		}
	};

	let visibleWalls: RockWallTile[] = [];
	let visibleCavernCovers: Array<{
		corners: Vec2[];
		cavern: HiddenCavern;
	}> = [];
	let visibleChunkSignature = "";

	k.add([
		k.pos(0, 0),
		k.layer(layers.game2),
		{
			draw() {
				for (const visual of visibleWalls) {
					if (visual.destructible?.destroyed) continue;
					k.drawPolygon({
						pts: visual.corners,
						color: k.BLACK,
					});
					for (const edge of visual.edges) {
						drawRockPolyline(edge.outline, 2, 0.95);
						drawRockPolyline(edge.ridge, 1, 0.5);
						for (const crack of edge.cracks) {
							k.drawLine({
								p1: crack.p1,
								p2: crack.p2,
								width: 1,
								color: k.WHITE,
								opacity: 0.42,
							});
						}
					}
					if (visual.destructible) {
						drawDestructibleWallCracks(visual);
					}
				}
				for (const cover of visibleCavernCovers) {
					if (cover.cavern.opened) continue;
					k.drawPolygon({
						pts: cover.corners,
						color: k.BLACK,
					});
				}
			},
		},
		tags.runMap,
		tags.gameLoop,
	]);

	const updateVisibleChunks = () => {
		const visibleRange = getVisibleRunChunkRange(grid);
		const signature = [
			visibleRange.minChunkQ,
			visibleRange.maxChunkQ,
			visibleRange.minChunkR,
			visibleRange.maxChunkR,
		].join(":");
		if (signature === visibleChunkSignature) return;
		visibleChunkSignature = signature;

		visibleWalls = [];
		visibleCavernCovers = [];
		for (
			let chunkQ = visibleRange.minChunkQ;
			chunkQ <= visibleRange.maxChunkQ;
			chunkQ++
		) {
			for (
				let chunkR = visibleRange.minChunkR;
				chunkR <= visibleRange.maxChunkR;
				chunkR++
			) {
				const chunk = chunks.get(`${chunkQ},${chunkR}`);
				if (!chunk) continue;
				visibleWalls.push(...chunk.walls);
				visibleCavernCovers.push(...chunk.cavernCovers);
			}
		}
	};

	refreshRunMapWallTopology = (coord) => {
		rebuildWallAndNeighbors(coord);
		visibleChunkSignature = "";
		updateVisibleChunks();
	};

	k.add([
		{
			update: updateVisibleChunks,
		},
		tags.runMap,
		tags.gameLoop,
	]);
	updateVisibleChunks();
}

function createRockWallEdge(
	p1: Vec2,
	p2: Vec2,
	center: Vec2,
	hash: number,
	connectionCount: number
) {
	const edgeMidpoint = p1.add(p2).scale(0.5);
	const jaggedAmount = 0.025 + (hash % 5) * 0.008;
	const jaggedMidpoint = edgeMidpoint.lerp(center, jaggedAmount);
	const ridgeInset = 0.13 + ((hash >> 3) % 4) * 0.012;
	const ridgeStart = p1.lerp(center, ridgeInset);
	const ridgeEnd = p2.lerp(center, ridgeInset);
	const ridgeMidpoint = jaggedMidpoint.lerp(center, ridgeInset * 0.75);
	const crackStart = ridgeMidpoint.lerp(
		ridgeStart,
		0.18 + (hash % 3) * 0.13
	);
	const crackEnd = crackStart.lerp(
		center,
		0.17 + ((hash >> 2) % 3) * 0.035
	);
	const cracks = [{ p1: crackStart, p2: crackEnd }];

	if (connectionCount <= 2 && hash % 2 === 0) {
		cracks.push({
			p1: crackEnd,
			p2: crackEnd.lerp(center, 0.1).lerp(ridgeEnd, 0.08),
		});
	}

	return {
		outline: [p1, jaggedMidpoint, p2],
		ridge: [ridgeStart, ridgeMidpoint, ridgeEnd],
		cracks,
	};
}

function drawRockPolyline(points: Vec2[], width: number, opacity: number) {
	if (points.length < 2) return;
	k.drawLines({
		pts: points,
		width,
		color: k.WHITE,
		opacity,
		join: "miter",
	});
}

function drawDestructibleWallCracks(visual: {
	center: Vec2;
	corners: Vec2[];
	destructible?: DestructibleWallState;
}) {
	const state = visual.destructible;
	if (!state || state.destroyed) return;
	const damageProgress = 1 - state.hp / state.maxHp;
	const visibleCrackProgress = 0.06 + damageProgress * 0.94;
	const branchCount = Math.max(1, Math.ceil(visibleCrackProgress * 4));

	for (let index = 0; index < branchCount; index++) {
		const corner = visual.corners[(index * 2 + 1) % visual.corners.length];
		const branchEnd = visual.center.lerp(
			corner,
			0.32 + visibleCrackProgress * 0.5
		);
		const bend = visual.center
			.lerp(branchEnd, 0.52)
			.add(index % 2 === 0 ? 2 : -2, index % 3 === 0 ? -2 : 2);
		drawRockPolyline(
			[visual.center, bend, branchEnd],
			Math.max(1, visibleCrackProgress * 2),
			0.62 + visibleCrackProgress * 0.38
		);
	}
}

function getRunRenderChunkKey(q: number, r: number) {
	return `${Math.floor(q / RUN_RENDER_CHUNK_SIZE)},${Math.floor(
		r / RUN_RENDER_CHUNK_SIZE
	)}`;
}

function getVisibleRunChunkRange(grid: HexGrid) {
	const camPos = k.getCamPos();
	const camScale = k.getCamScale();
	const halfWidth = k.width() / (2 * camScale.x);
	const halfHeight = k.height() / (2 * camScale.y);
	const corners = [
		camPos.add(-halfWidth, -halfHeight),
		camPos.add(halfWidth, -halfHeight),
		camPos.add(-halfWidth, halfHeight),
		camPos.add(halfWidth, halfHeight),
	].map((corner) => grid.screenToHex(corner));
	const minQ = Math.max(
		0,
		Math.floor(Math.min(...corners.map((corner) => corner.q))) -
			RUN_RENDER_PADDING_CELLS
	);
	const maxQ = Math.min(
		grid.config.width - 1,
		Math.ceil(Math.max(...corners.map((corner) => corner.q))) +
			RUN_RENDER_PADDING_CELLS
	);
	const minR = Math.max(
		0,
		Math.floor(Math.min(...corners.map((corner) => corner.r))) -
			RUN_RENDER_PADDING_CELLS
	);
	const maxR = Math.min(
		grid.config.height - 1,
		Math.ceil(Math.max(...corners.map((corner) => corner.r))) +
			RUN_RENDER_PADDING_CELLS
	);

	return {
		minChunkQ: Math.floor(minQ / RUN_RENDER_CHUNK_SIZE),
		maxChunkQ: Math.floor(maxQ / RUN_RENDER_CHUNK_SIZE),
		minChunkR: Math.floor(minR / RUN_RENDER_CHUNK_SIZE),
		maxChunkR: Math.floor(maxR / RUN_RENDER_CHUNK_SIZE),
	};
}

function populateRunMap(
	grid: HexGrid,
	map: GenerationMap,
	hexSize: number,
	seed: number,
	depth: number
) {
	for (const cell of map.getAllCells()) {
		if (!cell.tags.has("room_anchor")) continue;
		const role = getRoomRole(cell);
		if (!role || role === "spawn") continue;
		const content = selectGeneratedContent(role, seed, cell.coord, depth);
		if (!content) continue;
		const pos = getDisplacedContentPosition(
			grid.hexToScreen(cell.coord),
			cell.coord,
			hexSize,
			seed,
			content.id
		);
		spawnGeneratedContent(
			content.id,
			grid,
			map,
			cell.coord,
			pos,
			hexSize,
			depth
		);
	}

	for (const cell of map.getAllCells()) {
		if (cell.solid) continue;
		for (const slot of ["resource_node", "hazard"] as const) {
			if (!cell.tags.has(slot)) continue;
			const content = selectGeneratedContent(slot, seed, cell.coord, depth);
			if (!content) continue;
			const pos = getDisplacedContentPosition(
				grid.hexToScreen(cell.coord),
				cell.coord,
				hexSize,
				seed,
				content.id
			);
			spawnGeneratedContent(
				content.id,
				grid,
				map,
				cell.coord,
				pos,
				hexSize,
				depth
			);
		}
	}

	if (depth === 1 && !session.volatileCargoActive) {
		const cargoCell = selectVolatileCargoCell(map, seed);
		if (cargoCell) {
			currentVolatileCargoCoord = { ...cargoCell.coord };
			spawnVolatileCargoObjective({
				pos: getDisplacedContentPosition(
					grid.hexToScreen(cargoCell.coord),
					cargoCell.coord,
					hexSize,
					seed,
					"volatile_cargo_objective"
				),
				onCollect: () => {
					currentVolatileCargoCoord = undefined;
				},
				tags: [tags.runMap],
			});
		}
	}
}

function selectVolatileCargoCell(map: GenerationMap, seed: number) {
	const spawnCell = map
		.getAllCells()
		.find((cell) => cell.tags.has("player_spawn"));
	const exitCell = map
		.getAllCells()
		.find((cell) => cell.tags.has(roomRoleTag("exit")));
	if (!spawnCell) return undefined;

	return map
		.getAllCells()
		.filter((cell) => {
			if (cell.solid || cell.locked || getRoomRole(cell)) return false;
			if (cell.tags.has("resource_node") || cell.tags.has("hazard")) {
				return false;
			}
			if (hexDistance(cell.coord, spawnCell.coord) < 10) return false;
			if (exitCell && hexDistance(cell.coord, exitCell.coord) < 7) return false;
			return true;
		})
		.sort(
			(a, b) =>
				cavernHash(seed, a.coord, 7127) -
				cavernHash(seed, b.coord, 7127)
		)[0];
}

function getDisplacedContentPosition(
	cellCenter: Vec2,
	coord: { q: number; r: number },
	hexSize: number,
	seed: number,
	contentId: GeneratedContentId | "volatile_cargo_objective"
) {
	let contentSalt = 0;
	for (let index = 0; index < contentId.length; index++) {
		contentSalt = Math.imul(contentSalt ^ contentId.charCodeAt(index), 31);
	}
	const hash = cavernHash(seed, coord, contentSalt);
	const angle = hash % 360;
	const distanceFactor = 0.12 + ((hash >>> 9) % 1000) / 1000 * 0.68;
	return cellCenter.add(
		k.Vec2.fromAngle(angle).scale(hexSize * distanceFactor)
	);
}

function spawnGeneratedContent(
	contentId: GeneratedContentId,
	grid: HexGrid,
	map: GenerationMap,
	coord: { q: number; r: number },
	pos: Vec2,
	hexSize: number,
	depth: number
) {
	switch (contentId) {
		case "combat_assassins":
			spawnCombatRoomTrigger(pos, hexSize);
			return;
		case "reward_chest":
			spawnChest(pos, depth);
			return;
		case "asteroid_field":
			spawnAsteroidFieldTrigger(grid, map, coord, pos, hexSize);
			return;
		case "capture_shrine":
			const shrineConfig = getShrineLevelConfig(depth, hexSize);
			spawnShrine({
				pos,
				radius: shrineConfig.radius,
				captureTime: shrineConfig.captureTime,
				level: shrineConfig.level,
				enemySpawnDelay: shrineConfig.enemySpawnDelay,
				enemySpawnInterval: shrineConfig.enemySpawnInterval,
				enemySpawnDistance: shrineConfig.enemySpawnDistance,
				enemySpawnSpacing: shrineConfig.enemySpawnSpacing,
				onComplete: spawnShrineReward,
				tags: [tags.runMap],
			});
			return;
		case "damage_shrine":
			spawnDamageShrine({
				pos,
				health: 18 + depth * 5,
				depleteRate: 2 + depth * 0.25,
				onComplete: spawnShrineReward,
				tags: [tags.runMap],
			});
			return;
		case "rift_junction":
			spawnRiftJunction({
				pos,
				destinations: selectRiftDestinations(grid, map, coord),
				tags: [tags.runMap],
			});
			return;
		case "repair_station":
			spawnDroneRepairZone({
				pos,
				depth,
				hexSize,
				tags: [tags.runMap],
			});
			return;
		case "gravity_anomaly":
			spawnGravityAnomaly({
				pos,
				radius: hexSize * 4,
				strength: 58 + depth * 7,
				tags: [tags.runMap],
			});
			return;
		case "minefield":
			spawnMinefield({
				pos,
				radius: hexSize * 3.2,
				count: 9 + depth * 2,
				damage: 1 + Math.floor((depth - 1) / 3),
				seed: cavernHash(currentRunSeed ?? depth, coord, 9191),
				tags: [tags.runMap],
			});
			return;
		case "lost_convoy":
			spawnLostConvoy({
				pos,
				health: 6 + depth * 2,
				enemySpacing: hexSize,
				getDestination: () => currentFloorExitPosition?.clone(),
				onComplete: spawnShrineReward,
				tags: [tags.runMap],
			});
			return;
		case "signal_relay":
			spawnSignalRelay({
				pos,
				nodeRadius: hexSize * 0.8,
				nodeCaptureTime: 1.8 + depth * 0.2,
				enemySpacing: hexSize,
				onComplete: (relayPos) => {
					revealEntireGeneratedRunMap();
					spawnShrineReward(relayPos);
				},
				tags: [tags.runMap],
			});
			return;
		case "salvage_crate":
			spawnCrate({
				pos,
				am: 2 + Math.floor(depth / 2),
				hp: 3 + depth,
				powerupMultiplier: 0.35,
				speed: 0,
				destroyOffscreen: false,
				tags: [tags.runMap],
			});
			return;
		case "slow_field":
			spawnTimescaleZone({
				pos,
				radius: hexSize * 0.7,
				timescaleValue: 0.55,
				tags: [tags.runMap],
			});
			return;
		case "floor_exit":
			spawnFloorExit(pos);
			return;
		case "milestone_boss":
			spawnBossRoomTrigger(pos, hexSize, depth);
	}
}

function spawnShrineReward(pos: Vec2) {
	const reward = rollCrateReward(2);
	if (!reward) return;
	spawnRewardPickup(pos, reward, {
		stationary: true,
		armWhenPlayerLeaves: true,
	});
}

function selectRiftDestinations(
	grid: HexGrid,
	map: GenerationMap,
	origin: { q: number; r: number }
) {
	const seed = currentRunSeed ?? 1;
	return map
		.getAllCells()
		.filter(
			(cell) =>
				!cell.solid &&
				!cell.tags.has("room_anchor") &&
				hexDistance(origin, cell.coord) >= 12
		)
		.sort(
			(a, b) =>
				cavernHash(seed, a.coord, 4817) - cavernHash(seed, b.coord, 4817)
		)
		.slice(0, 3)
		.map((cell) => grid.hexToScreen(cell.coord));
}

function spawnFloorExit(pos: Vec2) {
	currentFloorExitPosition = pos.clone();
	let portalReady = false;
	let previousPhase = getRunPhase();
	let rampShakeCooldown = 0;
	const gravity = spawnGravityPull({
		pos,
		falloff: 1,
		visualizePull: true,
		targetTags: [
			tags.unit,
			tags.friendly,
			tags.enemy,
			tags.debree,
			tags.projectile,
		],
		tagStrengthMultipliers: {
			[tags.projectile]: 3,
		},
	});
	const portal = spawnLevel({
		pos,
		levelName: "level1",
		visual: "wormhole",
		label: "ACTIVATE EXIT",
		portalState: "dormant",
		onEnter: (_portal, selectLevel, cancel) => {
			if (getRunPhase() !== "exitReady") {
				if (activateRunFinale()) {
					const transitionSeconds = Math.ceil(
						getRunFinaleTransitionSecondsRemaining()
					);
					portal.setPortalState(
						"charging",
						transitionSeconds > 0
							? `WARP CHARGING ${transitionSeconds}`
							: "SURVIVE"
					);
					k.flash(k.WHITE, 0.22);
					explosionEmitter.emitter.position = portal.pos.clone();
					explosionEmitter.emit(44);
					starsEmitter.emitter.position = portal.pos.clone();
					starsEmitter.emit(28);
				}
				cancel();
				return;
			}
			const nextFloor = advanceRunSession();
			selectLevel(nextFloor?.levelKey ?? "hub");
		},
	});

	portal.onUpdate(() => {
		const phase = getRunPhase();
		if (phase === "transition") {
			const progress = getRunFinaleRampProgress();
			const easedProgress = progress * progress * (3 - 2 * progress);
			portal.setPortalProgress(progress);
			gravity.radius = k.lerp(36, 280, easedProgress);
			gravity.strength = k.lerp(8, 125, easedProgress);
			rampShakeCooldown -= k.dt();
			if (progress > 0 && rampShakeCooldown <= 0) {
				k.shake(k.lerp(0.25, 6, progress * progress));
				rampShakeCooldown = k.lerp(0.16, 0.035, progress);
			}
			portal.setPortalState(
				"charging",
				`WARP CHARGING ${Math.max(
					1,
					Math.ceil(getRunFinaleTransitionSecondsRemaining())
				)}`
			);
		}
		if (phase === "finale") {
			if (previousPhase === "transition") {
				k.shake(9);
				k.flash(k.WHITE, 0.85);
			}
			portal.setPortalProgress(0);
			portal.setPortalState("dormant", "SURVIVE");
			gravity.radius = 36;
			gravity.strength = 8;
		}
		if (phase === "exitReady") {
			portal.setPortalProgress(1);
		}
		previousPhase = phase;
		if (portalReady || phase !== "exitReady") return;
		portalReady = true;
		portal.setPortalProgress(1);
		k.flash(k.WHITE, 0.65);
		portal.setPortalState("active", "NEXT LEVEL");
		k.shake(5);
	});
	portal.onDestroy(() => {
		if (gravity.exists()) k.destroy(gravity);
	});
}

function spawnCargoDeliveryIndicator() {
	const indicator = k.add([
		k.pos(playerObj.pos.clone()),
		k.rotate(0),
		k.opacity(0),
		k.z(40),
		k.layer(layers.game),
		{
			draw() {
				const pulse = k.wave(0.92, 1.08, k.time() * 5);
				const color = k.rgb(255, 155, 55);
				k.drawCircle({
					pos: k.vec2(0),
					radius: 11 * pulse,
					color,
					opacity: this.opacity * 0.14,
					anchor: "center",
				});
				k.drawPolygon({
					pts: [
						k.vec2(-8, -5),
						k.vec2(2, -5),
						k.vec2(2, -9),
						k.vec2(13, 0),
						k.vec2(2, 9),
						k.vec2(2, 5),
						k.vec2(-8, 5),
					],
					color,
					opacity: this.opacity,
					outline: {
						width: 1,
						color: k.WHITE,
						opacity: this.opacity * 0.8,
					},
				});
			},
		},
		tags.runMap,
		tags.gameLoop,
	]);

	indicator.onUpdate(() => {
		const shouldShow =
			session.volatileCargoActive &&
			session.volatileCargoIntact &&
			!session.volatileCargoDelivered &&
			currentFloorExitPosition !== undefined;
		if (!shouldShow || !currentFloorExitPosition) {
			indicator.opacity = 0;
			return;
		}

		const towardExit = currentFloorExitPosition.sub(playerObj.pos);
		if (towardExit.len() <= 24) {
			indicator.opacity = 0;
			return;
		}

		const direction = towardExit.unit();
		const orbitRadius = k.wave(42, 46, k.time() * 3.5);
		indicator.pos = playerObj.pos.add(direction.scale(orbitRadius));
		indicator.angle = direction.angle();
		indicator.opacity = k.wave(0.72, 1, k.time() * 4.5);
	});
}

function spawnBossRoomTrigger(pos: Vec2, hexSize: number, depth: number) {
	let triggered = false;
	const trigger = k.add([
		k.pos(pos),
		{ triggerRadius: hexSize * 4 },
		tags.runMap,
		tags.gameLoop,
	]);

	trigger.onUpdate(() => {
		if (triggered || trigger.pos.dist(playerObj.pos) > trigger.triggerRadius) {
			return;
		}
		triggered = true;
		spawnBoss1(pos, 10 + depth * 2, 60 + depth * 20, 1, {
			onDefeated: spawnFloorExit,
			tags: [tags.runMap],
		});
		k.destroy(trigger);
	});
}

function isMilestoneBossFloor(depth: number) {
	return depth > 0 && depth % 3 === 0;
}

function promoteExitToBossRoom(map: GenerationMap) {
	for (const cell of map.getAllCells()) {
		if (!cell.tags.has(roomRoleTag("exit"))) continue;
		cell.tags.delete(roomRoleTag("exit"));
		cell.tags.add(roomRoleTag("boss"));
	}
}

function spawnAsteroidFieldTrigger(
	grid: HexGrid,
	map: GenerationMap,
	anchorCoord: { q: number; r: number },
	pos: Vec2,
	hexSize: number
) {
	let triggered = false;
	const trigger = k.add([
		k.pos(pos),
		{
			triggerRadius: hexSize * 6,
		},
		tags.runMap,
		tags.gameLoop,
	]);

	trigger.onUpdate(() => {
		if (triggered || trigger.pos.dist(playerObj.pos) > trigger.triggerRadius) {
			return;
		}

		triggered = true;
		const fieldCells = map
			.getAllCells()
			.filter(
				(cell) =>
					!cell.solid &&
					cell.tags.has(roomRoleTag("asteroid")) &&
					(cell.coord.q !== anchorCoord.q || cell.coord.r !== anchorCoord.r)
			)
			.sort((a, b) => a.coord.q - b.coord.q || a.coord.r - b.coord.r);
		const threat = getThreatSnapshot();
		const baseAsteroidCount = Math.max(24, fieldCells.length);
		const asteroidCount = Math.min(
			64,
			scaleThreatSpawnCount(baseAsteroidCount)
		);
		const movingChance = 0.22 + (threat.tier - 1) * 0.07;

		for (let index = 0; index < asteroidCount; index++) {
			const cell = fieldCells[index % fieldCells.length];
			if (!cell) break;
			const hash = Math.abs(
				cell.coord.q * 73 + cell.coord.r * 151 + index * 379
			);
			const angle = ((hash % 360) * Math.PI) / 180;
			const offsetDistance = 4 + ((hash >>> 3) % 100) / 100 * hexSize * 0.3;
			const offset = k.vec2(Math.cos(angle), Math.sin(angle)).scale(
				offsetDistance
			);
			const isMoving = ((hash >>> 7) % 1000) / 1000 < movingChance;
			const moveAngle = (hash * 47) % 360;
			const moveSpeed = isMoving
				? 12 + ((hash >>> 5) % 17) + (threat.tier - 1) * 5
				: 0;
			spawnMeteorite({
				pos: grid.hexToScreen(cell.coord).add(offset),
				dir: isMoving ? k.Vec2.fromAngle(moveAngle) : k.vec2(0, 0),
				scoreOnKill: 1,
				hp: 3 + (hash % 3),
				speed: moveSpeed,
				splitOnDeath: 0,
				destroyOffscreen: false,
				tags: [tags.runMap],
				bounceGridKey: isMoving ? RUN_GRID_KEY : undefined,
			});
		}

		k.destroy(trigger);
	});
}

function spawnCombatRoomTrigger(pos: Vec2, hexSize: number) {
	let triggered = false;
	const trigger = k.add([
		k.pos(pos),
		{
			triggerRadius: hexSize * 4,
		},
		tags.runMap,
		tags.gameLoop,
	]);

	trigger.onUpdate(() => {
		if (triggered || trigger.pos.dist(playerObj.pos) > trigger.triggerRadius) {
			return;
		}
		triggered = true;
		addThreatTime(10);
		spawnThreatEncounter(pos, hexSize);
		k.destroy(trigger);
	});
}

function spawnThreatDirector(
	grid: HexGrid,
	map: GenerationMap,
	hexSize: number
) {
	const reinforcementCells = map
		.getAllCells()
		.filter((cell) => !cell.solid && !cell.tags.has("room_anchor"));
	const director = k.add([
		{
			nextReinforcement: 3,
			lastTier: 0,
		},
		tags.runMap,
		tags.gameLoop,
	]);
	const label = k.add([
		k.pos(20, 18),
		k.text("", { size: 16 }),
		k.color(255, 115, 115),
		k.fixed(),
		k.layer(layers.ui),
		tags.runMap,
		tags.gameLoopUi,
	]);

	director.onUpdate(() => {
		updateThreatLevel(k.dt());
		const threat = getThreatSnapshot();
		const filled = Math.min(5, Math.ceil(threat.progress * 5));
		label.text = `THREAT ${getThreatRomanNumeral(threat.tier)}  [${"#".repeat(filled)}${"-".repeat(5 - filled)}]`;

		if (director.lastTier !== threat.tier) {
			director.lastTier = threat.tier;
			if (threat.tier > 1) {
				label.opacity = 1;
				k.flash(k.rgb(80, 0, 0), 0.18);
			}
		}

		if (getRunPhase() !== "exploration") return;
		director.nextReinforcement -= k.dt();
		if (director.nextReinforcement > 0) return;

		const activeEnemies = k.get(tags.threatEnemy).length;
		const activeCap = 8 + threat.tier * 4;
		if (activeEnemies < activeCap) {
			const spawnPos = findThreatSpawnPosition(
				grid,
				reinforcementCells,
				hexSize
			);
			if (spawnPos) {
				spawnThreatArrival(spawnPos, hexSize);
				spawnThreatEncounter(spawnPos, hexSize);
			}
		}

		const interval = Math.max(5, 12 - threat.tier * 2);
		director.nextReinforcement = interval * k.rand(0.85, 1.15);
	});
}

function findThreatSpawnPosition(
	grid: HexGrid,
	cells: GenCell[],
	hexSize: number
) {
	const minDistance = hexSize * 8;
	const maxDistance = hexSize * 18;
	const candidates = cells.filter((cell) => {
		const distance = grid.hexToScreen(cell.coord).dist(playerObj.pos);
		return distance >= minDistance && distance <= maxDistance;
	});
	if (candidates.length === 0) return undefined;
	const cell = candidates[Math.floor(k.rand(candidates.length))];
	return grid.hexToScreen(cell.coord);
}

function spawnThreatArrival(pos: Vec2, hexSize: number) {
	k.add([
		k.pos(pos),
		k.circle(hexSize * 0.55, { fill: false }),
		k.outline(3, k.rgb(255, 70, 70)),
		k.anchor("center"),
		k.opacity(0.9),
		k.lifespan(0.8, { fade: 0.55 }),
		tags.runMap,
		tags.gameLoop,
	]);
}

function getRoomRole(cell: { tags: Set<string> }): RoomRole | undefined {
	return ROOM_ROLES.find((role) => cell.tags.has(roomRoleTag(role)));
}

export function getRoomColor(role: RoomRole) {
	switch (role) {
		case "spawn":
			return k.rgb(40, 170, 255);
		case "combat":
			return k.rgb(255, 55, 55);
		case "reward":
			return k.rgb(255, 210, 40);
		case "asteroid":
			return k.rgb(165, 185, 210);
		case "shrine":
			return k.rgb(190, 90, 255);
		case "rift":
			return k.rgb(80, 190, 255);
		case "repair":
			return k.rgb(80, 255, 135);
		case "anomaly":
			return k.rgb(155, 105, 255);
		case "minefield":
			return k.rgb(255, 105, 65);
		case "convoy":
			return k.rgb(125, 205, 255);
		case "relay":
			return k.rgb(80, 235, 225);
		case "boss":
			return k.rgb(255, 90, 190);
		case "exit":
			return k.rgb(60, 255, 110);
	}
}

export function getRoomLabel(role: RoomRole) {
	if (role === "asteroid") return "ASTEROID FIELD";
	if (role === "shrine") return "SHRINE";
	if (role === "rift") return "RIFT JUNCTION";
	if (role === "repair") return "REPAIR STATION";
	if (role === "anomaly") return "GRAVITY ANOMALY";
	if (role === "minefield") return "MINEFIELD";
	if (role === "convoy") return "LOST CONVOY";
	if (role === "relay") return "SIGNAL RELAY";
	if (role === "boss") return "BOSS ARENA";
	return role.toUpperCase();
}
