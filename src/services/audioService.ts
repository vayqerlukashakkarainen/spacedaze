import { AudioPlay, KEventController, Vec2 } from "kaplay";
import { audioPlaybackSpeed, k } from "../main";
import { tags } from "../tags";
import { profileSection } from "./frameProfilerService";
import { runtimeDebug } from "./runtimeDebugService";

interface PlayingSound {
	audio: AudioPlay;
	id: string;
	baseVolume: number;
	baseSpeed: number;
	basePan: number;
	lastVolume?: number;
	lastPan?: number;
	spatial?: SpatialSound;
	voiceBudgeted?: boolean;
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
	voiceLimit?: number | false;
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
let positionalAudioElapsed = 0;

const AUDIO_UNLOCK_EVENTS = ["pointerdown", "keydown", "touchstart"] as const;
const POSITIONAL_AUDIO_UPDATE_INTERVAL = 1 / 30;
const POSITIONAL_VOLUME_EPSILON = 0.004;
const POSITIONAL_PAN_EPSILON = 0.008;
const DEFAULT_POSITIONAL_VOICE_LIMIT = 16;
const MAX_POSITIONAL_EFFECT_VOICES = 32;

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

function spatialMix(sound: PlayingSound) {
	if (!sound.spatial) return { gain: 1, pan: sound.basePan };
	const source = sound.spatial.source();
	const listener = sound.spatial.listener();
	if (!validPosition(source) || !validPosition(listener)) {
		return { gain: 0, pan: 0 };
	}
	const distance = source.dist(listener);
	let gain = 1;
	if (distance >= sound.spatial.maxDistance) {
		gain = 0;
	} else if (distance > sound.spatial.minDistance) {
		const range = sound.spatial.maxDistance - sound.spatial.minDistance;
		const progress = (distance - sound.spatial.minDistance) / range;
		gain = Math.pow(1 - progress, sound.spatial.rolloff);
	}
	const directionalPan = (source.x - listener.x) / sound.spatial.panDistance;
	return {
		gain,
		pan: k.clamp(sound.basePan + directionalPan, -1, 1),
	};
}

function updatePlayingSound(sound: PlayingSound, force = false) {
	const mix = spatialMix(sound);
	const volume =
		sound.baseVolume *
		audioSettings.soundVolume *
		masterVolume() *
		mix.gain;
	const nextVolume = Number.isFinite(volume) ? clampVolume(volume) : 0;
	const nextPan = Number.isFinite(mix.pan) ? k.clamp(mix.pan, -1, 1) : 0;
	if (
		force ||
		sound.lastVolume === undefined ||
		Math.abs(nextVolume - sound.lastVolume) >= POSITIONAL_VOLUME_EPSILON
	) {
		sound.audio.volume = nextVolume;
		sound.lastVolume = nextVolume;
	}
	if (
		force ||
		sound.lastPan === undefined ||
		Math.abs(nextPan - sound.lastPan) >= POSITIONAL_PAN_EPSILON
	) {
		sound.audio.pan = nextPan;
		sound.lastPan = nextPan;
	}
}

function validPosition(position: Vec2 | undefined): position is Vec2 {
	return !!position && Number.isFinite(position.x) && Number.isFinite(position.y);
}

function updatePositionalAudio() {
	positionalAudioElapsed += k.dt();
	if (positionalAudioElapsed < POSITIONAL_AUDIO_UPDATE_INTERVAL) return;
	positionalAudioElapsed %= POSITIONAL_AUDIO_UPDATE_INTERVAL;
	let hasPositionalSounds = false;
	for (const sound of playingSounds) {
		if (!sound.spatial) continue;
		hasPositionalSounds = true;
		updatePlayingSound(sound);
	}
	if (hasPositionalSounds || !positionalAudioUpdate) return;
	positionalAudioUpdate.cancel();
	positionalAudioUpdate = null;
	positionalAudioElapsed = 0;
}

function ensurePositionalAudioUpdate() {
	if (positionalAudioUpdate) return;
	positionalAudioElapsed = POSITIONAL_AUDIO_UPDATE_INTERVAL;
	positionalAudioUpdate = k.onUpdate(() => profileSection(
		"external:positionalAudio",
		updatePositionalAudio
	));
}

function playTrackedSound(
	soundId: string,
	options: SoundOptions = {},
	spatial?: SpatialSound,
	voiceBudgeted = false
) {
	if (soundId !== "text_print") {
		runtimeDebug.log("audio", "sound:play", {
			id: soundId,
			volume: options.volume ?? 1,
			speed: options.speed ?? 1,
			detune: options.detune ?? 0,
			loop: options.loop === true,
			spatial: spatial !== undefined,
		});
	}
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
		voiceBudgeted,
	};
	sound.audio.speed = baseSpeed * audioPlaybackSpeed();
	updatePlayingSound(sound, true);
	playingSounds.push(sound);
	if (spatial) ensurePositionalAudioUpdate();

	audio.onEnd(() => {
		if (soundId !== "text_print") {
			runtimeDebug.log("audio", "sound:end", { id: soundId });
		}
		const index = playingSounds.findIndex((current) => current.audio === audio);
		if (index !== -1) playingSounds.splice(index, 1);
	});

	return audio;
}

function createSpatialSound(
	source: PositionProvider,
	options: PositionalSoundOptions
): SpatialSound {
	const minDistance = Math.max(0, options.minDistance ?? 80);
	return {
		source: positionProvider(source),
		listener: positionProvider(options.listener ?? defaultPositionalListener),
		minDistance,
		maxDistance: Math.max(minDistance + 1, options.maxDistance ?? 700),
		rolloff: Math.max(0.01, options.rolloff ?? 1.5),
		panDistance: Math.max(1, options.panDistance ?? 300),
	};
}

function playVoiceLimitedPositionalSound(
	soundId: string,
	spatial: SpatialSound,
	voiceLimit: number,
	options: PositionalSoundOptions
) {
	const activeVoices = playingSounds.filter(
		(sound) => sound.id === soundId && sound.spatial && sound.voiceBudgeted
	);
	const limit = Math.max(1, Math.floor(voiceLimit));
	if (
		activeVoices.length >= limit &&
		!replaceQuietestPositionalVoice(spatial, activeVoices)
	) {
		runtimeDebug.log("audio", "sound:voice-rejected", {
			id: soundId,
			reason: "per-sound-limit",
			limit,
		});
		return null;
	}

	const positionalVoices = playingSounds.filter(
		(sound) => sound.spatial && sound.voiceBudgeted
	);
	if (
		positionalVoices.length >= MAX_POSITIONAL_EFFECT_VOICES &&
		!replaceQuietestPositionalVoice(spatial, positionalVoices)
	) {
		runtimeDebug.log("audio", "sound:voice-rejected", {
			id: soundId,
			reason: "global-positional-limit",
			limit: MAX_POSITIONAL_EFFECT_VOICES,
		});
		return null;
	}
	return playTrackedSound(soundId, options, spatial, true);
}

function replaceQuietestPositionalVoice(
	spatial: SpatialSound,
	candidates: PlayingSound[]
) {
	const nextGain = spatialGain(spatial);
	let quietest = candidates[0];
	let quietestGain = spatialGain(quietest.spatial!);
	for (let index = 1; index < candidates.length; index++) {
		const gain = spatialGain(candidates[index].spatial!);
		if (gain >= quietestGain) continue;
		quietest = candidates[index];
		quietestGain = gain;
	}
	if (nextGain <= quietestGain) return false;
	const quietestIndex = playingSounds.indexOf(quietest);
	if (quietestIndex !== -1) playingSounds.splice(quietestIndex, 1);
	runtimeDebug.log("audio", "sound:stopped", {
		id: quietest.id,
		reason: "voice-replaced",
	});
	quietest.audio.stop();
	return true;
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
	): AudioPlay | null {
		const spatial = createSpatialSound(source, options);
		if (options.voiceLimit === false) {
			return playTrackedSound(soundId, options, spatial);
		}
		return playVoiceLimitedPositionalSound(
			soundId,
			spatial,
			options.voiceLimit ?? DEFAULT_POSITIONAL_VOICE_LIMIT,
			options
		);
	},

	stopSound(audio: AudioPlay, reason = "requested") {
		const sound = playingSounds.find((entry) => entry.audio === audio);
		if (sound && sound.id !== "text_print") {
			runtimeDebug.log("audio", "sound:stopped", {
				id: sound.id,
				reason,
			});
		}
		const index = playingSounds.findIndex((entry) => entry.audio === audio);
		if (index !== -1) playingSounds.splice(index, 1);
		audio.stop();
	},

	updateSound(audio: AudioPlay, options: Pick<SoundOptions, "volume" | "speed" | "detune">) {
		const sound = playingSounds.find((entry) => entry.audio === audio);
		if (!sound) return;
		runtimeDebug.log("audio", "sound:update", {
			id: sound.id,
			...options,
		});
		if (options.volume !== undefined) sound.baseVolume = options.volume;
		if (options.speed !== undefined) {
			sound.baseSpeed = options.speed;
			audio.speed = options.speed * audioPlaybackSpeed();
		}
		if (options.detune !== undefined) audio.detune = options.detune;
		updatePlayingSound(sound, true);
	},

	playMusic(
		musicId: string,
		options?: MusicOptions
	): AudioPlay | null {
		runtimeDebug.log("audio", "music:play-request", {
			id: musicId,
			volume: options?.volume ?? 1,
			loop: options?.loop === true,
			continueIfPlaying: options?.continueIfPlaying === true,
			current: currentMusicId,
		});
		syncMasterVolume();
		cancelMusicFade();
		optionalMusicRequest++;
		currentMusicBaseVolume = options?.volume ?? 1;
		if (browserNeedsAudioUnlock()) {
			runtimeDebug.log("audio", "music:deferred-for-unlock", { id: musicId });
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
			runtimeDebug.log("audio", "music:continued", { id: musicId });
			currentMusic.volume =
				currentMusicBaseVolume * audioSettings.musicVolume * masterVolume();
			currentMusic.paused = false;
			return currentMusic;
		}
		// Stop current music if playing
		if (currentMusic) {
			runtimeDebug.log("audio", "music:replaced", {
				previous: currentMusicId,
				next: musicId,
			});
			currentMusic.stop();
		}

		currentMusic = k.play(musicId, {
			loop: options?.loop,
			volume:
				currentMusicBaseVolume * audioSettings.musicVolume * masterVolume(),
		});
		currentMusic.speed = 1;
		currentMusicId = musicId;
		runtimeDebug.log("audio", "music:started", { id: musicId });

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
		runtimeDebug.log("audio", "music:fade-out", {
			id: currentMusicId,
			durationSeconds,
		});
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
		runtimeDebug.log("audio", "music:stop-request", {
			id: currentMusicId,
			hasMusic: currentMusic !== null,
		});
		optionalMusicRequest++;
		cancelMusicFade();
		pendingMusic = null;
		stopListeningForAudioUnlock();
		if (currentMusic) {
			const stoppedMusicId = currentMusicId;
			currentMusic.stop();
			currentMusic = null;
			currentMusicId = null;
			runtimeDebug.log("audio", "music:stopped", { id: stoppedMusicId });
		}
	},

	pauseMusic() {
		if (currentMusic) {
			currentMusic.paused = true;
			runtimeDebug.log("audio", "music:paused", { id: currentMusicId });
		}
	},

	resumeMusic() {
		if (currentMusic) {
			currentMusic.paused = false;
			runtimeDebug.log("audio", "music:resumed", { id: currentMusicId });
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
		for (const sound of playingSounds) updatePlayingSound(sound, true);
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
		for (const sound of playingSounds) updatePlayingSound(sound, true);
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
		runtimeDebug.log("audio", "sound:stop-all", {
			count: playingSounds.length,
			ids: [...new Set(playingSounds.map((sound) => sound.id))],
		});
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

function spatialGain(spatial: SpatialSound) {
	const source = spatial.source();
	const listener = spatial.listener();
	if (!validPosition(source) || !validPosition(listener)) return 0;
	const distance = source.dist(listener);
	if (distance >= spatial.maxDistance) return 0;
	if (distance <= spatial.minDistance) return 1;
	const range = spatial.maxDistance - spatial.minDistance;
	const progress = (distance - spatial.minDistance) / range;
	return Math.pow(1 - progress, spatial.rolloff);
}
