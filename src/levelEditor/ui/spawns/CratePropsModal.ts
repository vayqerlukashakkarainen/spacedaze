import { k } from "../../../main";
import { createInputModal } from "../Modal";
import { SpawnPlacement, updateSpawnProps } from "../../state/editorState";
import { redrawGrid } from "../../rendering/gridRenderer";

/**
 * Open modal to edit crate spawn properties
 */
export function openCratePropsModal(
	spawn: SpawnPlacement,
	onUpdate?: () => void
): void {
	const currentProps = spawn.props || { am: 10, hp: 50, powerupMultiplier: 1 };

	// For now, use a simple text input. Could be expanded to multiple fields
	const propsStr = `am:${currentProps.am},hp:${currentProps.hp},mult:${currentProps.powerupMultiplier}`;

	createInputModal(
		`Edit Crate Properties (ID: ${spawn.id})`,
		propsStr,
		(value) => {
			// Parse the input format: "am:10,hp:50,mult:1"
			const props: any = {};
			const parts = value.split(",");

			for (const part of parts) {
				const [key, val] = part.split(":");
				if (key && val) {
					const trimmedKey = key.trim();
					const numVal = parseFloat(val.trim());

					if (trimmedKey === "am") props.am = numVal || 10;
					else if (trimmedKey === "hp") props.hp = numVal || 50;
					else if (trimmedKey === "mult") props.powerupMultiplier = numVal || 1;
				}
			}

			// Set defaults if missing
			if (!props.am) props.am = 10;
			if (!props.hp) props.hp = 50;
			if (!props.powerupMultiplier) props.powerupMultiplier = 1;

			updateSpawnProps(spawn.id, props);
			redrawGrid();
			console.log(`Updated crate ${spawn.id} props:`, props);

			if (onUpdate) onUpdate();
		},
		() => {
			console.log("Crate props edit cancelled");
		}
	);
}
