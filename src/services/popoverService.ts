import type { Color, GameObj } from "kaplay"
import { k, layers } from "../main"
import { tags } from "../tags"
import type { Reward } from "./rewardService"
import { REWARD_RARITY_COLORS } from "./rewardService"
import { addThemedText } from "../ui/common/text"
import { UI_COLORS } from "../ui/common/theme"

export interface PopoverOptions {
	title: string
	message: string
	description?: string
	sprite?: string
	color?: Color
	duration?: number
}

interface ActivePopover {
	obj: GameObj
	elapsed: number
	duration: number
}

const POPOVER_WIDTH = 330
const POPOVER_HEIGHT = 66
const POPOVER_GAP = 8
const POPOVER_BOTTOM_MARGIN = 22
const POPOVER_ENTER_DURATION = 0.28
const POPOVER_EXIT_DURATION = 0.7
const MAX_VISIBLE_POPOVERS = 4
const activePopovers: ActivePopover[] = []
const queuedPopovers: PopoverOptions[] = []
let popoverController: GameObj | undefined

export function showPopover(options: PopoverOptions) {
	removeDestroyedPopovers()
	if (activePopovers.length >= MAX_VISIBLE_POPOVERS) {
		queuedPopovers.push(options)
		ensurePopoverController()
		return
	}

	const duration = Math.max(
		POPOVER_ENTER_DURATION + POPOVER_EXIT_DURATION,
		options.duration ?? 5
	)
	const accent = options.color ?? k.rgb(...UI_COLORS.accent)
	const popover = k.add([
		k.pos(k.width() / 2, k.height() + POPOVER_HEIGHT),
		k.scale(0.86),
		k.opacity(0),
		k.fixed(),
		k.layer(layers.uiEffects),
		k.z(300),
		tags.gameLoopUi,
	])
	popover.add([
		k.rect(POPOVER_WIDTH, POPOVER_HEIGHT),
		k.anchor("center"),
		k.color(...UI_COLORS.panel),
		k.opacity(0.96),
		k.outline(2, accent),
	])
	popover.add([
		k.rect(4, POPOVER_HEIGHT - 4),
		k.pos(-POPOVER_WIDTH / 2 + 4, 0),
		k.anchor("center"),
		k.color(accent),
	])

	const contentLeft = -POPOVER_WIDTH / 2 + 58
	if (options.sprite) {
		popover.add([
			k.sprite(options.sprite, { width: 34, height: 34 }),
			k.pos(-POPOVER_WIDTH / 2 + 31, 0),
			k.anchor("center"),
			k.color(accent),
		])
	}
	addThemedText(popover, {
		text: options.title,
		pos: k.vec2(contentLeft, -24),
		variant: "caption",
		color: accent,
		size: 7,
	})
	addThemedText(popover, {
		text: options.message,
		pos: k.vec2(contentLeft, -11),
		variant: "heading",
		color: k.WHITE,
		size: 11,
		width: POPOVER_WIDTH - 72,
	})
	if (options.description) {
		addThemedText(popover, {
			text: options.description,
			pos: k.vec2(contentLeft, 8),
			variant: "muted",
			color: k.rgb(150, 165, 175),
			size: 7,
			width: POPOVER_WIDTH - 76,
			lineHeight: 1.25,
		})
	}

	activePopovers.push({ obj: popover, elapsed: 0, duration })
	ensurePopoverController()
	return popover
}

export function showCollectedRewardPopover(reward: Reward) {
	return showPopover({
		title: `${reward.rarity.toUpperCase()} ${reward.kind.toUpperCase()} COLLECTED`,
		message: reward.name,
		description: reward.description,
		sprite: reward.sprite,
		color: k.rgb(...REWARD_RARITY_COLORS[reward.rarity]),
		duration: 5,
	})
}

function ensurePopoverController() {
	if (popoverController?.exists()) return
	popoverController = k.add([tags.gameLoopUi])
	popoverController.onUpdate(updatePopovers)
	popoverController.onDestroy(() => {
		popoverController = undefined
		activePopovers.length = 0
		queuedPopovers.length = 0
	})
}

function updatePopovers() {
	removeDestroyedPopovers()
	const delta = k.dt()

	for (let index = 0; index < activePopovers.length; index++) {
		const active = activePopovers[index]
		active.elapsed += delta
		const targetY =
			k.height() -
			POPOVER_BOTTOM_MARGIN -
			POPOVER_HEIGHT / 2 -
			(activePopovers.length - 1 - index) *
				(POPOVER_HEIGHT + POPOVER_GAP)
		const positionBlend = 1 - Math.exp(-14 * delta)
		active.obj.pos.x = k.width() / 2
		active.obj.pos.y = k.lerp(active.obj.pos.y, targetY, positionBlend)

		if (active.elapsed < POPOVER_ENTER_DURATION) {
			const progress = k.clamp(
				active.elapsed / POPOVER_ENTER_DURATION,
				0,
				1
			)
			const eased = 1 - Math.pow(1 - progress, 3)
			active.obj.opacity = eased
			active.obj.scale = k.vec2(k.lerp(0.86, 1, eased))
			continue
		}

		const exitStart = active.duration - POPOVER_EXIT_DURATION
		if (active.elapsed >= exitStart) {
			const progress = k.clamp(
				(active.elapsed - exitStart) / POPOVER_EXIT_DURATION,
				0,
				1
			)
			active.obj.opacity = 1 - progress
			active.obj.scale = k.vec2(k.lerp(1, 0.78, progress))
		}

		if (active.elapsed >= active.duration && active.obj.exists()) {
			k.destroy(active.obj)
		}
	}

	removeDestroyedPopovers()
	while (
		activePopovers.length < MAX_VISIBLE_POPOVERS &&
		queuedPopovers.length > 0
	) {
		showPopover(queuedPopovers.shift()!)
	}
	if (activePopovers.length === 0 && popoverController?.exists()) {
		k.destroy(popoverController)
	}
}

function removeDestroyedPopovers() {
	for (let index = activePopovers.length - 1; index >= 0; index--) {
		if (!activePopovers[index].obj.exists()) activePopovers.splice(index, 1)
	}
}
