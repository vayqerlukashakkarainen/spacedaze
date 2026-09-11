import type { PosComp, Vec2 } from "kaplay"
import { interactable, INTERACTION_PRIORITY } from "../../comp/interactable"
import { snareable } from "../../comp/snareable"
import { dialogue } from "../../content/dialogue/dialogueCatalog"
import { k, layers } from "../../main"
import { registerBatchedEntityUpdate } from "../../services/core/entityUpdateService"
import {
	playCutscene,
	type CutsceneDefinition,
} from "../../services/narrative/cutsceneService"
import { tags } from "../../tags"
import { createNpcInteractionPrompt } from "../../ui/common"

const INTERACT_RADIUS = 72

export function spawnDepositAttendant(depositPos: Vec2, extraTags: string[] = []) {
	let talking = false
	const attendant = k.add([
		k.pos(depositPos.add(k.vec2(122, 6))),
		k.sprite("hub_droid_lamp_keeper", { width: 16, height: 16 }),
		k.anchor("center"),
		k.rotate(-90),
		k.scale(0.95),
		k.color(k.WHITE),
		k.layer(layers.game),
		k.z(12),
		interactable(
			INTERACT_RADIUS,
			startConversation,
			INTERACTION_PRIORITY.dialogue
		),
		snareable({
			mass: 0.8,
			radius: 10,
			releaseDrag: 2.8,
			returnAfterRelease: true,
			returnSpeed: 95,
		}),
		tags.npc,
		tags.props,
		tags.runMap,
		tags.gameLoop,
		...extraTags,
	])
	const prompt = createNpcInteractionPrompt({
		target: attendant,
		offset: k.vec2(0, -48),
		label: { text: "SALVAGE TENDER" },
	})

	registerBatchedEntityUpdate("world", attendant, () => {
		prompt.update(!talking && attendant.isInRange)
	})

	function startConversation() {
		if (talking || !attendant.exists()) return false
		talking = true
		attendant.isInRange = false
		prompt.update(false)
		void playCutscene(createConversation(), {
			resolveActor: (id) => {
				if (id === "depositAttendant") return attendant
				if (id === "player") return k.get<PosComp>(tags.player)[0]
				return undefined
			},
		}).finally(() => {
			if (attendant.exists()) talking = false
		})
		return true
	}

	return attendant
}

function createConversation(): CutsceneDefinition {
	return {
		id: "deposit-attendant-conversation",
		speakerActors: { "SALVAGE TENDER": "depositAttendant" },
		pauseGameplay: false,
		pauseVisualEffects: false,
		restoreActorRotationsOnEnd: true,
		steps: [
			{
				type: "rotate",
				actor: "depositAttendant",
				target: "player",
				duration: 0.25,
				easing: "easeInOutCubic",
			},
			{
				type: "dialogue",
				lines: dialogue.depositAttendant.explanation.lines,
				options: {
					gameplay: "live",
					advance: "manual",
					input: "passthrough",
					overlayOpacity: 0,
				},
			},
		],
	}
}
