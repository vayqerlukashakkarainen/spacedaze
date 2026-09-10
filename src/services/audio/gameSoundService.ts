import type { AudioPlay } from "kaplay"
import {
	audioService,
	type PositionProvider,
	type PositionalSoundOptions,
	type SoundOptions,
} from "./audioService"
import {
	getSoundCuePolicy,
	type SoundCueId,
} from "../../audio/soundCueCatalog"

type ActiveCue = {
	audio: AudioPlay
	group: string
}

const activeCues: ActiveCue[] = []
const lastPlayedAt = new Map<string, number>()
const previousAssetIndex = new Map<SoundCueId, number>()

function nowSeconds() {
	return typeof performance === "undefined" ? Date.now() / 1000 : performance.now() / 1000
}

function activeInGroup(group: string) {
	return activeCues.filter((cue) => cue.group === group)
}

function removeActive(audio: AudioPlay) {
	const index = activeCues.findIndex((cue) => cue.audio === audio)
	if (index !== -1) activeCues.splice(index, 1)
}

function stopGroup(group: string) {
	for (const cue of [...activeInGroup(group)]) {
		removeActive(cue.audio)
		audioService.stopSound(cue.audio, "cue-restarted")
	}
}

function canPlay(cueId: SoundCueId) {
	const policy = getSoundCuePolicy(cueId)
	const group = policy.group ?? cueId
	const currentTime = nowSeconds()
	const cooldown = policy.cooldownSeconds ?? 0
	if (currentTime - (lastPlayedAt.get(group) ?? -Infinity) < cooldown) return false

	const active = activeInGroup(group)
	if (policy.stacking === "ignore" && active.length > 0) return false
	if (
		policy.stacking === "limit" &&
		active.length >= Math.max(1, policy.maxVoices ?? 1)
	) return false
	if (policy.stacking === "restart" && active.length > 0) stopGroup(group)
	lastPlayedAt.set(group, currentTime)
	return true
}

function track(cueId: SoundCueId, audio: AudioPlay | null) {
	if (!audio) return null
	const group = getSoundCuePolicy(cueId).group ?? cueId
	activeCues.push({ audio, group })
	audio.onEnd(() => removeActive(audio))
	return audio
}

function mergeSoundOptions(cueId: SoundCueId, options?: SoundOptions) {
	const policy = getSoundCuePolicy(cueId)
	const detuneRange = policy.detuneRange
	const randomizedDetune = detuneRange
		? detuneRange[0] + Math.random() * (detuneRange[1] - detuneRange[0])
		: undefined
	return {
		...policy.defaults,
		...(randomizedDetune === undefined ? {} : { detune: randomizedDetune }),
		...options,
	}
}

function resolveAsset(cueId: SoundCueId) {
	const configuredAsset = getSoundCuePolicy(cueId).asset ?? cueId
	if (typeof configuredAsset === "string") return configuredAsset
	let index = Math.floor(Math.random() * configuredAsset.length)
	const previousIndex = previousAssetIndex.get(cueId)
	if (configuredAsset.length > 1 && index === previousIndex) {
		index = (index + 1) % configuredAsset.length
	}
	previousAssetIndex.set(cueId, index)
	return configuredAsset[index]
}

export const gameSoundService = {
	play(cueId: SoundCueId, options?: SoundOptions): AudioPlay | null {
		if (!canPlay(cueId)) return null
		return track(
			cueId,
			audioService.playSound(resolveAsset(cueId), mergeSoundOptions(cueId, options))
		)
	},

	playPositional(
		cueId: SoundCueId,
		source: PositionProvider,
		options: PositionalSoundOptions = {}
	): AudioPlay | null {
		if (!canPlay(cueId)) return null
		const policy = getSoundCuePolicy(cueId)
		return track(
			cueId,
			audioService.playPositionalSound(resolveAsset(cueId), source, {
				...policy.defaults,
				...policy.positionalDefaults,
				...options,
			})
		)
	},

	stop(audio: AudioPlay | null | undefined, reason = "requested") {
		if (!audio) return
		removeActive(audio)
		audioService.stopSound(audio, reason)
	},

	update(
		audio: AudioPlay | null | undefined,
		options: Pick<SoundOptions, "volume" | "speed" | "detune">
	) {
		if (!audio) return
		audioService.updateSound(audio, options)
	},
}
