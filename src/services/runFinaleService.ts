import { k } from "../main"
import { getFinaleDefinition, type FinaleId } from "../finales/finaleRegistry"
import type { FinaleDefinition, FinaleEvent, RunPhase } from "../finales/finaleTypes"

let finale: FinaleDefinition | undefined
let events: FinaleEvent[] = []
let phase: RunPhase = "exploration"
let elapsedMilliseconds = 0
let nextEventIndex = 0

export function prepareRunFinale(finaleId: FinaleId | undefined) {
	resetRunFinale()
	if (!finaleId) return
	finale = getFinaleDefinition(finaleId)
	events = [...finale.events].sort((a, b) => a.timeStamp - b.timeStamp)
	phase = "exploration"
}

export function activateRunFinale() {
	if (!finale || phase !== "exploration") return false
	elapsedMilliseconds = 0
	nextEventIndex = 0
	phase = "finale"
	finale.start?.()
	return true
}

export function updateRunFinale() {
	if (!finale || phase !== "finale") return
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

export function resetRunFinale() {
	finale?.reset()
	finale = undefined
	events = []
	phase = "exploration"
	elapsedMilliseconds = 0
	nextEventIndex = 0
}

function getFinaleDurationSeconds() {
	const duration = finale?.durationSeconds?.()
	if (duration !== undefined && Number.isFinite(duration) && duration > 0) {
		return duration
	}
	return finale?.fallbackDurationSeconds ?? 0
}
