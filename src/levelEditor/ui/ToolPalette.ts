import { Vec2 } from "kaplay";
import { k, layers } from "../../main";
import { CellType } from "../../grid/hexGrid";
import {
	editorState,
	setCurrentTool,
	setSelectedSpawn,
	EditorTool,
} from "../state/editorState";
import { updateToolLabel } from "./StatusBar";
import { createUiLabel } from "../../ui/common/label";
import { createUiButton } from "../../ui/common/button";
import { createListModal } from "./Modal";
import { uiState } from "../../ui/uiState";

/**
 * Available spawn types
 */
export const SPAWN_TYPES = [
	{ id: "crate", label: "Crate" },
	{ id: "shrine", label: "Shrine" },
	// Add more spawn types here as they're implemented
	// { id: "asteroid", label: "Asteroid" },
	// { id: "ship1", label: "Enemy Ship" },
];

/**
 * Get spawn label by ID
 */
function getSpawnLabel(id: string): string {
	const spawn = SPAWN_TYPES.find((s) => s.id === id);
	return spawn ? spawn.label : id;
}

/**
 * Create tool palette UI (right side)
 */
export function createToolPalette(paletteX: number, startY: number): number {
	let paletteY = startY;

	createUiLabel({
		pos: k.vec2(paletteX, paletteY),
		txt: "TOOLS",
		color: k.Color.fromHex("#ffffff"),
	});
	paletteY += 40;

	// Tool buttons
	addToolButton("EMPTY (E)", k.vec2(paletteX, paletteY), CellType.Empty);
	paletteY += 60;

	addToolButton("WALL (W)", k.vec2(paletteX, paletteY), CellType.Wall);
	paletteY += 60;

	addToolButton("OBSTACLE (O)", k.vec2(paletteX, paletteY), CellType.Obstacle);
	paletteY += 80;

	// Spawn tool section
	createUiLabel({
		pos: k.vec2(paletteX, paletteY),
		txt: "SPAWNS",
		color: k.Color.fromHex("#ffffff"),
	});
	paletteY += 40;

	// Spawn tool button
	addToolButton(`SPAWN (S)`, k.vec2(paletteX, paletteY), "spawn");
	paletteY += 60;

	// Spawn type selector button
	const spawnSelectBtn = createUiButton({
		pos: k.vec2(paletteX, paletteY),
		txt: `Type: ${getSpawnLabel(editorState.spawn.selectedType)}`,
		tags: ["levelEditor", "spawnSelectButton"],
		onClick: () => {
			openSpawnSelector();
		},
	});
	(spawnSelectBtn as any).isSpawnSelector = true;
	paletteY += 80;

	return paletteY;
}

/**
 * Add tool selection button
 */
function addToolButton(txt: string, pos: Vec2, tool: EditorTool) {
	const btn = createUiButton({
		pos,
		txt,
		tags: ["levelEditor", "toolButton"],
		onClick: () => {
			setCurrentTool(tool);
			updateToolLabel();
			highlightSelectedTool();
		},
	});

	// Store tool reference on the button
	(btn as any).tool = tool;

	// Highlight if current tool
	if (editorState.currentTool === tool) {
		btn.outline.color = new k.Color(255, 255, 0);
		btn.outline.width = 3;
	}

	return btn;
}

/**
 * Highlight the selected tool button
 */
export function highlightSelectedTool(): void {
	const buttons = k.get("toolButton");

	for (const btn of buttons) {
		if ("tool" in btn && btn.outline) {
			if (btn.tool === editorState.currentTool) {
				btn.outline.color = new k.Color(255, 255, 0);
				btn.outline.width = 3;
			} else {
				btn.outline.color = new k.Color(255, 255, 255);
				btn.outline.width = 2;
			}
		}
	}
}

/**
 * Open spawn type selector modal
 */
function openSpawnSelector(): void {
	const options = SPAWN_TYPES.map((spawn) => spawn.label);

	createListModal("Select Spawn Type", options, (selectedLabel) => {
		const spawn = SPAWN_TYPES.find((s) => s.label === selectedLabel);
		if (spawn) {
			setSelectedSpawn(spawn.id);
			updateSpawnSelectorLabel();
			console.log(`Selected spawn type: ${spawn.id}`);
		}
	});
}

/**
 * Update spawn selector button label
 */
export function updateSpawnSelectorLabel(): void {
	const buttons = k.get("spawnSelectButton");
	for (const btn of buttons) {
		if ("isSpawnSelector" in btn) {
			// Find text child and update
			for (const child of btn.children) {
				if ("text" in child) {
					(child as any).text =
						`Type: ${getSpawnLabel(editorState.spawn.selectedType)}`;
					break;
				}
			}
		}
	}
}
