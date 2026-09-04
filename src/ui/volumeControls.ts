import { GameObj, Vec2 } from "kaplay";
import { k } from "../main";
import { audioService } from "../services/audioService";
import { createSlider, createUiSlider } from "./common/slider";
import { createUiLabel } from "./common/label";
import { createUiCheckbox } from "./common/checkbox";
import { addThemedText } from "./common/text";
import { createUiActionButton } from "./common/button";
import { createUiSectionHeader } from "./common/sectionHeader";
import { UI_COLORS, UI_FONT_SIZES } from "./common/theme";

interface Props {
	center: Vec2;
	startY: number;
	tags: string[];
	width?: number;
}

export function createVolumeControls({
	center,
	startY,
	tags,
	width = 220,
}: Props) {
	createUiLabel({
		pos: k.vec2(center.x, startY),
		txt: "VOLUME",
		color: k.WHITE,
		fontSize: UI_FONT_SIZES.heading,
		tags,
	});

	const musicLabel = createUiLabel({
		pos: k.vec2(center.x, startY + 32),
		txt: volumeLabel("MUSIC", audioService.getMusicVolume()),
		color: k.WHITE,
		tags,
	});

	createSlider({
		pos: k.vec2(center.x - width / 2, startY + 50),
		width,
		value: audioService.getMusicVolume(),
		tags,
		onChange: (value) => {
			audioService.setMusicVolume(value);
			musicLabel.text = volumeLabel("MUSIC", value);
		},
	});

	const soundLabel = createUiLabel({
		pos: k.vec2(center.x, startY + 82),
		txt: volumeLabel("SOUND EFFECTS", audioService.getSoundVolume()),
		color: k.WHITE,
		tags,
	});

	createSlider({
		pos: k.vec2(center.x - width / 2, startY + 100),
		width,
		value: audioService.getSoundVolume(),
		tags,
		onChange: (value) => {
			audioService.setSoundVolume(value);
			soundLabel.text = volumeLabel("SOUND EFFECTS", value);
		},
	});

	createUiCheckbox({
		pos: k.vec2(center.x, startY + 140),
		txt: "MUTE ALL SOUND",
		checked: audioService.isMuted(),
		width,
		tags,
		onChange: (checked) => {
			audioService.setMuted(checked);
		},
	});
}

interface UiVolumeControlsProps {
	pos: Vec2;
	width: number;
}

export function createUiVolumeControls(
	parent: GameObj,
	{ pos, width }: UiVolumeControlsProps,
) {
	const controls = parent.add([k.pos(pos)]);
	createUiSectionHeader(controls, {
		pos: k.vec2(0, 0),
		width,
		eyebrow: "OUTPUT CONTROL",
		title: "AUDIO SYSTEMS",
		action: "LIVE",
	});

	const sliderWidth = width - 24;
	const musicLabel = addThemedText(controls, {
		pos: k.vec2(12, 63),
		text: volumeLabel("MUSIC", audioService.getMusicVolume()),
		variant: "muted",
		width: sliderWidth,
	});
	createUiSlider(controls, {
		pos: k.vec2(12, 82),
		width: sliderWidth,
		value: audioService.getMusicVolume(),
		onChange: (value) => {
			audioService.setMusicVolume(value);
			musicLabel.text = volumeLabel("MUSIC", value);
		},
	});

	const soundLabel = addThemedText(controls, {
		pos: k.vec2(12, 103),
		text: volumeLabel("SOUND EFFECTS", audioService.getSoundVolume()),
		variant: "muted",
		width: sliderWidth,
	});
	createUiSlider(controls, {
		pos: k.vec2(12, 122),
		width: sliderWidth,
		value: audioService.getSoundVolume(),
		onChange: (value) => {
			audioService.setSoundVolume(value);
			soundLabel.text = volumeLabel("SOUND EFFECTS", value);
		},
	});

	let statusText: ReturnType<typeof addThemedText>;
	createUiActionButton(controls, {
		pos: k.vec2(12, 145),
		size: k.vec2(Math.min(190, width - 118), 32),
		text: "TOGGLE MASTER AUDIO",
		onClick: () => {
			audioService.setMuted(!audioService.isMuted());
			updateMuteStatus(statusText);
		},
	});
	statusText = addThemedText(controls, {
		pos: k.vec2(12, 156),
		text: "",
		variant: "caption",
		width: width - 24,
		align: "right",
	});
	updateMuteStatus(statusText);

	return controls;
}

function updateMuteStatus(label: ReturnType<typeof addThemedText>) {
	const muted = audioService.isMuted();
	label.text = muted ? "MUTED" : "ONLINE";
	label.color = k.rgb(...(muted ? UI_COLORS.warning : UI_COLORS.success));
}

function volumeLabel(name: string, value: number) {
	return `${name}: ${Math.round(value * 100)}%`;
}
