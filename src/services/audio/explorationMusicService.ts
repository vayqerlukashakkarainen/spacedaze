import { loadSongData } from "../../web"
import { selectFloorMusicTrack } from "../../levels/floorThemes/floorThemeDirectory"
import { audioService } from "./audioService"
import { getWarpZone } from "../world/warpZoneService"

const SAFE_ROOM_MUSIC_MULTIPLIER = 0
const CHILL_ROOM_MUSIC_MULTIPLIER = 0.28
const COMBAT_ROOM_MUSIC_MULTIPLIER = 1
const ROOM_MUSIC_FADE_DURATION = 0.8
const SAFE_ROOM_AMBIENT_VOLUME = 0.12
const SAFE_ROOM_AMBIENT_FADE_DURATION = 1.2
let floorMusicBaseVolume = 1
let floorMusicMultiplier = 1

export type FloorMusicRoomState = "safe" | "chill" | "combat"

export async function playZoneExplorationMusic(
	zoneId: string,
	useFirstTrack: boolean,
	volume: number
) {
	floorMusicMultiplier = 1
	const zone = getWarpZone(zoneId)
	const song = useFirstTrack
		? zone?.firstExplorationMusic ?? zone?.explorationMusic
		: zone?.explorationMusic
	if (!song) return false

	const started = await audioService.playOptionalMusic(
		song.music,
		song.path,
		{ volume, loop: true }
	)
	if (!started) return false
	loadSongData(song.title, song.author, song.albumCover ?? "")
	return true
}

export function playFloorExplorationMusic(
	depth: number,
	selectionSeed: number,
	volume: number
) {
	floorMusicBaseVolume = volume
	const song = selectFloorMusicTrack(depth, selectionSeed)
	if (!song) {
		audioService.stopMusic()
		return false
	}
	if (song.stems) {
		audioService.playStemmedMusic(song.music, song.stems, {
			volume: floorMusicBaseVolume,
			loop: true,
			combatIntensity: floorMusicMultiplier,
		})
		loadSongData(song.title, song.author, song.albumCover ?? "")
		return true
	}

	audioService.playMusic(song.music, {
		volume: floorMusicBaseVolume * floorMusicMultiplier,
		loop: true,
	})
	syncSafeRoomAmbience(0)
	loadSongData(song.title, song.author, song.albumCover ?? "")
	return true
}

export function setFloorMusicCombatState(inCombat: boolean) {
	setFloorMusicRoomState(inCombat ? "combat" : "safe")
}

export function setFloorMusicRoomState(state: FloorMusicRoomState) {
	floorMusicMultiplier = state === "combat"
		? COMBAT_ROOM_MUSIC_MULTIPLIER
		: state === "chill"
			? CHILL_ROOM_MUSIC_MULTIPLIER
			: SAFE_ROOM_MUSIC_MULTIPLIER
	if (audioService.fadeMusicStemIntensity(floorMusicMultiplier, ROOM_MUSIC_FADE_DURATION)) {
		audioService.fadeMusicBaseVolume(floorMusicBaseVolume, ROOM_MUSIC_FADE_DURATION)
		audioService.fadeAmbientMusicBaseVolume(0, 0.35, 0, true)
		return
	}
	audioService.fadeMusicBaseVolume(
		floorMusicBaseVolume * floorMusicMultiplier,
		ROOM_MUSIC_FADE_DURATION
	)
	syncSafeRoomAmbience(ROOM_MUSIC_FADE_DURATION)
}

function syncSafeRoomAmbience(fadeInDelay: number) {
	const musicIsAudible = floorMusicMultiplier > SAFE_ROOM_MUSIC_MULTIPLIER
	if (musicIsAudible) {
		audioService.fadeAmbientMusicBaseVolume(0, 0.35, 0, true)
		return
	}
	audioService.playAmbientMusic("ambientSpaceNoise", {
		volume: 0,
		loop: true,
		continueIfPlaying: true,
	})
	audioService.fadeAmbientMusicBaseVolume(
		SAFE_ROOM_AMBIENT_VOLUME,
		SAFE_ROOM_AMBIENT_FADE_DURATION,
		fadeInDelay
	)
}
