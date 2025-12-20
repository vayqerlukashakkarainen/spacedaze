import { k } from "../../main"
import { editorState } from "../state/editorState"

/**
 * Setup camera controls (scroll zoom)
 */
export function setupCameraControls(): void {
	k.onScroll((delta) => {
		const zoomSpeed = 0.1
		editorState.camera.targetZoom *= 1 - delta.y * zoomSpeed
		editorState.camera.targetZoom = Math.max(
			0.25,
			Math.min(4, editorState.camera.targetZoom)
		)
	})
}

/**
 * Update camera position and zoom (called each frame)
 */
export function updateCamera(dt: number): void {
	const moveSpeed = editorState.camera.moveSpeed * dt

	// Update target camera position based on WASD input
	if (k.isKeyDown("w")) {
		editorState.camera.targetOffset.y -= moveSpeed
	}
	if (k.isKeyDown("s")) {
		editorState.camera.targetOffset.y += moveSpeed
	}
	if (k.isKeyDown("a")) {
		editorState.camera.targetOffset.x -= moveSpeed
	}
	if (k.isKeyDown("d")) {
		editorState.camera.targetOffset.x += moveSpeed
	}

	// Smoothly interpolate camera position
	const cameraLerpSpeed = 10 * dt
	editorState.camera.offset.x = k.lerp(
		editorState.camera.offset.x,
		editorState.camera.targetOffset.x,
		cameraLerpSpeed
	)
	editorState.camera.offset.y = k.lerp(
		editorState.camera.offset.y,
		editorState.camera.targetOffset.y,
		cameraLerpSpeed
	)

	// Smoothly interpolate zoom
	const zoomLerpSpeed = 8 * dt
	editorState.camera.zoom = k.lerp(
		editorState.camera.zoom,
		editorState.camera.targetZoom,
		zoomLerpSpeed
	)

	// Apply camera position and zoom
	k.setCamPos(k.center().add(editorState.camera.offset))
	k.setCamScale(editorState.camera.zoom)
}
