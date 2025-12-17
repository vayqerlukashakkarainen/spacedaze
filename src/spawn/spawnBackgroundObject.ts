import { Color, GameObj, Vec2 } from "kaplay";
import { dtScaled, k, layers } from "../main";
import { tags } from "../tags";

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
	// Invert so closer objects render on top
	const zIndex = props.parallaxLevel;

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

	// Update position based on parallax effect and movement
	obj.onUpdate(() => {
		// Calculate parallax offset from camera movement
		const cameraDelta = k.getCamPos().sub(obj.initialCamPos);
		const parallaxOffset = cameraDelta.scale(1 / obj.parallaxLevel);

		if (obj.hasMovement) {
			// Apply movement to initial world position
			const movementDelta = obj.moveDirection.scale(obj.moveSpeed * dtScaled());
			obj.initialWorldPos = obj.initialWorldPos.add(movementDelta);

			// Final position = initial world position + movement + parallax offset
			obj.pos = obj.initialWorldPos.add(parallaxOffset);
		} else {
			// Static object: position = initial position + parallax offset
			obj.pos = obj.initialWorldPos.add(parallaxOffset);
		}

		if (obj.rotationSpeed !== 0) {
			obj.angle += obj.rotationSpeed * dtScaled();
		}
	});

	return obj;
}
