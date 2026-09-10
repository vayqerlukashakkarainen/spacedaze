import type { GameObj } from "kaplay"

interface PausedObjectState {
	count: number
	wasPaused: boolean
}

const pausedObjects = new Map<GameObj, PausedObjectState>()

export function acquireGameplayPause(
	_reason: string,
	objects: readonly GameObj[]
) {
	const ownedObjects: GameObj[] = []
	for (const object of objects) {
		const current = pausedObjects.get(object)
		if (current) {
			current.count++
			ownedObjects.push(object)
			continue
		}
		pausedObjects.set(object, {
			count: 1,
			wasPaused: object.paused,
		})
		object.paused = true
		ownedObjects.push(object)
	}

	let released = false
	return () => {
		if (released) return
		released = true
		for (const object of ownedObjects) releasePausedObject(object)
	}
}

function releasePausedObject(object: GameObj) {
	const state = pausedObjects.get(object)
	if (!state) return
	state.count--
	if (state.count > 0) return
	pausedObjects.delete(object)
	if (object.exists()) object.paused = state.wasPaused
}
