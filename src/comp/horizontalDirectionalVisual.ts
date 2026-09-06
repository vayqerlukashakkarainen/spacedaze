import type { Comp, Vec2 } from "kaplay"
import { k } from "../main"

export type HorizontalFacing = "left" | "right"

export interface HorizontalDirectionalVisualComp extends Comp {
	facing: HorizontalFacing
	faceHorizontal(directionX: number): void
	showDirectionalMovement(direction: Vec2): void
	setVisualLean(angle: number): void
	settleVisual(): void
}

export interface HorizontalDirectionalVisualOptions {
	nativeFacing?: HorizontalFacing
	initialFacing?: HorizontalFacing
	maxLean?: number
	leanResponse?: number
}

export function horizontalDirectionalVisual(
	options: HorizontalDirectionalVisualOptions = {}
): HorizontalDirectionalVisualComp {
	const nativeFacing = options.nativeFacing ?? "left"
	const maxLean = Math.max(0, options.maxLean ?? 8)
	const leanResponse = Math.max(0.01, options.leanResponse ?? 12)
	let targetLean = 0
	let currentLean = 0

	return {
		id: "horizontalDirectionalVisual",
		require: ["sprite", "rotate"],
		facing: options.initialFacing ?? nativeFacing,
		add() {
			this.flipX = this.facing !== nativeFacing
			this.angle = 0
		},
		update() {
			const response = 1 - Math.exp(-leanResponse * k.dt())
			currentLean = k.lerp(currentLean, targetLean, response)
			if (Math.abs(currentLean) < 0.01 && targetLean === 0) currentLean = 0
			this.angle = currentLean
		},
		faceHorizontal(directionX: number) {
			if (Math.abs(directionX) >= 0.01) {
				this.facing = directionX < 0 ? "left" : "right"
				this.flipX = this.facing !== nativeFacing
			}
			targetLean = 0
		},
		showDirectionalMovement(direction: Vec2) {
			if (direction.len() < 0.01) {
				targetLean = 0
				return
			}
			this.faceHorizontal(direction.x)
			targetLean = k.clamp(direction.x / direction.len(), -1, 1) * maxLean
		},
		setVisualLean(angle: number) {
			targetLean = k.clamp(angle, -maxLean, maxLean)
		},
		settleVisual() {
			targetLean = 0
		},
	}
}
