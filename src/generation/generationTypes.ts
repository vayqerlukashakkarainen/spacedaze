import { HexCoord } from "./hexUtils";

/**
 * Single generated cell in the procedural map
 */
export interface GenCell {
	coord: HexCoord;
	solid: boolean;
	hardness: number;
	density: number;
	regionId: number;
	tags: Set<string>;
	locked: boolean;
}

/**
 * Complete generation map - single source of truth
 */
export class GenerationMap {
	width: number;
	height: number;
	cells: Map<string, GenCell>;

	constructor(width: number, height: number) {
		this.width = width;
		this.height = height;
		this.cells = new Map();
	}

	/**
	 * Get cell at coordinate
	 */
	getCell(coord: HexCoord): GenCell | undefined {
		return this.cells.get(this.coordKey(coord));
	}

	/**
	 * Set cell data
	 */
	setCell(coord: HexCoord, cell: GenCell): void {
		this.cells.set(this.coordKey(coord), cell);
	}

	/**
	 * Check if coordinate is within bounds
	 */
	inBounds(coord: HexCoord): boolean {
		return (
			coord.q >= 0 &&
			coord.q < this.width &&
			coord.r >= 0 &&
			coord.r < this.height
		);
	}

	/**
	 * Get all cells as array
	 */
	getAllCells(): GenCell[] {
		return Array.from(this.cells.values());
	}

	/**
	 * Coordinate to string key
	 */
	private coordKey(coord: HexCoord): string {
		return `${coord.q},${coord.r}`;
	}
}

/**
 * Configuration for cave generation
 */
export interface CaveGenConfig {
	// Pass 1: Initial Fill
	fill: {
		percentage: number; // 0.0 - 1.0, recommended 0.45-0.55
		edgesSolid: boolean; // Force edges to be solid
	};

	// Pass 2: Cellular Automata
	ca: {
		iterations: number; // Typically 4-6
		birthThreshold: number; // Neighbors needed to become solid (4-5)
		survivalThreshold: number; // Neighbors needed to stay solid (3-4)
	};

	// Pass 4: Connectivity
	connectivity: {
		ensureConnected: boolean;
		minRegionSize: number; // Regions smaller than this get filled
		tunnelWidth: number; // Cells wide for carved tunnels
	};

	// Pass 5: Stamps
	stamps: {
		enabled: boolean;
		count: number; // Number of stamps to place
		minSpacing: number; // Minimum distance between stamps
	};

	// Pass 6: Material Assignment
	materials: {
		edgeHardnessBonus: number; // Extra hardness at edges (0.0-1.0)
		depthHardnessScale: number; // Hardness increases with depth
		baseDensity: number; // Base matter density
	};

	// Pass 7: Feature Tagging
	features: {
		resourceNodeCount: number;
		hazardCount: number;
		minPoiSpacing: number; // Minimum distance between POIs
	};
}

/**
 * Default configuration
 */
export const DEFAULT_CAVE_CONFIG: CaveGenConfig = {
	fill: {
		percentage: 0.48,
		edgesSolid: true,
	},
	ca: {
		iterations: 5,
		birthThreshold: 4,
		survivalThreshold: 3,
	},
	connectivity: {
		ensureConnected: true,
		minRegionSize: 10,
		tunnelWidth: 2,
	},
	stamps: {
		enabled: true,
		count: 3,
		minSpacing: 8,
	},
	materials: {
		edgeHardnessBonus: 0.3,
		depthHardnessScale: 0.1,
		baseDensity: 1.0,
	},
	features: {
		resourceNodeCount: 5,
		hazardCount: 3,
		minPoiSpacing: 6,
	},
};
