import type { AudioPlay, GameObj } from "kaplay"
import { playerObj } from "../game"
import { k, layers, mainSoundVolume, musicVolume } from "../main"
import { tags } from "../tags"
import { audioService } from "./audioService"
import {
	cancelActiveCutscene,
	playCutscene,
	type CutsceneDefinition,
} from "./cutsceneService"
import { applyDamage } from "./damageService"
import type { DialogueLine } from "./dialogService"
import {
	beginNarrativePrologue,
	cancelNarrativePrologue,
	completeHubIntroduction,
	completeNarrativePrologue,
	narrativePrologueActive,
	shouldShowHubIntroduction,
	skipNarrativeIntroduction,
} from "./narrativeService"
import {
	clearQuest,
	failQuest,
	startQuest,
	updateQuestObjective,
} from "./questService"
import { setThreatTier } from "./threatService"
import { playZoneExplorationMusic } from "./explorationMusicService"
import {
	destroySpaceJumpBackdrop,
	spawnSpaceJumpBackdrop,
	type SpaceJumpBackdrop,
} from "./spaceJumpVisualService"
import {
	beginPrologueEnemyEvacuation,
	cancelPrologueRecoverySequence,
	playBattlefieldRecovery,
	playHubRepairSequence,
} from "./prologueRecoverySequence"

const PROLOGUE_QUEST_ID = "lost-in-the-daze"
const PROLOGUE_CUTSCENE_ID = "narrative-prologue"
const HUB_INTRODUCTION_CUTSCENE_ID = "hub-introduction"
const INTRO_BLACK_SCREEN_DURATION = 3
const LANDING_DIALOG_DELAY = 0.6
const INTRO_LINES: readonly DialogueLine[] = [
	{
		speaker: "SHIP",
		text: [
			{ text: "SPACEJUMP COORDINATION SYSTEM" },
			{ text: ".", waitAfter: 0.6 },
			{ text: ".", waitAfter: 0.6 },
			{ text: ". ", waitAfter: 0.6 },
			{
				text: "FAILURE.",
				color: [255, 70, 70],
				flash: true,
				sound: { id: "system_error", volume: 0.9 },
				shake: 8,
			},
		],
	},
	{ speaker: "SHIP", text: "DESTINATION LOCK LOST." },
	{
		speaker: "SHIP",
		text: [
			{
				text: "INCOMING TRANSMISSION.",
				waitAfter: 0.5,
			},
			{
				text: " SIGNAL...",
				waitAfter: 0.6,
			},
			{
				text: " UNKNOWN.",
				textShake: 1.5,
			},
		],
	},
	{
		speaker: "UNKNOWN",
		text: "...can you hear me?",
		disturbance: true,
	},
	{ speaker: "SHIP", text: "FOREIGN PHASE SIGNAL DETECTED." },
	{
		speaker: "UNKNOWN",
		text: "Whatever happens, keep moving.",
		disturbance: true,
	},
	{
		speaker: "SHIP",
		autoAdvance: true,
		text: [
			{ text: "LEAVING SPACE JUMP IN... " },
			{ text: "3...", waitAfter: 0.6 },
			{ text: " 2...", waitAfter: 0.6 },
			{ text: " 1... ", waitAfter: 0.6 },
		],
	},
]
const LANDED_LINES: readonly DialogueLine[] = [
	{
		speaker: "UNKNOWN",
		text: "Your hyperjump module has failed.",
	},
	{
		speaker: "UNKNOWN",
		text: "Find the wormhole and enter it.",
	},
	{
		speaker: "UNKNOWN",
		text: [
			{ text: "But be cautious,", waitAfter: 0.4 },
			{ text: " the " },
			{ text: "Federation", color: [255, 70, 70] },
			{ text: " is still lurking around." },
		],
	},
]
const HUB_LINES: readonly DialogueLine[] = [
	{
		speaker: "BURT",
		text: [
			{ text: "There you are.", waitAfter: 0.4 },
			{ text: " Name's Burt." },
		],
	},
	{
		speaker: "BURT",
		text: "Wake Station captured your phase pattern before it disappeared.",
	},
	{
		speaker: "BURT",
		text: [
			{ text: "It seems your hyperjump module failed while trying to get to " },
			{ text: "Galora", color: [0, 210, 255] },
			{ text: "." },
		],
	},
	{
		speaker: "BURT",
		text: [
			{ text: "You have landed on the outpost of " },
			{ text: "Drius", color: [0, 210, 255] },
			{ text: ",", waitAfter: 0.4 },
			{ text: " although planet " },
			{ text: "Drius", color: [0, 210, 255] },
			{ text: " is no more..." },
		],
	},
	{
		speaker: "BURT",
		text: [
			{ text: "It was destroyed by the " },
			{ text: "Federation", color: [255, 70, 70] },
			{ text: "." },
		],
	},
	{
		speaker: "BURT",
		text: "The outpost's phase bay is still active, and that's what picked your signal up.",
	},
	{
		speaker: "BURT",
		text: "As long as you are close to the outpost, you will respawn here.",
	},
	{
		speaker: "BURT",
		text: [
			{ text: "Out there, death isn't the end.", waitAfter: 0.4 },
			{ text: " But it isn't free either." },
		],
	},
	{
		speaker: "BURT",
		text: [
			{ text: "Bring back debris. We'll rebuild you stronger.", waitAfter: 0.6 },
			{ text: " And finally repair your " },
			{ text: "hyperdrive module", color: [90, 220, 145] },
			{ text: "." },
		],
	},
	{
		speaker: "BURT",
		text: [
			{ text: "Good luck,", waitAfter: 0.4 },
			{ text: " you'll need it." },
		],
	},
]

const PROLOGUE_CUTSCENE: CutsceneDefinition = {
	id: PROLOGUE_CUTSCENE_ID,
	pauseGameplay: true,
	pauseVisualEffects: false,
	steps: [
		{
			type: "action",
			run: startPrologueCutsceneVisuals,
		},
		{
			type: "wait",
			duration: INTRO_BLACK_SCREEN_DURATION,
		},
		{
			type: "action",
			run: clearIntroOverlay,
		},
		{
			type: "dialogue",
			lines: INTRO_LINES,
			skippable: true,
			options: {
				overlayOpacity: 0,
				skipLabel: "SKIP INTRO",
			},
		},
		{
			type: "action",
			run() {
				clearPrologueSpaceJump()
				k.flash(k.WHITE, 0.65)
			},
		},
	],
}

const PROLOGUE_LANDED_COMMS: CutsceneDefinition = {
	id: "prologue-landed-comms",
	pauseGameplay: false,
	restoreCameraOnEnd: false,
	steps: [{
		type: "dialogue",
		lines: LANDED_LINES,
		options: {
			channel: "comms",
			gameplay: "live",
			advance: "auto",
			input: "passthrough",
			overlayOpacity: 0,
			autoAdvanceDelay: 1.8,
		},
	}],
}

const HUB_INTRODUCTION_CUTSCENE: CutsceneDefinition = {
	id: HUB_INTRODUCTION_CUTSCENE_ID,
	steps: [{
		type: "dialogue",
		lines: HUB_LINES,
	}],
}

let controller: GameObj | undefined
let introOverlay: GameObj | undefined
let spaceJumpBackdrop: SpaceJumpBackdrop | undefined
let hyperspeedLoop: AudioPlay | undefined
let hiddenGameplayUi: { object: GameObj; wasHidden: boolean }[] = []

export function beginPrologueExperience(onSkip: () => void) {
	cancelActiveCutscene(PROLOGUE_CUTSCENE_ID)
	clearIntroOverlay()
	clearPrologueSpaceJump()
	hideGameplayUi()
	beginNarrativePrologue()
	void playCutscene(PROLOGUE_CUTSCENE, {
		onComplete: startPrologueCombat,
		onSkip: () => {
			setThreatTier(undefined)
			clearQuest(PROLOGUE_QUEST_ID)
			skipNarrativeIntroduction()
			onSkip()
		},
		onCancel: () => {
			setThreatTier(undefined)
			clearQuest(PROLOGUE_QUEST_ID)
			cancelNarrativePrologue()
		},
	})
}

export function prologueExperienceActive() {
	return narrativePrologueActive()
}

export function finishPrologueOnDeath() {
	if (!narrativePrologueActive()) return false
	cancelActiveCutscene(PROLOGUE_CUTSCENE_ID)
	clearIntroOverlay()
	clearPrologueSpaceJump()
	hideGameplayUi()
	if (controller?.exists()) k.destroy(controller)
	controller = undefined
	setThreatTier(undefined)
	failQuest(PROLOGUE_QUEST_ID)
	beginPrologueEnemyEvacuation(playerObj.pos)
	completeNarrativePrologue()
	return true
}

export function cancelPrologueExperience() {
	cancelActiveCutscene(PROLOGUE_CUTSCENE_ID)
	cancelActiveCutscene(HUB_INTRODUCTION_CUTSCENE_ID)
	cancelPrologueRecoverySequence()
	clearIntroOverlay()
	clearPrologueSpaceJump()
	restoreGameplayUi()
	if (controller?.exists()) k.destroy(controller)
	controller = undefined
	setThreatTier(undefined)
	clearQuest(PROLOGUE_QUEST_ID)
	cancelNarrativePrologue()
}

function clearPrologueSpaceJump() {
	destroySpaceJumpBackdrop(spaceJumpBackdrop)
	spaceJumpBackdrop = undefined
	if (hyperspeedLoop) audioService.stopSound(hyperspeedLoop, "space-jump-ended")
	hyperspeedLoop = undefined
}

function startPrologueCutsceneVisuals() {
	audioService.stopMusic()
	audioService.playSound("hyperspeed_jump_start", {
		volume: mainSoundVolume * 0.8,
	})
	hyperspeedLoop = audioService.playSound("hyperspeed_travel", {
		volume: mainSoundVolume * 0.24,
		detune: -280,
		speed: 0.72,
		loop: true,
	})
	spaceJumpBackdrop = spawnSpaceJumpBackdrop({
		tags: [tags.prologue],
		onSpeedChange(progress) {
			if (!hyperspeedLoop) return
			const eased = progress * progress * (3 - 2 * progress)
			audioService.updateSound(hyperspeedLoop, {
				volume: mainSoundVolume * k.lerp(0.24, 0.55, eased),
				speed: k.lerp(0.72, 1.22, eased),
				detune: k.lerp(-280, 220, eased),
			})
		},
	})
	introOverlay = k.add([
		k.pos(0, 0),
		k.rect(k.width(), k.height()),
		k.color(0, 0, 0),
		k.fixed(),
		k.layer(layers.gameEffects),
		k.z(8000),
		tags.prologue,
	])
	return () => {
		clearIntroOverlay()
		clearPrologueSpaceJump()
		restoreGameplayUi()
	}
}

function clearIntroOverlay() {
	if (introOverlay?.exists()) k.destroy(introOverlay)
	introOverlay = undefined
}

export function showPrologueRecoveryDialogue() {
	return playBattlefieldRecovery()
}

export function showPrologueHubRepair(
	phaseStationPosition: ReturnType<typeof k.vec2>,
	hubEntryPosition: ReturnType<typeof k.vec2>
) {
	return playHubRepairSequence(phaseStationPosition, hubEntryPosition)
}

export async function showHubIntroductionIfNeeded() {
	if (!shouldShowHubIntroduction()) return false
	const result = await playCutscene(HUB_INTRODUCTION_CUTSCENE)
	if (result === "completed") {
		completeHubIntroduction()
		clearQuest(PROLOGUE_QUEST_ID)
		return true
	}
	return false
}

function startPrologueCombat() {
	if (!narrativePrologueActive()) return
	restoreGameplayUi()
	setThreatTier(undefined)
	void playZoneExplorationMusic("zone1", true, musicVolume)
	k.wait(LANDING_DIALOG_DELAY, () => {
		if (!narrativePrologueActive()) return
		void playCutscene(PROLOGUE_LANDED_COMMS)
	})
	startQuest({
		id: PROLOGUE_QUEST_ID,
		title: "LOST IN THE DAZE",
		objective: "FIND A WAY OUT",
	})
	let elapsed = 0
	controller = k.add([
		{
			update() {
				if (!playerObj?.exists()) return
				elapsed += k.dt()
				if (elapsed >= 12 && elapsed - k.dt() < 12) {
					updateQuestObjective(
						PROLOGUE_QUEST_ID,
						"UNKNOWN SIGNAL DETECTED — KEEP MOVING"
					)
				}
				if (elapsed >= 26 && elapsed - k.dt() < 26) {
					updateQuestObjective(
						PROLOGUE_QUEST_ID,
						"PHASE STABILITY CRITICAL"
					)
					k.flash(k.rgb(0, 90, 120), 0.35)
				}
				if (elapsed < 40) return
				k.shake(5)
				applyDamage(playerObj, Math.max(1, playerObj.hp), {
					source: { name: "THE DAZE", sprite: "room_rift_anchor" },
					showNumber: false,
				})
			},
			draw() {
				if (elapsed < 26) return
				k.drawRect({
					pos: k.vec2(0, 0),
					width: k.width(),
					height: k.height(),
					color: k.rgb(0, 95, 125),
					opacity: k.clamp((elapsed - 26) / 40, 0, 0.22),
				})
			},
		},
		k.fixed(),
		k.layer(layers.uiEffects),
		k.z(50),
		tags.prologue,
		tags.gameLoop,
	])
	audioService.playSound("swap_level", { volume: mainSoundVolume * 0.65 })
}

function hideGameplayUi() {
	restoreGameplayUi()
	hiddenGameplayUi = k.get<GameObj>(tags.gameLoopUi).map((object) => ({
		object,
		wasHidden: object.hidden,
	}))
	for (const entry of hiddenGameplayUi) entry.object.hidden = true
}

function restoreGameplayUi() {
	for (const entry of hiddenGameplayUi) {
		if (entry.object.exists()) entry.object.hidden = entry.wasHidden
	}
	hiddenGameplayUi = []
}
