import { k } from "../../main";
import {
	editorState,
	addSpawnPlacement,
	removeSpawnPlacement,
	getSpawnPlacementById,
} from "../state/editorState";
import {
	paintCell,
	clearCell,
	updateHoveredCell,
} from "../actions/gridActions";
import { uiState } from "../../ui/uiState";
import { redrawGrid } from "../rendering/gridRenderer";
import { openSpawnPropsModal } from "../ui/spawns/SpawnPropsModal";

/**
 * Setup mouse controls for painting
 */
export function setupMouseControls(): void {
	// Mouse controls for painting
	k.onMousePress((btn) => {
		if (uiState.isOverUI) return;

		if (btn === "left") {
			editorState.mouse.isDown = true;

			// Check if clicking on a spawn marker
			const clickedSpawns = k.get("spawnClickable");
			let clickedAnySpawn = false;

			for (const spawnObj of clickedSpawns) {
				if (spawnObj.isHovering && spawnObj.isHovering()) {
					const spawnId = (spawnObj as any).spawnId;
					const spawn = getSpawnPlacementById(spawnId);
					if (spawn) {
						openSpawnPropsModal(spawn, () => redrawGrid());
						clickedAnySpawn = true;
						break;
					}
				}
			}

			// If didn't click a spawn, handle normal tool behavior
			if (!clickedAnySpawn) {
				if (editorState.currentTool === "spawn") {
					// Place spawn at exact mouse position (not snapped to grid)
					const worldPos = k.toWorld(k.mousePos());

					// Set default props based on spawn type
					let defaultProps: any;
					const spawnType = editorState.spawn.selectedType;

					if (spawnType === "crate") {
						defaultProps = { am: 10, hp: 50, powerupMultiplier: 1 };
					} else if (spawnType === "shrine") {
						defaultProps = { radius: 100, captureTime: 5 };
					}

					addSpawnPlacement(worldPos, undefined, defaultProps);
					redrawGrid(); // Redraw to show new spawn marker
					console.log(`Placed ${spawnType} at`, worldPos);
				} else {
					paintCell();
				}
			}
		} else if (btn === "right") {
			editorState.mouse.isRightDown = true;
			if (editorState.currentTool === "spawn") {
				// Remove spawn near mouse position
				const worldPos = k.toWorld(k.mousePos());
				removeSpawnPlacement(worldPos);
				redrawGrid();
			} else {
				clearCell();
			}
		}
	});

	k.onMouseRelease((btn) => {
		if (btn === "left") {
			editorState.mouse.isDown = false;
		} else if (btn === "right") {
			editorState.mouse.isRightDown = false;
		}
	});

	k.onMouseMove(() => {
		updateHoveredCell();
		if (editorState.mouse.isDown && editorState.currentTool !== "spawn") {
			paintCell();
		} else if (
			editorState.mouse.isRightDown &&
			editorState.currentTool !== "spawn"
		) {
			clearCell();
		}
	});
}
