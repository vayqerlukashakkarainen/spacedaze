import type { GameObj, PosComp, Vec2 } from "kaplay"
import {
	k,
	layers,
	mainSoundVolume,
	setTimescale,
	timeScale,
} from "../main"
import {
	getFavoriteWeaponIds,
	getOwnedWeaponIds,
	getEquippedWeapon,
	getWeaponDefinition,
	isWeaponFavorite,
	toggleWeaponFavorite,
	type WeaponDefinition,
	type WeaponId,
} from "../services/player/weaponService"
import {
	onInputActionPress,
	onInputActionRelease,
	type InputController,
} from "../services/input/inputBindingService"
import { gameSoundService } from "../services/audio/gameSoundService"
import { tags } from "../tags"
import { UI_COLORS } from "./common/theme"

const WHEEL_OFFSET_Y = -104
const WHEEL_RADIUS = 70
const ITEM_RADIUS = 17
const ITEM_HIT_RADIUS = 23
const SLOWED_TIMESCALE = 0.16
const HOLD_TO_OPEN_DURATION = 0.16

interface WeaponWheelOptions {
	player: GameObj<PosComp>
	inputBlocked: () => boolean
	onOpen?: () => void
	onQuickSwap: () => void
	onSelect: (weapon: WeaponDefinition) => void
}

interface WeaponWheelItem {
	weapon: WeaponDefinition
	root: GameObj
	outer: GameObj
	inner: GameObj
	favoriteMarker: GameObj
}

interface ActiveWeaponWheel {
	root: GameObj
	hoveredWeaponId?: WeaponId
	restoreTimescale: number
}

let activeWeaponWheel: ActiveWeaponWheel | undefined

export function weaponWheelOpen() {
	return Boolean(activeWeaponWheel?.root.exists())
}

export function installWeaponWheel(
	options: WeaponWheelOptions
): InputController {
	let pressedAt: number | undefined
	let holdOpened = false
	const openController = onInputActionPress("primaryWheel", () => {
		if (options.inputBlocked() || weaponWheelOpen() || pressedAt !== undefined) {
			return
		}
		pressedAt = k.time()
		holdOpened = false
	})
	const closeController = onInputActionRelease("primaryWheel", () => {
		if (pressedAt === undefined) return
		pressedAt = undefined
		if (holdOpened) {
			closeWeaponWheel(options, true)
			return
		}
		options.onQuickSwap()
	})
	const favoriteController = k.onMousePress("left", () => {
		const wheel = activeWeaponWheel
		if (!wheel || !wheel.hoveredWeaponId) return
		const favorite = toggleWeaponFavorite(wheel.hoveredWeaponId)
		gameSoundService.play("click1", {
			volume: mainSoundVolume * 0.52,
			detune: favorite ? 180 : -180,
		})
	})
	const updateController = options.player.onUpdate(() => {
		if (pressedAt === undefined || holdOpened) return
		if (options.inputBlocked()) {
			pressedAt = undefined
			return
		}
		if (k.time() - pressedAt < HOLD_TO_OPEN_DURATION) return
		holdOpened = true
		openWeaponWheel(options)
	})
	const destroyController = options.player.onDestroy(() => {
		pressedAt = undefined
		closeWeaponWheel(options, false)
	})

	return {
		cancel: () => {
			openController.cancel()
			closeController.cancel()
			favoriteController.cancel()
			updateController.cancel()
			destroyController.cancel()
			pressedAt = undefined
			closeWeaponWheel(options, false)
		},
	}
}

function openWeaponWheel(options: WeaponWheelOptions) {
	const weapons = getOwnedWeaponIds().map(getWeaponDefinition)
	if (weapons.length === 0) return

	options.onOpen?.()
	const restoreTimescale = timeScale
	setTimescale(SLOWED_TIMESCALE, 0.08, false)

	const root = k.add([
		k.pos(getWheelPosition(options.player)),
		k.z(240),
		k.layer(layers.gameText),
		tags.gameLoop,
	])
	root.add([
		k.circle(WHEEL_RADIUS + ITEM_RADIUS + 5),
		k.anchor("center"),
		k.color(...UI_COLORS.background),
		k.opacity(0.84),
	])
	root.add([
		k.circle(WHEEL_RADIUS - ITEM_RADIUS - 7, { fill: false }),
		k.anchor("center"),
		k.outline(1, k.rgb(...UI_COLORS.border)),
		k.opacity(0.9),
	])

	const items = weapons.map((weapon, index) =>
		createWeaponItem(root, weapon, index, weapons.length)
	)
	const nameLabel = root.add([
		k.pos(0, -4),
		k.text("", { font: "unscii", size: 7, width: 88, align: "center" }),
		k.anchor("center"),
		k.color(...UI_COLORS.text),
	])
	const instructionLabel = root.add([
		k.pos(0, 10),
		k.text("RELEASE", { font: "unscii", size: 5 }),
		k.anchor("center"),
		k.color(...UI_COLORS.muted),
	])

	activeWeaponWheel = { root, restoreTimescale }
	gameSoundService.play("click1", {
		volume: mainSoundVolume * 0.45,
		detune: -120,
	})

	root.onUpdate(() => {
		if (!options.player.exists() || options.inputBlocked()) {
			closeWeaponWheel(options, false)
			return
		}
		root.pos = getWheelPosition(options.player)
		const hovered = findHoveredItem(items, k.toWorld(k.mousePos()).sub(root.pos))
		const hoveredWeaponId = hovered?.weapon.id
		if (hoveredWeaponId !== activeWeaponWheel?.hoveredWeaponId) {
			activeWeaponWheel!.hoveredWeaponId = hoveredWeaponId
			if (hovered) {
				gameSoundService.play("ui_hover", {
					volume: mainSoundVolume * 0.32,
				})
			}
		}
		const equippedWeaponId = getEquippedWeapon().id
		for (const item of items) {
			const isHovered = item.weapon.id === hoveredWeaponId
			const isEquipped = item.weapon.id === equippedWeaponId
			const isFavorite = isWeaponFavorite(item.weapon.id)
			item.root.scale = k.vec2(isHovered ? 1.16 : 1)
			item.outer.color = isHovered
				? k.WHITE
				: isEquipped
					? k.rgb(...UI_COLORS.accent)
					: isFavorite
						? k.rgb(...UI_COLORS.warning)
						: k.rgb(...UI_COLORS.border)
			item.inner.color = isHovered
				? k.rgb(...UI_COLORS.panelHover)
				: k.rgb(...UI_COLORS.background)
			item.favoriteMarker.opacity = isFavorite ? 1 : 0
		}
		const displayedWeapon = hovered?.weapon ?? weapons.find((weapon) =>
			weapon.id === equippedWeaponId
		) ?? weapons[0]
		nameLabel.text = displayedWeapon.name
		instructionLabel.text = hovered
			? "RELEASE EQUIP  //  LMB FAVORITE"
			: getFavoriteWeaponIds().length > 0
				? "QUICK SWAP: FAVORITES"
				: "QUICK SWAP: ALL"
	})
}

function closeWeaponWheel(options: WeaponWheelOptions, selectHovered: boolean) {
	const wheel = activeWeaponWheel
	if (!wheel) return
	activeWeaponWheel = undefined
	if (wheel.root.exists()) k.destroy(wheel.root)
	setTimescale(wheel.restoreTimescale, 0.12, false)

	if (!selectHovered || !wheel.hoveredWeaponId) return
	const weapon = getWeaponDefinition(wheel.hoveredWeaponId)
	options.onSelect(weapon)
}

function createWeaponItem(
	parent: GameObj,
	weapon: WeaponDefinition,
	index: number,
	count: number
): WeaponWheelItem {
	const angle = -90 + index * (360 / count)
	const root = parent.add([
		k.pos(k.Vec2.fromAngle(angle).scale(WHEEL_RADIUS)),
		k.scale(1),
	])
	const outer = root.add([
		k.circle(ITEM_RADIUS),
		k.anchor("center"),
		k.color(...UI_COLORS.border),
	])
	const inner = root.add([
		k.circle(ITEM_RADIUS - 2),
		k.anchor("center"),
		k.color(...UI_COLORS.background),
	])
	const favoriteMarker = root.add([
		k.pos(11, -11),
		k.rect(5, 5),
		k.anchor("center"),
		k.color(...UI_COLORS.warning),
		k.opacity(isWeaponFavorite(weapon.id) ? 1 : 0),
	])
	root.add([
		k.sprite(weapon.icon, { width: 22, height: 22 }),
		k.anchor("center"),
		k.color(...UI_COLORS.text),
	])
	return { weapon, root, outer, inner, favoriteMarker }
}

function findHoveredItem(items: WeaponWheelItem[], pointer: Vec2) {
	let closest: WeaponWheelItem | undefined
	let closestDistance = ITEM_HIT_RADIUS
	for (const item of items) {
		const distance = item.root.pos.dist(pointer)
		if (distance > closestDistance) continue
		closest = item
		closestDistance = distance
	}
	return closest
}

function getWheelPosition(player: GameObj<PosComp>) {
	return player.pos.add(0, WHEEL_OFFSET_Y)
}
