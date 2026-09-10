import type { Vec2 } from "kaplay"
import { k } from "../../main"

export interface RunFinaleBattleZone {
	center: Vec2
	halfWidth: number
	halfHeight: number
}

let battleZone: RunFinaleBattleZone | undefined

export function captureRunFinaleBattleZone() {
	const cameraScale = k.getCamScale()
	battleZone = {
		center: k.getCamPos().clone(),
		halfWidth: k.width() / (2 * Math.max(cameraScale.x, 0.001)),
		halfHeight: k.height() / (2 * Math.max(cameraScale.y, 0.001)),
	}
	return battleZone
}

export function getRunFinaleBattleZone() {
	return battleZone
}

export function clearRunFinaleBattleZone() {
	battleZone = undefined
}
