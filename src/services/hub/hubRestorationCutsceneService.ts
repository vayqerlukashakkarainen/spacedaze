import type { GameObj } from "kaplay"
import { k, layers, mainSoundVolume } from "../../main"
import { starsEmitter } from "../../particles"
import type { HubRestorationHandle } from "../../spawn/spawnHubRestoration"
import { tags } from "../../tags"
import { audioService } from "../audio/audioService"
import { gameSoundService } from "../audio/gameSoundService"
import {
	playCutscene,
	type CutsceneContext,
	type CutsceneStep,
} from "../narrative/cutsceneService"
import type { PendingHubLevelReveal } from "../runs/runCompletionService"

const CUTSCENE_ID = "hub-restoration-level-reveal"
const CAMERA_PAN_DURATION = 0.48
const LAMP_CHARGE_DURATION = 1
const LAMP_REVEAL_HOLD = 0.28
const CAMERA_RESTORE_DURATION = 0.48
const CHARGE_SHAKE_INTERVAL = 0.075

export async function playHubRestorationLevelReveal(
	restoration: HubRestorationHandle,
	reveal: PendingHubLevelReveal
) {
	const levels = [] as number[]
	for (
		let level = reveal.previousLevel + 1;
		level <= reveal.currentLevel;
		level++
	) {
		if (restoration.getLamp(level)) levels.push(level)
	}
	if (levels.length === 0) {
		restoration.finishLevelReveal()
		return "completed" as const
	}

	const steps: CutsceneStep[] = []
	for (const level of levels) {
		steps.push(
			{
				type: "camera",
				target: () => restoration.getLamp(level)?.pos,
				duration: CAMERA_PAN_DURATION,
				easing: "easeInOutCubic",
			},
			{
				type: "action",
				run: (context) => chargeLamp(context, restoration, level),
			},
			{
				type: "action",
				run: () => revealLamp(restoration, level),
			},
			{ type: "wait", duration: LAMP_REVEAL_HOLD }
		)
	}
	steps.push({
		type: "restoreCamera",
		duration: CAMERA_RESTORE_DURATION,
		easing: "easeInOutCubic",
	})

	try {
		return await playCutscene({
			id: CUTSCENE_ID,
			steps,
			pauseGameplay: true,
			pauseVisualEffects: false,
			restoreCameraOnEnd: true,
		})
	} finally {
		restoration.finishLevelReveal()
	}
}

function chargeLamp(
	context: CutsceneContext,
	restoration: HubRestorationHandle,
	level: number
) {
	const lamp = restoration.getLamp(level)
	if (!lamp?.exists()) return Promise.resolve()
	const baseScale = lamp.scale?.clone() ?? k.vec2(1)
	const charge = spawnLampChargeEffect(lamp)
	const riser = gameSoundService.play("reward_riser_epic", {
		volume: mainSoundVolume * 0.5,
		detune: (level - 1) * 55,
	})

	return new Promise<void>((resolve) => {
		let elapsed = 0
		let shakeElapsed = 0
		let particleElapsed = 0
		let settled = false
		const finish = () => {
			if (settled) return
			settled = true
			update.cancel()
			audioService.stopSound(riser, "hub-lamp-charge-complete")
			if (charge.exists()) k.destroy(charge)
			if (lamp.exists()) lamp.scale = baseScale
			resolve()
		}
		const update = k.onUpdate(() => {
			if (context.cancelled || !lamp.exists()) {
				finish()
				return
			}
			elapsed += k.dt()
			shakeElapsed += k.dt()
			particleElapsed += k.dt()
			const progress = k.clamp(elapsed / LAMP_CHARGE_DURATION, 0, 1)
			charge.progress = progress
			charge.angle += k.dt() * k.lerp(70, 420, progress)
			const pulse = 1 + Math.sin(elapsed * k.lerp(12, 34, progress)) *
				k.lerp(0.025, 0.09, progress)
			lamp.scale = baseScale.scale(pulse)

			if (shakeElapsed >= CHARGE_SHAKE_INTERVAL) {
				shakeElapsed = 0
				k.shake(k.lerp(0.35, 4.5, progress * progress))
			}
			if (particleElapsed >= k.lerp(0.14, 0.055, progress)) {
				particleElapsed = 0
				starsEmitter.emitter.position = lamp.pos.clone()
				starsEmitter.emit(progress > 0.7 ? 3 : 1)
			}
			if (progress >= 1) finish()
		})
	})
}

function spawnLampChargeEffect(lamp: GameObj) {
	return k.add([
		k.pos(lamp.pos.clone()),
		k.rotate(0),
		k.layer(layers.gameEffects),
		k.z(20),
		{
			progress: 0,
			draw() {
				const progress = this.progress
				for (let index = 0; index < 3; index++) {
					const phase = (progress * 2.4 + index / 3) % 1
					k.drawCircle({
						pos: k.vec2(0),
						radius: k.lerp(34, 7, phase),
						fill: false,
						outline: {
							width: progress > 0.75 ? 2 : 1,
							color: k.WHITE,
							opacity: (1 - phase) * k.lerp(0.25, 0.9, progress),
						},
						anchor: "center",
					})
				}
				for (let index = 0; index < 4; index++) {
					const angle = index * 90
					const inner = k.Vec2.fromAngle(angle).scale(11)
					const outer = k.Vec2.fromAngle(angle).scale(
						k.lerp(24, 13, progress)
					)
					k.drawLine({
						p1: inner,
						p2: outer,
						width: 1,
						color: k.rgb(90, 210, 255),
						opacity: k.lerp(0.3, 1, progress),
					})
				}
			},
		},
		tags.hubRestoration,
	])
}

function revealLamp(restoration: HubRestorationHandle, level: number) {
	const lamp = restoration.getLamp(level)
	if (!lamp?.exists()) return
	restoration.setLampLit(level, true)
	starsEmitter.emitter.position = lamp.pos.clone()
	starsEmitter.emit(32)
	k.shake(7)
	k.flash(k.WHITE, 0.24)
	gameSoundService.play("reward_shine_legendary", {
		volume: mainSoundVolume * 0.72,
		detune: (level - 1) * 45,
	})
}
