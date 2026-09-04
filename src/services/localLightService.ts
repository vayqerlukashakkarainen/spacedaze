import type { GameObj } from "kaplay"
import { k } from "../main"

export interface LocalLightPulse {
	scaleMin: number
	scaleMax: number
	scaleSpeed: number
	opacityMin: number
	opacityMax: number
	opacitySpeed: number
}

export interface LocalLightOptions {
	size: number
	color: readonly [number, number, number]
	opacity: number
	z?: number
	pulse?: LocalLightPulse
}

export interface LocalLightHandle {
	object: GameObj
	pulse?: LocalLightPulse
}

let localLightSprite: ReturnType<typeof k.loadSprite> | undefined

function getLocalLightSprite() {
	if (localLightSprite) return localLightSprite
	const size = 96
	const canvas = document.createElement("canvas")
	canvas.width = size
	canvas.height = size
	const context = canvas.getContext("2d")
	if (!context) throw new Error("Unable to create local light texture")
	const center = size / 2
	const gradient = context.createRadialGradient(
		center,
		center,
		0,
		center,
		center,
		center
	)
	gradient.addColorStop(0, "rgba(255, 255, 255, 0.9)")
	gradient.addColorStop(0.24, "rgba(255, 255, 255, 0.48)")
	gradient.addColorStop(0.58, "rgba(255, 255, 255, 0.16)")
	gradient.addColorStop(1, "rgba(255, 255, 255, 0)")
	context.fillStyle = gradient
	context.fillRect(0, 0, size, size)
	localLightSprite = k.loadSprite(null, canvas, { singular: true })
	return localLightSprite
}

export function addLocalLight(
	parent: GameObj,
	options: LocalLightOptions
): LocalLightHandle {
	const light = parent.add([
		k.pos(),
		k.sprite(getLocalLightSprite(), {
			width: options.size,
			height: options.size,
		}),
		k.anchor("center"),
		k.scale(1),
		k.color(...options.color),
		k.opacity(options.opacity),
		k.z(options.z ?? -1),
		k.blend(k.BlendMode.Add),
	])

	return { object: light, pulse: options.pulse }
}

export function updateLocalLight(light: LocalLightHandle) {
	if (!light.pulse) return
	light.object.scale = k.vec2(
		k.wave(
			light.pulse.scaleMin,
			light.pulse.scaleMax,
			k.time() * light.pulse.scaleSpeed
		)
	)
	light.object.opacity = k.wave(
		light.pulse.opacityMin,
		light.pulse.opacityMax,
		k.time() * light.pulse.opacitySpeed
	)
}
