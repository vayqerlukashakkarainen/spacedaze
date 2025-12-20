import { Color, GameObj, Vec2 } from "kaplay";
import { k } from "../main";
import {
	HexCoord,
	hexCorners,
	hexNeighbors,
	hexToPixel,
	hexToString,
	pixelToHex,
} from "./hexCoord";

/**
 * Cell types for hex grid
 */
export enum CellType {
	Empty = "empty",
	Wall = "wall",
	Obstacle = "obstacle",
}

/**
 * Single hex cell data
 */
export interface HexCell {
	coord: HexCoord;
	type: CellType;
	color: Color;
	layer: number;
	entities: GameObj[]; // For spatial partitioning
}

/**
 * Grid configuration
 */
export interface HexGridConfig {
	width: number; // Number of hexes wide
	height: number; // Number of hexes tall
	hexSize: number; // Radius of each hex in pixels
	offset: Vec2; // Screen offset for grid origin
}

/**
 * Hexagonal grid manager
 */
export class HexGrid {
	config: HexGridConfig;
	cells: Map<string, HexCell>;
	layers: number;
	currentLayer: number;

	constructor(config: HexGridConfig, layers: number = 1) {
		this.config = config;
		this.cells = new Map();
		this.layers = layers;
		this.currentLayer = 0;
		this.generateEmpty();
	}

	/**
	 * Generate empty grid
	 */
	generateEmpty(): void {
		this.cells.clear();

		// Use offset coordinates for rectangular grid generation
		for (let row = 0; row < this.config.height; row++) {
			const rowOffset = Math.floor(row / 2);
			for (let col = -rowOffset; col < this.config.width - rowOffset; col++) {
				const coord: HexCoord = { q: col, r: row };
				// Generate cells for all layers
				for (let layer = 0; layer < this.layers; layer++) {
					this.setCell(coord, CellType.Empty, layer);
				}
			}
		}
	}

	/**
	 * Get cell key with layer
	 */
	private getCellKey(coord: HexCoord, layer: number): string {
		return `${hexToString(coord)}_L${layer}`;
	}

	/**
	 * Set cell type at coordinate and layer
	 */
	setCell(coord: HexCoord, type: CellType, layer?: number): void {
		const targetLayer = layer !== undefined ? layer : this.currentLayer;
		const key = this.getCellKey(coord, targetLayer);
		const existing = this.cells.get(key);

		if (existing) {
			existing.type = type;
			existing.color = this.getCellColor(type);
		} else {
			this.cells.set(key, {
				coord,
				type,
				color: this.getCellColor(type),
				layer: targetLayer,
				entities: [],
			});
		}
	}

	/**
	 * Get cell at coordinate on current layer
	 */
	getCell(coord: HexCoord, layer?: number): HexCell | undefined {
		const targetLayer = layer !== undefined ? layer : this.currentLayer;
		return this.cells.get(this.getCellKey(coord, targetLayer));
	}

	/**
	 * Get all cells at coordinate across all layers
	 */
	getCellsAtCoord(coord: HexCoord): HexCell[] {
		const cells: HexCell[] = [];
		for (let layer = 0; layer < this.layers; layer++) {
			const cell = this.getCell(coord, layer);
			if (cell) {
				cells.push(cell);
			}
		}
		return cells;
	}

	/**
	 * Check if coordinate is within grid bounds
	 */
	inBounds(coord: HexCoord): boolean {
		// Check if any layer has this coordinate
		return this.cells.has(this.getCellKey(coord, 0));
	}

	/**
	 * Set current active layer
	 */
	setCurrentLayer(layer: number): void {
		if (layer >= 0 && layer < this.layers) {
			this.currentLayer = layer;
		}
	}

	/**
	 * Add a new layer to the grid
	 */
	addLayer(): void {
		const newLayer = this.layers;
		this.layers++;

		// Generate empty cells for the new layer
		for (let row = 0; row < this.config.height; row++) {
			const rowOffset = Math.floor(row / 2);
			for (let col = -rowOffset; col < this.config.width - rowOffset; col++) {
				const coord: HexCoord = { q: col, r: row };
				this.setCell(coord, CellType.Empty, newLayer);
			}
		}
	}

	/**
	 * Check if cell is walkable (for pathfinding) on current layer
	 */
	isWalkable(coord: HexCoord, layer?: number): boolean {
		const cell = this.getCell(coord, layer);
		if (!cell) return false;
		return cell.type === CellType.Empty;
	}

	/**
	 * Get cell color based on type
	 */
	getCellColor(type: CellType): Color {
		switch (type) {
			case CellType.Empty:
				return k.Color.fromHex("#000000");
			case CellType.Wall:
				return k.Color.fromHex("#FFFFFF");
			case CellType.Obstacle:
				return k.Color.fromHex("#888888");
			default:
				return k.Color.fromHex("#FF00FF");
		}
	}

	/**
	 * Get all neighbor cells on current layer
	 */
	getNeighbors(coord: HexCoord, layer?: number): HexCell[] {
		const neighbors: HexCell[] = [];
		const targetLayer = layer !== undefined ? layer : this.currentLayer;
		for (const neighborCoord of hexNeighbors(coord)) {
			const cell = this.getCell(neighborCoord, targetLayer);
			if (cell) {
				neighbors.push(cell);
			}
		}
		return neighbors;
	}

	/**
	 * Convert hex coordinate to screen position
	 */
	hexToScreen(coord: HexCoord): Vec2 {
		const pixel = hexToPixel(coord, this.config.hexSize);
		return k.vec2(
			pixel.x + this.config.offset.x,
			pixel.y + this.config.offset.y
		);
	}

	/**
	 * Convert screen position to hex coordinate
	 */
	screenToHex(screen: Vec2): HexCoord {
		const localPixel = k.vec2(
			screen.x - this.config.offset.x,
			screen.y - this.config.offset.y
		);
		return pixelToHex(localPixel, this.config.hexSize);
	}

	/**
	 * Get hex corners in screen space
	 */
	getHexScreenCorners(coord: HexCoord): Vec2[] {
		const corners = hexCorners(coord, this.config.hexSize);
		return corners.map((c) =>
			k.vec2(c.x + this.config.offset.x, c.y + this.config.offset.y)
		);
	}

	/**
	 * Add entity to cell for spatial partitioning
	 */
	addEntityToCell(coord: HexCoord, entity: GameObj, layer?: number): void {
		const cell = this.getCell(coord, layer);
		if (cell && !cell.entities.includes(entity)) {
			cell.entities.push(entity);
		}
	}

	/**
	 * Remove entity from cell
	 */
	removeEntityFromCell(coord: HexCoord, entity: GameObj, layer?: number): void {
		const cell = this.getCell(coord, layer);
		if (cell) {
			const index = cell.entities.indexOf(entity);
			if (index !== -1) {
				cell.entities.splice(index, 1);
			}
		}
	}

	/**
	 * Get all entities in cell and neighboring cells on current layer
	 */
	getEntitiesNear(coord: HexCoord, layer?: number): GameObj[] {
		const entities: GameObj[] = [];
		const targetLayer = layer !== undefined ? layer : this.currentLayer;

		// Current cell
		const currentCell = this.getCell(coord, targetLayer);
		if (currentCell) {
			entities.push(...currentCell.entities);
		}

		// Neighbor cells
		for (const neighbor of this.getNeighbors(coord, targetLayer)) {
			entities.push(...neighbor.entities);
		}

		return entities;
	}

	/**
	 * Clear all entities from all cells
	 */
	clearAllEntities(): void {
		for (const cell of this.cells.values()) {
			cell.entities = [];
		}
	}

	/**
	 * Get all cells as array (optionally filter by layer)
	 */
	getAllCells(layer?: number): HexCell[] {
		if (layer !== undefined) {
			return Array.from(this.cells.values()).filter(
				(cell) => cell.layer === layer
			);
		}
		return Array.from(this.cells.values());
	}

	/**
	 * Get all cells on current layer
	 */
	getCurrentLayerCells(): HexCell[] {
		return this.getAllCells(this.currentLayer);
	}

	/**
	 * Get grid bounds in screen space
	 */
	getScreenBounds(): {
		minX: number;
		maxX: number;
		minY: number;
		maxY: number;
	} {
		let minX = Infinity;
		let maxX = -Infinity;
		let minY = Infinity;
		let maxY = -Infinity;

		for (const cell of this.cells.values()) {
			const corners = this.getHexScreenCorners(cell.coord);
			for (const corner of corners) {
				minX = Math.min(minX, corner.x);
				maxX = Math.max(maxX, corner.x);
				minY = Math.min(minY, corner.y);
				maxY = Math.max(maxY, corner.y);
			}
		}

		return { minX, maxX, minY, maxY };
	}

	/**
	 * Inject a pattern into the grid at an offset position
	 * @param pattern - Pattern with relative coordinates
	 * @param offset - Where to place the pattern origin
	 */
	injectPattern(pattern: Record<string, CellType>, offset: HexCoord): void {
		for (const [coordStr, cellType] of Object.entries(pattern)) {
			const [q, r] = coordStr.split(",").map(Number);
			const targetCoord: HexCoord = {
				q: q + offset.q,
				r: r + offset.r,
			};

			// Only set cell if it's within bounds
			if (this.inBounds(targetCoord)) {
				this.setCell(targetCoord, cellType);
			}
		}
	}

	/**
	 * Clear all cells back to empty (optionally on specific layer)
	 */
	clearCells(layer?: number): void {
		if (layer !== undefined) {
			for (const cell of this.cells.values()) {
				if (cell.layer === layer) {
					cell.type = CellType.Empty;
					cell.color = this.getCellColor(CellType.Empty);
				}
			}
		} else {
			for (const cell of this.cells.values()) {
				cell.type = CellType.Empty;
				cell.color = this.getCellColor(CellType.Empty);
			}
		}
	}
}
