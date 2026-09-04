import type {
	Asset,
	Color,
	GameObj,
	KEventController,
	SpriteData,
	Vec2,
} from "kaplay"
import { hexCorners, hexToPixel } from "../grid/hexCoord"
import {
	GeneratedRunMapCell,
	getGeneratedRunMapSnapshot,
	getRoomColor,
	getRoomLabel,
} from "../levels/runMap"
import { k, layers } from "../main"
import { loopService } from "../services/loopService"
import { tags } from "../tags"
import { createUiScrollable, UiScrollableControl } from "./common/scrollable"
import { UI_COLORS } from "./common/theme"
import { uiState } from "./uiState"
import { registerBatchedUiUpdate } from "../services/uiUpdateService"
import { uiHitRegion } from "./common/hitRegion"

const MAP_MARGIN = 22
const MAP_HEADER_HEIGHT = 48
const MAP_FOOTER_HEIGHT = 34
const MAP_MIN_ZOOM = 0.7
const MAP_MAX_ZOOM = 5
const MAP_RASTER_PIXELS_PER_UNIT = 14
const MAP_RASTER_PADDING = 8
const MAP_MAX_RASTER_SIZE = 2048

let open = false
let inputControllers: KEventController[] = []
let pausedObjects = new Set<GameObj>()
let zoneScroll: UiScrollableControl | undefined
let rememberedMapSeed: number | undefined
let rememberedZoomMultiplier = 1

export function tacticalMapOpen() {
	return open
}

export function toggleTacticalMap() {
	if (open) {
		hideTacticalMap()
		return true
	}
	return showTacticalMap()
}

export function showTacticalMap() {
	if (open) return true
	const snapshot = getGeneratedRunMapSnapshot()
	if (!snapshot) return false

	open = true
	uiState.modalOpen = true
	pausedObjects = new Set()
	for (const obj of k.get<GameObj>(tags.gameLoop)) {
		if (obj.paused) continue
		obj.paused = true
		pausedObjects.add(obj)
	}
	loopService.pauseAll()

	const sidebarWidth = k.clamp(k.width() * 0.24, 190, 280)
	const viewportPos = k.vec2(MAP_MARGIN, MAP_HEADER_HEIGHT)
	const viewportSize = k.vec2(
		Math.max(220, k.width() - sidebarWidth - MAP_MARGIN * 3),
		Math.max(180, k.height() - MAP_HEADER_HEIGHT - MAP_FOOTER_HEIGHT)
	)
	const sidebarX = viewportPos.x + viewportSize.x + MAP_MARGIN

	k.add([
		k.rect(k.width(), k.height()),
		k.pos(0, 0),
		k.color(...UI_COLORS.background),
		k.opacity(0.97),
		k.fixed(),
		k.layer(layers.uiEffects),
		k.z(300),
		tags.tacticalMap,
	])

	k.add([
		k.text(`SECTOR MAP  //  SEED ${snapshot.seed}`, {
			size: 15,
			font: "unscii",
		}),
		k.pos(MAP_MARGIN, 17),
		k.color(...UI_COLORS.accent),
		k.fixed(),
		k.layer(layers.uiEffects),
		k.z(302),
		tags.tacticalMap,
	])

	const viewport = k.add([
		k.rect(viewportSize.x, viewportSize.y),
		k.pos(viewportPos),
		uiHitRegion(viewportSize),
		k.color(0, 0, 0),
		k.outline(1, k.rgb(...UI_COLORS.muted)),
		k.mask("intersect"),
		k.fixed(),
		k.layer(layers.uiEffects),
		k.z(301),
		tags.tacticalMap,
	])

	const geometry = createMapGeometry(snapshot.cells)
	const rasterizedMap = rasterizeMap(
		geometry,
		snapshot.playerPosition,
		snapshot.playerPath
	)
	const fitScale = Math.min(
		(viewportSize.x - 30) / rasterizedMap.width,
		(viewportSize.y - 30) / rasterizedMap.height
	)
	if (rememberedMapSeed !== snapshot.seed) {
		rememberedMapSeed = snapshot.seed
		rememberedZoomMultiplier = 1
	}
	let zoom = k.clamp(
		fitScale * rememberedZoomMultiplier,
		fitScale * MAP_MIN_ZOOM,
		fitScale * MAP_MAX_ZOOM
	)
	const focusedMapPos = (scale: number) =>
		viewportSize
			.scale(0.5)
			.sub(rasterizedMap.playerPosition.scale(scale))
	const rememberZoom = () => {
		rememberedZoomMultiplier = zoom / fitScale
	}

	const mapCanvas = viewport.add([
		k.sprite(rasterizedMap.sprite),
		k.pos(focusedMapPos(zoom)),
		k.scale(zoom),
	])
	mapCanvas.onDestroy(() => rasterizedMap.sprite.data?.tex.free())

	let dragging = false
	let previousMousePos = k.mousePos()
	inputControllers = [
		k.onMousePress("left", () => {
			if (!viewport.isHovering()) return
			dragging = true
			previousMousePos = k.mousePos()
		}),
		k.onMouseMove(() => {
			if (!dragging) return
			const mousePos = k.mousePos()
			mapCanvas.pos = mapCanvas.pos.add(mousePos.sub(previousMousePos))
			previousMousePos = mousePos
		}),
		k.onMouseRelease("left", () => {
			dragging = false
		}),
		k.onScroll((delta) => {
			if (!viewport.isHovering()) return
			const previousZoom = zoom
			const zoomFactor = Math.exp(-delta.y * 0.12)
			zoom = k.clamp(
				zoom * zoomFactor,
				fitScale * MAP_MIN_ZOOM,
				fitScale * MAP_MAX_ZOOM
			)
			const mouseInViewport = k.mousePos().sub(viewportPos)
			const mapPoint = mouseInViewport.sub(mapCanvas.pos).scale(1 / previousZoom)
			mapCanvas.pos = mouseInViewport.sub(mapPoint.scale(zoom))
			mapCanvas.scale = k.vec2(zoom)
			rememberZoom()
		}),
		k.onKeyPress("r", () => {
			zoom = fitScale
			mapCanvas.scale = k.vec2(fitScale)
			mapCanvas.pos = focusedMapPos(fitScale)
			rememberZoom()
		}),
	]

	registerBatchedUiUpdate("modal", mapCanvas, () => {
		const panDirection = k.vec2(
			(k.isKeyDown("d") ? 1 : 0) - (k.isKeyDown("a") ? 1 : 0),
			(k.isKeyDown("s") ? 1 : 0) - (k.isKeyDown("w") ? 1 : 0)
		)
		if (panDirection.len() !== 0) {
			mapCanvas.pos = mapCanvas.pos.add(panDirection.unit().scale(260 * k.dt()))
		}
	})

	addZoneSidebar(snapshot.cells, sidebarX, viewportPos.y, sidebarWidth, viewportSize.y)
	k.add([
		k.text("DRAG / WASD  PAN     WHEEL  ZOOM     R  RESET     TAB / ESC  CLOSE", {
			size: 9,
			font: "unscii",
		}),
		k.pos(MAP_MARGIN, k.height() - 20),
		k.color(...UI_COLORS.muted),
		k.fixed(),
		k.layer(layers.uiEffects),
		k.z(302),
		tags.tacticalMap,
	])

	return true
}

export function hideTacticalMap() {
	if (!open) return
	open = false
	uiState.modalOpen = false
	for (const controller of inputControllers) controller.cancel()
	inputControllers = []
	zoneScroll?.destroy()
	zoneScroll = undefined
	k.destroyAll(tags.tacticalMap)
	for (const obj of pausedObjects) {
		if (obj.exists()) obj.paused = false
	}
	pausedObjects.clear()
	loopService.resumeAll()
}

interface MapCellGeometry extends GeneratedRunMapCell {
	center: Vec2
	corners: Vec2[]
}

interface MapGeometry {
	cells: MapCellGeometry[]
	min: Vec2
	width: number
	height: number
}

interface RasterizedMap {
	sprite: Asset<SpriteData>
	width: number
	height: number
	playerPosition: Vec2
}

function createMapGeometry(cells: GeneratedRunMapCell[]) {
	const mappedCells: MapCellGeometry[] = cells.map((cell) => ({
		...cell,
		center: hexToPixel(cell, 1),
		corners: hexCorners(cell, 1),
	}))
	const points = mappedCells.flatMap((cell) => cell.corners)
	const min = k.vec2(
		Math.min(...points.map((point) => point.x)),
		Math.min(...points.map((point) => point.y))
	)
	const max = k.vec2(
		Math.max(...points.map((point) => point.x)),
		Math.max(...points.map((point) => point.y))
	)
	return {
		cells: mappedCells,
		min,
		width: max.x - min.x,
		height: max.y - min.y,
	}
}

function rasterizeMap(
	geometry: MapGeometry,
	playerPosition: Vec2,
	playerPath: Vec2[]
): RasterizedMap {
	const availableWidth = MAP_MAX_RASTER_SIZE - MAP_RASTER_PADDING * 2
	const availableHeight = MAP_MAX_RASTER_SIZE - MAP_RASTER_PADDING * 2
	const pixelsPerUnit = Math.min(
		MAP_RASTER_PIXELS_PER_UNIT,
		availableWidth / Math.max(1, geometry.width),
		availableHeight / Math.max(1, geometry.height)
	)
	const width = Math.max(
		1,
		Math.ceil(geometry.width * pixelsPerUnit + MAP_RASTER_PADDING * 2)
	)
	const height = Math.max(
		1,
		Math.ceil(geometry.height * pixelsPerUnit + MAP_RASTER_PADDING * 2)
	)
	const canvas = document.createElement("canvas")
	canvas.width = width
	canvas.height = height
	const context = canvas.getContext("2d")
	if (!context) throw new Error("Unable to create tactical map canvas")
	context.imageSmoothingEnabled = false
	context.lineJoin = "round"
	const toRasterPosition = (point: Vec2) =>
		point
			.sub(geometry.min)
			.scale(pixelsPerUnit)
			.add(MAP_RASTER_PADDING, MAP_RASTER_PADDING)

	for (const cell of geometry.cells) {
		if (!cell.revealed) continue
		if (!cell.solid && !cell.role && !cell.volatileCargoObjective) continue
		const roleColor = cell.role ? getRoomColor(cell.role) : undefined
		const color = cell.solid
			? cell.destructible
				? k.rgb(58, 48, 35)
				: k.rgb(31, 39, 46)
			: roleColor ?? k.rgb(10, 18, 24)
		const opacity = cell.solid ? 0.8 : cell.role ? 0.72 : 1
		const corners = cell.corners.map(toRasterPosition)

		tracePolygon(context, corners)
		context.fillStyle = canvasColor(color, opacity)
		context.fill()
		context.lineWidth = cell.roomAnchor ? 2 : 1
		context.strokeStyle = canvasColor(
			cell.roomAnchor
				? k.WHITE
				: cell.destructible
					? k.rgb(205, 155, 70)
					: k.rgb(50, 62, 72),
			opacity
		)
		context.stroke()
		if (cell.destructible) {
			drawDestructibleMapMark(
				context,
				toRasterPosition(cell.center),
				pixelsPerUnit
			)
		}
		if (cell.volatileCargoObjective) {
			drawVolatileCargoMapMark(
				context,
				toRasterPosition(cell.center),
				pixelsPerUnit
			)
		}
	}

	const routePoints = playerPath.map(toRasterPosition)
	context.lineCap = "round"
	for (let index = 0; index < routePoints.length - 1; index++) {
		const progress = (index + 1) / Math.max(1, routePoints.length - 1)
		const opacity = 0.05 + Math.pow(progress, 1.6) * 0.85
		context.beginPath()
		context.moveTo(routePoints[index].x, routePoints[index].y)
		context.lineTo(routePoints[index + 1].x, routePoints[index + 1].y)
		context.lineWidth = Math.max(2, pixelsPerUnit * 0.16)
		context.strokeStyle = canvasColor(
			k.rgb(...UI_COLORS.accent),
			opacity
		)
		context.stroke()
	}

	const playerCenter = toRasterPosition(playerPosition)
	context.beginPath()
	context.arc(
		playerCenter.x,
		playerCenter.y,
		0.34 * pixelsPerUnit,
		0,
		Math.PI * 2
	)
	context.fillStyle = canvasColor(k.WHITE)
	context.fill()
	context.lineWidth = 2
	context.strokeStyle = canvasColor(k.BLACK)
	context.stroke()

	return {
		sprite: k.loadSprite(null, canvas, { singular: true }),
		width,
		height,
		playerPosition: playerCenter,
	}
}

function tracePolygon(context: CanvasRenderingContext2D, points: Vec2[]) {
	if (points.length === 0) return
	context.beginPath()
	context.moveTo(points[0].x, points[0].y)
	for (let index = 1; index < points.length; index++) {
		context.lineTo(points[index].x, points[index].y)
	}
	context.closePath()
}

function drawDestructibleMapMark(
	context: CanvasRenderingContext2D,
	center: Vec2,
	pixelsPerUnit: number
) {
	const size = pixelsPerUnit * 0.34
	context.beginPath()
	context.moveTo(center.x - size, center.y - size * 0.65)
	context.lineTo(center.x - size * 0.12, center.y - size * 0.08)
	context.lineTo(center.x - size * 0.4, center.y + size * 0.32)
	context.lineTo(center.x + size, center.y + size * 0.72)
	context.lineWidth = 1.5
	context.strokeStyle = canvasColor(k.rgb(255, 205, 95), 0.9)
	context.stroke()
}

function drawVolatileCargoMapMark(
	context: CanvasRenderingContext2D,
	center: Vec2,
	pixelsPerUnit: number
) {
	const radius = pixelsPerUnit * 0.32
	context.beginPath()
	context.moveTo(center.x, center.y - radius)
	context.lineTo(center.x + radius, center.y)
	context.lineTo(center.x, center.y + radius)
	context.lineTo(center.x - radius, center.y)
	context.closePath()
	context.fillStyle = canvasColor(k.rgb(255, 145, 45), 0.95)
	context.fill()
	context.lineWidth = 2
	context.strokeStyle = canvasColor(k.WHITE)
	context.stroke()
}

function canvasColor(color: Color, opacity = 1) {
	return `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity})`
}

function addZoneSidebar(
	cells: GeneratedRunMapCell[],
	x: number,
	y: number,
	width: number,
	height: number
) {
	k.add([
		k.text("OBJECTIVES // ZONES", { size: 12, font: "unscii" }),
		k.pos(x, y),
		k.color(...UI_COLORS.accent),
		k.fixed(),
		k.layer(layers.uiEffects),
		k.z(302),
		tags.tacticalMap,
	])

	const zones = cells
		.filter((cell) => cell.revealed && cell.roomAnchor && cell.role)
		.sort((a, b) => a.r - b.r || a.q - b.q)
	const cargoObjective = cells.find(
		(cell) => cell.revealed && cell.volatileCargoObjective
	)
	const scrollY = y + 24
	const scrollHeight = height - 24
	const rowHeight = 42
	const objectiveRows = cargoObjective ? 1 : 0
	zoneScroll = createUiScrollable({
		pos: k.vec2(x, scrollY),
		width,
		height: scrollHeight,
		contentHeight: Math.max(
			scrollHeight,
			(zones.length + objectiveRows) * rowHeight + 12
		),
		scrollStep: rowHeight,
		layer: layers.uiEffects,
		zIndex: 302,
		tags: [tags.tacticalMap],
	})
	if (cargoObjective) {
		zoneScroll.content.add([
			k.rect(6, 28),
			k.pos(7, 8),
			k.color(255, 145, 45),
		])
		zoneScroll.content.add([
			k.text("OBJ  VOLATILE CARGO", {
				size: 9,
				font: "unscii",
				width: width - 24,
			}),
			k.pos(19, 8),
			k.color(255, 175, 75),
		])
		zoneScroll.content.add([
			k.text(`HEX ${cargoObjective.q},${cargoObjective.r}`, {
				size: 8,
				font: "unscii",
			}),
			k.pos(19, 23),
			k.color(...UI_COLORS.muted),
		])
	}

	zones.forEach((zone, index) => {
		const role = zone.role!
		const yPos = 8 + (index + objectiveRows) * rowHeight
		zoneScroll!.content.add([
			k.rect(6, 28),
			k.pos(7, yPos),
			k.color(getRoomColor(role)),
		])
		zoneScroll!.content.add([
			k.text(`${String(index + 1).padStart(2, "0")}  ${getRoomLabel(role)}`, {
				size: 9,
				font: "unscii",
				width: width - 24,
			}),
			k.pos(19, yPos),
			k.color(k.WHITE),
		])
		zoneScroll!.content.add([
			k.text(`HEX ${zone.q},${zone.r}`, { size: 8, font: "unscii" }),
			k.pos(19, yPos + 15),
			k.color(...UI_COLORS.muted),
		])
	})
}
