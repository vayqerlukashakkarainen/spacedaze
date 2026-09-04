import type { Vec2 } from "kaplay"
import { playerObj } from "../../game"
import { k, layers, mainSoundVolume, spendScore } from "../../main"
import { addThreatTime } from "../../services/threatService"
import { spawnThreatEncounter } from "../../services/enemyEncounterService"
import { audioService } from "../../services/audioService"
import { updatePlayerHealthBar } from "../../ui/gameUi"
import { tags } from "../../tags"
import { spawnBuilding } from "../spawnBuilding"
import { spawnDamageNumber } from "../spawnDamageNumber"
import { spawnRing } from "../spawnRing"
import { registerBatchedEntityUpdate } from "../../services/entityUpdateService"
import { UI_FONT_SIZES } from "../../ui/common"
import {
	purchaseBurstParticleCount,
	spawnCurrencyBurst,
} from "../spawnCurrencyBurst"
import { playRequirementErrorSound } from "../../services/uiSoundService"

interface RepairStationProps {
	pos: Vec2
	cost: number
	repairTime: number
	defendRadius: number
	enemySpacing: number
	tags?: string[]
}

export function spawnRepairStation(props: RepairStationProps) {
	let repairing = false
	let repaired = false
	let progress = 0
	const station = spawnBuilding({
		pos: props.pos,
		sprite: "room_repair_station",
		scale: 0.62,
		interactRadius: 75,
		interactPromptOffset: k.vec2(0, -138),
		interactionPrompt: () => ({
			title: "REPAIR STATION",
			action: "START REPAIR",
			detailLeft: `COST ${props.cost} SCRAP`,
		}),
		onInteract: beginRepair,
	})
	station.tag(props.tags ?? [])
	const status = station.add([
		k.text(`REPAIR ${props.cost}`, { size: UI_FONT_SIZES.body, font: "unscii" }),
		k.pos(0, -86),
		k.anchor("center"),
		k.color(90, 255, 135),
		k.layer(layers.gameText),
	])
	const barBg = station.add([
		k.rect(76, 5),
		k.pos(-38, -72),
		k.anchor("left"),
		k.color(45, 65, 50),
		k.layer(layers.gameEffects),
	])
	const bar = station.add([
		k.rect(0, 5),
		k.pos(-38, -72),
		k.anchor("left"),
		k.color(90, 255, 135),
		k.layer(layers.gameEffects),
	])

	registerBatchedEntityUpdate("world", station, () => {
		if (!repairing || repaired) return
		const inside = playerObj.pos.dist(station.pos) <= props.defendRadius
		status.text = inside ? "REPAIRING" : "RETURN TO STATION"
		if (!inside) return
		progress += k.dt()
		bar.width = 76 * k.clamp(progress / props.repairTime, 0, 1)
		if (progress < props.repairTime) return

		repairing = false
		repaired = true
		const restored = Math.max(0, playerObj.maxHP - playerObj.hp)
		playerObj.hp = playerObj.maxHP
		updatePlayerHealthBar(playerObj.hp)
		if (restored > 0) {
			spawnDamageNumber(playerObj.pos.clone(), restored, {
				color: k.rgb(90, 255, 135),
				prefix: "+",
			})
		}
		status.text = "REPAIR COMPLETE"
		station.setInteractRadius(0)
		spawnRing({
			pos: station.pos,
			speed: 180,
			intensity: 0.25,
			maxRadius: props.defendRadius,
			color: k.rgb(90, 255, 135),
		})
		audioService.playSound("powerup1", { volume: mainSoundVolume })
	})

	function beginRepair() {
		if (repairing || repaired) return
		if (playerObj.hp >= playerObj.maxHP) {
			status.text = "HULL FULL"
			playRequirementErrorSound()
			return
		}
		if (!spendScore(props.cost)) {
			status.text = `NEED ${props.cost} SALVAGE`
			playRequirementErrorSound()
			return
		}
		spawnCurrencyBurst(station.pos.clone(), {
			particleCount: purchaseBurstParticleCount(props.cost),
		})
		repairing = true
		status.text = "REPAIRING"
		addThreatTime(8)
		spawnThreatEncounter(
			station.pos.add(k.Vec2.fromAngle(k.rand(360)).scale(props.defendRadius + 90)),
			props.enemySpacing
		)
	}

	return station
}
