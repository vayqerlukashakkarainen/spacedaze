import type { GameObj, HealthComp, PosComp, Vec2 } from "kaplay"
import { k, layers } from "../main"
import { tags } from "../tags"
import { UI_COLORS, UI_FONT_SIZES } from "../ui/common/theme"
import { registerBatchedUiUpdate } from "./uiUpdateService"
import {
	getBossDefinition,
	getBossPhaseIndex,
	type BossId,
	type BossPhaseDefinition,
} from "./bossRegistry"
import { runtimeDebug } from "./runtimeDebugService"

export interface BossEncounterOptions {
	maxHealth: number
	onPhaseChanged?: (
		phase: BossPhaseDefinition,
		phaseIndex: number
	) => void
	onDefeated?: (pos: Vec2) => void
}

export interface BossEncounterController {
	id: BossId
	getPhase: () => BossPhaseDefinition
	getPhaseIndex: () => number
	destroy: () => void
}

let activeEncounter: BossEncounterController | undefined

export function registerBossEncounter(
	boss: GameObj<HealthComp | PosComp>,
	id: BossId,
	options: BossEncounterOptions
): BossEncounterController {
	activeEncounter?.destroy()
	const definition = getBossDefinition(id)
	let phaseIndex = 0
	let finished = false
	const hud = definition.kind === "miniBoss"
		? spawnMiniBossHud(boss, definition.name)
		: spawnBossHud(definition.name, definition.subtitle)

	const controller: BossEncounterController = {
		id,
		getPhase: () => definition.phases[phaseIndex],
		getPhaseIndex: () => phaseIndex,
		destroy: cancel,
	}
	activeEncounter = controller
	options.onPhaseChanged?.(definition.phases[0], 0)
	runtimeDebug.log("boss", "encounter:started", {
		id,
		kind: definition.kind,
		maxHealth: options.maxHealth,
	})

	registerBatchedUiUpdate("overlay", hud.root, () => {
		if (!boss.exists()) return
		const health = Math.max(0, Number(boss.hp))
		const healthRatio = health / Math.max(1, options.maxHealth)
		hud.setHealth(healthRatio)
		const nextPhaseIndex = getBossPhaseIndex(definition, healthRatio)
		if (nextPhaseIndex === phaseIndex) return
		phaseIndex = nextPhaseIndex
		const phase = definition.phases[phaseIndex]
		options.onPhaseChanged?.(phase, phaseIndex)
		runtimeDebug.log("boss", "encounter:phase-changed", {
			id,
			phase: phase.id,
			phaseIndex,
			healthRatio,
		})
	})

	boss.onDeath(() => finish(true))
	boss.onDestroy(() => finish(false))
	return controller

	function finish(defeated: boolean) {
		if (finished) return
		finished = true
		const defeatedAt = boss.pos?.clone?.() ?? k.center()
		cleanup()
		runtimeDebug.log("boss", defeated ? "encounter:defeated" : "encounter:removed", {
			id,
			phase: definition.phases[phaseIndex].id,
		})
		if (defeated) options.onDefeated?.(defeatedAt)
	}

	function cancel() {
		if (finished) return
		finished = true
		cleanup()
	}

	function cleanup() {
		if (hud.root.exists()) k.destroy(hud.root)
		if (activeEncounter === controller) activeEncounter = undefined
	}
}

export function getActiveBossEncounter() {
	return activeEncounter
}

function spawnBossHud(name: string, subtitle: string) {
	const width = Math.min(420, k.width() - 32)
	const root = k.add([
		k.pos(k.width() / 2, 18),
		k.fixed(),
		k.layer(layers.uiEffects),
		k.z(200),
		tags.bossEncounterUi,
		tags.gameLoopUi,
	])
	root.add([
		k.text(`BOSS  //  ${subtitle}`, {
			size: UI_FONT_SIZES.tiny,
			font: "unscii",
		}),
		k.pos(0, 0),
		k.anchor("top"),
		k.color(...UI_COLORS.muted),
	])
	root.add([
		k.text(name, { size: UI_FONT_SIZES.heading, font: "unscii" }),
		k.pos(0, 13),
		k.anchor("top"),
		k.color(...UI_COLORS.text),
	])
	root.add([
		k.rect(width, 7),
		k.pos(-width / 2, 35),
		k.color(...UI_COLORS.border),
	])
	const fill = root.add([
		k.rect(width, 7),
		k.pos(-width / 2, 35),
		k.color(...UI_COLORS.danger),
	])
	return {
		root,
		setHealth(value: number) {
			fill.width = width * k.clamp(value, 0, 1)
		},
	}
}

function spawnMiniBossHud(
	miniBoss: GameObj<HealthComp | PosComp>,
	name: string
) {
	const width = 58
	const height = 4
	const offset = k.vec2(0, -42)
	const root = k.add([
		k.pos(miniBoss.pos.add(offset)),
		k.layer(layers.gameText),
		k.z(100),
		tags.bossEncounterUi,
		tags.gameLoopUi,
	])
	root.add([
		k.text(name, {
			size: UI_FONT_SIZES.tiny,
			font: "unscii",
		}),
		k.pos(0, -5),
		k.anchor("bot"),
		k.color(...UI_COLORS.text),
	])
	root.add([
		k.rect(width, height),
		k.pos(-width / 2, 0),
		k.color(...UI_COLORS.border),
	])
	const fill = root.add([
		k.rect(width, height),
		k.pos(-width / 2, 0),
		k.color(...UI_COLORS.danger),
	])
	return {
		root,
		setHealth(value: number) {
			root.pos = miniBoss.pos.add(offset)
			fill.width = width * k.clamp(value, 0, 1)
		},
	}
}
