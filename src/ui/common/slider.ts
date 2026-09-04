import { Vec2, GameObj } from "kaplay";
import { k, layers } from "../../main";
import { uiState } from "../uiState";
import { UI_COLORS } from "./theme";
import { uiHitRegion } from "./hitRegion";
import { getUiTreeTransitionOpacity } from "./modalTransition";

interface Props {
	pos: Vec2;
	width: number;
	value: number;
	onChange: (value: number) => void;
	tags?: string[];
}

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
}

export function createUiSlider(
	parent: GameObj,
	{ pos, width, value, onChange }: UiSliderProps,
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
		handle.opacity = getUiTreeTransitionOpacity(slider);
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

export function createSlider({
	pos,
	width,
	value,
	onChange,
	tags,
}: Props): SliderComponents {
	const sliderTags = tags || ["levelEditor"];
	const trackHeight = 4;
	const handleWidth = 8;
	const handleHeight = 16;

	// Slider track
	const track = k.add([
		k.rect(width, trackHeight),
		k.pos(pos.x, pos.y),
		uiHitRegion(k.vec2(width, trackHeight)),
		k.color(...UI_COLORS.muted),
		k.fixed(),
		k.layer(layers.ui),
		...sliderTags,
	]);

	// Track hover for UI state
	track.onHover(() => {
		uiState.isOverUI = true;
	});

	track.onHoverEnd(() => {
		uiState.isOverUI = false;
	});

	// Slider handle
	const handle = k.add([
		k.rect(handleWidth, handleHeight),
		k.pos(pos.x + width * value, pos.y + trackHeight / 2),
		k.color(...UI_COLORS.accent),
		k.anchor("center"),
		uiHitRegion(k.vec2(handleWidth, handleHeight), true),
		k.fixed(),
		k.layer(layers.ui),
		...sliderTags,
	]);

	// Handle hover for UI state
	handle.onHover(() => {
		uiState.isOverUI = true;
	});

	handle.onHoverEnd(() => {
		uiState.isOverUI = false;
	});

	// Handle dragging
	let isDragging = false;
	const updateValue = (mouseX: number) => {
		const newValue = k.clamp((mouseX - pos.x) / width, 0, 1);
		handle.pos = k.vec2(
			pos.x + width * newValue,
			pos.y + trackHeight / 2
		);
		onChange(newValue);
	};

	const pressController = k.onMousePress("left", () => {
		if (handle.isHovering()) {
			isDragging = true;
		}
	});

	track.onClick(() => {
		updateValue(k.mousePos().x);
	});

	const releaseController = k.onMouseRelease(() => {
		isDragging = false;
	});

	const moveController = k.onMouseMove(() => {
		if (!isDragging) return;
		updateValue(k.mousePos().x);
	});

	track.onDestroy(() => {
		pressController.cancel();
		releaseController.cancel();
		moveController.cancel();
	});

	return {
		track,
		handle,
		getValue: () => {
			return (handle.pos.x - pos.x) / width;
		},
		setValue: (newValue: number) => {
			handle.pos = k.vec2(
				pos.x + width * k.clamp(newValue, 0, 1),
				pos.y + trackHeight / 2
			);
		},
		updatePosition: () => {
			// Helper to update handle position based on current value
			const currentValue = (handle.pos.x - pos.x) / width;
			handle.pos = k.vec2(
				pos.x + width * k.clamp(currentValue, 0, 1),
				pos.y + trackHeight / 2
			);
		},
	};
}
