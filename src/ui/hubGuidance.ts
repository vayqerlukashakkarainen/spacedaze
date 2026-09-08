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
}

interface HubDestination {
	id: string
	title: string
	position: Vec2
	interactionRadius: number
	status: () => string
	shouldShow: () => boolean
}

interface HubGuideMarker {
	destination: HubDestination
	root: GameObj
	surface: GameObj
	title: GameObj
	status: GameObj
}

const MARKER_WIDTH = 250
const MARKER_HEIGHT = 40
const EDGE_X = MARKER_WIDTH / 2 + 14
const EDGE_TOP = 42
const EDGE_BOTTOM = 88
const LABEL_MIN_DISTANCE = 155
const LABEL_MAX_DISTANCE = 660
const LABEL_OFFSET_Y = 128

export function createHubGuidance({
	facilityPositions,
}: HubGuidanceOptions) {
	const destinations = HUB_FACILITIES.map((facility) => createFacilityDestination(
		facility,
		facilityPositions[facility.id]
	))
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
		shouldShow: () => facilityNeedsAttention(facility),
	}
}

function facilityNeedsAttention(facility: HubFacilityDefinition) {
	const construction = getFacilityConstruction()
	if (construction?.facilityId === facility.id) return true
	if (isFacilityBuilt(facility.id)) {
		return facility.id === "trainingRange" && hasUnseenBlueprints()
	}
	return isFacilityUnlocked(facility.id)
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
	if (getScore() < facility.cost) return `NEED ${facility.cost} SCRAP`
	return facility.cost > 0 ? `BUILD // ${facility.cost} SCRAP` : "BUILD // FREE"
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
	const title = addThemedText(root, {
		pos: k.vec2(-MARKER_WIDTH / 2 + 14, -13),
		text: destination.title,
		variant: "body",
		size: UI_FONT_SIZES.micro,
		width: MARKER_WIDTH - 28,
		color: k.rgb(...UI_COLORS.text),
	})
	const status = addThemedText(root, {
		pos: k.vec2(-MARKER_WIDTH / 2 + 14, 3),
		text: "",
		variant: "caption",
		size: UI_FONT_SIZES.micro,
		width: MARKER_WIDTH - 28,
	})
	return { destination, root, surface, title, status }
}

function updateMarkers(markers: HubGuideMarker[]) {
	if (!playerObj?.exists() || uiState.modalOpen || uiState.pauseMenuOpen) {
		for (const marker of markers) marker.root.hidden = true
		return
	}
	for (const marker of markers) {
		const destination = marker.destination
		const screen = k.toScreen(destination.position)
		const worldDistance = playerObj.pos.dist(destination.position)
		const onScreen = isDestinationOnScreen(screen)
		const showWorldLabel = destination.shouldShow() &&
			onScreen &&
			worldDistance > Math.max(LABEL_MIN_DISTANCE, destination.interactionRadius) &&
			worldDistance < LABEL_MAX_DISTANCE
		if (!showWorldLabel) {
			marker.root.hidden = true
			continue
		}

		marker.root.hidden = false
		marker.title.text = destination.title
		marker.status.text = destination.status()
		marker.root.pos = k.vec2(
			k.clamp(screen.x, EDGE_X, k.width() - EDGE_X),
			k.clamp(screen.y + LABEL_OFFSET_Y, EDGE_TOP, k.height() - EDGE_BOTTOM)
		)
		marker.surface.outline.color = k.rgb(...UI_COLORS.border)
		const fadeRange = LABEL_MAX_DISTANCE - LABEL_MIN_DISTANCE
		marker.root.opacity = k.clamp(
			(LABEL_MAX_DISTANCE - worldDistance) / fadeRange,
			0.5,
			1
		)
	}
}

function isDestinationOnScreen(screen: Vec2) {
	return screen.x >= 36 &&
		screen.x <= k.width() - 36 &&
		screen.y >= 32 &&
		screen.y <= k.height() - 72
}
