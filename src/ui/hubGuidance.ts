import type { GameObj, Vec2 } from "kaplay"
import { playerObj } from "../game"
import { getScore, k, layers } from "../main"
import {
	getFacilityConstruction,
	getFacilityConstructionRemainingMs,
	hasUnseenBlueprints,
	HUB_FACILITIES,
	HUB_FACILITY_BUILD_DURATION_MS,
	type HubFacilityDefinition,
	type HubFacilityId,
	isFacilityBuilt,
	isFacilityUnlocked,
} from "../services/hubProgressService"
import { tags } from "../tags"
import { addThemedText, createUiSurface, UI_COLORS, UI_FONT_SIZES } from "./common"
import { uiState } from "./uiState"

interface HubGuidanceOptions {
	facilityPositions: Record<HubFacilityId, Vec2>
	wormholePosition: Vec2
}

interface HubDestination {
	id: string
	title: string
	position: Vec2
	interactionRadius: number
	status: () => string
	priority: () => number
	showAtEdge: () => boolean
}

interface HubGuideMarker {
	destination: HubDestination
	root: GameObj
	surface: GameObj
	arrow: GameObj
	title: GameObj
	status: GameObj
	distance: GameObj
}

const MARKER_WIDTH = 250
const MARKER_HEIGHT = 40
const EDGE_X = MARKER_WIDTH / 2 + 14
const EDGE_TOP = 42
const EDGE_BOTTOM = 88
const LABEL_MIN_DISTANCE = 155
const LABEL_MAX_DISTANCE = 660
const LABEL_OFFSET_Y = 128
const MAX_EDGE_MARKERS = 3

export function createHubGuidance({
	facilityPositions,
	wormholePosition,
}: HubGuidanceOptions) {
	const destinations: HubDestination[] = [
		...HUB_FACILITIES.map((facility) => createFacilityDestination(
			facility,
			facilityPositions[facility.id]
		)),
		{
			id: "expedition-gate",
			title: "EXPEDITION GATE",
			position: wormholePosition,
			interactionRadius: 110,
			status: () => "SELECT RUN",
			priority: () => 90,
			showAtEdge: () => true,
		},
	]
	const markers = destinations.map(createGuideMarker)
	const controller = k.add([
		k.pos(0, 0),
		k.fixed(),
		k.layer(layers.ui),
		k.z(80),
		tags.gameLoop,
		tags.hubGuidance,
	])

	controller.onUpdate(() => updateMarkers(markers))
	controller.onDestroy(() => {
		for (const marker of markers) {
			if (marker.root.exists()) k.destroy(marker.root)
		}
	})
	return controller
}

function createFacilityDestination(
	facility: HubFacilityDefinition,
	position: Vec2
): HubDestination {
	return {
		id: facility.id,
		title: facility.name,
		position,
		interactionRadius: 120,
		status: () => facilityStatus(facility),
		priority: () => facilityPriority(facility),
		showAtEdge: () => isFacilityBuilt(facility.id) ||
			isFacilityUnlocked(facility.id),
	}
}

function facilityStatus(facility: HubFacilityDefinition) {
	if (isFacilityBuilt(facility.id)) {
		if (facility.id === "trainingRange" && hasUnseenBlueprints()) {
			return "NEW BLUEPRINTS"
		}
		return "OPEN"
	}
	const construction = getFacilityConstruction()
	if (construction?.facilityId === facility.id) {
		const remaining = getFacilityConstructionRemainingMs(facility.id)
		const progress = Math.min(100, Math.round(
			(1 - remaining / HUB_FACILITY_BUILD_DURATION_MS) * 100
		))
		return `REPAIRING // ${progress}%`
	}
	if (!isFacilityUnlocked(facility.id)) {
		return `LOCKED // HUB LEVEL ${facility.requiredHubLevel}`
	}
	if (getScore() < facility.cost) return `NEED ${facility.cost} SCRAP`
	return facility.cost > 0 ? `BUILD // ${facility.cost} SCRAP` : "BUILD // FREE"
}

function facilityPriority(facility: HubFacilityDefinition) {
	const construction = getFacilityConstruction()
	if (construction?.facilityId === facility.id) return 150
	if (!isFacilityBuilt(facility.id) && isFacilityUnlocked(facility.id)) return 140
	if (facility.id === "trainingRange" && hasUnseenBlueprints()) return 130
	if (facility.id === "contractTerminal" && isFacilityBuilt(facility.id)) return 110
	if (facility.id === "trainingRange" && isFacilityBuilt(facility.id)) return 80
	return isFacilityBuilt(facility.id) ? 70 : 0
}

function createGuideMarker(destination: HubDestination): HubGuideMarker {
	const root = k.add([
		k.pos(0, 0),
		k.fixed(),
		k.layer(layers.ui),
		k.z(80),
		k.opacity(1),
		tags.gameLoop,
		tags.hubGuidance,
	])
	root.hidden = true
	const surface = createUiSurface(root, {
		pos: k.vec2(0, 0),
		size: k.vec2(MARKER_WIDTH, MARKER_HEIGHT),
		anchor: "center",
		tone: "default",
		borderColor: UI_COLORS.border,
		opacity: 0.92,
	})
	const arrow = root.add([
		k.pos(-MARKER_WIDTH / 2 + 14, 0),
		k.polygon([
			k.vec2(-5, -6),
			k.vec2(6, 0),
			k.vec2(-5, 6),
		]),
		k.color(...UI_COLORS.accent),
		k.rotate(0),
	])
	const title = addThemedText(root, {
		pos: k.vec2(-MARKER_WIDTH / 2 + 27, -13),
		text: destination.title,
		variant: "body",
		size: UI_FONT_SIZES.micro,
		width: MARKER_WIDTH - 52,
		color: k.rgb(...UI_COLORS.text),
	})
	const status = addThemedText(root, {
		pos: k.vec2(-MARKER_WIDTH / 2 + 27, 3),
		text: "",
		variant: "caption",
		size: UI_FONT_SIZES.micro,
		width: MARKER_WIDTH - 95,
	})
	const distance = addThemedText(root, {
		pos: k.vec2(-MARKER_WIDTH / 2 + 27, 3),
		text: "",
		variant: "muted",
		size: UI_FONT_SIZES.micro,
		width: MARKER_WIDTH - 39,
		align: "right",
	})
	return { destination, root, surface, arrow, title, status, distance }
}

function updateMarkers(markers: HubGuideMarker[]) {
	if (!playerObj?.exists() || uiState.modalOpen || uiState.pauseMenuOpen) {
		for (const marker of markers) marker.root.hidden = true
		return
	}
	const screenCenter = k.vec2(k.width() / 2, k.height() / 2)
	const edgeCandidates = markers
		.filter((marker) => {
			const screen = k.toScreen(marker.destination.position)
			return marker.destination.showAtEdge() && !isDestinationOnScreen(screen)
		})
		.sort((a, b) => {
			const priority = b.destination.priority() - a.destination.priority()
			if (priority !== 0) return priority
			return playerObj.pos.dist(a.destination.position) -
				playerObj.pos.dist(b.destination.position)
		})
		.slice(0, MAX_EDGE_MARKERS)
	const edgeIds = new Set(edgeCandidates.map((marker) => marker.destination.id))
	const occupiedEdgePositions: Vec2[] = []

	for (const marker of markers) {
		const destination = marker.destination
		const screen = k.toScreen(destination.position)
		const worldDistance = playerObj.pos.dist(destination.position)
		const onScreen = isDestinationOnScreen(screen)
		const showWorldLabel = onScreen &&
			worldDistance > Math.max(LABEL_MIN_DISTANCE, destination.interactionRadius) &&
			worldDistance < LABEL_MAX_DISTANCE
		const showEdge = edgeIds.has(destination.id)
		if (!showWorldLabel && !showEdge) {
			marker.root.hidden = true
			continue
		}

		marker.root.hidden = false
		marker.title.text = destination.title
		marker.status.text = destination.status()
		marker.distance.text = `DIST ${Math.round(worldDistance)}`
		if (showWorldLabel) {
			marker.root.pos = k.vec2(
				k.clamp(screen.x, EDGE_X, k.width() - EDGE_X),
				k.clamp(screen.y + LABEL_OFFSET_Y, EDGE_TOP, k.height() - EDGE_BOTTOM)
			)
			marker.arrow.hidden = true
			marker.distance.hidden = true
			marker.surface.outline.color = k.rgb(...UI_COLORS.border)
			const fadeRange = LABEL_MAX_DISTANCE - LABEL_MIN_DISTANCE
			marker.root.opacity = k.clamp(
				(LABEL_MAX_DISTANCE - worldDistance) / fadeRange,
				0.5,
				1
			)
			continue
		}

		const direction = screen.sub(screenCenter)
		const angle = direction.len() > 0 ? direction.angle() : 0
		const edgePos = resolveEdgePosition(screenCenter, direction)
		avoidMarkerOverlap(edgePos, occupiedEdgePositions)
		occupiedEdgePositions.push(edgePos.clone())
		marker.root.pos = edgePos
		marker.root.opacity = k.wave(0.78, 1, k.time() * 3.5)
		marker.arrow.hidden = false
		marker.distance.hidden = false
		marker.arrow.angle = angle
		marker.surface.outline.color = k.rgb(...UI_COLORS.accent)
	}
}

function isDestinationOnScreen(screen: Vec2) {
	return screen.x >= 36 &&
		screen.x <= k.width() - 36 &&
		screen.y >= 32 &&
		screen.y <= k.height() - 72
}

function resolveEdgePosition(center: Vec2, direction: Vec2) {
	if (direction.len() <= 0) return center
	const horizontalScale = (k.width() / 2 - EDGE_X) /
		Math.max(0.001, Math.abs(direction.x))
	const verticalExtent = direction.y < 0
		? k.height() / 2 - EDGE_TOP
		: k.height() / 2 - EDGE_BOTTOM
	const verticalScale = verticalExtent / Math.max(0.001, Math.abs(direction.y))
	return center.add(direction.scale(Math.min(horizontalScale, verticalScale)))
}

function avoidMarkerOverlap(position: Vec2, occupied: Vec2[]) {
	for (const other of occupied) {
		if (position.dist(other) >= MARKER_HEIGHT + 8) continue
		if (position.x < EDGE_X + 20 || position.x > k.width() - EDGE_X - 20) {
			position.y = k.clamp(
				position.y + (position.y >= other.y ? 48 : -48),
				EDGE_TOP,
				k.height() - EDGE_BOTTOM
			)
		} else {
			position.x = k.clamp(
				position.x + (position.x >= other.x ? MARKER_WIDTH + 8 : -MARKER_WIDTH - 8),
				EDGE_X,
				k.width() - EDGE_X
			)
		}
	}
}
