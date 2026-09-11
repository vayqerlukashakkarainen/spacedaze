import type { GameObj, Vec2 } from "kaplay"
import { hexKey } from "../../generation/hexUtils"
import type { HexGrid } from "../../grid/hexGrid"
import { k, layers } from "../../main"
import { tags } from "../../tags"
import { DensePool } from "../core/densePool"
import { setPerformanceCounter } from "../debug/frameProfilerService"

type GroundShadowCaster = GameObj & {
	pos: Vec2
	hb?: number
	groundShadowDisabled?: boolean
	groundShadowHeight?: number
	groundShadowMode?: "default" | "ground"
	groundShadowOpacity?: number
	groundShadowScale?: number
	dataOrientedVisual?: boolean
	runtimeVisibilityCulled?: boolean
}

interface GroundShadowProfile {
	radiusX: number
	radiusY: number
	offsetY: number
	opacity: number
}

const DEFAULT_FAKE_HEIGHT = 10
const SHADOW_RADIUS_FACTOR = 0.325
const SHADOW_HEIGHT_RATIO = 0.39
const SHADOW_MIN_RADIUS = 4
const SHADOW_MAX_RADIUS = 56
const SHADOW_MAX_OFFSET_Y = 52
const SHADOW_OFFSET_FACTOR = 1.15
const GROUND_SHADOW_OFFSET_FACTOR = 0.3
const GROUND_SHADOW_HEIGHT_FACTOR = 0.25
const GROUND_SHADOW_MIN_OFFSET_Y = 4
const GROUND_SHADOW_MAX_OFFSET_Y = 24
const SHADOW_BASE_OPACITY = 0.62
const SHADOW_VIEW_MARGIN = 80

export function spawnRoomGroundShadowRenderer(
	grid: HexGrid,
	groundCoordKeys: ReadonlySet<string>
) {
	return spawnGroundShadowRenderer(
		(position) => groundCoordKeys.has(hexKey(grid.screenToHex(position))),
		[tags.runRoom, tags.runMap, tags.gameLoop]
	)
}

export function spawnGroundShadowRenderer(
	isGroundAt: (position: Vec2) => boolean,
	rendererTags: string[]
) {
	const casters = new DensePool<GroundShadowCaster>((obj) => obj.id)
	const registerCaster = (obj: GameObj) => {
		if (!canCastGroundShadow(obj)) return
		casters.add(obj as GroundShadowCaster)
	}

	for (const obj of k.get(tags.gameLoop)) registerCaster(obj)
	const addController = k.onAdd(tags.gameLoop, registerCaster)
	const renderer = k.add([
		k.pos(0, 0),
		k.layer(layers.game2),
		k.z(1),
		{
			draw() {
				const camera = k.getCamPos()
				const cameraScale = k.getCamScale()
				const halfWidth = k.width() / (2 * cameraScale.x) + SHADOW_VIEW_MARGIN
				const halfHeight = k.height() / (2 * cameraScale.y) + SHADOW_VIEW_MARGIN
				let drawn = 0

				casters.forEach((obj) => {
					if (!obj.exists()) {
						casters.remove(obj.id)
						return
					}
					if (!shouldDrawGroundShadow(obj, camera, halfWidth, halfHeight)) return
					if (!isGroundAt(obj.pos)) return
					const profile = getGroundShadowProfile(obj)
					if (!profile) return

					k.drawEllipse({
						pos: obj.pos.add(0, profile.offsetY),
						radiusX: profile.radiusX,
						radiusY: profile.radiusY,
						anchor: "center",
						color: k.BLACK,
						opacity: profile.opacity,
					})
					drawn++
				})

				setPerformanceCounter("groundShadowCasters", casters.size)
				setPerformanceCounter("groundShadowsDrawn", drawn)
			},
		},
		...rendererTags,
	])

	renderer.onDestroy(() => {
		addController.cancel()
		casters.clear()
	})
	return renderer
}

function canCastGroundShadow(obj: GameObj) {
	if (!obj.pos || obj.groundShadowDisabled === true) return false
	if (
		obj.is(tags.blaster) ||
		obj.is(tags.rocket) ||
		obj.is(tags.projectile) ||
		obj.is(tags.debree) ||
		obj.is(tags.part) ||
		obj.is(tags.roomTrap) ||
		obj.is(tags.levelBg)
	) return false
	if (!(
		obj.is(tags.player) ||
		obj.is(tags.enemy) ||
		obj.is(tags.follower) ||
		obj.is(tags.npc) ||
		obj.is(tags.unit) ||
		obj.is(tags.props) ||
		obj.is(tags.roomEnvironment)
	)) return false
	return getCasterDiameter(obj as GroundShadowCaster) > 0
}

function shouldDrawGroundShadow(
	obj: GroundShadowCaster,
	camera: Vec2,
	halfWidth: number,
	halfHeight: number
) {
	if (obj.groundShadowDisabled === true || obj.runtimeVisibilityCulled === true) {
		return false
	}
	if (obj.hidden && obj.dataOrientedVisual !== true) return false
	if ((obj.opacity ?? 1) <= 0.02) return false
	return Math.abs(obj.pos.x - camera.x) <= halfWidth &&
		Math.abs(obj.pos.y - camera.y) <= halfHeight
}

function getGroundShadowProfile(
	obj: GroundShadowCaster
): GroundShadowProfile | undefined {
	const diameter = getCasterDiameter(obj)
	if (diameter <= 0) return undefined
	const fakeHeight = Math.max(0, obj.groundShadowHeight ?? DEFAULT_FAKE_HEIGHT)
	const heightScale = k.clamp(1 - fakeHeight * 0.012, 0.6, 1)
	const objectScale = Math.max(0.1, obj.groundShadowScale ?? 1)
	const isGroundObject = obj.groundShadowMode === "ground"
	const radiusX = k.clamp(
		diameter * SHADOW_RADIUS_FACTOR * heightScale * objectScale,
		SHADOW_MIN_RADIUS,
		SHADOW_MAX_RADIUS
	)
	const opacityScale = k.clamp(1 - fakeHeight * 0.01, 0.65, 1)
	return {
		radiusX,
		radiusY: Math.max(2, radiusX * SHADOW_HEIGHT_RATIO),
		offsetY: isGroundObject
			? k.clamp(
				radiusX * GROUND_SHADOW_OFFSET_FACTOR +
					fakeHeight * GROUND_SHADOW_HEIGHT_FACTOR,
				GROUND_SHADOW_MIN_OFFSET_Y,
				GROUND_SHADOW_MAX_OFFSET_Y
			)
			: k.clamp(
				radiusX * SHADOW_OFFSET_FACTOR + fakeHeight,
				10,
				SHADOW_MAX_OFFSET_Y
			),
		opacity: k.clamp(
			(obj.groundShadowOpacity ?? SHADOW_BASE_OPACITY) *
				opacityScale *
				k.clamp(obj.opacity ?? 1, 0, 1),
			0,
			1
		),
	}
}

function getCasterDiameter(obj: GroundShadowCaster) {
	const scaleX = Math.abs(obj.scale?.x ?? 1)
	const scaleY = Math.abs(obj.scale?.y ?? 1)
	const width = typeof obj.width === "number" ? obj.width * scaleX : 0
	const height = typeof obj.height === "number" ? obj.height * scaleY : 0
	const hitDiameter = typeof obj.hb === "number" ? obj.hb * 2 : 0
	return Math.max(width, height, hitDiameter)
}
