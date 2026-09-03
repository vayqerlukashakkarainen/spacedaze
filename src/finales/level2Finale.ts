import { musicVolume } from "../main"
import { audioService } from "../services/audioService"
import { endSong, loadSongData } from "../web"
import type { FinaleDefinition } from "./finaleTypes"

export const level2Finale: FinaleDefinition = {
	id: "level2Ending",
	song: {
		music: "flirtFlirtOhItHurts",
		title: "Flirt Flirt Oh It Hurts",
		author: "Bossfight",
		albumCover: "/covers/caps-on-hats-off.jpg",
		bpm: 0.375,
	},
	fallbackDurationSeconds: 211.37,
	durationSeconds: () => audioService.getCurrentMusic()?.duration(),
	start: () => {
		loadSongData(
			level2Finale.song.title,
			level2Finale.song.author,
			level2Finale.song.albumCover
		)
		audioService.playMusic(level2Finale.song.music, { volume: musicVolume })
	},
	reset: () => {
		audioService.stopMusic()
		endSong()
	},
	events: [],
}
