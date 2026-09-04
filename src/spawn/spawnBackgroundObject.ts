import { Color, GameObj, Vec2 } from "kaplay";
import { dtScaled, k, layers } from "../main";
import { tags } from "../tags";
import { profileSection } from "../services/frameProfilerService";

interface BackgroundObjectProps {
	pos: Vec2;
	sprite: string;
	scale: number;
	color: Color;
	parallaxLevel: number;
	opacity?: number;
	rotation?: number;
	rotationSpeed?: number;
	anchor?: string;
	moveTo?: Vec2;
	speed?: number;
}

const backgroundObjects = new Map<number, GameObj>();
let backgroundUpdateController: GameObj | undefined;
let lastCameraPos: Vec2 | undefined;

export function spawnBackgroundObject(props: BackgroundObjectProps): GameObj {
	// Capture initial camera position and world position as reference points
	const initialCamPos = k.getCamPos().clone();
	const initialWorldPos = props.pos.clone();

	// Default values
	const opacity = props.opacity !== undefined ? props.opacity : 1;
	const rotation = props.rotation !== undefined ? props.rotation : 0;

	// Calculate direction if moveTo is specified
	let moveDirection: Vec2 | undefined;
	const hasMovement = props.moveTo !== undefined && props.speed !== undefined;
	if (hasMovement) {
		moveDirection = props.moveTo!.sub(props.pos).unit();
	}

	// Calculate z-index based on parallax level (6c)
	// Higher parallax = further away = lower z-index
	const zIndex = -props.parallaxLevel;

	// Build component list
	const components: any[] = [
		k.pos(initialWorldPos),
		k.sprite(props.sprite),
		k.scale(props.scale),
		k.color(props.color),
		k.opacity(opacity),
		k.rotate(rotation),
		k.layer(layers.bg),
		k.z(zIndex),
		tags.levelBg,
		tags.gameLoop,
		{
			parallaxLevel: props.parallaxLevel,
			initialCamPos: initialCamPos,
			initialWorldPos: initialWorldPos,
			rotationSpeed: props.rotationSpeed || 0,
			moveDirection: moveDirection,
			moveSpeed: props.speed || 0,
			hasMovement: hasMovement,
		},
	];

	// Add offscreen destroy component if object has movement
	if (hasMovement) {
		components.push(k.offscreen({ destroy: true, distance: 400 }));
	}

	// Add anchor if specified, otherwise use center
	if (props.anchor) {
		components.push(k.anchor(props.anchor as any));
	} else {
		components.push(k.anchor("center"));
	}

	const obj = k.add(components);
	backgroundObjects.set(obj.id, obj);
	obj.onDestroy(() => backgroundObjects.delete(obj.id));
	ensureBackgroundUpdateController();

	return obj;
}

function ensureBackgroundUpdateController() {
	if (backgroundUpdateController?.exists()) return;
	lastCameraPos = k.getCamPos().clone();
	const controller = k.add([
		tags.levelBg,
		tags.gameLoop,
	]);
	backgroundUpdateController = controller;

	controller.onUpdate(() => profileSection("external:background", updateBackgroundObjects));
	controller.onDestroy(() => {
		if (backgroundUpdateController?.id === controller.id) {
			backgroundUpdateController = undefined;
			lastCameraPos = undefined;
			backgroundObjects.clear();
		}
	});
}

function updateBackgroundObjects() {
	const cameraPos = k.getCamPos();
	const cameraMoved = !lastCameraPos || cameraPos.dist(lastCameraPos) > 0.001;
	lastCameraPos = cameraPos.clone();

	for (const obj of backgroundObjects.values()) {
		if (!obj.exists()) continue;
		if (obj.hasMovement) {
			const movementDelta = obj.moveDirection.scale(
				obj.moveSpeed * dtScaled()
			);
			obj.initialWorldPos = obj.initialWorldPos.add(movementDelta);
		}

		if (obj.hasMovement || cameraMoved) {
			const cameraDelta = cameraPos.sub(obj.initialCamPos);
			const parallaxOffset = cameraDelta.scale(1 - 1 / obj.parallaxLevel);
			obj.pos = obj.initialWorldPos.add(parallaxOffset);
		}

		if (obj.rotationSpeed !== 0) {
			obj.angle += obj.rotationSpeed * dtScaled();
		}
	}
}
