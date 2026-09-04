import { AudioPlay, KEventController, Vec2 } from "kaplay";
import { audioPlaybackSpeed, k } from "../main";
import { tags } from "../tags";
import { profileSection } from "./frameProfilerService";

interface PlayingSound {
	audio: AudioPlay;
	id: string;
	baseVolume: number;
	baseSpeed: number;
	basePan: number;
	spatial?: SpatialSound;
}

export interface SoundOptions {
	volume?: number;
	detune?: number;
	speed?: number;
	loop?: boolean;
	pan?: number;
}

interface MusicOptions {
	volume?: number;
	loop?: boolean;
	continueIfPlaying?: boolean;
}

interface PendingMusic {
	musicId: string;
	options?: MusicOptions;
}

export interface PositionalSoundOptions extends SoundOptions {
	minDistance?: number;
	maxDistance?: number;
	rolloff?: number;
	panDistance?: number;
	listener?: PositionProvider;
}

type PositionProvider = Vec2 | (() => Vec2 | undefined);

interface SpatialSound {
	source: () => Vec2 | undefined;
	listener: () => Vec2 | undefined;
	minDistance: number;
	maxDistance: number;
	rolloff: number;
	panDistance: number;
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
let positionalAudioUpdate: KEventController | null = null;
let pendingMusic: PendingMusic | null = null;
let audioUnlockListening = false;
let audioUnlocked = false;

const AUDIO_UNLOCK_EVENTS = ["pointerdown", "keydown", "touchstart"] as const;

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

function browserNeedsAudioUnlock() {
	return typeof window !== "undefined" && !audioUnlocked;
}

function stopListeningForAudioUnlock() {
	if (!audioUnlockListening) return;
	for (const event of AUDIO_UNLOCK_EVENTS) {
		window.removeEventListener(event, unlockPendingMusic);
	}
	audioUnlockListening = false;
}

function unlockPendingMusic() {
	audioUnlocked = true;
	void k.audioCtx.resume();
	const request = pendingMusic;
	pendingMusic = null;
	stopListeningForAudioUnlock();
	if (request) audioService.playMusic(request.musicId, request.options);
}

function listenForAudioUnlock() {
	if (audioUnlockListening || typeof window === "undefined") return;
	audioUnlockListening = true;
	for (const event of AUDIO_UNLOCK_EVENTS) {
		window.addEventListener(event, unlockPendingMusic, { once: true });
	}
}

function saveAudioSettings() {
	localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(audioSettings));
}

function cancelMusicFade() {
	if (!currentMusicFade) return;
	currentMusicFade.cancel();
	currentMusicFade = null;
}

function positionProvider(provider: PositionProvider): () => Vec2 | undefined {
	return typeof provider === "function" ? provider : () => provider;
}

function defaultPositionalListener() {
	const listener = k.get(tags.player)[0];
	return listener?.pos ?? k.getCamPos();
}

function spatialGain(sound: PlayingSound) {
	if (!sound.spatial) return 1;
	const source = sound.spatial.source();
	const listener = sound.spatial.listener();
	if (!source || !listener) return 0;
	const distance = source.dist(listener);
	if (distance <= sound.spatial.minDistance) return 1;
	if (distance >= sound.spatial.maxDistance) return 0;
	const range = sound.spatial.maxDistance - sound.spatial.minDistance;
	const progress = (distance - sound.spatial.minDistance) / range;
	return Math.pow(1 - progress, sound.spatial.rolloff);
}

function spatialPan(sound: PlayingSound) {
	if (!sound.spatial) return sound.basePan;
	const source = sound.spatial.source();
	const listener = sound.spatial.listener();
	if (!source || !listener) return 0;
	const directionalPan = (source.x - listener.x) / sound.spatial.panDistance;
	return k.clamp(sound.basePan + directionalPan, -1, 1);
}

function updatePlayingSound(sound: PlayingSound) {
	sound.audio.volume =
		sound.baseVolume *
		audioSettings.soundVolume *
		masterVolume() *
		spatialGain(sound);
	sound.audio.pan = spatialPan(sound);
}

function updatePositionalAudio() {
	let hasPositionalSounds = false;
	for (const sound of playingSounds) {
		if (!sound.spatial) continue;
		hasPositionalSounds = true;
		updatePlayingSound(sound);
	}
	if (hasPositionalSounds || !positionalAudioUpdate) return;
	positionalAudioUpdate.cancel();
	positionalAudioUpdate = null;
}

function ensurePositionalAudioUpdate() {
	if (positionalAudioUpdate) return;
	positionalAudioUpdate = k.onUpdate(() => profileSection(
		"external:positionalAudio",
		updatePositionalAudio
	));
}

function playTrackedSound(
	soundId: string,
	options: SoundOptions = {},
	spatial?: SpatialSound
) {
	syncMasterVolume();
	const baseVolume = options.volume ?? 1;
	const baseSpeed = options.speed ?? 1;
	const basePan = options.pan ?? 0;
	const audio = k.play(soundId, {
		volume: 0,
		detune: options.detune,
		loop: options.loop,
		pan: basePan,
	});
	const sound: PlayingSound = {
		audio,
		id: soundId,
		baseVolume,
		baseSpeed,
		basePan,
		spatial,
	};
	sound.audio.speed = baseSpeed * audioPlaybackSpeed();
	updatePlayingSound(sound);
	playingSounds.push(sound);
	if (spatial) ensurePositionalAudioUpdate();

	audio.onEnd(() => {
		const index = playingSounds.findIndex((current) => current.audio === audio);
		if (index !== -1) playingSounds.splice(index, 1);
	});

	return audio;
}

export const audioService = {
	playSound(
		soundId: string,
		options?: SoundOptions
	): AudioPlay {
		return playTrackedSound(soundId, options);
	},

	playPositionalSound(
		soundId: string,
		source: PositionProvider,
		options: PositionalSoundOptions = {}
	): AudioPlay {
		const minDistance = Math.max(0, options.minDistance ?? 80);
		const maxDistance = Math.max(minDistance + 1, options.maxDistance ?? 700);
		return playTrackedSound(soundId, options, {
			source: positionProvider(source),
			listener: positionProvider(options.listener ?? defaultPositionalListener),
			minDistance,
			maxDistance,
			rolloff: Math.max(0.01, options.rolloff ?? 1.5),
			panDistance: Math.max(1, options.panDistance ?? 300),
		});
	},

	playMusic(
		musicId: string,
		options?: MusicOptions
	): AudioPlay | null {
		syncMasterVolume();
		cancelMusicFade();
		optionalMusicRequest++;
		currentMusicBaseVolume = options?.volume ?? 1;
		if (browserNeedsAudioUnlock()) {
			pendingMusic = { musicId, options };
			listenForAudioUnlock();
			return null;
		}
		pendingMusic = null;
		stopListeningForAudioUnlock();
		if (
			options?.continueIfPlaying &&
			currentMusic &&
			currentMusicId === musicId
		) {
			currentMusic.volume =
				currentMusicBaseVolume * audioSettings.musicVolume * masterVolume();
			currentMusic.paused = false;
			return currentMusic;
		}
		// Stop current music if playing
		if (currentMusic) {
			currentMusic.stop();
		}

		currentMusic = k.play(musicId, {
			loop: options?.loop,
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
		fadeController = k.onUpdate(() => profileSection("external:audioFade", () => {
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
		}));
		currentMusicFade = fadeController;
	},

	stopMusic() {
		optionalMusicRequest++;
		cancelMusicFade();
		pendingMusic = null;
		stopListeningForAudioUnlock();
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
		for (const sound of playingSounds) updatePlayingSound(sound);
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
		for (const sound of playingSounds) updatePlayingSound(sound);
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
			sound.audio.speed = sound.baseSpeed * timeScale;
		}
	},

	stopAllSounds() {
		// Stop all sound effects
		for (const sound of playingSounds) {
			sound.audio.stop();
		}
		playingSounds.length = 0;
		positionalAudioUpdate?.cancel();
		positionalAudioUpdate = null;

		// Stop music
		audioService.stopMusic();
	},

	getCurrentMusic(): AudioPlay | null {
		return currentMusic;
	},
};
