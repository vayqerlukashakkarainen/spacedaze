import { Vec2, GameObj } from "kaplay";
import { k, layers } from "../../main";
import { uiState } from "../uiState";
import { UI_COLORS } from "./theme";
import { uiHitRegion } from "./hitRegion";
import { getUiTreeTransitionOpacity } from "./modalTransition";

interface SliderComponents {
	track: GameObj;
	handle: GameObj;
	getValue: () => number;
	setValue: (value: number) => void;
	updatePosition: () => void;
}

export interface UiSliderProps {
	pos: Vec2;
	width: number;
	value: number;
	onChange: (value: number) => void;
	handleVisible?: (screenPosition: Vec2) => boolean;
}

export function createUiSlider(
	parent: GameObj,
	{ pos, width, value, onChange, handleVisible }: UiSliderProps,
): SliderComponents {
	const trackHeight = 4;
	const handleWidth = 8;
	const handleHeight = 14;
	const interactionHeight = 18;
	const slider = parent.add([k.pos(pos)]);
	const track = slider.add([
		k.pos(0, 0),
		k.rect(width, trackHeight),
		k.color(...UI_COLORS.border),
	]);
	const trackInteraction = slider.add([
		k.pos(width / 2, trackHeight / 2),
		uiHitRegion(k.vec2(width, interactionHeight), true),
	]);
	let currentValue = k.clamp(value, 0, 1);
	const handle = k.add([
		k.pos(0, 0),
		k.rect(handleWidth, handleHeight),
		k.anchor("center"),
		k.color(...UI_COLORS.accent),
		k.opacity(0),
		k.scale(1),
		k.rotate(0),
		k.fixed(),
		k.layer(layers.ui),
		k.z(1000),
	]);

	let isDragging = false;
	const syncHandlePosition = () => {
		const screenStart = slider.toScreen(k.vec2(0, trackHeight / 2));
		const screenEnd = slider.toScreen(k.vec2(width, trackHeight / 2));
		const screenDown = slider.toScreen(
			k.vec2(0, trackHeight / 2 + handleHeight)
		);
		const trackLength = screenStart.dist(screenEnd);
		const verticalLength = screenStart.dist(screenDown);
		handle.pos = screenStart.lerp(screenEnd, currentValue);
		handle.scale = k.vec2(
			trackLength / width,
			verticalLength / handleHeight
		);
		handle.angle = k.Vec2.toAngle(screenEnd.sub(screenStart));
		handle.opacity = handleVisible?.(handle.pos) === false
			? 0
			: getUiTreeTransitionOpacity(slider);
	};
	const updateValue = (mousePosition: Vec2) => {
		currentValue = getTrackValueFromScreenPosition(
			slider,
			width,
			trackHeight / 2,
			mousePosition
		);
		syncHandlePosition();
		onChange(currentValue);
	};
	const syncHoverState = () => {
		uiState.isOverUI = isDragging || trackInteraction.isHovering();
	};

	trackInteraction.onHover(() => {
		syncHoverState();
	});
	trackInteraction.onHoverEnd(() => {
		syncHoverState();
	});
	const pressController = k.onMousePress("left", () => {
		if (!trackInteraction.isHovering()) return;
		isDragging = true;
		updateValue(k.mousePos());
		syncHoverState();
	});
	const releaseController = k.onMouseRelease(() => {
		isDragging = false;
		syncHoverState();
	});
	const moveController = k.onMouseMove(() => {
		if (isDragging) updateValue(k.mousePos());
	});
	slider.onUpdate(syncHandlePosition);

	slider.onDestroy(() => {
		pressController.cancel();
		releaseController.cancel();
		moveController.cancel();
		if (handle.exists()) k.destroy(handle);
	});

	return {
		track,
		handle,
		getValue: () => currentValue,
		setValue: (newValue: number) => {
			currentValue = k.clamp(newValue, 0, 1);
			syncHandlePosition();
		},
		updatePosition: () => {
			currentValue = k.clamp(currentValue, 0, 1);
			syncHandlePosition();
		},
	};
}

function getTrackValueFromScreenPosition(
	trackRoot: GameObj,
	width: number,
	centerY: number,
	mousePosition: Vec2
) {
	const screenStart = trackRoot.toScreen(k.vec2(0, centerY));
	const screenEnd = trackRoot.toScreen(k.vec2(width, centerY));
	const trackX = screenEnd.x - screenStart.x;
	const trackY = screenEnd.y - screenStart.y;
	const lengthSquared = trackX * trackX + trackY * trackY;
	if (lengthSquared <= 0) return 0;
	const pointerX = mousePosition.x - screenStart.x;
	const pointerY = mousePosition.y - screenStart.y;
	const projected = (pointerX * trackX + pointerY * trackY) / lengthSquared;
	return k.clamp(projected, 0, 1);
}
