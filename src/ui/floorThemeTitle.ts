import type { GameObj } from "kaplay"
import { k, layers } from "../main"
import { registerBatchedUiUpdate } from "../services/uiUpdateService"
import { tags } from "../tags"
import {
	getFloorThemeDefinition,
	type FloorThemeId,
} from "../levels/floorThemes/floorThemeDirectory"
import { UI_COLORS, UI_FONT_SIZES } from "./common"

const TITLE_ENTER_DURATION = 0.35
const TITLE_HOLD_DURATION = 2.2
const TITLE_EXIT_DURATION = 0.65
const TITLE_TOTAL_DURATION = TITLE_ENTER_DURATION + TITLE_HOLD_DURATION + TITLE_EXIT_DURATION

let activeTitle: GameObj | undefined

export function showFloorThemeTitle(themeId: FloorThemeId, depth: number) {
	if (activeTitle?.exists()) k.destroy(activeTitle)

	const theme = getFloorThemeDefinition(themeId)
	const root = k.add([
		k.pos(k.width() / 2, k.height() * 0.22 - 8),
		k.fixed(),
		k.layer(layers.uiEffects),
		k.z(1000),
		tags.gameLoopUi,
	])
	activeTitle = root

	const elements = [
		root.add([
			k.text(`FLOOR ${String(depth).padStart(2, "0")}`, {
				font: "unscii",
				size: UI_FONT_SIZES.small,
			}),
			k.pos(0, -24),
			k.anchor("center"),
			k.color(...theme.color),
			k.opacity(0),
		]),
		root.add([
			k.text(theme.name.toUpperCase(), {
				font: "unscii",
				size: UI_FONT_SIZES.display,
			}),
			k.anchor("center"),
			k.color(...UI_COLORS.text),
			k.opacity(0),
		]),
		root.add([
			k.text(theme.subtitle, {
				font: "unscii",
				size: UI_FONT_SIZES.small,
			}),
			k.pos(0, 25),
			k.anchor("center"),
			k.color(...theme.color),
			k.opacity(0),
		]),
		root.add([
			k.rect(72, 1),
			k.pos(-138, 25),
			k.anchor("center"),
			k.color(...theme.color),
			k.opacity(0),
		]),
		root.add([
			k.rect(72, 1),
			k.pos(138, 25),
			k.anchor("center"),
			k.color(...theme.color),
			k.opacity(0),
		]),
	]

	let elapsed = 0
	registerBatchedUiUpdate("overlay", root, () => {
		elapsed += k.dt()
		const opacity = getTitleOpacity(elapsed)
		root.pos.x = k.width() / 2
		root.pos.y = k.height() * 0.22 - 8 + (1 - opacity) * -8
		for (const element of elements) element.opacity = opacity
		if (elapsed < TITLE_TOTAL_DURATION) return
		if (activeTitle?.id === root.id) activeTitle = undefined
		k.destroy(root)
	})
}

function getTitleOpacity(elapsed: number) {
	if (elapsed < TITLE_ENTER_DURATION) {
		return smoothStep(elapsed / TITLE_ENTER_DURATION)
	}
	if (elapsed < TITLE_ENTER_DURATION + TITLE_HOLD_DURATION) return 1
	const exitElapsed = elapsed - TITLE_ENTER_DURATION - TITLE_HOLD_DURATION
	return 1 - smoothStep(Math.min(1, exitElapsed / TITLE_EXIT_DURATION))
}

function smoothStep(value: number) {
	return value * value * (3 - 2 * value)
}
