import { Vec2 } from "kaplay";
import { k } from "../main";
import { audioService } from "../services/audioService";
import { createSlider } from "./common/slider";
import { createUiLabel } from "./common/label";
import { createUiCheckbox } from "./common/checkbox";

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
		fontSize: 16,
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

function volumeLabel(name: string, value: number) {
	return `${name}: ${Math.round(value * 100)}%`;
}
