import { updateVisibleCells } from "../levelEditor/rendering/hexCulling";
import { HexGrid } from "./hexGrid";

/**
 * Global registry for hex grids
 * Allows components to reference grids by key
 */
class GridRegistry {
	private grids: Map<string, HexGrid>;

	constructor() {
		this.grids = new Map();
	}

	/**
	 * Register a grid with a key
	 */
	register(key: string, grid: HexGrid): void {
		this.grids.set(key, grid);
	}

	updateVisibleCells() {
		this.grids.forEach((grid) => {
			updateVisibleCells(grid);
		});
	}

	/**
	 * Get a grid by key
	 */
	get(key: string): HexGrid | undefined {
		return this.grids.get(key);
	}

	/**
	 * Check if a grid exists
	 */
	has(key: string): boolean {
		return this.grids.has(key);
	}

	/**
	 * Unregister a grid
	 */
	unregister(key: string): void {
		this.grids.delete(key);
	}

	/**
	 * Clear all grids
	 */
	clear(): void {
		this.grids.clear();
	}

	/**
	 * Get all registered grid keys
	 */
	getKeys(): string[] {
		return Array.from(this.grids.keys());
	}
}

/**
 * Global singleton instance
 */
export const gridRegistry = new GridRegistry();
