import {
	GameObj,
	PosComp,
	SpriteComp,
	Vec2,
	AnchorComp,
	ZComp,
	Anchor,
} from "kaplay";
import { k, layers } from "../main";
import { tags } from "../tags";
import { interactable, InteractableComp } from "../comp/interactable";
import { registerBatchedEntityUpdate } from "../services/entityUpdateService";
import {
	createInteractionPrompt,
	type InteractionPromptSource,
} from "../ui/common";

interface SpawnBuildingOptions {
	pos: Vec2;
	sprite: string;
	interactRadius?: number;
	onInteract?: () => void;
	z?: number;
	anchor?: Anchor;
	scale?: number;
	interactPromptOffset?: Vec2;
	interactionPrompt?: InteractionPromptSource | false;
}

export function spawnBuilding(
	options: SpawnBuildingOptions
): GameObj<PosComp | SpriteComp | AnchorComp | ZComp | InteractableComp> {
	const {
		pos,
		sprite,
		interactRadius = 50,
		onInteract = () => {},
		z = 0,
		anchor = "center",
		scale = 1,
		interactPromptOffset = k.vec2(0, -40),
		interactionPrompt = {
			title: "INTERACTION",
			action: "INTERACT",
		},
	} = options;

	const building = k.add([
		k.pos(pos),
		k.sprite(sprite),
		k.anchor(anchor),
		k.layer(layers.buildings),
		k.z(z),
		k.scale(scale),
		interactable(interactRadius, onInteract),
		tags.gameLoop,
		tags.props,
	]);

	const prompt = interactionPrompt === false
		? undefined
		: createInteractionPrompt({
			target: building,
			offset: interactPromptOffset,
			content: interactionPrompt,
		});

	registerBatchedEntityUpdate("world", building, () => {
		const interactable = building as any;
		prompt?.update(interactable.isInRange);
	});

	return building;
}
