import { SpawnPlacement } from "../../state/editorState";
import { openCratePropsModal } from "./CratePropsModal";
import { openShrinePropsModal } from "./ShrinePropsModal";

/**
 * Open the appropriate property modal for a spawn type
 */
export function openSpawnPropsModal(
	spawn: SpawnPlacement,
	onUpdate?: () => void
): void {
	switch (spawn.type) {
		case "crate":
			openCratePropsModal(spawn, onUpdate);
			break;
		case "shrine":
			openShrinePropsModal(spawn, onUpdate);
			break;
		default:
			console.warn(`No property modal for spawn type: ${spawn.type}`);
			break;
	}
}
