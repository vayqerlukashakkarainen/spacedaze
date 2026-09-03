import { Comp, KEventController, Vec2 } from "kaplay"
import { gridRegistry } from "../grid/gridRegistry"
import { HexGrid, HexCell } from "../grid/hexGrid"
import { HexCoord, hexEqual } from "../grid/hexCoord"
import { k } from "../main"

export interface GridCollisionComp extends Comp {
	gridKey: string
	grid: HexGrid | undefined
	currentCell: HexCoord | undefined
	currentCellData: HexCell | undefined
	lastValidPos: Vec2 | undefined
	enabled: boolean

	// Get current cell coordinate
	getCurrentCell(): HexCoord | undefined

	// Get current cell data (for buffs/effects)
	getCellProperties(): HexCell | undefined

	// Check if next position would be walkable
	canMoveTo(nextPos: Vec2): boolean

	// Check if currently on walkable cell
	isOnWalkableCell(): boolean

	// Event when collision occurs
	onGridCollide(callback: (cell: HexCell) => void): KEventController
}

/**
 * Grid collision component
 * Prevents entities from moving into non-walkable cells
 * Automatically updates spatial partitioning
 * 
 * @param gridKey - Key to lookup grid in gridRegistry
 */
export function gridCollision(gridKey: string): GridCollisionComp {
	let originalMove: ((x: number | Vec2, y?: number) => void) | undefined
	let hasOverriddenMove = false

	return {
		id: "gridCollision",
		require: ["pos"],
		gridKey,
		grid: undefined,
		currentCell: undefined,
		currentCellData: undefined,
		lastValidPos: undefined,
		enabled: true,

		add() {
			// Try to get grid from registry
			this.grid = gridRegistry.get(this.gridKey)

			if (!this.grid) {
				console.warn(
					`[gridCollision] Grid "${this.gridKey}" not found in registry. Component disabled.`
				)
				this.enabled = false
				return
			}

			// Calculate initial cell position
			this.currentCell = this.grid.screenToHex(this.pos)
			this.currentCellData = this.grid.getCell(this.currentCell)
			this.lastValidPos = this.pos.clone()

			// Add entity to spatial partitioning
			if (this.currentCell) {
				this.grid.addEntityToCell(this.currentCell, this)
			}

			// Override move() method to intercept movement
			if (this.move && !hasOverriddenMove) {
				originalMove = this.move.bind(this)
				hasOverriddenMove = true

				this.move = (x: number | Vec2, y?: number) => {
					if (!this.enabled || !this.grid) {
						// Component disabled - allow free movement
						if (originalMove) {
							originalMove(x, y)
						}
						return
					}

					// Calculate next position
					let moveVec: Vec2
					if (typeof x === "number" && y !== undefined) {
						moveVec = { x, y } as Vec2
					} else if (typeof x === "object") {
						moveVec = x
					} else {
						return
					}

					const nextPos = this.pos.add(moveVec.scale(k.dt()))

					// Check if next position is walkable
					if (this.canMoveTo(nextPos)) {
						// Allow movement
						if (originalMove) {
							originalMove(moveVec)
						}
						this.lastValidPos = this.pos.clone()
					} else {
						// Collision detected - trigger event
						const nextCell = this.grid.screenToHex(nextPos)
						const nextCellData = this.grid.getCell(nextCell)

						if (nextCellData) {
							this.trigger("gridCollide", nextCellData)
						}

						// Movement blocked - stay at last valid position
					}
				}
			}
		},

		update() {
			if (!this.enabled || !this.grid) return

			// Check if position changed
			if (
				!this.lastValidPos ||
				!this.pos.eq(this.lastValidPos)
			) {
				const newCell = this.grid.screenToHex(this.pos)

				// Check if we moved to a different cell
				if (
					!this.currentCell ||
					!hexEqual(this.currentCell, newCell)
				) {
					// Remove from old cell
					if (this.currentCell) {
						this.grid.removeEntityFromCell(this.currentCell, this)
					}

					// Add to new cell
					this.grid.addEntityToCell(newCell, this)

					// Update current cell data
					this.currentCell = newCell
					this.currentCellData = this.grid.getCell(newCell)
				}

				// Update last valid position
				this.lastValidPos = this.pos.clone()
			}
		},

		destroy() {
			if (!this.enabled || !this.grid) return

			// Remove from spatial partitioning
			if (this.currentCell) {
				this.grid.removeEntityFromCell(this.currentCell, this)
			}

			// Restore original move method if we overrode it
			if (originalMove) {
				this.move = originalMove
			}
		},

		getCurrentCell(): HexCoord | undefined {
			if (!this.enabled || !this.grid) return undefined
			return this.grid.screenToHex(this.pos)
		},

		getCellProperties(): HexCell | undefined {
			if (!this.enabled || !this.grid) return undefined
			
			const cell = this.getCurrentCell()
			if (!cell) return undefined

			return this.grid.getCell(cell)
		},

		canMoveTo(nextPos: Vec2): boolean {
			if (!this.enabled || !this.grid) return true

			const nextCell = this.grid.screenToHex(nextPos)
			
			// Check if cell is in bounds
			if (!this.grid.inBounds(nextCell)) return false

			// Check if cell is walkable
			return this.grid.isWalkable(nextCell)
		},

		isOnWalkableCell(): boolean {
			if (!this.enabled || !this.grid) return true

			const cell = this.getCurrentCell()
			if (!cell) return false

			return this.grid.isWalkable(cell)
		},

		onGridCollide(callback: (cell: HexCell) => void): KEventController {
			return this.on("gridCollide", callback)
		},
	}
}
