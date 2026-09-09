import { loadSongData } from "../web"
import { selectFloorMusicTrack } from "../levels/floorThemes/floorThemeDirectory"
import { audioService } from "./audioService"
import { getWarpZone } from "./warpZoneService"

const NON_COMBAT_MUSIC_MULTIPLIER = 0
const ROOM_MUSIC_FADE_DURATION = 0.8
const SAFE_ROOM_AMBIENT_VOLUME = 0.12
const SAFE_ROOM_AMBIENT_FADE_DURATION = 1.2
let floorMusicBaseVolume = 1
let floorMusicMultiplier = 1

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

	audioService.playMusic(song.music, {
		volume: floorMusicBaseVolume * floorMusicMultiplier,
		loop: true,
	})
	syncSafeRoomAmbience(0)
	loadSongData(song.title, song.author, song.albumCover ?? "")
	return true
}

export function setFloorMusicCombatState(inCombat: boolean) {
	floorMusicMultiplier = inCombat ? 1 : NON_COMBAT_MUSIC_MULTIPLIER
	audioService.fadeMusicBaseVolume(
		floorMusicBaseVolume * floorMusicMultiplier,
		ROOM_MUSIC_FADE_DURATION
	)
	syncSafeRoomAmbience(ROOM_MUSIC_FADE_DURATION)
}

function syncSafeRoomAmbience(fadeInDelay: number) {
	const inCombat = floorMusicMultiplier > NON_COMBAT_MUSIC_MULTIPLIER
	if (inCombat) {
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
