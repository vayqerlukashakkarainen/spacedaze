import { loadSongData } from "../web"
import { audioService } from "./audioService"
import { getWarpZone } from "./warpZoneService"

export async function playZoneExplorationMusic(
	zoneId: string,
	useFirstTrack: boolean,
	volume: number
) {
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
