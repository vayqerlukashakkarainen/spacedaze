import {
	GameObj,
	PosComp,
	SpriteComp,
	Vec2,
	AnchorComp,
	ZComp,
	Anchor,
	ScaleComp,
} from "kaplay";
import { k, layers } from "../main";
import { tags } from "../tags";
import { interactable, InteractableComp } from "../comp/interactable";
import { registerBatchedEntityUpdate } from "../services/core/entityUpdateService";
import {
	createInteractionPrompt,
	type InteractionPromptSource,
} from "../ui/common";
import { addBuildingPlayerDepth } from "../comp/buildingPlayerDepth";

interface SpawnBuildingOptions {
	pos: Vec2;
	sprite: string;
	spriteSize?: Vec2;
	interactRadius?: number;
	onInteract?: () => void;
	z?: number;
	anchor?: Anchor;
	scale?: number;
	interactPromptOffset?: Vec2;
	interactionPrompt?: InteractionPromptSource | false;
	groundShadowMode?: "default" | "ground";
	tags?: string[];
}

export function spawnBuilding(
	options: SpawnBuildingOptions
): GameObj<
	PosComp | SpriteComp | AnchorComp | ZComp | ScaleComp | InteractableComp
> {
	const {
		pos,
		sprite,
		spriteSize,
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
		groundShadowMode = "default",
		tags: objectTags = [],
	} = options;

	const building = k.add([
		k.pos(pos),
		k.sprite(sprite, spriteSize
			? { width: spriteSize.x, height: spriteSize.y }
			: {}),
		k.anchor(anchor),
		k.layer(layers.game),
		k.z(z),
		k.scale(scale),
		interactable(interactRadius, onInteract),
		{ groundShadowMode },
		tags.gameLoop,
		tags.props,
		tags.runtimeCullable,
		...objectTags,
	]);
	addBuildingPlayerDepth(building);

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
