import type { AudioPlay } from "kaplay"
import { k, mainSoundVolume } from "../main"
import { getFinaleDefinition, type FinaleId } from "../finales/finaleRegistry"
import type { FinaleDefinition, FinaleEvent, RunPhase } from "../finales/finaleTypes"
import { audioService } from "./audioService"
import {
	captureRunFinaleBattleZone,
	clearRunFinaleBattleZone,
} from "./runFinaleArenaService"

let finale: FinaleDefinition | undefined
let events: FinaleEvent[] = []
let phase: RunPhase = "exploration"
let elapsedMilliseconds = 0
let nextEventIndex = 0
let transitionDurationMilliseconds = 0
let transitionElapsedMilliseconds = 0
let transitionRampSound: AudioPlay | undefined

const WORMHOLE_RAMP_SOUND_DURATION_MILLISECONDS = 3341

export function prepareRunFinale(
	finaleId: FinaleId | undefined,
	transitionSeconds = 0
) {
	resetRunFinale()
	if (!finaleId) return
	finale = getFinaleDefinition(finaleId)
	events = [...finale.events].sort((a, b) => a.timeStamp - b.timeStamp)
	transitionDurationMilliseconds = Math.max(0, transitionSeconds * 1000)
	phase = "exploration"
}

export function activateRunFinale() {
	if (!finale || phase !== "exploration") return false
	captureRunFinaleBattleZone()
	elapsedMilliseconds = 0
	nextEventIndex = 0
	transitionElapsedMilliseconds = 0
	if (transitionDurationMilliseconds > 0) {
		phase = "transition"
		audioService.fadeOutMusic(transitionDurationMilliseconds / 1000)
	} else {
		startFinale()
	}
	return true
}

export function updateRunFinale() {
	if (!finale) return
	if (phase === "transition") {
		transitionElapsedMilliseconds += k.dt() * 1000
		startTransitionRampSoundWhenReady()
		if (transitionElapsedMilliseconds >= transitionDurationMilliseconds) {
			startFinale()
		}
		return
	}
	if (phase !== "finale") return
	elapsedMilliseconds += k.dt() * 1000

	while (
		nextEventIndex < events.length &&
		events[nextEventIndex].timeStamp <= elapsedMilliseconds
	) {
		const event = events[nextEventIndex]
		event.begin?.(elapsedMilliseconds)
		nextEventIndex++
	}

	for (const event of events) {
		if (event.duration === undefined) continue
		const eventElapsed = elapsedMilliseconds - event.timeStamp
		if (eventElapsed < 0 || eventElapsed >= event.duration) continue
		event.upd(eventElapsed)
	}

	if (elapsedMilliseconds >= getFinaleDurationSeconds() * 1000) {
		phase = "exitReady"
	}
}

export function getRunPhase() {
	return phase
}

export function getRunFinaleProgress() {
	if (!finale) return 0
	if (phase === "exitReady") return 1
	if (phase !== "finale") return 0
	return k.clamp(
		elapsedMilliseconds / (getFinaleDurationSeconds() * 1000),
		0,
		1
	)
}

export function getRunFinaleTransitionProgress() {
	if (phase === "finale" || phase === "exitReady") return 1
	if (phase !== "transition" || transitionDurationMilliseconds <= 0) return 0
	return k.clamp(
		transitionElapsedMilliseconds / transitionDurationMilliseconds,
		0,
		1
	)
}

export function getRunFinaleTransitionSecondsRemaining() {
	if (phase !== "transition") return 0
	return Math.max(
		0,
		(transitionDurationMilliseconds - transitionElapsedMilliseconds) / 1000
	)
}

export function getRunFinaleRampProgress() {
	if (phase !== "transition") return 0
	const remainingMilliseconds = Math.max(
		0,
		transitionDurationMilliseconds - transitionElapsedMilliseconds
	)
	if (remainingMilliseconds > WORMHOLE_RAMP_SOUND_DURATION_MILLISECONDS) {
		return 0
	}
	return k.clamp(
		1 - remainingMilliseconds / WORMHOLE_RAMP_SOUND_DURATION_MILLISECONDS,
		0,
		1
	)
}

export function resetRunFinale() {
	clearRunFinaleBattleZone()
	transitionRampSound?.stop()
	transitionRampSound = undefined
	finale?.reset()
	finale = undefined
	events = []
	phase = "exploration"
	elapsedMilliseconds = 0
	nextEventIndex = 0
	transitionDurationMilliseconds = 0
	transitionElapsedMilliseconds = 0
}

function startTransitionRampSoundWhenReady() {
	if (transitionRampSound) return
	const remainingMilliseconds =
		transitionDurationMilliseconds - transitionElapsedMilliseconds
	if (remainingMilliseconds > WORMHOLE_RAMP_SOUND_DURATION_MILLISECONDS) return
	transitionRampSound = audioService.playSound("wormhole_rampup", {
		volume: mainSoundVolume,
	})
}

function startFinale() {
	phase = "finale"
	elapsedMilliseconds = 0
	nextEventIndex = 0
	finale?.start?.()
}

function getFinaleDurationSeconds() {
	const duration = finale?.durationSeconds?.()
	if (duration !== undefined && Number.isFinite(duration) && duration > 0) {
		return duration
	}
	return finale?.fallbackDurationSeconds ?? 0
}
