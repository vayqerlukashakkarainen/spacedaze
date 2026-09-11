import { GameObj, Vec2 } from "kaplay";
import { k } from "../main";
import { audioService } from "../services/audio/audioService";
import { createUiSlider } from "./common/slider";
import { addThemedText } from "./common/text";
import { createUiActionButton } from "./common/button";
import { createUiSectionHeader } from "./common/sectionHeader";
import { UI_COLORS, UI_FONT_SIZES } from "./common/theme";

interface UiVolumeControlsProps {
	pos: Vec2;
	width: number;
	sliderHandleVisible?: (screenPosition: Vec2) => boolean;
}

export function createUiVolumeControls(
	parent: GameObj,
	{ pos, width, sliderHandleVisible }: UiVolumeControlsProps,
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
		handleVisible: sliderHandleVisible,
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
		handleVisible: sliderHandleVisible,
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
