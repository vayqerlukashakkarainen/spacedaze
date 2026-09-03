import { k, layers } from "../main";
import { tags } from "../tags";
import { createUiButton } from "./common/button";
import { createUiLabel } from "./common/label";
import { createVolumeControls } from "./volumeControls";
import { createUiPanel } from "./common/panel";
import { compactUi, fitUiHeight, fitUiWidth } from "./common/layout";

interface PauseMenuActions {
	onResume: () => void;
	onQuit: () => void;
}

export function showPauseMenu({ onResume, onQuit }: PauseMenuActions) {
	const center = k.center();
	const pauseTags = [tags.pauseMenu];
	const compact = compactUi();
	const panelWidth = fitUiWidth(420);
	const panelHeight = fitUiHeight(430);
	const panelTop = center.y - panelHeight / 2;
	const buttonWidth = Math.min(280, panelWidth - 50);

	k.add([
		k.rect(k.width(), k.height()),
		k.pos(0, 0),
		k.color(0, 0, 0),
		k.opacity(0.75),
		k.fixed(),
		k.layer(layers.ui),
		...pauseTags,
	]);

	createUiPanel({
		pos: center,
		size: k.vec2(panelWidth, panelHeight),
		anchor: "center",
		tags: pauseTags,
	});

	createUiLabel({
		pos: k.vec2(center.x, panelTop + 46),
		txt: "PAUSED",
		color: k.WHITE,
		fontSize: 28,
		tags: pauseTags,
	});

	createUiButton({
		pos: k.vec2(center.x, panelTop + 102),
		txt: "RESUME",
		size: k.vec2(buttonWidth, compact ? 42 : 48),
		tags: pauseTags,
		onClick: onResume,
	});

	createUiButton({
		pos: k.vec2(center.x, panelTop + 162),
		txt: "QUIT",
		size: k.vec2(buttonWidth, compact ? 42 : 48),
		tags: pauseTags,
		onClick: onQuit,
	});

	createVolumeControls({
		center,
		startY: panelTop + 220,
		width: Math.min(220, panelWidth - 80),
		tags: pauseTags,
	});
}

export function hidePauseMenu() {
	k.destroyAll(tags.pauseMenu);
}
