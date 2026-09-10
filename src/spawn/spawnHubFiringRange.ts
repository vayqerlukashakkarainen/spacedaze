import type { GameObj, Vec2 } from "kaplay"
import { jitter } from "../comp/jitter"
import { timescale } from "../comp/timescale"
import { compose, unitComponents } from "../compose"
import { checkProjectileComponentIntersection, playerObj } from "../game"
import { k, layers, subSoundVolume } from "../main"
import {
	ABILITIES,
	isAbilityDiscovered,
	type AbilityDefinition,
} from "../services/abilities/abilityRegistry"
import type { AbilitySlot } from "../services/abilities/abilityLoadoutService"
import { spawnAbilityLoadoutPickup } from "../services/abilities/abilitySwapService"
import { registerBatchedEntityUpdate } from "../services/core/entityUpdateService"
import {
	getHubLevel,
	getHubLevelDefinition,
	getHubLifetimeDeposited,
} from "../services/hub/hubProgressService"
import { gameSoundService } from "../services/audio/gameSoundService"
import { setHitSoundProfile } from "../services/audio/hitSoundService"
import { spawnRockDestructionFragments } from "../services/combat/rockDestructionEffectService"
import { tags } from "../tags"
import type { RewardKind } from "../types/rewardTypes"
import type { StatCategory, UpgradeDefinition } from "../types/upgradeTypes"
import {
	createRewardTypeFrame,
	createNpcInteractionPromptPool,
	getScaledLineSpacing,
	UI_COLORS,
} from "../ui/common"
import { getAllUpgradeDefinitions } from "../upgrades/upgradeRegistry"
import {
	HUNTER_VISUALS,
	getEnemyVisual,
} from "../visuals/enemyVisualCatalog"
import { getPickupVisual } from "../visuals/pickupVisualCatalog"
import { getTrainingUpgradePreviewSprite } from "../visuals/trainingUpgradePreviewAtlas"
import type { VisualRepresentation } from "../visuals/visualRepresentation"
import { onEnemyHit } from "./enemyShared"
import { spawnEnemyDeathEffect } from "./spawnEnemyDeathEffect"
import { spawnMeteorite } from "./spawnAsteroid"
import { spawnExplodingFuelCell } from "./rooms/spawnRoomEnvironment"
import { spawnHealthShrine } from "./shrine/spawnHealthShrine"
import { spawnSwarmEnemy, type SwarmPatrol } from "./spawnSwarm"

const RANGE_WIDTH = 660
const TARGET_OFFSET_Y = 230
const TARGET_RESPAWN_DELAY = 1.5
const DISCOVERY_REFRESH_INTERVAL = 0.5
const PICKUP_SPACING = 60
const LOCKED_PICKUP_REVEAL_RADIUS = 54
const LOCKED_PICKUP_SCALE = getPickupVisual("reward").worldScale
const LOCKED_PICKUP_ICON_SIZE = 24 * LOCKED_PICKUP_SCALE
const LOCKED_PICKUP_FRAME_SIZE = 36 * LOCKED_PICKUP_SCALE
const UPGRADE_GALLERY_TOP = -210
const UPGRADE_GALLERY_COLUMNS = 6
const UPGRADE_GALLERY_LABEL_X = 270
const UPGRADE_GALLERY_START_X = 340
const UPGRADE_GALLERY_COLUMN_SPACING = 42
const UPGRADE_GALLERY_ROW_SPACING = 36
const UPGRADE_GALLERY_CATEGORY_GAP = 10
const UPGRADE_TOOLTIP_WIDTH = 180
const UPGRADE_DESCRIPTION_LINE_HEIGHT = 1.55
const RANGE_CULL_RADIUS = 680
const TRAINING_SWARM_COUNT = 5
const TRAINING_FUEL_CELL_RESPAWN_DELAY = 3
const COMPOSITE_TARGET_OFFSET_X = 130
const COMPOSITE_TARGET_HP = 90
const COMPOSITE_PART_HP = 14
const COMPOSITE_ASTEROID_OFFSET_Y = 88
const COMPOSITE_ASTEROID_HP = 75
const COMPOSITE_ASTEROID_PART_HP = 24
const TRAINING_COMPOSITE_VISUALS = [
	getEnemyVisual("fighter"),
	HUNTER_VISUALS.standard,
] as const

const SLOT_ROWS: readonly {
	slot: AbilitySlot
	label: string
	y: number
	color: readonly [number, number, number]
}[] = [
	{ slot: "primary", label: "PRIMARY", y: -150, color: UI_COLORS.success },
	{ slot: "secondary", label: "SECONDARY", y: -70, color: UI_COLORS.warning },
	{ slot: "mobility", label: "MOBILITY", y: 10, color: [70, 150, 255] },
	{ slot: "ultimate", label: "ULTIMATE", y: 90, color: UI_COLORS.danger },
]

const UPGRADE_CATEGORIES: readonly {
	category: StatCategory
	label: string
	color: readonly [number, number, number]
}[] = [
	{ category: "combat", label: "COMBAT", color: UI_COLORS.danger },
	{ category: "movement", label: "MOVEMENT", color: [70, 150, 255] },
	{ category: "survival", label: "SURVIVAL", color: UI_COLORS.success },
	{ category: "resources", label: "RESOURCES", color: UI_COLORS.warning },
	{ category: "special", label: "SPECIAL", color: UI_COLORS.accent },
]

export interface HubFiringRangeProps {
	pos: Vec2
	isHubSessionActive: () => boolean
}

export interface HubFiringRange {
	targetPos: Vec2
	getPrimaryTarget: () => GameObj | undefined
}

interface TrainingPreviewPickup {
	object: GameObj
	title: string
	description?: string
	textColor: readonly [number, number, number]
}

interface TrainingPreviewTooltipPool {
	update(pickup: TrainingPreviewPickup | undefined): void
	destroy(): void
}

interface TrainingPreviewProps {
	position: Vec2
	icon: string
	kind: RewardKind
	abilitySlot?: AbilitySlot
	minimumHubLevel: number
	availableTitle: string
	availableDescription?: string
	availableTextColor?: readonly [number, number, number]
}

export function spawnHubFiringRange(
	props: HubFiringRangeProps
): HubFiringRange {
	const root = k.add([
		k.pos(props.pos),
		k.layer(layers.game),
		{
			runtimeCullRadius: RANGE_CULL_RADIUS,
		},
		tags.runtimeCullable,
		tags.props,
		tags.gameLoop,
	])
	const equipmentRoot = root.add([k.pos(0, 0)])
	const equipmentPromptPool = createNpcInteractionPromptPool(2)
	const previewTooltipPool = createTrainingPreviewTooltipPool()
	root.onDestroy(() => {
		equipmentPromptPool.destroy()
		previewTooltipPool.destroy()
	})
	const targetPos = props.pos.add(0, TARGET_OFFSET_Y)

	spawnHealthShrine({
		pos: props.pos.add(-RANGE_WIDTH / 2 + 70, TARGET_OFFSET_Y),
		respawnOrbs: true,
	})
	spawnTrainingFuelCell(
		props.pos.add(RANGE_WIDTH / 2 - 70, TARGET_OFFSET_Y),
		props.isHubSessionActive
	)
	let discoverySignature = ""
	let refreshTimer = 0
	let displayObjects: GameObj[] = []
	let interactiveAbilityPickups: GameObj[] = []
	let previewPickups: TrainingPreviewPickup[] = []
	const refreshEquipment = () => {
		const unlocked = ABILITIES.filter(isAbilityDiscovered)
		const nextSignature = [
			getHubLevel(),
			getHubLifetimeDeposited(),
			...unlocked.map((ability) => ability.id),
		].join("|")
		if (nextSignature === discoverySignature) return
		discoverySignature = nextSignature
		previewTooltipPool.update(undefined)
		equipmentRoot.removeAll()
		for (const pickup of displayObjects) {
			if (pickup.exists()) k.destroy(pickup)
		}
		displayObjects = []
		interactiveAbilityPickups = []
		previewPickups = []
		spawnUpgradeGallery(
			equipmentRoot,
			props.pos,
			displayObjects,
			previewPickups
		)
		for (const row of SLOT_ROWS) {
			const rowAbilities = ABILITIES.filter(
				(ability) => ability.slot === row.slot
			)
			spawnAbilityRow(
				equipmentRoot,
				row,
				rowAbilities,
				props.pos,
				displayObjects,
				interactiveAbilityPickups,
				previewPickups,
				equipmentPromptPool
			)
		}
	}
	refreshEquipment()

	registerBatchedEntityUpdate("world", root, () => {
		updateTrainingPreviewReveals(
			previewPickups,
			interactiveAbilityPickups,
			previewTooltipPool
		)
		refreshTimer += k.dt()
		if (refreshTimer < DISCOVERY_REFRESH_INTERVAL) return
		refreshTimer = 0
		refreshEquipment()
	})

	let primaryTarget: GameObj | undefined
	spawnTrainingDummy(
		targetPos,
		props.isHubSessionActive,
		(target) => primaryTarget = target
	)
	spawnCompositeTrainingTarget(
		targetPos.add(-COMPOSITE_TARGET_OFFSET_X, 0),
		TRAINING_COMPOSITE_VISUALS[0],
		props.isHubSessionActive
	)
	spawnCompositeTrainingTarget(
		targetPos.add(COMPOSITE_TARGET_OFFSET_X, 0),
		TRAINING_COMPOSITE_VISUALS[1],
		props.isHubSessionActive
	)
	spawnCompositeTrainingAsteroid(
		targetPos.add(0, COMPOSITE_ASTEROID_OFFSET_Y),
		props.isHubSessionActive
	)
	spawnTrainingSwarm(targetPos, props.isHubSessionActive)

	return {
		targetPos,
		getPrimaryTarget: () => primaryTarget?.exists()
			? primaryTarget
			: undefined,
	}
}

function spawnCompositeTrainingAsteroid(
	pos: Vec2,
	isHubSessionActive: () => boolean
) {
	const target = k.add([
		k.pos(pos),
		k.sprite("rock_fragment_32_b"),
		k.color(k.WHITE),
		k.anchor("center"),
		k.rotate(-8),
		k.health(COMPOSITE_ASTEROID_HP),
		k.animate(),
		timescale(),
		jitter(),
		{
			hb: 36,
			enemyDamageMaterial: "rock",
		},
		tags.enemy,
		tags.enemyRoleTerrain,
		tags.unit,
		tags.trainingTarget,
		tags.gameLoop,
	])
	const partDefinitions = [
		{ sprite: "rock_fragment_32_a", offset: k.vec2(-17, 8), angle: -24 },
		{ sprite: "rock_fragment_32_c", offset: k.vec2(17, 7), angle: 18 },
	] as const
	const parts = partDefinitions.map((definition) => target.add([
		k.pos(definition.offset),
		k.sprite(definition.sprite),
		k.color(k.WHITE),
		k.anchor("center"),
		k.rotate(definition.angle),
		k.health(COMPOSITE_ASTEROID_PART_HP),
		k.animate(),
		timescale(),
		jitter(),
		{
			enemyDamageMaterial: "rock",
		},
		tags.part,
		tags.gameLoop,
	]))
	setHitSoundProfile(target, "stone")

	unitComponents[target.id] = compose({
		material: "rock",
		skipDefaultBodyDeath: true,
		onBodyDeath: () => {
			const deathPos = target.pos.clone()
			spawnEnemyDeathEffect(deathPos, 0.9, "normal", {
				particleScale: 0.8,
			})
			spawnRockDestructionFragments(deathPos, 0.9)
			gameSoundService.playPositional("rock_material_destroyed", deathPos, {
				volume: subSoundVolume,
			})
			k.wait(TARGET_RESPAWN_DELAY, () => {
				if (!isHubSessionActive()) return
				spawnCompositeTrainingAsteroid(pos, isHubSessionActive)
			})
		},
		parts: [
			{
				obj: target,
				hitbox: 12,
				isBody: true,
				scoreOnDestroy: 0,
			},
			...parts.map((part) => ({
				obj: part,
				hitbox: 10,
				isBody: false,
				scoreOnDestroy: 0,
			})),
		],
	})
	target.onDestroy(() => {
		delete unitComponents[target.id]
	})
	registerBatchedEntityUpdate("enemies", target, () => {
		const components = unitComponents[target.id]
		if (!components) return
		checkProjectileComponentIntersection(
			target.pos,
			target.hb,
			tags.friendly,
			components,
			(projectile, index) => onEnemyHit(components[index].obj, projectile)
		)
	})
	return target
}

function spawnCompositeTrainingTarget(
	pos: Vec2,
	visual: VisualRepresentation,
	isHubSessionActive: () => boolean
) {
	const [bodyVisual, ...partVisuals] = visual.parts
	if (!bodyVisual) return undefined
	const target = k.add([
		k.pos(pos),
		k.sprite(bodyVisual.sprite),
		k.color(k.WHITE),
		k.anchor("center"),
		k.rotate(0),
		k.scale(visual.worldScale),
		k.health(COMPOSITE_TARGET_HP),
		k.animate(),
		timescale(),
		jitter(),
		{
			hb: 18 * visual.worldScale,
		},
		tags.enemy,
		tags.unit,
		tags.trainingTarget,
		tags.gameLoop,
	])
	const parts = partVisuals.map((partVisual) => {
		const offset = partVisual.offset ?? [0, 0]
		return target.add([
			k.pos(offset[0], offset[1]),
			k.sprite(partVisual.sprite),
			k.color(k.WHITE),
			k.anchor("center"),
			k.rotate(0),
			k.scale(partVisual.scale ?? 1),
			k.health(COMPOSITE_PART_HP),
			k.animate(),
			timescale(),
			jitter(),
			tags.part,
			tags.gameLoop,
		])
	})
	unitComponents[target.id] = compose({
		skipDefaultBodyDeath: true,
		onBodyDeath: () => {
			const deathPos = target.pos.clone()
			spawnEnemyDeathEffect(deathPos, 0.75, "normal", {
				particleScale: 0.7,
			})
			gameSoundService.playPositional("enemy_ship_destroyed", deathPos, {
				volume: subSoundVolume,
			})
			k.wait(TARGET_RESPAWN_DELAY, () => {
				if (!isHubSessionActive()) return
				spawnCompositeTrainingTarget(pos, visual, isHubSessionActive)
			})
		},
		parts: [
			{
				obj: target,
				hitbox: 11 * visual.worldScale,
				isBody: true,
				scoreOnDestroy: 0,
			},
			...parts.map((part) => ({
				obj: part,
				hitbox: 7 * visual.worldScale,
				isBody: false,
				scoreOnDestroy: 0,
			})),
		],
	})
	target.onDestroy(() => {
		delete unitComponents[target.id]
	})
	registerBatchedEntityUpdate("enemies", target, () => {
		const components = unitComponents[target.id]
		if (!components) return
		checkProjectileComponentIntersection(
			target.pos,
			target.hb,
			tags.friendly,
			components,
			(projectile, index) => onEnemyHit(components[index].obj, projectile)
		)
	})
	return target
}

function spawnTrainingFuelCell(
	pos: Vec2,
	isHubSessionActive: () => boolean
) {
	return spawnExplodingFuelCell(pos, {
		onExplode: () => {
			k.wait(TRAINING_FUEL_CELL_RESPAWN_DELAY, () => {
				if (!isHubSessionActive()) return
				spawnTrainingFuelCell(pos, isHubSessionActive)
			})
		},
	})
}

function spawnTrainingSwarm(
	center: Vec2,
	isHubSessionActive: () => boolean
) {
	for (let index = 0; index < TRAINING_SWARM_COUNT; index++) {
		spawnTrainingSwarmEnemy(center, index, isHubSessionActive)
	}
}

function spawnTrainingSwarmEnemy(
	center: Vec2,
	index: number,
	isHubSessionActive: () => boolean
) {
	const phase = 360 / TRAINING_SWARM_COUNT * index
	const angularSpeed = index % 2 === 0 ? 34 : -30
	const patrol: SwarmPatrol = {
		center,
		radiusX: 185,
		radiusY: 66,
		angularSpeed,
		phase,
		speed: 54,
	}
	const pos = center.add(
		Math.cos(phase * Math.PI / 180) * patrol.radiusX,
		Math.sin(phase * Math.PI / 180) * patrol.radiusY
	)
	spawnSwarmEnemy(
		pos,
		5,
		{
			disableThreatScaling: true,
			persistOffscreen: true,
			tags: [tags.trainingTarget, tags.stressEnemy],
		},
		undefined,
		{
			patrol,
			suppressRewards: true,
			onDeath: () => {
				k.wait(TARGET_RESPAWN_DELAY, () => {
					if (!isHubSessionActive()) return
					spawnTrainingSwarmEnemy(center, index, isHubSessionActive)
				})
			},
		}
	)
}

function spawnUpgradeGallery(
	root: GameObj,
	rangePos: Vec2,
	displayObjects: GameObj[],
	previewPickups: TrainingPreviewPickup[]
) {
	const upgrades = getAllUpgradeDefinitions()
	let rowY = UPGRADE_GALLERY_TOP
	for (const categoryDefinition of UPGRADE_CATEGORIES) {
		const categoryUpgrades = upgrades
			.filter((upgrade) => upgrade.category === categoryDefinition.category)
			.sort((left, right) =>
				getUpgradeMinimumHubLevel(left) - getUpgradeMinimumHubLevel(right) ||
				left.toolName.localeCompare(right.toolName)
			)
		if (categoryUpgrades.length === 0) continue
		root.add([
			k.text(categoryDefinition.label, {
				size: 6,
				font: "unscii",
			}),
			k.pos(UPGRADE_GALLERY_LABEL_X, rowY - 3),
			k.anchor("left"),
			k.color(...categoryDefinition.color),
			k.layer(layers.gameText),
		])
		categoryUpgrades.forEach((upgrade, index) => {
			const column = index % UPGRADE_GALLERY_COLUMNS
			const row = Math.floor(index / UPGRADE_GALLERY_COLUMNS)
			const preview = spawnUpgradePreview(
				upgrade,
				rangePos.add(
					UPGRADE_GALLERY_START_X + column * UPGRADE_GALLERY_COLUMN_SPACING,
					rowY + row * UPGRADE_GALLERY_ROW_SPACING
				)
			)
			if (!preview) return
			displayObjects.push(preview.object)
			previewPickups.push(preview)
		})
		const rowCount = Math.ceil(
			categoryUpgrades.length / UPGRADE_GALLERY_COLUMNS
		)
		rowY += rowCount * UPGRADE_GALLERY_ROW_SPACING +
			UPGRADE_GALLERY_CATEGORY_GAP
	}
}

function spawnUpgradePreview(
	upgrade: UpgradeDefinition,
	position: Vec2
): TrainingPreviewPickup | undefined {
	const firstLevel = upgrade.levels[0]
	if (!firstLevel) return
	return spawnTrainingPreviewPickup({
		position,
		icon: getTrainingUpgradePreviewSprite(firstLevel.sprite),
		kind: "upgrade",
		minimumHubLevel: getUpgradeMinimumHubLevel(upgrade),
		availableTitle: upgrade.toolName.toUpperCase(),
		availableDescription: firstLevel.desc,
	})
}

function spawnAbilityRow(
	root: GameObj,
	row: typeof SLOT_ROWS[number],
	abilities: readonly AbilityDefinition[],
	rangePos: Vec2,
	displayObjects: GameObj[],
	interactiveAbilityPickups: GameObj[],
	previewPickups: TrainingPreviewPickup[],
	interactionPromptPool: ReturnType<typeof createNpcInteractionPromptPool>
) {
	if (abilities.length === 0) return
	root.add([
		k.text(row.label, {
			size: 7,
			font: "unscii",
		}),
		k.pos(-RANGE_WIDTH / 2 + 20, row.y - 4),
		k.anchor("left"),
		k.color(...row.color),
		k.layer(layers.gameText),
	])

	const spacing = Math.min(PICKUP_SPACING, (RANGE_WIDTH - 150) / abilities.length)
	const startX = -(abilities.length - 1) * spacing / 2
	abilities.forEach((ability, index) => {
		const position = rangePos.add(startX + index * spacing + 55, row.y)
		if (!isAbilityDiscovered(ability)) {
			const lockedPickup = spawnLockedAbilityPickup(ability, position)
			displayObjects.push(lockedPickup.object)
			previewPickups.push(lockedPickup)
			return
		}
		const pickup = spawnAbilityLoadoutPickup(
			ability.slot,
			ability.id,
			position,
			interactionPromptPool
		)
		if (pickup) {
			displayObjects.push(pickup)
			interactiveAbilityPickups.push(pickup)
		}
	})
}

function spawnLockedAbilityPickup(
	ability: AbilityDefinition,
	position: Vec2
): TrainingPreviewPickup {
	return spawnTrainingPreviewPickup({
		position,
		icon: ability.icon,
		kind: getAbilityRewardKind(ability.slot),
		abilitySlot: ability.slot,
		minimumHubLevel: ability.minimumHubLevel,
		availableTitle: "AVAILABLE FOR DROP",
		availableTextColor: UI_COLORS.success,
	})
}

function spawnTrainingPreviewPickup(
	props: TrainingPreviewProps
): TrainingPreviewPickup {
	const hubLevelReached = getHubLevel() >= props.minimumHubLevel
	const unlockProgress = getHubUnlockProgress(props.minimumHubLevel)
	const pickup = k.add([
		k.pos(props.position),
		k.sprite(props.icon, {
			width: LOCKED_PICKUP_ICON_SIZE,
			height: LOCKED_PICKUP_ICON_SIZE,
		}),
		k.anchor("center"),
		k.color(...(hubLevelReached ? UI_COLORS.text : UI_COLORS.muted)),
		k.opacity(hubLevelReached ? 0.82 : 0.58),
		k.layer(layers.game),
		{
			runtimeCullRadius: LOCKED_PICKUP_REVEAL_RADIUS,
		},
		tags.props,
		tags.gameLoop,
		tags.runtimeCullable,
	])
	const pickupFrame = createRewardTypeFrame(pickup, {
		size: LOCKED_PICKUP_FRAME_SIZE,
		color: hubLevelReached ? UI_COLORS.success : UI_COLORS.muted,
		kind: props.kind,
		abilitySlot: props.abilitySlot,
		fillOpacity: hubLevelReached ? 0.12 : 0.06,
		outlineOpacity: 1,
		lineWidth: 1,
		progress: hubLevelReached ? undefined : unlockProgress,
		progressColor: UI_COLORS.accent,
		progressLineWidth: 2,
		z: -1,
	})
	pickupFrame.use(k.layer(layers.gameEffects))

	const title = hubLevelReached
		? props.availableTitle
		: `REQUIRES HUB LEVEL ${props.minimumHubLevel}`
	const showDescription = hubLevelReached && props.availableDescription !== undefined
	return {
		object: pickup,
		title,
		description: showDescription ? props.availableDescription : undefined,
		textColor: hubLevelReached
			? props.availableTextColor ?? UI_COLORS.text
			: UI_COLORS.text,
	}
}

function getHubUnlockProgress(minimumHubLevel: number) {
	const requiredDeposited = getHubLevelDefinition(minimumHubLevel).requiredDeposited
	if (requiredDeposited <= 0) return 1
	return Math.min(1, Math.max(0, getHubLifetimeDeposited() / requiredDeposited))
}

function getUpgradeMinimumHubLevel(upgrade: UpgradeDefinition) {
	return Math.max(1, Math.round(upgrade.reward?.minimumHubLevel ?? 1))
}

function getAbilityRewardKind(slot: AbilitySlot): RewardKind {
	if (slot === "primary") return "weapon"
	if (slot === "secondary") return "activeModule"
	return slot
}

function createTrainingPreviewTooltipPool(): TrainingPreviewTooltipPool {
	interface TooltipSlot {
		root: GameObj
		background: GameObj
		title: GameObj
		description: GameObj
		pickup: TrainingPreviewPickup | undefined
		reveal: number
		visible: boolean
	}

	const slots = Array.from({ length: 2 }, () => {
		const root = k.add([
			k.pos(),
			k.layer(layers.gameText),
			k.z(20),
		])
		root.hidden = true
		const background = root.add([
			k.rect(UPGRADE_TOOLTIP_WIDTH, 50),
			k.anchor("center"),
			k.color(...UI_COLORS.panel),
			k.opacity(0),
			k.z(0),
		])
		const title = root.add([
			k.text("", {
				font: "unscii",
				size: 6,
				width: UPGRADE_TOOLTIP_WIDTH,
				align: "center",
			}),
			k.pos(),
			k.anchor("center"),
			k.color(...UI_COLORS.text),
			k.opacity(0),
			k.scale(0.9),
			k.z(1),
		])
		const description = root.add([
			k.text("", {
				font: "unscii",
				size: 6,
				width: UPGRADE_TOOLTIP_WIDTH - 12,
				align: "center",
				lineSpacing: getScaledLineSpacing(
					6,
					UPGRADE_DESCRIPTION_LINE_HEIGHT
				),
			}),
			k.pos(0, 7),
			k.anchor("center"),
			k.color(...UI_COLORS.text),
			k.opacity(0),
			k.scale(0.9),
			k.z(1),
		])
		return {
			root,
			background,
			title,
			description,
			pickup: undefined,
			reveal: 0,
			visible: false,
		}
	})
	let activePickup: TrainingPreviewPickup | undefined
	let activeSlotIndex = -1

	return {
		update(pickup) {
			if (pickup !== activePickup) {
				if (activeSlotIndex >= 0) slots[activeSlotIndex].visible = false
				activePickup = pickup
				if (pickup) {
					activeSlotIndex = (activeSlotIndex + 1) % slots.length
					assignTooltip(slots[activeSlotIndex], pickup)
				}
			}
			for (const slot of slots) updateTooltip(slot)
		},
		destroy() {
			for (const slot of slots) {
				if (slot.root.exists()) k.destroy(slot.root)
			}
		},
	}

	function assignTooltip(slot: TooltipSlot, pickup: TrainingPreviewPickup) {
		const showDescription = pickup.description !== undefined
		slot.pickup = pickup
		slot.visible = true
		slot.root.hidden = false
		slot.background.hidden = !showDescription
		slot.title.text = pickup.title
		slot.title.pos.y = showDescription ? -13 : 0
		slot.title.color = k.rgb(...pickup.textColor)
		slot.description.hidden = !showDescription
		slot.description.text = pickup.description ?? ""
	}

	function updateTooltip(slot: TooltipSlot) {
		if (slot.pickup && !slot.pickup.object.exists()) slot.visible = false
		const target = slot.visible ? 1 : 0
		const blend = 1 - Math.exp(-12 * k.dt())
		slot.reveal = k.lerp(slot.reveal, target, blend)
		if (Math.abs(slot.reveal - target) < 0.01) slot.reveal = target
		if (slot.reveal === 0) {
			slot.root.hidden = true
			slot.pickup = undefined
			return
		}
		const pickup = slot.pickup
		if (!pickup) return
		const easedReveal = slot.reveal * slot.reveal * (3 - 2 * slot.reveal)
		const showDescription = pickup.description !== undefined
		slot.root.hidden = false
		if (pickup.object.exists()) {
			slot.root.pos = pickup.object.pos.add(
				0,
				(showDescription ? -49 : -39) + (1 - easedReveal) * 5
			)
		}
		slot.background.opacity = easedReveal * 0.8
		slot.title.opacity = easedReveal
		slot.title.scale = k.vec2(0.9 + easedReveal * 0.1)
		slot.description.opacity = easedReveal
		slot.description.scale = k.vec2(0.9 + easedReveal * 0.1)
	}
}

function updateTrainingPreviewReveals(
	pickups: readonly TrainingPreviewPickup[],
	interactivePickups: readonly GameObj[],
	tooltipPool: TrainingPreviewTooltipPool
) {
	let nearest: TrainingPreviewPickup | undefined
	let nearestDistance = LOCKED_PICKUP_REVEAL_RADIUS
	const interactionPromptVisible = interactivePickups.some((pickup) =>
		pickup.exists() &&
		pickup.isInRange === true &&
		pickup.isInteractionTarget === true
	)
	if (!interactionPromptVisible) {
		for (const pickup of pickups) {
			if (!pickup.object.exists()) continue
			const distance = pickup.object.pos.dist(playerObj.pos)
			if (distance >= nearestDistance) continue
			nearest = pickup
			nearestDistance = distance
		}
	}
	tooltipPool.update(nearest)
}

function spawnTrainingDummy(
	pos: Vec2,
	isHubSessionActive: () => boolean,
	onSpawn?: (target: GameObj) => void
) {
	const target = spawnMeteorite({
		pos,
		dir: k.vec2(0, 0),
		scoreOnKill: 0,
		hp: 10000,
		speed: 0,
		splitOnDeath: 0,
		destroyOffscreen: false,
		powerupMultiplier: 0,
		tags: [tags.trainingTarget],
		onDeath: () => {
			k.wait(TARGET_RESPAWN_DELAY, () => {
				if (!isHubSessionActive()) return
				spawnTrainingDummy(pos, isHubSessionActive, onSpawn)
			})
		},
	})
	onSpawn?.(target)
	return target
}
