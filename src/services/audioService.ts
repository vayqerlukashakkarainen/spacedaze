import { AudioPlay, KEventController } from "kaplay";
import { audioPlaybackSpeed, k } from "../main";

interface PlayingSound {
	audio: AudioPlay;
	id: string;
	baseVolume: number;
}

interface AudioSettings {
	musicVolume: number;
	soundVolume: number;
	muted: boolean;
}

const AUDIO_SETTINGS_KEY = "spacedaze_audio_settings";
const playingSounds: PlayingSound[] = [];
let currentMusic: AudioPlay | null = null;
let currentMusicId: string | null = null;
let currentMusicBaseVolume = 1;
let currentMusicFade: KEventController | null = null;
let optionalMusicRequest = 0;
let audioSettings = loadAudioSettings();

function clampVolume(value: number) {
	return Math.max(0, Math.min(1, value));
}

function loadAudioSettings(): AudioSettings {
	const defaults = { musicVolume: 1, soundVolume: 1, muted: false };
	const savedSettings = localStorage.getItem(AUDIO_SETTINGS_KEY);
	if (!savedSettings) return defaults;

	const parsedSettings = JSON.parse(savedSettings) as Partial<AudioSettings>;
	return {
		musicVolume: clampVolume(parsedSettings.musicVolume ?? 1),
		soundVolume: clampVolume(parsedSettings.soundVolume ?? 1),
		muted: parsedSettings.muted ?? false,
	};
}

function masterVolume() {
	return audioSettings.muted ? 0 : 1;
}

function syncMasterVolume() {
	k.setVolume(masterVolume());
}

function saveAudioSettings() {
	localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(audioSettings));
}

function cancelMusicFade() {
	if (!currentMusicFade) return;
	currentMusicFade.cancel();
	currentMusicFade = null;
}

export const audioService = {
	playSound(
		soundId: string,
		options?: { volume?: number; detune?: number }
	): AudioPlay {
		syncMasterVolume();
		const baseVolume = options?.volume ?? 1;
		const audio = k.play(soundId, {
			...options,
			volume: baseVolume * audioSettings.soundVolume * masterVolume(),
		});

		// Track this sound
		const sound: PlayingSound = { audio, id: soundId, baseVolume };
		sound.audio.speed = audioPlaybackSpeed();
		playingSounds.push(sound);

		// Remove from tracking when it ends
		audio.onEnd(() => {
			const index = playingSounds.findIndex((s) => s.audio === audio);
			if (index !== -1) {
				playingSounds.splice(index, 1);
			}
		});

		return audio;
	},

	playMusic(
		musicId: string,
		options?: { volume?: number; loop?: boolean }
	): AudioPlay {
		syncMasterVolume();
		cancelMusicFade();
		optionalMusicRequest++;
		// Stop current music if playing
		if (currentMusic) {
			currentMusic.stop();
		}

		currentMusicBaseVolume = options?.volume ?? 1;
		currentMusic = k.play(musicId, {
			...options,
			volume:
				currentMusicBaseVolume * audioSettings.musicVolume * masterVolume(),
		});
		currentMusic.speed = 1;
		currentMusicId = musicId;

		return currentMusic;
	},

	async playOptionalMusic(
		musicId: string,
		path: string,
		options?: { volume?: number; loop?: boolean }
	): Promise<boolean> {
		const request = ++optionalMusicRequest;
		try {
			const response = await fetch(path, { method: "HEAD" });
			const contentType = response.headers.get("content-type") ?? "";
			if (!response.ok || !contentType.startsWith("audio/")) return false;
			if (request !== optionalMusicRequest) return false;
			k.loadMusic(musicId, path);
			audioService.playMusic(musicId, options);
			return true;
		} catch {
			return false;
		}
	},

	fadeOutMusic(durationSeconds: number) {
		cancelMusicFade();
		if (!currentMusic) return;
		if (durationSeconds <= 0) {
			audioService.stopMusic();
			return;
		}

		const fadingMusic = currentMusic;
		const startVolume = fadingMusic.volume;
		let elapsedSeconds = 0;
		let fadeController: KEventController;
		fadeController = k.onUpdate(() => {
			if (currentMusic !== fadingMusic) {
				fadeController.cancel();
				if (currentMusicFade === fadeController) currentMusicFade = null;
				return;
			}
			elapsedSeconds += k.dt();
			const progress = clampVolume(elapsedSeconds / durationSeconds);
			fadingMusic.volume = startVolume * (1 - progress);
			if (progress < 1) return;

			fadingMusic.stop();
			currentMusic = null;
			currentMusicId = null;
			fadeController.cancel();
			if (currentMusicFade === fadeController) currentMusicFade = null;
		});
		currentMusicFade = fadeController;
	},

	stopMusic() {
		optionalMusicRequest++;
		cancelMusicFade();
		if (currentMusic) {
			currentMusic.stop();
			currentMusic = null;
			currentMusicId = null;
		}
	},

	pauseMusic() {
		if (currentMusic) {
			currentMusic.paused = true;
		}
	},

	resumeMusic() {
		if (currentMusic) {
			currentMusic.paused = false;
		}
	},

	setMusicSpeed(speed: number) {
		if (currentMusic) {
			currentMusic.speed = speed;
		}
	},

	setMusicVolume(volume: number) {
		audioSettings.musicVolume = clampVolume(volume);
		if (currentMusic) {
			currentMusic.volume =
				currentMusicBaseVolume * audioSettings.musicVolume * masterVolume();
		}
		saveAudioSettings();
	},

	setSoundVolume(volume: number) {
		audioSettings.soundVolume = clampVolume(volume);
		for (const sound of playingSounds) {
			sound.audio.volume =
				sound.baseVolume * audioSettings.soundVolume * masterVolume();
		}
		saveAudioSettings();
	},

	getMusicVolume() {
		return audioSettings.musicVolume;
	},

	getSoundVolume() {
		return audioSettings.soundVolume;
	},

	setMuted(muted: boolean) {
		audioSettings.muted = muted;
		syncMasterVolume();
		if (currentMusic) {
			currentMusic.volume =
				currentMusicBaseVolume * audioSettings.musicVolume * masterVolume();
		}
		for (const sound of playingSounds) {
			sound.audio.volume =
				sound.baseVolume * audioSettings.soundVolume * masterVolume();
		}
		saveAudioSettings();
	},

	toggleMuted() {
		audioService.setMuted(!audioSettings.muted);
		return audioSettings.muted;
	},

	isMuted() {
		return audioSettings.muted;
	},

	syncSettings() {
		syncMasterVolume();
	},

	updateAudioSpeed(timeScale: number) {
		for (const sound of playingSounds) {
			sound.audio.speed = timeScale;
		}
	},

	stopAllSounds() {
		// Stop all sound effects
		for (const sound of playingSounds) {
			sound.audio.stop();
		}
		playingSounds.length = 0;

		// Stop music
		audioService.stopMusic();
	},

	getCurrentMusic(): AudioPlay | null {
		return currentMusic;
	},
};
