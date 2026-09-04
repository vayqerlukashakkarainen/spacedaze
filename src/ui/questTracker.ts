import type { GameObj } from "kaplay"
import { k, layers } from "../main"
import {
	getActiveQuest,
	subscribeToQuest,
	type QuestState,
} from "../services/questService"
import { tags } from "../tags"
import { UI_COLORS, UI_FONT_SIZES } from "./common"

let tracker: GameObj | undefined

export function setupQuestTracker() {
	subscribeToQuest(renderQuest)
}

function renderQuest(quest: QuestState | undefined) {
	if (tracker?.exists()) k.destroy(tracker)
	tracker = undefined
	if (!quest) return

	const color = quest.status === "failed"
		? UI_COLORS.danger
		: quest.status === "completed"
			? UI_COLORS.success
			: UI_COLORS.accent
	const root = k.add([
		k.pos(20, 56),
		k.fixed(),
		k.layer(layers.ui),
		k.z(500),
		tags.questUi,
	])
	tracker = root
	root.add([
		k.rect(286, 62),
		k.color(...UI_COLORS.panel),
		k.opacity(0.9),
		k.outline(1, k.rgb(...UI_COLORS.border)),
	])
	root.add([
		k.rect(3, 62),
		k.color(...color),
	])
	root.add([
		k.pos(14, 11),
		k.text(quest.title.toUpperCase(), { font: "unscii", size: UI_FONT_SIZES.small }),
		k.color(...color),
	])
	root.add([
		k.pos(14, 33),
		k.text(quest.objective, {
			font: "unscii",
			size: UI_FONT_SIZES.tiny,
			width: 255,
		}),
		k.color(...UI_COLORS.text),
	])

	if (quest.status !== "active") {
		const questId = quest.id
		k.wait(1.8, () => {
			if (getActiveQuest()?.id !== questId) return
			if (root.exists()) k.destroy(root)
			if (tracker === root) tracker = undefined
		})
	}
}
