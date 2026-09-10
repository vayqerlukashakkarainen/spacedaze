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
import { quickJumpToClearedRoom } from "../levels/roomFloorRuntime"
import { activeLevelKey } from "../levels/levels"
import {
	getFloorPositionForDepth,
	getFloorThemeDefinition,
} from "../levels/floorThemes/floorThemeDirectory"
import { k, layers } from "../main"
import { getPickupVisual } from "../visuals/pickupVisualCatalog"
import { requirePrimaryVisualSprite } from "../visuals/visualRepresentation"
import type {
	RoomFloor,
	RoomFloorKind,
	RoomFloorRoom,
	RoomFloorState,
} from "../generation/rooms/roomFloorTypes"
import {
	getHubLevel,
	getHubLevelProgress,
	hasUnseenBlueprints,
	HUB_FACILITIES,
	isFacilityBuilt,
} from "../services/hub/hubProgressService"
import {
	HUB_FACILITY_OFFSETS,
	HUB_HALF_HEIGHT,
	HUB_HALF_WIDTH,
	HUB_PHASE_FIELD_OFFSET,
	HUB_WORMHOLE_OFFSET,
} from "../services/hub/hubLayoutService"
import { getHubSettlementState } from "../services/hub/hubSettlementService"
import { loopService } from "../services/core/loopService"
import { getRoomFloorSnapshot } from "../services/world/roomFloorService"
import { tags } from "../tags"
import { createUiScrollable, UiScrollableControl } from "./common/scrollable"
import {
	addThemedText,
	createUiActionButton,
	createUiPanel,
	createUiProgressBar,
	createUiSectionHeader,
	createUiSurface,
	playUiModalClose,
	playUiModalOpen,
	UI_COLORS,
	UI_FONT_SIZES,
} from "./common"
import { addCompendiumContent } from "./hubFacilities"
import { uiState } from "./uiState"
import { registerBatchedUiUpdate } from "../services/ui/uiUpdateService"
import { uiHitRegion } from "./common/hitRegion"
import {
	playShopMenuCloseSound,
	playShopMenuOpenSound,
} from "../services/audio/shopMenuSoundService"
import { audioService } from "../services/audio/audioService"
import {
	formatInputBinding,
	getInputBinding,
	isInputActionDown,
} from "../services/input/inputBindingService"

const MAP_MARGIN = 22
const MAP_TOP_PADDING = 10
const MAP_HEADER_HEIGHT = 48
const MAP_TAB_BAR_HEIGHT = 40
const MAP_PROGRESS_HEIGHT = 48
const MAP_FOOTER_HEIGHT = 34
const MAP_MIN_ZOOM = 0.7
const MAP_MAX_ZOOM = 5
const MAP_RASTER_PIXELS_PER_UNIT = 14
const MAP_RASTER_PADDING = 8
const MAP_MAX_RASTER_SIZE = 2048
const MAP_MUSIC_MULTIPLIER = 0.4
const MAP_MUSIC_FADE_DURATION = 0.35

let open = false
let closing = false
let inputControllers: KEventController[] = []
let pausedObjects = new Set<GameObj>()
let hiddenWorldObjects = new Set<GameObj>()
let zoneScroll: UiScrollableControl | undefined
let activeRoot: GameObj | undefined
let activeBackdrop: GameObj | undefined
let afterCloseAction: (() => void) | undefined
let rememberedMapKey: string | undefined
let rememberedZoomMultiplier = 1

type NavigationTab = "map" | "compendium"

type HubMapLandmarkKind = "core" | "facility" | "settlement" | "phase" | "wormhole"

interface HubMapLandmark {
	id: string
	label: string
	position: Vec2
	kind: HubMapLandmarkKind
	built: boolean
}

interface HubMapSnapshot {
	level: number
	playerPosition: Vec2
	landmarks: HubMapLandmark[]
}

interface RoomDirectoryEntry {
	rooms: RoomFloorRoom[]
	typeHidden: boolean
	current: boolean
}

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

export function showTacticalMap(initialTab: NavigationTab = "map") {
	if (open) return true
	const hubSnapshot = activeLevelKey() === "hub"
		? createHubMapSnapshot()
		: undefined
	const roomFloorSnapshot = hubSnapshot ? undefined : getRoomFloorSnapshot()
	const roomFloorName = roomFloorSnapshot
		? getFloorThemeDefinition(roomFloorSnapshot.themeId).name.toUpperCase()
		: undefined
	const roomFloorPosition = roomFloorSnapshot
		? getFloorPositionForDepth(roomFloorSnapshot.depth)
		: undefined
	const runSnapshot = hubSnapshot || roomFloorSnapshot
		? undefined
		: getGeneratedRunMapSnapshot()
	if (!hubSnapshot && !roomFloorSnapshot && !runSnapshot) return false

	open = true
	closing = false
	afterCloseAction = undefined
	uiState.modalOpen = true
	audioService.fadeMusicDucking(
		MAP_MUSIC_MULTIPLIER,
		MAP_MUSIC_FADE_DURATION
	)
	pausedObjects = new Set()
	hiddenWorldObjects = new Set()
	for (const obj of k.get<GameObj>(tags.gameLoop)) {
		if (!obj.paused) {
			obj.paused = true
			pausedObjects.add(obj)
		}
		if (!obj.hidden) {
			obj.hidden = true
			hiddenWorldObjects.add(obj)
		}
	}
	loopService.pauseAll()

	const sidebarWidth = hubSnapshot
		? 0
		: k.clamp(k.width() * 0.24, 190, 280)
	const floorTreeWidth = roomFloorSnapshot
		? k.clamp(k.width() * 0.18, 160, 220)
		: 0
	const viewportPos = k.vec2(
		MAP_MARGIN + (floorTreeWidth > 0 ? floorTreeWidth + MAP_MARGIN : 0),
		MAP_TOP_PADDING + MAP_HEADER_HEIGHT + MAP_TAB_BAR_HEIGHT +
			MAP_PROGRESS_HEIGHT
	)
	const viewportSize = k.vec2(
		Math.max(
			220,
			k.width() - sidebarWidth - floorTreeWidth - MAP_MARGIN * (
				hubSnapshot ? 2 : roomFloorSnapshot ? 4 : 3
			)
		),
		Math.max(
			180,
			k.height() - MAP_TOP_PADDING - MAP_HEADER_HEIGHT -
				MAP_TAB_BAR_HEIGHT - MAP_PROGRESS_HEIGHT - MAP_FOOTER_HEIGHT
		)
	)
	const sidebarX = viewportPos.x + viewportSize.x + MAP_MARGIN

	const backdrop = k.add([
		k.rect(k.width(), k.height()),
		k.pos(0, 0),
		k.color(...UI_COLORS.background),
		k.opacity(0.92),
		k.animate(),
		k.fixed(),
		k.layer(layers.uiEffects),
		tags.tacticalMap,
	])
	const root = createUiPanel({
		pos: k.center(),
		size: k.vec2(k.width(), k.height()),
		anchor: "center",
		layer: layers.uiEffects,
		tags: [tags.tacticalMap],
		animated: true,
	})
	const contentRoot = root.add([
		k.pos(-k.width() / 2, -k.height() / 2),
	])
	const headerRoot = contentRoot.add([k.pos(0, 0)])
	const navigationTabsRoot = contentRoot.add([k.pos(0, 0)])
	const mapContentRoot = contentRoot.add([k.pos(0, 0)])
	let compendiumContentRoot: GameObj | undefined
	let activeNavigationTab = initialTab
	activeBackdrop = backdrop
	activeRoot = root

	const renderNavigationTab = () => {
		destroyUiChildren(headerRoot)
		destroyUiChildren(navigationTabsRoot)
		if (compendiumContentRoot?.exists()) {
			destroyUiTree(compendiumContentRoot)
		}
		compendiumContentRoot = undefined
		mapContentRoot.hidden = activeNavigationTab !== "map"

		createUiSectionHeader(headerRoot, {
			pos: k.vec2(MAP_MARGIN, MAP_TOP_PADDING),
			width: k.width() - MAP_MARGIN * 2,
			height: MAP_HEADER_HEIGHT,
			eyebrow: "NAVIGATION COMPUTER",
			title: activeNavigationTab === "compendium"
				? "COMPENDIUM"
				: hubSnapshot
					? `HUB MAP  //  LEVEL ${hubSnapshot.level}`
					: roomFloorSnapshot
						? `FLOOR ${roomFloorPosition!.floor}.${roomFloorPosition!.subfloor}  //  ${roomFloorName}  //  SEED ${roomFloorSnapshot.seed}`
						: `SECTOR MAP  //  SEED ${runSnapshot!.seed}`,
			action: activeNavigationTab === "compendium"
				? `HUB LEVEL ${getHubLevel()}`
				: hubSnapshot
					? "LIVE STATION SURVEY"
					: roomFloorSnapshot
						? "DISCOVERED ROOM NETWORK"
						: "LIVE CARTOGRAPHY",
		})
		for (const [index, tab] of (["map", "compendium"] as const).entries()) {
			createUiActionButton(navigationTabsRoot, {
				pos: k.vec2(
					MAP_MARGIN + index * 158,
					MAP_TOP_PADDING + MAP_HEADER_HEIGHT + 4
				),
				size: k.vec2(150, 32),
				text: tab.toUpperCase(),
				selected: activeNavigationTab === tab,
				notification: tab === "compendium" && hasUnseenBlueprints(),
				onClick: () => {
					if (activeNavigationTab === tab) return
					activeNavigationTab = tab
					renderNavigationTab()
				},
			})
		}
		if (activeNavigationTab !== "compendium") return
		compendiumContentRoot = contentRoot.add([k.pos(0, 0)])
		const compendiumWidth = k.width() - MAP_MARGIN * 2
		const compendiumTop = MAP_TOP_PADDING + MAP_HEADER_HEIGHT +
			MAP_TAB_BAR_HEIGHT + 12
		addCompendiumContent(compendiumContentRoot, {
			left: MAP_MARGIN,
			top: compendiumTop,
			width: compendiumWidth,
			bottom: k.height() - MAP_FOOTER_HEIGHT,
		})
	}
	const hubLevelProgress = getHubLevelProgress()
	const hubXpRemaining = Math.max(
		0,
		hubLevelProgress.required - hubLevelProgress.current
	)
	const mapProgressTop = MAP_TOP_PADDING + MAP_HEADER_HEIGHT +
		MAP_TAB_BAR_HEIGHT + 4
	addThemedText(mapContentRoot, {
		text: `HUB LEVEL ${hubLevelProgress.level}`,
		pos: k.vec2(MAP_MARGIN, mapProgressTop),
		variant: "caption",
		width: k.width() - MAP_MARGIN * 2,
	})
	addThemedText(mapContentRoot, {
		text: hubLevelProgress.progress >= 1
			? `${hubLevelProgress.current} DEPOSITED  //  MAXIMUM LEVEL`
			: `${hubLevelProgress.current} / ${hubLevelProgress.required} DEPOSITED  //  ${hubXpRemaining} NEEDED`,
		pos: k.vec2(MAP_MARGIN, mapProgressTop),
		variant: "muted",
		width: k.width() - MAP_MARGIN * 2,
		align: "right",
	})
	createUiProgressBar(mapContentRoot, {
		pos: k.vec2(MAP_MARGIN, mapProgressTop + 20),
		width: k.width() - MAP_MARGIN * 2,
		height: 6,
		value: hubLevelProgress.progress,
		color: hubLevelProgress.progress >= 1
			? UI_COLORS.success
			: UI_COLORS.accent,
	})

	const viewport = createUiSurface(mapContentRoot, {
		pos: viewportPos,
		size: viewportSize,
		tone: "raised",
	})
	viewport.use(uiHitRegion(viewportSize))
	viewport.use(k.mask("intersect"))

	const rasterizedMap = hubSnapshot
		? rasterizeHubMap(hubSnapshot)
		: roomFloorSnapshot
			? rasterizeRoomFloorMap(roomFloorSnapshot)
			: rasterizeMap(
			createMapGeometry(runSnapshot!.cells),
			runSnapshot!.playerPosition,
			runSnapshot!.playerPath
		)
	const fitScale = Math.min(
		(viewportSize.x - 30) / rasterizedMap.width,
		(viewportSize.y - 30) / rasterizedMap.height
	)
	const mapKey = hubSnapshot
		? "hub"
		: roomFloorSnapshot
			? `floor:${roomFloorSnapshot.seed}:${roomFloorSnapshot.depth}`
			: `run:${runSnapshot!.seed}`
	if (rememberedMapKey !== mapKey) {
		rememberedMapKey = mapKey
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
	for (const position of rasterizedMap.lockedLinks ?? []) {
		const marker = mapCanvas.add([
			k.pos(position),
			k.circle(11),
			k.anchor("center"),
			k.color(...UI_COLORS.background),
			k.opacity(0.96),
			k.outline(2, k.rgb(...UI_COLORS.warning)),
			k.z(20),
		])
		marker.add([
			k.sprite(requirePrimaryVisualSprite(getPickupVisual("room-key")), { width: 16, height: 16 }),
			k.anchor("center"),
			k.color(...UI_COLORS.warning),
		])
	}
	mapCanvas.onDestroy(() => rasterizedMap.sprite.data?.tex?.free())
	const roomNodes = rasterizedMap.roomNodes ?? []
	if (roomFloorSnapshot) {
		const currentRoomNode = roomNodes.find(
			(node) => node.roomId === roomFloorSnapshot.currentRoomId
		)
		if (currentRoomNode) {
			addCurrentRoomMarker(mapCanvas, currentRoomNode.position)
		}
	}
	const currentRoom = roomFloorSnapshot?.rooms.find(
		(room) => room.id === roomFloorSnapshot.currentRoomId
	)
	const canQuickJump = (node: RoomMapNode) =>
		currentRoom?.state === "cleared" &&
		node.roomId !== roomFloorSnapshot?.currentRoomId &&
		node.state === "cleared"
	const roomNodeAt = (screenPosition: Vec2) => {
		if (!roomFloorSnapshot || roomNodes.length === 0) return undefined
		const mapPoint = screenPosition
			.sub(viewportPos)
			.sub(mapCanvas.pos)
			.scale(1 / zoom)
		return roomNodes.find(
			(node) => node.position.dist(mapPoint) <= ROOM_MAP_NODE_RADIUS + 5
		)
	}
	if (roomFloorSnapshot) {
		viewport.add([
			k.pos(0, 0),
			{
				draw() {
					if (activeNavigationTab !== "map") return
					const node = roomNodeAt(k.mousePos())
					if (!node || !canQuickJump(node)) return
					const center = mapCanvas.pos.add(node.position.scale(zoom))
					const corners = Array.from({ length: 6 }, (_, index) => {
						const angle = Math.PI / 3 * index - Math.PI / 2
						const radius = (ROOM_MAP_NODE_RADIUS + 5) * zoom
						return center.add(
							Math.cos(angle) * radius,
							Math.sin(angle) * radius
						)
					})
					k.drawPolygon({
						pts: corners,
						color: k.rgb(...UI_COLORS.accent),
						opacity: 0.14,
						outline: {
							width: 2,
							color: k.rgb(...UI_COLORS.accent),
						},
					})
				},
			},
		])
	}

	let dragging = false
	let previousMousePos = k.mousePos()
	let pressedMousePos: Vec2 | undefined
	inputControllers = [
		k.onMousePress("left", () => {
			if (activeNavigationTab !== "map") return
			if (!viewport.isHovering()) return
			dragging = true
			previousMousePos = k.mousePos()
			pressedMousePos = previousMousePos
		}),
		k.onMouseMove(() => {
			if (activeNavigationTab !== "map") return
			if (!dragging) return
			const mousePos = k.mousePos()
			mapCanvas.pos = mapCanvas.pos.add(mousePos.sub(previousMousePos))
			previousMousePos = mousePos
		}),
		k.onMouseRelease("left", () => {
			if (activeNavigationTab !== "map") return
			const releasedAt = k.mousePos()
			const clicked = pressedMousePos && pressedMousePos.dist(releasedAt) <= 6
			dragging = false
			pressedMousePos = undefined
			if (!clicked) return
			const node = roomNodeAt(releasedAt)
			if (!node || !canQuickJump(node)) return
			hideTacticalMap(() => {
				quickJumpToClearedRoom(node.roomId)
			})
		}),
		k.onScroll((delta) => {
			if (activeNavigationTab !== "map") return
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
			if (activeNavigationTab !== "map") return
			zoom = fitScale
			mapCanvas.scale = k.vec2(fitScale)
			mapCanvas.pos = focusedMapPos(fitScale)
			rememberZoom()
		}),
	]

	registerBatchedUiUpdate("modal", mapCanvas, () => {
		if (activeNavigationTab !== "map") return
		const panDirection = k.vec2(
			(isInputActionDown("moveRight") ? 1 : 0) -
				(isInputActionDown("moveLeft") ? 1 : 0),
			(isInputActionDown("moveDown") ? 1 : 0) -
				(isInputActionDown("moveUp") ? 1 : 0)
		)
		if (panDirection.len() !== 0) {
			mapCanvas.pos = mapCanvas.pos.sub(panDirection.unit().scale(260 * k.dt()))
		}
	})

	if (roomFloorSnapshot) {
		addSublevelTree(
			mapContentRoot,
			roomFloorSnapshot,
			MAP_MARGIN,
			viewportPos.y,
			floorTreeWidth,
			viewportSize.y
		)
		addRoomFloorSidebar(
			mapContentRoot,
			roomFloorSnapshot,
			sidebarX,
			viewportPos.y,
			sidebarWidth,
			viewportSize.y
		)
	} else if (!hubSnapshot) {
		addZoneSidebar(
			mapContentRoot,
			runSnapshot!.cells,
			sidebarX,
			viewportPos.y,
			sidebarWidth,
			viewportSize.y
		)
	}
	addThemedText(mapContentRoot, {
		text: roomFloorSnapshot
			? `CLICK CLEARED ROOM  QUICK JUMP     DRAG / ${movementBindingLabel()}  PAN     WHEEL  ZOOM     R  RESET     ${closeBindingLabel()}  CLOSE`
			: `DRAG / ${movementBindingLabel()}  PAN     WHEEL  ZOOM     R  RESET     ${closeBindingLabel()}  CLOSE`,
		pos: k.vec2(MAP_MARGIN, k.height() - 20),
		variant: "muted",
		width: k.width() - MAP_MARGIN * 2,
	})
	renderNavigationTab()

	playUiModalOpen(backdrop, root, {
		panelPos: k.center(),
		backdropOpacity: 0.92,
	})
	playShopMenuOpenSound()

	return true
}

function movementBindingLabel() {
	return (["moveUp", "moveLeft", "moveDown", "moveRight"] as const)
		.map((action) => formatInputBinding(getInputBinding(action)))
		.join(" / ")
}

function closeBindingLabel() {
	return `${formatInputBinding(getInputBinding("tacticalMap"))} / ${formatInputBinding(getInputBinding("pause"))}`
}

export function hideTacticalMap(onClosed?: () => void) {
	if (!open || closing) return
	closing = true
	afterCloseAction = onClosed
	audioService.fadeMusicDucking(1, MAP_MUSIC_FADE_DURATION)
	for (const controller of inputControllers) controller.cancel()
	inputControllers = []
	playShopMenuCloseSound()
	const root = activeRoot
	const backdrop = activeBackdrop
	if (!root?.exists() || !backdrop?.exists()) {
		finishClosingTacticalMap()
		return
	}
	void playUiModalClose(backdrop, root, {
		panelPos: k.center(),
		backdropOpacity: 0.92,
	}).then(finishClosingTacticalMap)
}

function finishClosingTacticalMap() {
	open = false
	closing = false
	uiState.modalOpen = false
	zoneScroll?.destroy()
	zoneScroll = undefined
	k.destroyAll(tags.tacticalMap)
	for (const obj of pausedObjects) {
		if (obj.exists()) obj.paused = false
	}
	pausedObjects.clear()
	for (const obj of hiddenWorldObjects) {
		if (obj.exists()) obj.hidden = false
	}
	hiddenWorldObjects.clear()
	loopService.resumeAll()
	activeRoot = undefined
	activeBackdrop = undefined
	const action = afterCloseAction
	afterCloseAction = undefined
	action?.()
}

function destroyUiChildren(parent: GameObj) {
	for (const child of [...parent.children]) destroyUiTree(child)
}

function destroyUiTree(obj: GameObj) {
	for (const child of [...obj.children]) destroyUiTree(child)
	k.destroy(obj)
}

function createHubMapSnapshot(): HubMapSnapshot | undefined {
	const player = k.get<GameObj>(tags.player)[0]
	if (!player?.exists()) return undefined
	const level = getHubLevel()
	const landmarks: HubMapLandmark[] = [
		{
			id: "hub-core",
			label: "HUB CORE",
			position: k.vec2(0, 0),
			kind: "core",
			built: true,
		},
		...HUB_FACILITIES
			.filter((facility) => facility.id !== "trainingRange")
			.map((facility) => ({
			id: facility.id,
			label: facility.name,
			position: k.vec2(...HUB_FACILITY_OFFSETS[facility.id]),
			kind: "facility" as const,
			built: isFacilityBuilt(facility.id),
		})),
		{
			id: "phase-field",
			label: "PHASE FIELD",
			position: k.vec2(...HUB_PHASE_FIELD_OFFSET),
			kind: "phase",
			built: true,
		},
		{
			id: "wormhole",
			label: "WORMHOLE",
			position: k.vec2(...HUB_WORMHOLE_OFFSET),
			kind: "wormhole",
			built: true,
		},
		...getHubSettlementState(level).map((plot) => ({
			id: plot.id,
			label: plot.id.replaceAll("-", " ").toUpperCase(),
			position: k.vec2(...plot.position),
			kind: "settlement" as const,
			built: plot.built,
		})),
	]
	return {
		level,
		playerPosition: player.pos.sub(k.center()),
		landmarks,
	}
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
	roomNodes?: RoomMapNode[]
	lockedLinks?: Vec2[]
}

interface RoomMapNode {
	roomId: string
	position: Vec2
	state: RoomFloorState
}

const ROOM_MAP_NODE_RADIUS = 28
const ROOM_MAP_HEX_SIZE = 96
const ROOM_MAP_PADDING = 54

function addCurrentRoomMarker(parent: GameObj, position: Vec2) {
	const marker = parent.add([
		k.pos(position),
		k.z(30),
		{
			draw() {
				const pulse = k.wave(0, 1, k.time() * 3.2)
				k.drawCircle({
					radius: k.lerp(34, 42, pulse),
					fill: false,
					opacity: k.lerp(0.95, 0.35, pulse),
					outline: {
						width: 2,
						color: k.WHITE,
					},
				})
			}
		},
	])
	marker.add([
		k.text("YOU ARE HERE", {
			size: 8,
			font: "unscii",
		}),
		k.pos(0, 48),
		k.anchor("top"),
		k.color(k.WHITE),
		k.outline(2, k.BLACK),
		k.z(31),
	])
}

function rasterizeRoomFloorMap(snapshot: RoomFloor): RasterizedMap {
	const rooms = snapshot.rooms.filter((room) => room.state !== "unseen")
	const centers = new Map<string, Vec2>()
	for (const room of rooms) {
		centers.set(room.id, hexToPixel(room.coord, ROOM_MAP_HEX_SIZE))
	}
	const allCenters = [...centers.values()]
	const contentMin = k.vec2(
		Math.min(...allCenters.map((center) => center.x)) - ROOM_MAP_PADDING,
		Math.min(...allCenters.map((center) => center.y)) - ROOM_MAP_PADDING
	)
	const contentMax = k.vec2(
		Math.max(...allCenters.map((center) => center.x)) + ROOM_MAP_PADDING,
		Math.max(...allCenters.map((center) => center.y)) + ROOM_MAP_PADDING
	)
	const contentSize = contentMax.sub(contentMin)
	const width = Math.max(520, Math.ceil(contentSize.x))
	const height = Math.max(360, Math.ceil(contentSize.y))
	const contentOffset = k.vec2(
		(width - contentSize.x) / 2,
		(height - contentSize.y) / 2
	)
	const canvas = document.createElement("canvas")
	canvas.width = width
	canvas.height = height
	const context = canvas.getContext("2d")
	if (!context) throw new Error("Unable to create room floor map canvas")
	context.imageSmoothingEnabled = false
	context.lineCap = "round"
	context.lineJoin = "round"
	const toRasterPosition = (position: Vec2) =>
		position.sub(contentMin).add(contentOffset)

	const renderedConnections = new Set<string>()
	const lockedLinks: Vec2[] = []
	const roomById = new Map(rooms.map((room) => [room.id, room]))
	for (const room of rooms) {
		const from = centers.get(room.id)
		if (!from) continue
		for (const connectionId of room.connections) {
			const to = centers.get(connectionId)
			const connectedRoom = roomById.get(connectionId)
			if (!to || !connectedRoom) continue
			const key = [room.id, connectionId].sort().join(":")
			if (renderedConnections.has(key)) continue
			renderedConnections.add(key)
			const start = toRasterPosition(from)
			const end = toRasterPosition(to)
			context.beginPath()
			context.moveTo(start.x, start.y)
			context.lineTo(end.x, end.y)
			context.lineWidth = 12
			context.strokeStyle = canvasColor(k.rgb(...UI_COLORS.border), 0.5)
			context.stroke()
			context.lineWidth = 3
			context.strokeStyle = canvasColor(k.rgb(...UI_COLORS.muted), 0.8)
			context.stroke()
			if (roomMapRoomIsKeyLocked(room) || roomMapRoomIsKeyLocked(connectedRoom)) {
				lockedLinks.push(start.add(end).scale(0.5))
			}
		}
	}

	for (const room of rooms) {
		const center = centers.get(room.id)
		if (!center) continue
		drawRoomMapNode(context, toRasterPosition(center), room)
	}

	const currentRoomCenter = centers.get(snapshot.currentRoomId)
		?? allCenters[0]
	const playerPosition = toRasterPosition(currentRoomCenter)
	drawRoomMapPlayerMarker(context, playerPosition)

	return {
		sprite: k.loadSprite(null, canvas, { singular: true }),
		width,
		height,
		playerPosition: k.vec2(width / 2, height / 2),
		lockedLinks,
		roomNodes: rooms.map((room) => ({
			roomId: room.id,
			position: toRasterPosition(centers.get(room.id)!),
			state: room.state,
		})),
	}
}

function roomMapRoomIsKeyLocked(room: RoomFloorRoom) {
	const keyRequired = room.keyRequired === true ||
		room.kind === "reward" ||
		room.kind === "shop" ||
		room.kind === "droneShop"
	return keyRequired && room.keyUnlocked !== true
}

function drawRoomMapNode(
	context: CanvasRenderingContext2D,
	center: Vec2,
	room: RoomFloorRoom
) {
	const typeHidden =
		room.state === "discovered" && room.mapIdentityRevealed !== true
	const color = typeHidden
		? k.rgb(...UI_COLORS.muted)
		: getRoomFloorKindColor(room.kind)
	const corners = Array.from({ length: 6 }, (_, index) => {
		const angle = Math.PI / 3 * index - Math.PI / 2
		return k.vec2(
			center.x + Math.cos(angle) * ROOM_MAP_NODE_RADIUS,
			center.y + Math.sin(angle) * ROOM_MAP_NODE_RADIUS
		)
	})
	tracePolygon(context, corners)
	context.fillStyle = canvasColor(
		color,
		room.state === "discovered" ? 0.18 : room.state === "cleared" ? 0.3 : 0.52
	)
	context.fill()
	context.lineWidth = room.state === "active" ? 4 : 2
	context.strokeStyle = canvasColor(
		room.state === "active" ? k.rgb(...UI_COLORS.accent) : color,
		room.state === "discovered" ? 0.75 : 1
	)
	context.stroke()

	context.textAlign = "center"
	context.textBaseline = "middle"
	context.font = "bold 12px monospace"
	context.fillStyle = canvasColor(
		room.state === "active" ? k.WHITE : color,
		room.state === "discovered" ? 0.8 : 1
	)
	context.fillText(
		typeHidden ? "?" : getRoomFloorKindCode(room.kind),
		center.x,
		center.y + 1
	)
}

function drawRoomMapPlayerMarker(
	context: CanvasRenderingContext2D,
	center: Vec2
) {
	context.beginPath()
	context.moveTo(center.x, center.y - 13)
	context.lineTo(center.x + 7, center.y + 2)
	context.lineTo(center.x, center.y - 1)
	context.lineTo(center.x - 7, center.y + 2)
	context.closePath()
	context.fillStyle = canvasColor(k.WHITE)
	context.fill()
	context.lineWidth = 2
	context.strokeStyle = canvasColor(k.BLACK)
	context.stroke()
}

function getRoomFloorKindCode(kind: RoomFloorKind) {
	return {
		start: "S",
		combat: "X",
		reward: "$",
		health: "+",
		shrine: "?",
		gravity: "G",
		event: "!",
		shop: "$",
		droneShop: "R",
		lassoComponent: "L",
		scrapCircuit: "C",
		cargoPuzzleSource: "C",
		cargoPuzzleTarget: "O",
		deposit: "D",
		miniBoss: "M",
		boss: "B",
		exit: "E",
	}[kind]
}

function getRoomFloorKindLabel(kind: RoomFloorKind) {
	return {
		start: "ENTRY",
		combat: "HOSTILE ROOM",
		reward: "SALVAGE CACHE",
		health: "HEALTH SHRINE",
		shrine: "UPGRADE SHRINE",
		gravity: "GRAVITY LINK",
		event: "UNKNOWN SIGNAL",
		shop: "SALVAGE EXCHANGE",
		droneShop: "DRONE DEPOT",
		lassoComponent: "TETHER SIGNAL",
		scrapCircuit: "SCRAP CIRCUIT",
		cargoPuzzleSource: "PHASE CARGO",
		cargoPuzzleTarget: "DELIVERY",
		deposit: "SALVAGE RELAY",
		miniBoss: "MINI-BOSS",
		boss: "COMMAND THREAT",
		exit: "FLOOR EXIT",
	}[kind]
}

function getRoomFloorKindColor(kind: RoomFloorKind) {
	if (kind === "combat" || kind === "miniBoss" || kind === "boss") return k.rgb(...UI_COLORS.danger)
	if (kind === "health" || kind === "deposit") return k.rgb(...UI_COLORS.success)
	if (kind === "reward" || kind === "shop") return k.rgb(255, 190, 55)
	if (kind === "droneShop") return k.rgb(90, 190, 255)
	if (kind === "lassoComponent") return k.rgb(...UI_COLORS.warning)
	if (kind === "scrapCircuit") return k.rgb(...UI_COLORS.accent)
	if (kind === "cargoPuzzleSource" || kind === "cargoPuzzleTarget") {
		return k.rgb(...UI_COLORS.accent)
	}
	if (kind === "gravity" || kind === "shrine") return k.rgb(185, 80, 255)
	if (kind === "exit") return k.rgb(...UI_COLORS.accent)
	if (kind === "event") return k.rgb(255, 145, 45)
	return k.WHITE
}

function getRoomFloorStateLabel(state: RoomFloorState) {
	return {
		unseen: "UNKNOWN",
		discovered: "DISCOVERED",
		active: "CURRENT",
		cleared: "CLEARED",
	}[state]
}

function createRoomDirectoryEntries(
	rooms: RoomFloorRoom[],
	currentRoomId: string
) {
	const grouped = new Map<string, RoomDirectoryEntry>()
	for (const room of rooms) {
		const current = room.id === currentRoomId
		const typeHidden =
			room.state === "discovered" && room.mapIdentityRevealed !== true
		const key = current
			? `current:${room.id}`
			: typeHidden
				? "hidden"
				: `kind:${room.kind}`
		const existing = grouped.get(key)
		if (existing) {
			existing.rooms.push(room)
			continue
		}
		grouped.set(key, {
			rooms: [room],
			typeHidden,
			current,
		})
	}
	return Array.from(grouped.values()).sort((a, b) => {
		if (a.current !== b.current) return a.current ? -1 : 1
		const aDepth = Math.min(...a.rooms.map((room) => room.distanceFromStart))
		const bDepth = Math.min(...b.rooms.map((room) => room.distanceFromStart))
		return aDepth - bDepth || a.rooms[0].id.localeCompare(b.rooms[0].id)
	})
}

function getRoomDirectoryStateText(rooms: RoomFloorRoom[]) {
	const depths = rooms.map((room) => room.distanceFromStart)
	const minimumDepth = Math.min(...depths)
	const maximumDepth = Math.max(...depths)
	const depthLabel = minimumDepth === maximumDepth
		? `${minimumDepth}`
		: `${minimumDepth}-${maximumDepth}`
	if (rooms.length === 1) {
		const room = rooms[0]
		const state = room.kind === "deposit" && room.contentCompleted
			? "SPENT"
			: getRoomFloorStateLabel(room.state)
		return `${state}  //  DEPTH ${depthLabel}`
	}
	const spentCount = rooms.filter(
		(room) => room.kind === "deposit" && room.contentCompleted
	).length
	if (spentCount > 0) {
		const state = spentCount === rooms.length
			? "SPENT"
			: `${spentCount}/${rooms.length} SPENT`
		return `${state}  //  DEPTH ${depthLabel}`
	}
	const clearedCount = rooms.filter((room) => room.state === "cleared").length
	const state = clearedCount === rooms.length
		? "CLEARED"
		: clearedCount > 0
			? `${clearedCount}/${rooms.length} CLEARED`
			: "DISCOVERED"
	return `${state}  //  DEPTH ${depthLabel}`
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
		if (
			!cell.solid &&
			!cell.role &&
			!cell.volatileCargoObjective &&
			!cell.debreeDeposit
		) continue
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
		if (cell.debreeDeposit) {
			drawDebreeDepositMapMark(
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

function rasterizeHubMap(snapshot: HubMapSnapshot): RasterizedMap {
	const mapWidth = HUB_HALF_WIDTH * 2
	const mapHeight = HUB_HALF_HEIGHT * 2
	const availableWidth = MAP_MAX_RASTER_SIZE - MAP_RASTER_PADDING * 2
	const availableHeight = MAP_MAX_RASTER_SIZE - MAP_RASTER_PADDING * 2
	const pixelsPerUnit = Math.min(
		MAP_RASTER_PIXELS_PER_UNIT,
		availableWidth / mapWidth,
		availableHeight / mapHeight
	)
	const width = Math.ceil(mapWidth * pixelsPerUnit + MAP_RASTER_PADDING * 2)
	const height = Math.ceil(mapHeight * pixelsPerUnit + MAP_RASTER_PADDING * 2)
	const canvas = document.createElement("canvas")
	canvas.width = width
	canvas.height = height
	const context = canvas.getContext("2d")
	if (!context) throw new Error("Unable to create hub map canvas")
	context.imageSmoothingEnabled = false
	context.lineJoin = "round"
	context.lineCap = "round"
	const toRasterPosition = (point: Vec2) => k.vec2(
		(point.x + HUB_HALF_WIDTH) * pixelsPerUnit + MAP_RASTER_PADDING,
		(point.y + HUB_HALF_HEIGHT) * pixelsPerUnit + MAP_RASTER_PADDING
	)

	context.fillStyle = canvasColor(k.rgb(...UI_COLORS.background), 1)
	context.fillRect(0, 0, width, height)
	context.strokeStyle = canvasColor(k.rgb(...UI_COLORS.border), 0.9)
	context.lineWidth = 3
	context.strokeRect(
		MAP_RASTER_PADDING,
		MAP_RASTER_PADDING,
		mapWidth * pixelsPerUnit,
		mapHeight * pixelsPerUnit
	)

	const hubCore = toRasterPosition(k.vec2(0, 0))
	for (const landmark of snapshot.landmarks) {
		if (landmark.kind === "core") continue
		const position = toRasterPosition(landmark.position)
		context.beginPath()
		context.moveTo(hubCore.x, hubCore.y)
		context.lineTo(position.x, position.y)
		context.strokeStyle = canvasColor(k.rgb(...UI_COLORS.border), 0.28)
		context.lineWidth = 2
		context.stroke()
	}

	for (const landmark of snapshot.landmarks) {
		drawHubLandmark(context, toRasterPosition(landmark.position), landmark)
	}
	for (const landmark of snapshot.landmarks) {
		drawHubLandmarkLabel(
			context,
			toRasterPosition(landmark.position),
			landmark
		)
	}

	const playerCenter = toRasterPosition(snapshot.playerPosition)
	context.beginPath()
	context.arc(playerCenter.x, playerCenter.y, 9, 0, Math.PI * 2)
	context.fillStyle = canvasColor(k.WHITE)
	context.fill()
	context.lineWidth = 3
	context.strokeStyle = canvasColor(k.BLACK)
	context.stroke()

	return {
		sprite: k.loadSprite(null, canvas, { singular: true }),
		width,
		height,
		playerPosition: playerCenter,
	}
}

function drawHubLandmark(
	context: CanvasRenderingContext2D,
	position: Vec2,
	landmark: HubMapLandmark
) {
	const color = landmark.built
		? landmark.kind === "settlement"
			? k.rgb(...UI_COLORS.success)
			: k.rgb(...UI_COLORS.accent)
		: k.rgb(...UI_COLORS.muted)
	const radius = landmark.kind === "core"
		? 20
		: landmark.kind === "facility" ? 15 : 11
	context.beginPath()
	if (landmark.kind === "wormhole") {
		context.arc(position.x, position.y, radius, 0, Math.PI * 2)
		context.arc(position.x, position.y, radius * 0.45, 0, Math.PI * 2, true)
	} else if (landmark.kind === "phase") {
		context.moveTo(position.x, position.y - radius)
		context.lineTo(position.x + radius, position.y)
		context.lineTo(position.x, position.y + radius)
		context.lineTo(position.x - radius, position.y)
		context.closePath()
	} else {
		context.rect(
			position.x - radius,
			position.y - radius,
			radius * 2,
			radius * 2
		)
	}
	context.fillStyle = canvasColor(color, landmark.built ? 0.9 : 0.38)
	context.fill()
	context.lineWidth = landmark.kind === "core" ? 4 : 2
	context.strokeStyle = canvasColor(color, 1)
	context.stroke()
	if (!landmark.built) {
		context.beginPath()
		context.moveTo(position.x - radius, position.y - radius)
		context.lineTo(position.x + radius, position.y + radius)
		context.moveTo(position.x + radius, position.y - radius)
		context.lineTo(position.x - radius, position.y + radius)
		context.stroke()
	}
}

function drawHubLandmarkLabel(
	context: CanvasRenderingContext2D,
	position: Vec2,
	landmark: HubMapLandmark
) {
	const text = landmark.built
		? landmark.label
		: `${landmark.label} // RUIN`
	const markerRadius = landmark.kind === "core"
		? 20
		: landmark.kind === "facility" ? 15 : 11
	const isLeft = landmark.position.x < 0
	const isAbove = landmark.position.y < 0
	const staggerBottomCenterLabel =
		landmark.position.y > HUB_HALF_HEIGHT * 0.65 &&
		landmark.position.x > 0 &&
		landmark.position.x < HUB_HALF_WIDTH * 0.45
	const x = position.x + (isLeft ? markerRadius + 10 : -markerRadius - 10)
	const y = position.y + (
		isAbove
			? markerRadius + 11
			: -markerRadius - 11 - (staggerBottomCenterLabel ? 48 : 0)
	)
	const color = landmark.built
		? landmark.kind === "settlement"
			? k.rgb(...UI_COLORS.success)
			: k.rgb(...UI_COLORS.accent)
		: k.rgb(...UI_COLORS.muted)

	context.font = "bold 19px unscii, monospace"
	context.textAlign = isLeft ? "left" : "right"
	context.textBaseline = isAbove ? "top" : "bottom"
	const metrics = context.measureText(text)
	const textHeight = 22
	const paddingX = 5
	const paddingY = 3
	const backgroundX = isLeft
		? x - paddingX
		: x - metrics.width - paddingX
	const backgroundY = isAbove
		? y - paddingY
		: y - textHeight - paddingY
	context.fillStyle = canvasColor(k.rgb(...UI_COLORS.background), 0.88)
	context.fillRect(
		backgroundX,
		backgroundY,
		metrics.width + paddingX * 2,
		textHeight + paddingY * 2
	)
	context.fillStyle = canvasColor(color, landmark.built ? 1 : 0.8)
	context.fillText(text, x, y)
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

function drawDebreeDepositMapMark(
	context: CanvasRenderingContext2D,
	center: Vec2,
	pixelsPerUnit: number
) {
	const radius = pixelsPerUnit * 0.34
	context.beginPath()
	context.arc(center.x, center.y, radius, 0, Math.PI * 2)
	context.fillStyle = canvasColor(k.rgb(...UI_COLORS.success), 0.95)
	context.fill()
	context.beginPath()
	context.arc(center.x, center.y, radius * 0.45, 0, Math.PI * 2)
	context.fillStyle = canvasColor(k.rgb(...UI_COLORS.background), 1)
	context.fill()
}

function canvasColor(color: Color, opacity = 1) {
	return `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity})`
}

function addSublevelTree(
	parent: GameObj,
	snapshot: RoomFloor,
	x: number,
	y: number,
	width: number,
	height: number
) {
	const theme = getFloorThemeDefinition(snapshot.themeId)
	const floorPosition = getFloorPositionForDepth(snapshot.depth)
	createUiSurface(parent, {
		pos: k.vec2(x, y),
		size: k.vec2(width, height),
		tone: "default",
	})
	createUiSectionHeader(parent, {
		pos: k.vec2(x, y),
		width,
		height: 58,
		eyebrow: `FLOOR ${String(floorPosition.floor).padStart(2, "0")}`,
		title: theme.name.toUpperCase(),
	})

	const nodeX = x + 28
	const firstNodeY = y + 88
	const rowHeight = 48
	const discoveredSublevels = Array.from(
		{ length: floorPosition.subfloor },
		(_, index) => index + 1
	)
	if (discoveredSublevels.length > 0) {
		parent.add([
			k.pos(nodeX, y + 58),
			k.rect(1, firstNodeY - (y + 58) + rowHeight * (discoveredSublevels.length - 1)),
			k.color(...UI_COLORS.border),
		])
	}

	for (const sublevel of discoveredSublevels) {
		const nodeY = firstNodeY + (sublevel - 1) * rowHeight
		const current = sublevel === floorPosition.subfloor
		const color = current
			? k.rgb(...UI_COLORS.accent)
			: k.rgb(...UI_COLORS.text)
		parent.add([
			k.pos(nodeX, nodeY),
			k.rect(18, 1),
			k.color(...UI_COLORS.border),
		])
		parent.add([
			k.pos(nodeX - 4, nodeY - 4),
			k.rect(9, 9),
			k.color(...UI_COLORS.background),
			k.outline(2, color),
		])
		addThemedText(parent, {
			pos: k.vec2(nodeX + 25, nodeY - 8),
			text: `SUBLEVEL ${String(sublevel).padStart(2, "0")}`,
			variant: "body",
			width: width - 62,
			color,
		})
		addThemedText(parent, {
			pos: k.vec2(nodeX + 25, nodeY + 8),
			text: current ? "CURRENT" : "DISCOVERED",
			variant: "muted",
			width: width - 62,
			color: current ? color : k.rgb(...UI_COLORS.muted),
		})
	}
}

function addRoomFloorSidebar(
	parent: GameObj,
	snapshot: RoomFloor,
	x: number,
	y: number,
	width: number,
	height: number
) {
	createUiSurface(parent, {
		pos: k.vec2(x, y),
		size: k.vec2(width, height),
		tone: "default",
	})
	createUiSectionHeader(parent, {
		pos: k.vec2(x, y),
		width,
		height: 48,
		eyebrow: "FLOOR DIRECTORY",
		title: "KNOWN ROOMS",
	})

	const entries = createRoomDirectoryEntries(
		snapshot.rooms.filter((room) => room.state !== "unseen"),
		snapshot.currentRoomId
	)
	const scrollY = y + 52
	const scrollHeight = height - 56
	const rowHeight = 46
	zoneScroll = createUiScrollable({
		parent,
		pos: k.vec2(x, scrollY),
		width,
		height: scrollHeight,
		contentHeight: Math.max(scrollHeight, entries.length * rowHeight + 12),
		scrollStep: rowHeight,
		tags: [tags.tacticalMap],
	})

	entries.forEach((entry, index) => {
		const room = entry.rooms[0]
		const yPos = 8 + index * rowHeight
		const allDiscovered = entry.rooms.every(
			(candidate) => candidate.state === "discovered"
		)
		const color = entry.current
			? k.rgb(...UI_COLORS.accent)
			: entry.typeHidden
				? k.rgb(...UI_COLORS.muted)
				: getRoomFloorKindColor(room.kind)
		zoneScroll!.content.add([
			k.rect(6, 32),
			k.pos(7, yPos),
			k.color(color),
			k.opacity(allDiscovered ? 0.65 : 1),
		])
		zoneScroll!.content.add([
			k.text(
				`${entry.typeHidden
					? "?  UNKNOWN ROOM"
					: `${getRoomFloorKindCode(room.kind)}  ${getRoomFloorKindLabel(room.kind)}`}${entry.rooms.length > 1
					? `  x${entry.rooms.length}`
					: ""}`,
				{
					size: UI_FONT_SIZES.small,
					font: "unscii",
					width: width - 28,
				}
			),
			k.pos(19, yPos),
			k.color(allDiscovered ? k.rgb(...UI_COLORS.muted) : color),
		])
		zoneScroll!.content.add([
			k.text(
				getRoomDirectoryStateText(entry.rooms),
				{
					size: UI_FONT_SIZES.tiny,
					font: "unscii",
					width: width - 28,
				}
			),
			k.pos(19, yPos + 17),
			k.color(...UI_COLORS.muted),
		])
	})
}

function addZoneSidebar(
	parent: GameObj,
	cells: GeneratedRunMapCell[],
	x: number,
	y: number,
	width: number,
	height: number
) {
	createUiSurface(parent, {
		pos: k.vec2(x, y),
		size: k.vec2(width, height),
		tone: "default",
	})
	createUiSectionHeader(parent, {
		pos: k.vec2(x, y),
		width,
		height: 48,
		eyebrow: "DISCOVERED SIGNALS",
		title: "OBJECTIVES // ZONES",
	})

	const zones = cells
		.filter((cell) => cell.revealed && cell.roomAnchor && cell.role)
		.sort((a, b) => a.r - b.r || a.q - b.q)
	const cargoObjective = cells.find(
		(cell) => cell.revealed && cell.volatileCargoObjective
	)
	const depositCount = cells.filter(
		(cell) => cell.revealed && cell.debreeDeposit
	).length
	const scrollY = y + 52
	const scrollHeight = height - 56
	const rowHeight = 42
	const objectiveRows = (cargoObjective ? 1 : 0) + (depositCount > 0 ? 1 : 0)
	zoneScroll = createUiScrollable({
		parent,
		pos: k.vec2(x, scrollY),
		width,
		height: scrollHeight,
		contentHeight: Math.max(
			scrollHeight,
			(zones.length + objectiveRows) * rowHeight + 12
		),
		scrollStep: rowHeight,
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
				size: UI_FONT_SIZES.small,
				font: "unscii",
				width: width - 24,
			}),
			k.pos(19, 8),
			k.color(255, 175, 75),
		])
		zoneScroll.content.add([
			k.text(`HEX ${cargoObjective.q},${cargoObjective.r}`, {
				size: UI_FONT_SIZES.tiny,
				font: "unscii",
			}),
			k.pos(19, 23),
			k.color(...UI_COLORS.muted),
		])
	}
	if (depositCount > 0) {
		const yPos = cargoObjective ? rowHeight + 8 : 8
		zoneScroll.content.add([
			k.rect(6, 28),
			k.pos(7, yPos),
			k.color(...UI_COLORS.success),
		])
		zoneScroll.content.add([
			k.text(`SAFE  SALVAGE RELAY  x${depositCount}`, {
				size: UI_FONT_SIZES.small,
				font: "unscii",
				width: width - 24,
			}),
			k.pos(19, yPos),
			k.color(...UI_COLORS.success),
		])
		zoneScroll.content.add([
			k.text("DEPOSIT CARRIED SALVAGE", {
				size: UI_FONT_SIZES.tiny,
				font: "unscii",
			}),
			k.pos(19, yPos + 15),
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
				size: UI_FONT_SIZES.small,
				font: "unscii",
				width: width - 24,
			}),
			k.pos(19, yPos),
			k.color(k.WHITE),
		])
		zoneScroll!.content.add([
			k.text(`HEX ${zone.q},${zone.r}`, { size: UI_FONT_SIZES.tiny, font: "unscii" }),
			k.pos(19, yPos + 15),
			k.color(...UI_COLORS.muted),
		])
	})
}
