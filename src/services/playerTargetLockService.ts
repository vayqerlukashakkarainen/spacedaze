import type { GameObj, PosComp } from "kaplay"

let lockedTarget: GameObj<PosComp> | undefined

export function setPlayerTargetLock(target?: GameObj<PosComp>) {
	lockedTarget = target?.exists() ? target : undefined
}

export function getPlayerTargetLock() {
	if (lockedTarget?.exists()) return lockedTarget
	lockedTarget = undefined
	return undefined
}
