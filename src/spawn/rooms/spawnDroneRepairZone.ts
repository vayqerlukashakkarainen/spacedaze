import type { GameObj, PosComp, Vec2 } from "kaplay"
import { interactable, type InteractableComp } from "../../comp/interactable"
import { k, layers, mainSoundVolume, spendScore } from "../../main"
import { starsEmitter } from "../../particles"
import { spawnRepairedCombatDrone } from "../../powerups"
import { audioService } from "../../services/audioService"
import { tags } from "../../tags"
import { spawnRing } from "../spawnRing"
import { spawnRepairStation } from "./spawnRepairStation"
import { registerBatchedEntityUpdate } from "../../services/entityUpdateService"
import { UI_FONT_SIZES } from "../../ui/common"
import {
	purchaseBurstParticleCount,
	spawnCurrencyBurst,
} from "../spawnCurrencyBurst"
import { playRequirementErrorSound } from "../../services/uiSoundService"

interface DroneRepairZoneProps {
	pos: Vec2
	depth: number
	hexSize: number
	tags?: string[]
}

const DRONE_REPAIR_DURATION = 0.9
const DRONE_REPAIR_COLOR = { r: 80, g: 92, b: 98 }

export function spawnDroneRepairZone(props: DroneRepairZoneProps) {
	const objectTags = props.tags ?? []
	const station = spawnRepairStation({
		pos: props.pos,
		cost: 8 + props.depth * 3,
		repairTime: 3 + props.depth * 0.35,
		defendRadius: props.hexSize * 2.3,
		enemySpacing: props.hexSize,
		tags: objectTags,
	})
	const wreckDistance = Math.max(44, props.hexSize * 1.25)
	const wreckCount = 2

	for (let index = 0; index < wreckCount; index++) {
		const angle = index === 0 ? 25 : 155
		spawnBrokenDrone({
			pos: props.pos.add(k.Vec2.fromAngle(angle).scale(wreckDistance)),
			cost: 7 + props.depth * 3 + index * 2,
			angle: angle + (index === 0 ? 72 : -68),
			tags: objectTags,
		})
	}

	return station
}

interface BrokenDroneProps {
	pos: Vec2
	cost: number
	angle: number
	tags: string[]
}

function spawnBrokenDrone(props: BrokenDroneProps) {
	let repairing = false
	let repaired = false
	let elapsed = 0
	let sparkElapsed = 0
	let messageElapsed = 0
	const startAngle = props.angle
	const wreck = k.add([
		k.pos(props.pos),
		k.sprite("drone_combat"),
		k.anchor("center"),
		k.rotate(startAngle),
		k.scale(0.9, 0.62),
		k.color(DRONE_REPAIR_COLOR.r, DRONE_REPAIR_COLOR.g, DRONE_REPAIR_COLOR.b),
		k.opacity(0.82),
		k.layer(layers.game),
		interactable(48, beginRepair),
		{ repairCost: props.cost },
		tags.props,
		tags.gameLoop,
		...props.tags,
	])
	const prompt = wreck.add([
		k.text(`F  REPAIR  ${props.cost}`, { size: UI_FONT_SIZES.small, font: "unscii" }),
		k.layer(layers.gameText),
		k.pos(0, -19),
		k.anchor("center"),
		k.color(90, 255, 135),
		k.opacity(0),
		k.z(10),
	])

	registerBatchedEntityUpdate("world", wreck, () => {
		if (!wreck.exists()) return
		if (!repairing) {
			if (messageElapsed > 0) {
				messageElapsed -= k.dt()
				prompt.opacity = 1
			} else {
				prompt.text = `F  REPAIR  ${props.cost}`
				prompt.color = k.rgb(90, 255, 135)
				prompt.opacity = wreck.isInRange ? 1 : 0
			}
			return
		}

		elapsed += k.dt()
		sparkElapsed += k.dt()
		const progress = k.clamp(elapsed / DRONE_REPAIR_DURATION, 0, 1)
		const eased = 1 - Math.pow(1 - progress, 3)
		const brightness = Math.round(k.lerp(DRONE_REPAIR_COLOR.r, 255, eased))
		wreck.color = k.rgb(brightness, brightness, brightness)
		wreck.opacity = k.lerp(0.82, 1, eased)
		wreck.angle = k.lerp(startAngle, -90, eased)
		const pulse = 1 + Math.sin(progress * Math.PI * 6) * (1 - progress) * 0.12
		wreck.scale = k.vec2(k.lerp(0.9, 1, eased) * pulse)
		prompt.text = "REBOOTING"
		prompt.opacity = 1

		if (sparkElapsed >= 0.12) {
			sparkElapsed = 0
			starsEmitter.emitter.position = wreck.pos
			starsEmitter.emit(3)
		}
		if (progress >= 1) finishRepair(wreck)
	})

	function beginRepair() {
		if (repairing || repaired) return
		if (!spendScore(props.cost)) {
			prompt.text = `NEED ${props.cost} SALVAGE`
			prompt.color = k.rgb(255, 110, 90)
			prompt.opacity = 1
			messageElapsed = 1.4
			playRequirementErrorSound()
			return
		}
		spawnCurrencyBurst(wreck.pos.clone(), {
			particleCount: purchaseBurstParticleCount(props.cost),
		})
		repairing = true
		wreck.setInteractRadius(0)
		prompt.text = "REBOOTING"
		prompt.color = k.rgb(90, 255, 135)
		prompt.opacity = 1
		audioService.playSound("powerup1", { volume: mainSoundVolume * 0.55 })
	}

	function finishRepair(droneWreck: GameObj<InteractableComp | PosComp>) {
		if (repaired) return
		repaired = true
		const deploymentPos = droneWreck.pos.clone()
		starsEmitter.emitter.position = deploymentPos
		starsEmitter.emit(16)
		spawnRing({
			pos: deploymentPos,
			speed: 120,
			intensity: 0.18,
			maxRadius: 48,
			color: k.rgb(90, 255, 135),
		})
		k.destroy(droneWreck)
		spawnRepairedCombatDrone(deploymentPos)
	}

	return wreck
}
