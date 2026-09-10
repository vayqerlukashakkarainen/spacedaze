import type { GameObj, Vec2 } from "kaplay"
import {
	horizontalDirectionalVisual,
	type HorizontalDirectionalVisualComp,
} from "../../comp/horizontalDirectionalVisual"
import { BURT_TAG } from "../../spawn/npcs/spawnHubBurt"
import {
	k,
	layers,
	mainSoundVolume,
	musicVolume,
	WORLD_CAMERA_SCALE,
} from "../../main"
import { tags } from "../../tags"
import { audioService } from "../audio/audioService"
import { gameSoundService } from "../audio/gameSoundService"
import { showDialogue } from "./dialogService"
import { showEmotion } from "./emotionService"
import { getCompanionVisual } from "../../visuals/companionVisualCatalog"
import { requirePrimaryVisualSprite } from "../../visuals/visualRepresentation"
import {
	clearPrologueTrace,
	tracePrologue,
} from "./prologueTraceService"

const ENEMY_EXIT_MARGIN = 240
const ENEMY_DRIVE_SPEED = 88
const BURT_ENTRY_MARGIN = 96
const BURT_SCREEN_ENTRY_DISTANCE = 100
const BURT_SCREEN_ENTRY_DURATION = 1.5
const BURT_PLAYER_APPROACH_DURATION = 2.2
const BURT_MUSIC_ENTRANCE_DELAY = 0.6
const BURT_ALERT_BOB_HEIGHT = 12
const BURT_HUB_CLEAR_DISTANCE = 100
const WORMHOLE_CHARGE_DURATION = 4
const HUB_REPAIR_DURATION = 3
const BURT_ACKNOWLEDGE_DISTANCE = 110
const HUB_REPAIR_PART_OFFSETS = [
	[-7, 0],
	[7, 0],
	[0, -2],
	[-3, 7],
	[3, 7],
] as const
const HUB_REPAIR_SMOKE_OFFSETS = [-8, 0, 8] as const
const PART_SPRITES = [
	"enemy_fighter_left_wing",
	"enemy_fighter_right_wing",
	"enemy_fighter_core",
	"particle3",
	"particle4",
] as const

let recoveryGeneration = 0
let evacuationController: GameObj | undefined
let deathPosition: Vec2 | undefined

export function beginPrologueEnemyEvacuation(pos: Vec2) {
	clearPrologueTrace()
	cancelEvacuationController()
	deathPosition = pos.clone()
	tracePrologue("death:evacuation-start", {
		x: Math.round(pos.x),
		y: Math.round(pos.y),
		enemies: k.get(tags.enemy).length,
	})
	const evacuationStates = new Map<number, {
		direction: Vec2
		speed: number
		elapsed: number
	}>()
	evacuationController = k.add([
		{
			update() {
				const enemies = k.get<GameObj>(tags.enemy)
				for (const enemy of enemies) {
					if (!enemy.exists()) continue
					enemy.paused = true
					let state = evacuationStates.get(enemy.id)
					if (!state) {
						state = {
							direction: nearestScreenExitDirection(enemy.pos),
							speed: ENEMY_DRIVE_SPEED * (0.82 + enemy.id % 5 * 0.045),
							elapsed: 0,
						}
						evacuationStates.set(enemy.id, state)
						tracePrologue("enemy:drive-away", {
							id: enemy.id,
							speed: Math.round(state.speed),
							directionX: Number(state.direction.x.toFixed(2)),
							directionY: Number(state.direction.y.toFixed(2)),
						})
					}
					state.elapsed += k.dt()
					const driveSpeed = state.speed * k.clamp(state.elapsed / 0.8, 0.28, 1)
					enemy.pos = enemy.pos.add(state.direction.scale(driveSpeed * k.dt()))
					if ("angle" in enemy) {
						const desiredAngle = Math.atan2(
							state.direction.y,
							state.direction.x
						) * 180 / Math.PI + 90
						enemy.angle = approachAngle(
							enemy.angle,
							desiredAngle,
							Math.min(1, k.dt() * 2.8)
						)
					}
					if (!isInsideScreen(enemy.pos, ENEMY_EXIT_MARGIN)) {
						tracePrologue("enemy:exited-screen", { id: enemy.id })
						k.destroy(enemy)
					}
				}
			},
		},
		tags.prologue,
	])
}

export async function playBattlefieldRecovery() {
	const generation = ++recoveryGeneration
	const center = deathPosition ?? k.getCamPos()
	tracePrologue("battlefield:sequence-start", {
		generation,
		x: Math.round(center.x),
		y: Math.round(center.y),
	})
	await waitUntil(() => !hasEnemyOnScreen(), generation)
	tracePrologue("battlefield:screen-clear-enemies-clear", { generation })
	await waitSeconds(2, generation)
	tracePrologue("battlefield:post-clear-delay-complete", { generation })
	if (!isCurrent(generation)) return false

	tracePrologue("music:recovery-start")
	audioService.playMusic("burts_recovery", {
		volume: musicVolume * 0.82,
		loop: true,
	})
	tracePrologue("music:recovery-entrance-delay-start", {
		duration: BURT_MUSIC_ENTRANCE_DELAY,
	})
	await waitSeconds(BURT_MUSIC_ENTRANCE_DELAY, generation)
	tracePrologue("music:recovery-entrance-delay-complete")
	if (!isCurrent(generation)) return false

	const burtStart = screenOutsidePosition("left", center.y)
	const burtEntryTarget = screenInsidePosition(
		"left",
		BURT_SCREEN_ENTRY_DISTANCE,
		center.y
	)
	const burtTarget = center.add(-42, -18)
	const burt = spawnBurt(burtStart)
	tracePrologue("burt:battlefield-spawn", {
		id: burt.id,
		startX: Math.round(burtStart.x),
		startY: Math.round(burtStart.y),
		targetX: Math.round(burtEntryTarget.x),
		targetY: Math.round(burtEntryTarget.y),
	})
	await moveObject(burt, burtEntryTarget, BURT_SCREEN_ENTRY_DURATION, generation)
	tracePrologue("burt:battlefield-entry-stop", {
		exists: burt.exists(),
		x: Math.round(burt.pos.x),
		y: Math.round(burt.pos.y),
	})
	if (!isCurrent(generation)) return false

	await scanBattlefield(burt, generation)
	if (!isCurrent(generation)) return false
	showEmotion(burt, "fear", {
		duration: 2.2,
		priority: "narrative",
	})
	await waitSeconds(0.34, generation)
	if (!isCurrent(generation)) return false
	tracePrologue("dialogue:burt-federation-open")
	const federationDialogueResult = await showDialogue([
		{ speaker: "BURT", text: "They are gone. They have to be gone." },
		{
			speaker: "BURT",
			text: "No Federation transponders. Not yet.",
		},
	], {
		overlayOpacity: 0,
		resolveSpeaker: () => burt,
	})
	tracePrologue("dialogue:burt-federation-close", {
		result: federationDialogueResult,
	})
	if (!isCurrent(generation)) return false

	showEmotion(burt, "alert", {
		duration: 2.8,
		priority: "narrative",
	})
	tracePrologue("burt:wreck-spotted")
	await waitSeconds(0.18, generation)
	await bobObjectUp(burt, BURT_ALERT_BOB_HEIGHT, 0.42, generation)
	await moveObject(burt, burtTarget, BURT_PLAYER_APPROACH_DURATION, generation)
	tracePrologue("burt:battlefield-arrived", {
		exists: burt.exists(),
		x: Math.round(burt.pos.x),
		y: Math.round(burt.pos.y),
	})
	if (!isCurrent(generation)) return false

	tracePrologue("dialogue:burt-cleanup-open")
	const cleanupDialogueResult = await showDialogue([
		{ speaker: "BURT", text: "You are not Federation." },
		{
			speaker: "BURT",
			text: "Good. I can repair you. Whether I should is a later problem.",
		},
	], {
		overlayOpacity: 0,
		resolveSpeaker: () => burt,
	})
	tracePrologue("dialogue:burt-cleanup-close", {
		result: cleanupDialogueResult,
	})
	if (!isCurrent(generation)) return false

	tracePrologue("parts:gather-start", {
		parts: k.get(tags.prologueShipPart).length,
	})
	await gatherShipParts(burt, generation)
	tracePrologue("parts:gather-complete", {
		remaining: k.get(tags.prologueShipPart).length,
		burtExists: burt.exists(),
	})
	const portalPosition = center.add(112, -38)
	tracePrologue("portal:module-load-start")
	const { spawnLevel } = await import("../../spawn/spawnLevel")
	tracePrologue("portal:module-load-complete")
	if (!isCurrent(generation)) return false
	const portal = spawnLevel({
		pos: portalPosition,
		levelName: "hub",
		visual: "wormhole",
		portalState: "dormant",
		interactionEnabled: false,
		label: "",
		onEnter: () => {},
	})
	tracePrologue("portal:spawned", {
		id: portal.id,
		x: Math.round(portalPosition.x),
		y: Math.round(portalPosition.y),
	})
	portal.setPortalState("charging")
	tracePrologue("portal:charge-start", {
		duration: WORMHOLE_CHARGE_DURATION,
	})
	gameSoundService.play("wormhole_rampup", {
		volume: mainSoundVolume * 0.9,
	})
	await animatePortalCharge(portal, WORMHOLE_CHARGE_DURATION, generation)
	tracePrologue("portal:charge-complete", {
		exists: portal.exists(),
		progress: portal.portalProgress,
	})
	if (!isCurrent(generation)) return false
	portal.setPortalState("active")
	tracePrologue("dialogue:burt-wormhole-exit-open")
	const wormholeExitDialogueResult = await showDialogue([{
		speaker: "BURT",
		text: "Wake Station still answers. Move before the Claimkeeper turns around.",
	}], {
		overlayOpacity: 0,
		resolveSpeaker: () => burt,
	})
	tracePrologue("dialogue:burt-wormhole-exit-close", {
		result: wormholeExitDialogueResult,
	})
	if (!isCurrent(generation)) return false
	tracePrologue("portal:burt-entry-start", {
		burtExists: burt.exists(),
	})
	try {
		await Promise.race([
			moveObject(burt, portalPosition, 1.05, generation, (progress) => {
				burt.scale = k.vec2(k.lerp(1, 0.15, progress))
				burt.opacity = k.lerp(1, 0, progress)
			}),
			waitSeconds(1.25, generation),
		])
		tracePrologue("portal:burt-entry-complete", {
			burtExists: burt.exists(),
		})
	} finally {
		tracePrologue("portal:cleanup-start")
		audioService.stopMusic()
		tracePrologue("music:recovery-stop")
		if (burt.exists()) k.destroy(burt)
		cancelEvacuationController()
		tracePrologue("portal:cleanup-complete")
	}
	const completed = isCurrent(generation)
	tracePrologue("battlefield:sequence-complete", { completed, generation })
	return completed
}

export interface PrologueHubRepairResult {
	burt: GameObj
	playerSpawnPosition: Vec2
}

export async function playHubRepairSequence(
	phaseStationPosition: Vec2,
	hubEntryPosition: Vec2
): Promise<PrologueHubRepairResult | false> {
	const generation = ++recoveryGeneration
	const playerSpawnPosition = phaseStationPosition.add(52, -112)
	const burtWorkPosition = playerSpawnPosition.add(-34, 0)
	tracePrologue("hub:repair-sequence-start", {
		generation,
		entryX: Math.round(hubEntryPosition.x),
		entryY: Math.round(hubEntryPosition.y),
		phaseStationX: Math.round(phaseStationPosition.x),
		phaseStationY: Math.round(phaseStationPosition.y),
	})
	const existingHubBurt = k.get<GameObj<HorizontalDirectionalVisualComp>>(
		BURT_TAG
	)[0]
	const burt = existingHubBurt ?? spawnBurt(hubEntryPosition)
	burt.pos = hubEntryPosition.clone()
	burt.scale = k.vec2(1)
	burt.opacity = 1
	addCarriedParts(burt)
	k.setCamPos(hubEntryPosition)
	k.setCamScale(WORLD_CAMERA_SCALE)
	tracePrologue("hub:burt-spawned", {
		id: burt.id,
		x: Math.round(burt.pos.x),
		y: Math.round(burt.pos.y),
	})
	const toWorkPosition = burtWorkPosition.sub(hubEntryPosition)
	const hubClearDirection = toWorkPosition.len() > 0.01
		? toWorkPosition.unit()
		: k.vec2(-1, 0)
	const hubClearPosition = hubEntryPosition.add(
		hubClearDirection.scale(BURT_HUB_CLEAR_DISTANCE / WORLD_CAMERA_SCALE)
	)
	await moveObject(
		burt,
		hubClearPosition,
		0.9,
		generation,
		() => k.setCamPos(burt.pos)
	)
	if (!isCurrent(generation)) return false
	burt.faceHorizontal(hubEntryPosition.x - burt.pos.x)
	tracePrologue("hub:burt-looked-back", {
		x: Math.round(burt.pos.x),
		y: Math.round(burt.pos.y),
	})
	await waitSeconds(0.32, generation)
	const arrivalDialogueResult = await showDialogue([{
		speaker: "BURT",
		text: "No pursuit. Good. Good.",
	}], {
		gameplay: "live",
		advance: "auto",
		input: "passthrough",
		autoAdvanceDelay: 1.4,
		overlayOpacity: 0,
		resolveSpeaker: () => burt,
	})
	tracePrologue("hub:arrival-dialogue-close", {
		result: arrivalDialogueResult,
	})
	if (!isCurrent(generation)) return false

	await moveObject(
		burt,
		burtWorkPosition,
		2.2,
		generation,
		() => k.setCamPos(burt.pos)
	)
	tracePrologue("hub:burt-arrived-at-phase-station", {
		exists: burt.exists(),
	})
	if (!isCurrent(generation)) return false

	const hubDialogueResult = await showDialogue([{
		speaker: "BURT",
		text: "Hold still. I can rebuild a ship from five pieces. I have had practice.",
	}], {
		gameplay: "live",
		advance: "auto",
		input: "passthrough",
		autoAdvanceDelay: 1.4,
		overlayOpacity: 0,
		resolveSpeaker: () => burt,
	})
	tracePrologue("hub:repair-dialogue-close", { result: hubDialogueResult })
	if (!isCurrent(generation)) return false

	await installShipParts(burt, playerSpawnPosition, generation)
	tracePrologue("hub:parts-installed")
	const completed = isCurrent(generation)
	tracePrologue("hub:repair-sequence-complete", {
		burtId: burt.id,
		completed,
		playerSpawnX: Math.round(playerSpawnPosition.x),
		playerSpawnY: Math.round(playerSpawnPosition.y),
	})
	if (!completed) return false
	burt.faceHorizontal(playerSpawnPosition.x - burt.pos.x)
	if (!existingHubBurt) registerBurtPlayerAcknowledgement(burt)
	return { burt, playerSpawnPosition }
}

export function cancelPrologueRecoverySequence() {
	tracePrologue("sequence:cancel")
	recoveryGeneration++
	deathPosition = undefined
	cancelEvacuationController()
	audioService.stopMusic()
}

function spawnBurt(pos: Vec2) {
	const visual = getCompanionVisual("burt")
	return k.add([
		k.pos(pos),
		k.sprite(requirePrimaryVisualSprite(visual)),
		k.anchor("center"),
		k.rotate(0),
		horizontalDirectionalVisual({
			nativeFacing: "left",
			initialFacing: "left",
			maxLean: 8,
		}),
		k.scale(visual.worldScale),
		k.opacity(1),
		k.color(k.WHITE),
		k.layer(layers.game),
		k.z(20),
		BURT_TAG,
		tags.prologue,
		tags.props,
	])
}

async function gatherShipParts(burt: GameObj, generation: number) {
	const parts = k.get<GameObj>(tags.prologueShipPart).slice(0, PART_SPRITES.length)
	await Promise.all(parts.map(async (part, index) => {
		tracePrologue("parts:gather-part-start", { id: part.id, index })
		await waitSeconds(index * 0.11, generation)
		await moveObject(part, () => burt.pos, 0.72, generation, (progress) => {
			part.scale = k.vec2(k.lerp(0.72, 0.18, progress))
		})
		if (part.exists()) k.destroy(part)
		tracePrologue("parts:gather-part-complete", { id: part.id, index })
	}))
	if (isCurrent(generation) && burt.exists()) addCarriedParts(burt)
}

function addCarriedParts(burt: GameObj) {
	for (let index = 0; index < PART_SPRITES.length; index++) {
		const angle = index / PART_SPRITES.length * Math.PI * 2
		burt.add([
			k.pos(Math.cos(angle) * 15, Math.sin(angle) * 11),
			k.sprite(PART_SPRITES[index]),
			k.anchor("center"),
			k.rotate(index * 71),
			k.scale(0.28),
			k.color(k.WHITE),
			k.z(-1),
			"burtCarriedPart",
		])
	}
}

async function installShipParts(
	burt: GameObj<HorizontalDirectionalVisualComp>,
	repairPosition: Vec2,
	generation: number
) {
	burt.faceHorizontal(repairPosition.x - burt.pos.x)
	const parts = burt.get("burtCarriedPart") as GameObj[]
	tracePrologue("hub:parts-spread-start", { parts: parts.length })
	await Promise.all(parts.map((part, index) => {
		const offset = HUB_REPAIR_PART_OFFSETS[index]
		const worldTarget = repairPosition.add(offset[0], offset[1])
		return moveObject(part, worldTarget.sub(burt.pos), 0.68, generation, (progress) => {
			part.scale = k.vec2(k.lerp(0.28, 0.52, progress))
		})
	}))
	tracePrologue("hub:parts-spread-complete")
	if (!isCurrent(generation)) return

	const smoke = spawnRepairSmoke(repairPosition)
	const hammer = gameSoundService.play("burt_repair_hammer", {
		volume: mainSoundVolume,
		loop: true,
	})
	tracePrologue("hub:repair-work-start", {
		duration: HUB_REPAIR_DURATION,
		parts: parts.length,
		smokeEmitters: smoke.length,
	})
	let toolPlayed = false
	try {
		await tween(HUB_REPAIR_DURATION, generation, (progress) => {
			burt.setVisualLean(Math.sin(progress * Math.PI * 12) * 4)
			if (toolPlayed || progress < 0.38) return
			toolPlayed = true
			tracePrologue("hub:repair-tool-play")
			gameSoundService.play("burt_repair_tool", {
				volume: mainSoundVolume * 0.9,
			})
		})
	} finally {
		if (hammer) audioService.stopSound(hammer, "repair-complete")
		tracePrologue("hub:repair-hammer-stop")
	}
	for (let index = 0; index < parts.length; index++) {
		if (parts[index].exists()) k.destroy(parts[index])
		tracePrologue("hub:part-installed", { index })
	}
	burt.settleVisual()
}

function registerBurtPlayerAcknowledgement(
	burt: GameObj<HorizontalDirectionalVisualComp>
) {
	burt.onUpdate(() => {
		const player = k.get<GameObj>(tags.player)[0]
		if (!player?.exists()) return
		const toPlayer = player.pos.sub(burt.pos)
		if (toPlayer.len() > BURT_ACKNOWLEDGE_DISTANCE) return
		burt.faceHorizontal(toPlayer.x)
	})
}

function spawnRepairSmoke(pos: Vec2) {
	return HUB_REPAIR_SMOKE_OFFSETS.map((offsetX, index) => {
		const smoke = k.add([
			k.pos(pos.add(offsetX, index % 2 * 8)),
			k.particles(
				{
					max: 80,
					speed: [9, 34],
					acceleration: [k.vec2(-3, -22), k.vec2(3, -38)],
					angle: [0, 360],
					lifeTime: [0.85, 1.55],
					colors: [k.rgb(245, 245, 245), k.rgb(92, 104, 112)],
					opacities: [0, 0.92, 0.72, 0],
					scales: [0.7, 2.5, 4.2],
					angularVelocity: [-70, 70],
					texture: k.getSprite("particle3")!.data!.frames[0].tex,
					quads: [k.getSprite("particle3")!.data!.frames[0].q],
				},
				{
					rate: 20,
					lifetime: HUB_REPAIR_DURATION,
					direction: -90,
					spread: 80,
					position: k.vec2(),
				}
			),
			k.layer(layers.gameEffects),
			k.z(80),
			tags.props,
			tags.prologue,
		])
		smoke.onEnd(() => {
			k.wait(1.6, () => {
				if (smoke.exists()) k.destroy(smoke)
			})
		})
		return smoke
	})
}

function animatePortalCharge(portal: GameObj, duration: number, generation: number) {
	return tween(duration, generation, (progress) => {
		if (portal.exists()) portal.setPortalProgress(progress)
	})
}

function moveObject(
	object: GameObj,
	target: Vec2 | (() => Vec2),
	duration: number,
	generation: number,
	onProgress?: (progress: number) => void
) {
	const start = object.pos.clone()
	return tween(duration, generation, (progress) => {
		if (!object.exists()) return
		const destination = typeof target === "function" ? target() : target
		if (object.has("horizontalDirectionalVisual")) {
			const directionalVisual = object as GameObj<HorizontalDirectionalVisualComp>
			if (progress < 1) {
				directionalVisual.showDirectionalMovement(destination.sub(object.pos))
			} else {
				directionalVisual.settleVisual()
			}
		}
		const eased = progress < 0.5
			? 4 * progress * progress * progress
			: 1 - Math.pow(-2 * progress + 2, 3) / 2
		object.pos = start.lerp(destination, eased)
		onProgress?.(progress)
	})
}

async function scanBattlefield(
	burt: GameObj<HorizontalDirectionalVisualComp>,
	generation: number
) {
	burt.faceHorizontal(-1)
	await waitSeconds(0.34, generation)
	if (!isCurrent(generation)) return
	burt.faceHorizontal(1)
	await waitSeconds(0.42, generation)
}

function bobObjectUp(
	object: GameObj,
	height: number,
	duration: number,
	generation: number
) {
	const start = object.pos.clone()
	return tween(duration, generation, (progress) => {
		if (!object.exists()) return
		object.pos = start.add(0, -Math.sin(progress * Math.PI) * height)
	})
}

function tween(
	duration: number,
	generation: number,
	onProgress: (progress: number) => void
) {
	return new Promise<void>((resolve) => {
		let elapsed = 0
		const controller = k.onUpdate(() => {
			if (!isCurrent(generation)) {
				controller.cancel()
				resolve()
				return
			}
			elapsed += k.dt()
			const progress = k.clamp(elapsed / Math.max(0.001, duration), 0, 1)
			onProgress(progress)
			if (progress < 1) return
			controller.cancel()
			resolve()
		})
	})
}

function waitSeconds(duration: number, generation: number) {
	return new Promise<void>((resolve) => {
		let controller: ReturnType<typeof k.onUpdate>
		const finish = () => {
			controller?.cancel()
			resolve()
		}
		const timer = k.wait(duration, finish)
		controller = k.onUpdate(() => {
			if (isCurrent(generation)) return
			timer.cancel()
			finish()
		})
	})
}

function waitUntil(condition: () => boolean, generation: number) {
	return new Promise<void>((resolve) => {
		const controller = k.onUpdate(() => {
			if (isCurrent(generation) && !condition()) return
			controller.cancel()
			resolve()
		})
	})
}

function hasEnemyOnScreen() {
	return k.get<GameObj>(tags.enemy).some((enemy) =>
		enemy.exists() && isInsideScreen(enemy.pos, 0)
	)
}

function isInsideScreen(pos: Vec2, margin: number) {
	const screen = k.toScreen(pos)
	return screen.x >= -margin && screen.x <= k.width() + margin &&
		screen.y >= -margin && screen.y <= k.height() + margin
}

function screenOutsidePosition(side: "left" | "right", y: number) {
	const edge = k.toWorld(k.vec2(
		side === "left"
			? -BURT_ENTRY_MARGIN
			: k.width() + BURT_ENTRY_MARGIN,
		k.height() / 2
	))
	return k.vec2(edge.x, y)
}

function screenInsidePosition(
	side: "left" | "right",
	distance: number,
	y: number
) {
	const edge = k.toWorld(k.vec2(
		side === "left" ? distance : k.width() - distance,
		k.height() / 2
	))
	return k.vec2(edge.x, y)
}

function nearestScreenExitDirection(pos: Vec2) {
	const screen = k.toScreen(pos)
	const exits = [
		{ distance: screen.x, point: k.vec2(-ENEMY_EXIT_MARGIN, screen.y) },
		{
			distance: k.width() - screen.x,
			point: k.vec2(k.width() + ENEMY_EXIT_MARGIN, screen.y),
		},
		{ distance: screen.y, point: k.vec2(screen.x, -ENEMY_EXIT_MARGIN) },
		{
			distance: k.height() - screen.y,
			point: k.vec2(screen.x, k.height() + ENEMY_EXIT_MARGIN),
		},
	].sort((a, b) => a.distance - b.distance)
	const target = k.toWorld(exits[0].point)
	const direction = target.sub(pos)
	return direction.len() > 0.01 ? direction.unit() : k.vec2(-1, 0)
}

function approachAngle(current: number, target: number, amount: number) {
	const difference = ((target - current + 540) % 360) - 180
	return current + difference * amount
}

function isCurrent(generation: number) {
	return generation === recoveryGeneration
}

function cancelEvacuationController() {
	if (evacuationController?.exists()) k.destroy(evacuationController)
	evacuationController = undefined
	tracePrologue("enemy:evacuation-controller-stop")
}
