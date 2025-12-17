import { AudioPlay } from "kaplay";
import { k, timeScale } from "../main";

interface PlayingSound {
	audio: AudioPlay;
	id: string;
}

const playingSounds: PlayingSound[] = [];
let currentMusic: AudioPlay | null = null;
let currentMusicId: string | null = null;

export const audioService = {
	playSound(soundId: string, options?: { volume?: number }): AudioPlay {
		const audio = k.play(soundId, options);

		// Track this sound
		const sound: PlayingSound = { audio, id: soundId };
		sound.audio.speed = timeScale;
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
		// Stop current music if playing
		if (currentMusic) {
			currentMusic.stop();
		}

		currentMusic = k.play(musicId, options);
		currentMusicId = musicId;

		return currentMusic;
	},

	stopMusic() {
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

	updateAudioSpeed(timeScale: number) {
		// Update all playing sounds
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
