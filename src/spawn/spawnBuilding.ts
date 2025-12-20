import {
	GameObj,
	PosComp,
	SpriteComp,
	Vec2,
	AnchorComp,
	ZComp,
	Anchor,
} from "kaplay";
import { k } from "../main";
import { tags } from "../tags";
import { interactable, InteractableComp } from "../comp/interactable";

interface SpawnBuildingOptions {
	pos: Vec2;
	sprite: string;
	interactRadius?: number;
	onInteract?: () => void;
	z?: number;
	anchor?: Anchor;
	scale?: number;
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
	} = options;

	const building = k.add([
		k.pos(pos),
		k.sprite(sprite),
		k.anchor(anchor),
		k.z(z),
		k.scale(scale),
		interactable(interactRadius, onInteract),
		tags.gameLoop,
		tags.props,
	]);

	const interactPrompt = building.add([
		k.text("Space", { size: 12 }),
		k.pos(0, -40),
		k.anchor("center"),
		k.color(255, 255, 255),
		k.z(100),
		k.opacity(0),
	]);

	building.onUpdate(() => {
		const interactable = building as any;
		interactPrompt.opacity = interactable.isInRange ? 1 : 0;
	});

	return building;
}
