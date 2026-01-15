# Cave Generator

Procedural, deterministic, multipass hex-based cave generation system for SpaceDaze.

## Features

- **Pure data generation** - No rendering, engine-agnostic
- **Fully deterministic** - Same seed = same output
- **Multipass pipeline** - 7 sequential generation passes
- **Hex grid native** - Uses axial coordinates with pointy-top orientation
- **Destructible terrain ready** - Supports runtime modification
- **Configurable** - Fine-tune every aspect of generation

## Usage

### Quick Start

```typescript
import { generateCave } from "./generation/caveGenerator";
import { generationMapToHexGrid } from "./generation/gridConversion";

// Generate cave data
const seed = 12345;
const map = generateCave(seed, 40, 30);

// Convert to HexGrid for gameplay
const grid = generationMapToHexGrid(map, 40, 400, 300);
```

### Custom Configuration

```typescript
import { CaveGenerator } from "./generation/caveGenerator";

const config = {
	fill: { percentage: 0.5, edgesSolid: true },
	ca: { iterations: 6, birthThreshold: 5, survivalThreshold: 4 },
	stamps: { enabled: true, count: 5, minSpacing: 10 },
};

const generator = new CaveGenerator(seed, config);
const map = generator.generate(50, 40);
```

## Generation Pipeline

### Pass 1: Initial Fill

- Random solid/empty distribution using seeded RNG
- Configurable fill percentage (typically 45-55%)
- Optional edge forcing

### Pass 2: Cellular Automata

- Applies hex-neighbor CA rules for organic shapes
- Birth threshold: neighbors needed to become solid
- Survival threshold: neighbors needed to stay solid
- Multiple iterations for smoothing

### Pass 3: Region Detection

- Flood-fills empty cells to identify cave regions
- Assigns `regionId` to connected areas
- Fills small disconnected pockets
- Carves tunnels between major regions

### Pass 4: Stamp Injection

- Places predefined structures (chambers, ruins, etc.)
- Supports rotation (6 orientations)
- Respects minimum spacing
- Can lock cells from further modification

### Pass 5: Material Assignment

- Assigns `hardness` based on:
  - Distance from edges (edges harder)
  - Proximity to open space (border cells softer)
  - Depth (deeper = harder)
- Assigns `density` for resource variation

### Pass 6: Feature Tagging

- Tags cells for gameplay:
  - `player_spawn` - Starting location
  - `resource_node` - Mineable resources
  - `hazard` - Dangerous areas
  - `poi_candidate` - Points of interest
  - `tunnel`, `chamber`, `structure` - Generated features

## Data Model

### GenCell

```typescript
interface GenCell {
	coord: HexCoord; // Axial coordinates
	solid: boolean; // Wall or empty
	hardness: number; // Carving difficulty (0.1 - 5+)
	density: number; // Matter density (affects drops)
	regionId: number; // Cave region (-1 = none)
	tags: Set<string>; // Gameplay tags
	locked: boolean; // Prevent modification
}
```

### GenerationMap

```typescript
class GenerationMap {
	width: number;
	height: number;
	cells: Map<string, GenCell>;

	getCell(coord: HexCoord): GenCell | undefined;
	setCell(coord: HexCoord, cell: GenCell): void;
	inBounds(coord: HexCoord): boolean;
	getAllCells(): GenCell[];
}
```

## Debugging & Visualization

### Test Script

```bash
npx tsx src/generation/test/testGenerator.ts
```

Generates:

- `cave_*.json` - Full cell data
- `cave_*.svg` - Visual preview (open in browser)

### ASCII Preview

```typescript
import { renderASCII, getStatistics } from "./generation/debug/visualizer";

const map = generateCave(12345, 30, 20);
console.log(renderASCII(map));
console.log(getStatistics(map));
```

**ASCII Legend:**

- `█▓▒░` - Solid cells (hardness levels)
- `P` - Player spawn
- `R` - Resource node
- `H` - Hazard
- `·` - Tunnel
- `○` - Chamber
- `L` - Locked cell

## Configuration Reference

```typescript
interface CaveGenConfig {
	fill: {
		percentage: number; // 0.0-1.0, recommended 0.45-0.55
		edgesSolid: boolean; // Force edges solid
	};
	ca: {
		iterations: number; // Typically 4-6
		birthThreshold: number; // Neighbors to become solid (4-5)
		survivalThreshold: number; // Neighbors to stay solid (3-4)
	};
	connectivity: {
		ensureConnected: boolean;
		minRegionSize: number; // Fill regions smaller than this
		tunnelWidth: number; // Carved tunnel width
	};
	stamps: {
		enabled: boolean;
		count: number; // Stamps to place
		minSpacing: number; // Min distance between stamps
	};
	materials: {
		edgeHardnessBonus: number; // 0.0-1.0
		depthHardnessScale: number;
		baseDensity: number;
	};
	features: {
		resourceNodeCount: number;
		hazardCount: number;
		minPoiSpacing: number;
	};
}
```

## Gameplay Integration

### Destructible Terrain

```typescript
import { getCellGameplayData } from "./generation/gridConversion";

const map = generateCave(seed, 30, 30);
const cellData = getCellGameplayData(map);

// Find cell to mine
const target = cellData.find((c) => c.isWall && c.hardness < 2);

// Apply damage (in your game loop)
if (target) {
	const damagePerFrame = 0.1;
	target.hardness -= damagePerFrame;

	if (target.hardness <= 0) {
		// Cell destroyed - update grid
		grid.setCell(target.coord, CellType.Empty);
		// Drop resources based on density
		spawnResources(target.coord, target.density);
	}
}
```

### Spawn Placement

```typescript
// Find spawn point
const spawnCell = map.getAllCells().find((c) => c.tags.has("player_spawn"));
if (spawnCell) {
	spawnPlayer(spawnCell.coord);
}

// Find resource nodes
const resourceNodes = map
	.getAllCells()
	.filter((c) => c.tags.has("resource_node"));
for (const node of resourceNodes) {
	spawnResourceIndicator(node.coord);
}
```

## Files

```
src/generation/
├── caveGenerator.ts          # Main generator orchestrator
├── generationTypes.ts        # Data model & config
├── seededRng.ts             # Deterministic RNG
├── gridConversion.ts        # GenerationMap → HexGrid
├── examples.ts              # Usage examples
├── passes/
│   ├── initialFill.ts       # Pass 1: Random fill
│   ├── cellularAutomata.ts  # Pass 2: CA smoothing
│   ├── regionAnalysis.ts    # Pass 3: Connectivity
│   ├── materialAssignment.ts # Pass 5: Hardness/density
│   └── featureTagging.ts    # Pass 6: Gameplay tags
├── stamps/
│   └── stampSystem.ts       # Pass 4: Structure injection
├── debug/
│   └── visualizer.ts        # ASCII/SVG/JSON export
└── test/
    └── testGenerator.ts     # Test script
```

## Performance

- 40x30 grid: ~5-15ms
- 100x100 grid: ~50-100ms
- All operations O(n) where n = cell count
- Memory scales linearly with grid size

## Future Enhancements

- [ ] Biome system (ice caves, volcanic, crystal)
- [ ] Noise-based terrain variation
- [ ] Vertical connections between layers
- [ ] Dynamic difficulty zones
- [ ] Prefab room library expansion
- [ ] Winding river/chasm generation
