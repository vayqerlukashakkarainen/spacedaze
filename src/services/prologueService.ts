import type { AudioPlay, GameObj, Vec2 } from "kaplay"
import type { HorizontalDirectionalVisualComp } from "../comp/horizontalDirectionalVisual"
import { playerObj } from "../game"
import {
	k,
	layers,
	mainSoundVolume,
	musicVolume,
	WORLD_CAMERA_SCALE,
} from "../main"
import { tags } from "../tags"
import { BURT_TAG } from "../spawn/npcs/spawnHubBurt"
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
import { HUB_WORMHOLE_OFFSET } from "./hubLayoutService"
import {
	beginPrologueEnemyEvacuation,
	cancelPrologueRecoverySequence,
	playBattlefieldRecovery,
	playHubRepairSequence,
} from "./prologueRecoverySequence"

const PROLOGUE_QUEST_ID = "lost-in-the-daze"
const PROLOGUE_CUTSCENE_ID = "narrative-prologue"
const HUB_INTRODUCTION_CUTSCENE_ID = "hub-introduction"
const HUB_INTRODUCTION_BURT_ACTOR = "hub-introduction-burt"
const HUB_INTRODUCTION_PLAYER_ACTOR = "hub-introduction-player"
const HUB_INTRODUCTION_ACTOR_OFFSET_X = 44
const HUB_INTRODUCTION_ACTOR_OFFSET_Y = -150
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
const HUB_LAMP_GUIDANCE_LINES: readonly DialogueLine[] = [
	{
		speaker: "BURT",
		text: [
			{ text: "See those " },
			{ text: "lamps", color: [0, 210, 255] },
			{ text: " around the heart of the hub?" },
		],
	},
	{
		speaker: "BURT",
		text: "Each one marks another part of Drius brought back online. Bring debris home, and we'll light the rest.",
	},
]
const HUB_PHASE_VOID_GUIDANCE_LINES: readonly DialogueLine[] = [
	{
		speaker: "BURT",
		text: [
			{ text: "That wormhole leads into the " },
			{ text: "Phase Void", color: [180, 120, 255] },
			{ text: "." },
		],
	},
	{
		speaker: "BURT",
		text: "A skilled pilot can retrieve weapons, ship systems, and rare salvage from inside.",
	},
	{
		speaker: "BURT",
		text: "Go as deep as you dare, then bring the haul back here.",
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
	pauseGameplay: true,
	restoreCameraOnEnd: false,
	steps: [{
		type: "dialogue",
		lines: LANDED_LINES,
		options: {
			channel: "comms",
			gameplay: "paused",
			advance: "auto",
			input: "capture",
			overlayOpacity: 0,
			autoAdvanceDelay: 1.8,
		},
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
		volume: mainSoundVolume * 0.55,
		detune: 220,
		speed: 1.22,
		loop: true,
	})
	spaceJumpBackdrop = spawnSpaceJumpBackdrop({
		tags: [tags.prologue],
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
	const { getHubFacilityPositions } = await import("../levels/hub")
	const phaseStationPosition = getHubFacilityPositions().trainingRange
	const result = await playCutscene(
		createHubIntroductionCutscene(phaseStationPosition),
		{
			resolveActor(id) {
				if (id === HUB_INTRODUCTION_PLAYER_ACTOR) return playerObj
				if (id === HUB_INTRODUCTION_BURT_ACTOR) {
					return k.get<GameObj>(BURT_TAG)[0]
				}
				return undefined
			},
		}
	)
	if (result === "completed") {
		completeHubIntroduction()
		clearQuest(PROLOGUE_QUEST_ID)
		return true
	}
	return false
}

function createHubIntroductionCutscene(
	phaseStationPosition: Vec2
): CutsceneDefinition {
	const burtPosition = phaseStationPosition.add(
		-HUB_INTRODUCTION_ACTOR_OFFSET_X,
		HUB_INTRODUCTION_ACTOR_OFFSET_Y
	)
	const playerPosition = phaseStationPosition.add(
		HUB_INTRODUCTION_ACTOR_OFFSET_X,
		HUB_INTRODUCTION_ACTOR_OFFSET_Y
	)
	const cameraPosition = burtPosition.lerp(playerPosition, 0.5)
	const hubCenter = k.center()
	const wormholePosition = hubCenter.add(...HUB_WORMHOLE_OFFSET)
	const dialogueOptions = {
		gameplay: "paused" as const,
		advance: "manual" as const,
		input: "capture" as const,
		overlayOpacity: 0,
	}
	return {
		id: HUB_INTRODUCTION_CUTSCENE_ID,
		speakerActors: { BURT: HUB_INTRODUCTION_BURT_ACTOR },
		pauseGameplay: true,
		pauseVisualEffects: false,
		steps: [
			{
				type: "parallel",
				steps: [
					{
						type: "move",
						actor: HUB_INTRODUCTION_BURT_ACTOR,
						target: burtPosition,
						duration: 0.55,
					},
					{
						type: "move",
						actor: HUB_INTRODUCTION_PLAYER_ACTOR,
						target: playerPosition,
						duration: 0.55,
					},
					{
						type: "camera",
						target: cameraPosition,
						zoom: WORLD_CAMERA_SCALE * 2,
						duration: 0.55,
					},
				],
			},
			{
				type: "action",
				run(context) {
					faceHubIntroductionActors((id) => context.resolveActor(id))
				},
			},
			{ type: "wait", duration: 0.18 },
			{
				type: "emotion",
				actor: HUB_INTRODUCTION_BURT_ACTOR,
				emotion: "happy",
				options: { duration: 2.2, priority: "narrative" },
			},
			{ type: "wait", duration: 0.32 },
			{
				type: "dialogue",
				lines: HUB_LINES.slice(0, 2),
				options: dialogueOptions,
			},
			{
				type: "emotion",
				actor: HUB_INTRODUCTION_PLAYER_ACTOR,
				emotion: "question",
				options: { duration: 2.2, priority: "narrative" },
			},
			{ type: "wait", duration: 0.38 },
			{
				type: "dialogue",
				lines: HUB_LINES.slice(2, 4),
				options: dialogueOptions,
			},
			{
				type: "emotion",
				actor: HUB_INTRODUCTION_BURT_ACTOR,
				emotion: "sad",
				options: { duration: 2.2, priority: "narrative" },
			},
			{ type: "wait", duration: 0.35 },
			{
				type: "dialogue",
				lines: HUB_LINES.slice(4, 5),
				options: dialogueOptions,
			},
			{
				type: "emotion",
				actor: HUB_INTRODUCTION_PLAYER_ACTOR,
				emotion: "surprised",
				options: { duration: 2.4, priority: "narrative" },
			},
			{ type: "wait", duration: 0.42 },
			{
				type: "dialogue",
				lines: HUB_LINES.slice(5, 8),
				options: dialogueOptions,
			},
			{
				type: "emotion",
				actor: HUB_INTRODUCTION_BURT_ACTOR,
				emotion: "idea",
				options: { duration: 2.4, priority: "narrative" },
			},
			{ type: "wait", duration: 0.35 },
			{
				type: "dialogue",
				lines: HUB_LINES.slice(8, 9),
				options: dialogueOptions,
			},
			{
				type: "camera",
				target: hubCenter,
				zoom: WORLD_CAMERA_SCALE,
				duration: 0.8,
				easing: "easeInOutCubic",
			},
			{
				type: "dialogue",
				lines: HUB_LAMP_GUIDANCE_LINES,
				options: dialogueOptions,
			},
			{
				type: "camera",
				target: wormholePosition,
				zoom: WORLD_CAMERA_SCALE * 1.5,
				duration: 0.9,
				easing: "easeInOutCubic",
			},
			{
				type: "dialogue",
				lines: HUB_PHASE_VOID_GUIDANCE_LINES,
				options: dialogueOptions,
			},
			{
				type: "camera",
				target: cameraPosition,
				zoom: WORLD_CAMERA_SCALE * 2,
				duration: 0.75,
				easing: "easeInOutCubic",
			},
			{
				type: "dialogue",
				lines: HUB_LINES.slice(9),
				options: dialogueOptions,
			},
		],
	}
}

function faceHubIntroductionActors(
	resolveActor: (id: string) => GameObj | undefined
) {
	const burt = resolveActor(HUB_INTRODUCTION_BURT_ACTOR)
	const player = resolveActor(HUB_INTRODUCTION_PLAYER_ACTOR)
	if (!burt || !player) return
	if (burt.has("horizontalDirectionalVisual")) {
		const directionalBurt = burt as GameObj<HorizontalDirectionalVisualComp>
		directionalBurt.faceHorizontal(player.pos.x - burt.pos.x)
	}
	player.angle = burt.pos.sub(player.pos).angle() + 90
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
