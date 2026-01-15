import { Vec2, GameObj } from "kaplay";
import { k, layers } from "../../main";
import { uiState } from "../uiState";

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
		k.area(),
		k.color(100, 100, 100),
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
		k.pos(pos.x + width * value, pos.y - (handleHeight - trackHeight) / 2),
		k.color(255, 255, 255),
		k.anchor("center"),
		k.area(),
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

	handle.onMousePress(() => {
		isDragging = true;
	});

	k.onMouseRelease(() => {
		isDragging = false;
	});

	k.onMouseMove(() => {
		if (isDragging || (k.isMouseDown("left") && handle.isHovering())) {
			const mousePos = k.mousePos();
			const sliderBounds = {
				x: pos.x,
				y: pos.y - handleHeight / 2,
				width: width,
				height: handleHeight,
			};

			// Check if mouse is near slider
			if (
				mousePos.x >= sliderBounds.x &&
				mousePos.x <= sliderBounds.x + sliderBounds.width &&
				mousePos.y >= sliderBounds.y &&
				mousePos.y <= sliderBounds.y + sliderBounds.height
			) {
				const newValue = k.clamp((mousePos.x - pos.x) / width, 0, 1);
				handle.pos.x = pos.x + width * newValue;
				onChange(newValue);
			}
		}
	});

	return {
		track,
		handle,
		getValue: () => {
			return (handle.pos.x - pos.x) / width;
		},
		setValue: (newValue: number) => {
			handle.pos.x = pos.x + width * k.clamp(newValue, 0, 1);
		},
		updatePosition: () => {
			// Helper to update handle position based on current value
			const currentValue = (handle.pos.x - pos.x) / width;
			handle.pos.x = pos.x + width * k.clamp(currentValue, 0, 1);
		},
	};
}
