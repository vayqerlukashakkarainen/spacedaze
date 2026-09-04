import type { AudioPlay, GameObj } from "kaplay"
import { playerObj } from "../game"
import { k, layers, mainSoundVolume, musicVolume } from "../main"
import { tags } from "../tags"
import { audioService } from "./audioService"
import { applyDamage } from "./damageService"
import { showDialogue, type DialogueLine } from "./dialogService"
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

const PROLOGUE_QUEST_ID = "lost-in-the-daze"
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
const RECOVERY_LINES: readonly DialogueLine[] = [
	{ speaker: "SHIP", text: "HULL FAILURE." },
	{
		speaker: "SHIP",
		text: [
			{ text: "PILOT SIGNAL" },
			{ text: ".", waitAfter: 0.6 },
			{ text: ".", waitAfter: 0.6 },
			{ text: ". ", waitAfter: 0.6 },
			{ text: "LOST." },
		],
	},
	{ speaker: "UNKNOWN", text: "Found you." },
	{
		speaker: "UNKNOWN",
		text: "I thought you were lost in the destruction...",
	},
	{ speaker: "UNKNOWN", text: "Pulling your phase echo back now." },
]
const HUB_LINES: readonly DialogueLine[] = [
	{
		speaker: "UNKNOWN",
		text: [
			{ text: "Easy.", waitAfter: 0.4 },
			{ text: " Your ship was destroyed." },
		],
	},
	{
		speaker: "UNKNOWN",
		text: "Wake Station captured your phase pattern before it disappeared.",
	},
	{
		speaker: "UNKNOWN",
		text: [
			{ text: "It seems your hyperjump module failed while trying to get to " },
			{ text: "Galora", color: [0, 210, 255] },
			{ text: "." },
		],
	},
	{
		speaker: "UNKNOWN",
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
		speaker: "UNKNOWN",
		text: [
			{ text: "It was destroyed by the " },
			{ text: "Federation", color: [255, 70, 70] },
			{ text: "." },
		],
	},
	{
		speaker: "UNKNOWN",
		text: "The outpost's phase bay is still active, and that's what picked your signal up.",
	},
	{
		speaker: "UNKNOWN",
		text: "As long as you are close to the outpost, you will respawn here.",
	},
	{
		speaker: "UNKNOWN",
		text: [
			{ text: "Out there, death isn't the end.", waitAfter: 0.4 },
			{ text: " But it isn't free either." },
		],
	},
	{
		speaker: "UNKNOWN",
		text: [
			{ text: "Bring back debris. We'll rebuild you stronger.", waitAfter: 0.6 },
			{ text: " And finally repair your " },
			{ text: "hyperdrive module", color: [90, 220, 145] },
			{ text: "." },
		],
	},
	{
		speaker: "UNKNOWN",
		text: [
			{ text: "Good luck,", waitAfter: 0.4 },
			{ text: " you'll need it." },
		],
	},
]

let controller: GameObj | undefined
let introLeadIn: {
	overlay: GameObj
	timer: ReturnType<typeof k.wait>
	pausedObjects: GameObj[]
} | undefined
let landingDialogueTimer: ReturnType<typeof k.wait> | undefined
let spaceJumpBackdrop: SpaceJumpBackdrop | undefined
let hyperspeedLoop: AudioPlay | undefined
let hiddenGameplayUi: { object: GameObj; wasHidden: boolean }[] = []

export function beginPrologueExperience(onSkip: () => void) {
	clearIntroLeadIn()
	clearPrologueSpaceJump()
	hideGameplayUi()
	beginNarrativePrologue()
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
	const pausedObjects = pausePrologueObjects()
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
	const overlay = k.add([
		k.pos(0, 0),
		k.rect(k.width(), k.height()),
		k.color(0, 0, 0),
		k.fixed(),
		k.layer(layers.gameEffects),
		k.z(8000),
		tags.prologue,
	])
	const timer = k.wait(INTRO_BLACK_SCREEN_DURATION, () => {
		clearIntroLeadIn()
		if (!narrativePrologueActive()) return
		void showDialogue(INTRO_LINES, {
			overlayOpacity: 0,
			skipLabel: "SKIP INTRO",
			onComplete: startPrologueLanding,
			onSkip: () => {
				clearPrologueSpaceJump()
				restoreGameplayUi()
				if (controller?.exists()) k.destroy(controller)
				controller = undefined
				setThreatTier(undefined)
				clearQuest(PROLOGUE_QUEST_ID)
				skipNarrativeIntroduction()
				onSkip()
			},
		})
	})
	introLeadIn = { overlay, timer, pausedObjects }
}

export function prologueExperienceActive() {
	return narrativePrologueActive()
}

export function finishPrologueOnDeath() {
	if (!narrativePrologueActive()) return false
	clearLandingSequence()
	clearPrologueSpaceJump()
	restoreGameplayUi()
	if (controller?.exists()) k.destroy(controller)
	controller = undefined
	setThreatTier(undefined)
	failQuest(PROLOGUE_QUEST_ID)
	completeNarrativePrologue()
	return true
}

export function cancelPrologueExperience() {
	clearIntroLeadIn()
	clearLandingSequence()
	clearPrologueSpaceJump()
	restoreGameplayUi()
	if (controller?.exists()) k.destroy(controller)
	controller = undefined
	setThreatTier(undefined)
	clearQuest(PROLOGUE_QUEST_ID)
	cancelNarrativePrologue()
}

function startPrologueLanding() {
	if (!narrativePrologueActive()) return
	clearPrologueSpaceJump()
	k.flash(k.WHITE, 0.65)
	clearLandingSequence()
	landingDialogueTimer = k.wait(LANDING_DIALOG_DELAY, () => {
		landingDialogueTimer = undefined
		if (!narrativePrologueActive()) return
		void showDialogue(LANDED_LINES, {
			overlayOpacity: 0,
			pauseVisualEffects: false,
			onComplete: startPrologueCombat,
		})
	})
}

function clearLandingSequence() {
	landingDialogueTimer?.cancel()
	landingDialogueTimer = undefined
}

function clearPrologueSpaceJump() {
	destroySpaceJumpBackdrop(spaceJumpBackdrop)
	spaceJumpBackdrop = undefined
	hyperspeedLoop?.stop()
	hyperspeedLoop = undefined
}

function pausePrologueObjects() {
	const pausedObjects: GameObj[] = []
	for (const object of k.get<GameObj>(tags.gameLoop)) {
		if (object.paused) continue
		object.paused = true
		pausedObjects.push(object)
	}
	return pausedObjects
}

function clearIntroLeadIn() {
	if (!introLeadIn) return
	introLeadIn.timer.cancel()
	for (const object of introLeadIn.pausedObjects) {
		if (object.exists()) object.paused = false
	}
	if (introLeadIn.overlay.exists()) k.destroy(introLeadIn.overlay)
	introLeadIn = undefined
}

export function showPrologueRecoveryDialogue() {
	return showDialogue(RECOVERY_LINES, { blackout: true })
}

export function showHubIntroductionIfNeeded() {
	if (!shouldShowHubIntroduction()) return Promise.resolve(false)
	return showDialogue(HUB_LINES).then(() => {
		completeHubIntroduction()
		clearQuest(PROLOGUE_QUEST_ID)
		return true
	})
}

function startPrologueCombat() {
	if (!narrativePrologueActive()) return
	restoreGameplayUi()
	setThreatTier(undefined)
	void playZoneExplorationMusic("zone1", true, musicVolume)
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
