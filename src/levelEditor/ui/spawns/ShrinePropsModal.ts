import { k } from "../../../main";
import { createInputModal } from "../Modal";
import { SpawnPlacement, updateSpawnProps } from "../../state/editorState";
import { redrawGrid } from "../../rendering/gridRenderer";

/**
 * Open modal to edit shrine spawn properties
 */
export function openShrinePropsModal(
	spawn: SpawnPlacement,
	onUpdate?: () => void
): void {
	const currentProps = spawn.props || { radius: 100, captureTime: 5 };

	// Format: "radius:100,time:5"
	const propsStr = `radius:${currentProps.radius},time:${currentProps.captureTime}`;

	createInputModal(
		`Edit Shrine Properties (ID: ${spawn.id})`,
		propsStr,
		(value) => {
			// Parse the input format: "radius:100,time:5"
			const props: any = {};
			const parts = value.split(",");

			for (const part of parts) {
				const [key, val] = part.split(":");
				if (key && val) {
					const trimmedKey = key.trim();
					const numVal = parseFloat(val.trim());

					if (trimmedKey === "radius") props.radius = numVal || 100;
					else if (trimmedKey === "time") props.captureTime = numVal || 5;
				}
			}

			// Set defaults if missing
			if (!props.radius) props.radius = 100;
			if (!props.captureTime) props.captureTime = 5;

			updateSpawnProps(spawn.id, props);
			redrawGrid();
			console.log(`Updated shrine ${spawn.id} props:`, props);

			if (onUpdate) onUpdate();
		},
		() => {
			console.log("Shrine props edit cancelled");
		}
	);
}
