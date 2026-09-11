import type { AudioPlay, GameObj, PosComp, Vec2 } from "kaplay"
import { dialogue } from "../../content/dialogue/dialogueCatalog"
import type { HorizontalDirectionalVisualComp } from "../../comp/horizontalDirectionalVisual"
import { playerObj } from "../../game"
import {
	k,
	layers,
	mainSoundVolume,
	musicVolume,
	WORLD_CAMERA_SCALE,
} from "../../main"
import { tags } from "../../tags"
import { BURT_TAG } from "../../spawn/npcs/spawnHubBurt"
import { audioService } from "../audio/audioService"
import { gameSoundService } from "../audio/gameSoundService"
import {
	cancelActiveCutscene,
	playCutscene,
	type CutsceneDefinition,
} from "./cutsceneService"
import {
	beginNarrativePrologue,
	cancelNarrativePrologue,
	completeHubIntroduction,
	completeNarrativePrologue,
	narrativePrologueActive,
	shouldShowHubIntroduction,
} from "./narrativeService"
import {
	clearQuest,
	failQuest,
	startQuest,
} from "../progression/questService"
import { setThreatTier } from "../enemies/threatService"
import { playZoneExplorationMusic } from "../audio/explorationMusicService"
import {
	destroySpaceJumpBackdrop,
	spawnSpaceJumpBackdrop,
	type SpaceJumpBackdrop,
} from "../world/spaceJumpVisualService"
import {
	HUB_FIRING_RANGE_OFFSET,
	HUB_WORMHOLE_OFFSET,
} from "../hub/hubLayoutService"
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
const HUB_INTRODUCTION_OVERVIEW_ZOOM_MULTIPLIER = 0.5
const HUB_INTRODUCTION_FACILITY_ZOOM_MULTIPLIER = 1.15
const HUB_INTRODUCTION_WORMHOLE_ZOOM_MULTIPLIER = 1.35
const HUB_INTRODUCTION_ACTOR_ZOOM_MULTIPLIER = 2
const INTRO_BLACK_SCREEN_DURATION = 3
const LANDING_DIALOG_DELAY = 0.6

function hubIntroductionZoom(multiplier: number) {
	return WORLD_CAMERA_SCALE * multiplier
}

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
			lines: dialogue.prologue.spacejumpFailure,
			options: {
				overlayOpacity: 0,
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
		lines: dialogue.prologue.landed,
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

let introOverlay: GameObj | undefined
let spaceJumpBackdrop: SpaceJumpBackdrop | undefined
let hyperspeedLoop: AudioPlay | null | undefined
let hiddenGameplayUi: { object: GameObj; wasHidden: boolean }[] = []

export function beginPrologueExperience() {
	cancelActiveCutscene(PROLOGUE_CUTSCENE_ID)
	clearIntroOverlay()
	clearPrologueSpaceJump()
	hideGameplayUi()
	beginNarrativePrologue()
	void playCutscene(PROLOGUE_CUTSCENE, {
		onComplete: startPrologueCombat,
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
	gameSoundService.play("hyperspeed_jump_start", {
		volume: mainSoundVolume * 0.8,
	})
	hyperspeedLoop = gameSoundService.play("hyperspeed_travel", {
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
	const { getHubFacilityPositions } = await import("../../levels/hub")
	const facilityPositions = getHubFacilityPositions()
	const result = await playCutscene(
		createHubIntroductionCutscene(facilityPositions),
		{
			resolveActor(id) {
				if (id === HUB_INTRODUCTION_PLAYER_ACTOR) return playerObj
				if (id === HUB_INTRODUCTION_BURT_ACTOR) {
					return k.get<PosComp>(BURT_TAG)[0]
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

interface HubIntroductionFacilityPositions {
	contractTerminal: Vec2
	trainingRange: Vec2
	salvageForge: Vec2
	debriefTerminal: Vec2
}

function createHubIntroductionCutscene(
	facilityPositions: HubIntroductionFacilityPositions
): CutsceneDefinition {
	const phaseStationPosition = facilityPositions.trainingRange
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
	const firingRangePosition = hubCenter.add(...HUB_FIRING_RANGE_OFFSET)
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
						target: hubCenter,
						zoom: hubIntroductionZoom(
							HUB_INTRODUCTION_OVERVIEW_ZOOM_MULTIPLIER
						),
						duration: 1.1,
						easing: "easeInOutCubic",
					},
				],
			},
			{ type: "wait", duration: 0.35 },
			{
				type: "dialogue",
				lines: dialogue.prologue.hubIntroduction.overview,
				options: dialogueOptions,
			},
			{
				type: "camera",
				target: cameraPosition,
				zoom: hubIntroductionZoom(HUB_INTRODUCTION_ACTOR_ZOOM_MULTIPLIER),
				duration: 0.8,
				easing: "easeInOutCubic",
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
				emotion: "alert",
				options: { duration: 2.2, priority: "narrative" },
			},
			{ type: "wait", duration: 0.32 },
			{
				type: "dialogue",
				lines: dialogue.prologue.hubIntroduction.meeting,
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
				type: "camera",
				target: hubCenter,
				zoom: hubIntroductionZoom(HUB_INTRODUCTION_FACILITY_ZOOM_MULTIPLIER),
				duration: 0.8,
				easing: "easeInOutCubic",
			},
			{
				type: "dialogue",
				lines: dialogue.prologue.hubIntroduction.reconstruction,
				options: dialogueOptions,
			},
			{
				type: "camera",
				target: facilityPositions.salvageForge,
				zoom: hubIntroductionZoom(HUB_INTRODUCTION_FACILITY_ZOOM_MULTIPLIER),
				duration: 0.75,
				easing: "easeInOutCubic",
			},
			{
				type: "dialogue",
				lines: dialogue.prologue.hubIntroduction.salvageForge,
				options: dialogueOptions,
			},
			{
				type: "camera",
				target: facilityPositions.debriefTerminal,
				zoom: hubIntroductionZoom(HUB_INTRODUCTION_FACILITY_ZOOM_MULTIPLIER),
				duration: 0.75,
				easing: "easeInOutCubic",
			},
			{
				type: "dialogue",
				lines: dialogue.prologue.hubIntroduction.debriefTerminal,
				options: dialogueOptions,
			},
			{
				type: "camera",
				target: firingRangePosition,
				zoom: hubIntroductionZoom(HUB_INTRODUCTION_FACILITY_ZOOM_MULTIPLIER),
				duration: 0.85,
				easing: "easeInOutCubic",
			},
			{
				type: "dialogue",
				lines: dialogue.prologue.hubIntroduction.trainingRange,
				options: dialogueOptions,
			},
			{
				type: "camera",
				target: facilityPositions.contractTerminal,
				zoom: hubIntroductionZoom(HUB_INTRODUCTION_FACILITY_ZOOM_MULTIPLIER),
				duration: 0.85,
				easing: "easeInOutCubic",
			},
			{
				type: "dialogue",
				lines: dialogue.prologue.hubIntroduction.contractTerminal,
				options: dialogueOptions,
			},
			{
				type: "camera",
				target: wormholePosition,
				zoom: hubIntroductionZoom(HUB_INTRODUCTION_WORMHOLE_ZOOM_MULTIPLIER),
				duration: 0.8,
				easing: "easeInOutCubic",
			},
			{
				type: "dialogue",
				lines: dialogue.prologue.hubIntroduction.phaseVoidGuidance,
				options: dialogueOptions,
			},
			{
				type: "camera",
				target: cameraPosition,
				zoom: hubIntroductionZoom(HUB_INTRODUCTION_ACTOR_ZOOM_MULTIPLIER),
				duration: 0.8,
				easing: "easeInOutCubic",
			},
			{
				type: "emotion",
				actor: HUB_INTRODUCTION_BURT_ACTOR,
				emotion: "fear",
				options: { duration: 2.4, priority: "narrative" },
			},
			{ type: "wait", duration: 0.35 },
			{
				type: "dialogue",
				lines: dialogue.prologue.hubIntroduction.confession,
				options: dialogueOptions,
			},
			{
				type: "emotion",
				actor: HUB_INTRODUCTION_PLAYER_ACTOR,
				emotion: "angry",
				options: { duration: 2.2, priority: "narrative" },
			},
			{ type: "wait", duration: 0.38 },
			{
				type: "emotion",
				actor: HUB_INTRODUCTION_BURT_ACTOR,
				emotion: "angry",
				options: { duration: 2.2, priority: "narrative" },
			},
			{ type: "wait", duration: 0.34 },
			{
				type: "dialogue",
				lines: dialogue.prologue.hubIntroduction.departure,
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
		const directionalBurt = burt as GameObj<
			PosComp | HorizontalDirectionalVisualComp
		>
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
	gameSoundService.play("swap_level", { volume: mainSoundVolume * 0.65 })
}

function hideGameplayUi() {
	restoreGameplayUi()
	hiddenGameplayUi = k.get(tags.gameLoopUi).map((object) => ({
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
