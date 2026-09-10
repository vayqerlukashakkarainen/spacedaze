import type { GameObj, Vec2 } from "kaplay"
import { jitter } from "../comp/jitter"
import { timescale } from "../comp/timescale"
import { compose, unitComponents } from "../compose"
import { checkProjectileComponentIntersection, playerObj } from "../game"
import { k, layers } from "../main"
import {
	ABILITIES,
	isAbilityDiscovered,
	type AbilityDefinition,
} from "../services/abilities/abilityRegistry"
import type { AbilitySlot } from "../services/abilities/abilityLoadoutService"
import { spawnAbilityLoadoutPickup } from "../services/abilities/abilitySwapService"
import { registerBatchedEntityUpdate } from "../services/core/entityUpdateService"
import { getHubLevel } from "../services/hub/hubProgressService"
import { tags } from "../tags"
import { UI_COLORS } from "../ui/common"
import {
	HUNTER_VISUALS,
	getEnemyVisual,
} from "../visuals/enemyVisualCatalog"
import type { VisualRepresentation } from "../visuals/visualRepresentation"
import { onEnemyHit } from "./enemyShared"
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
const LOCKED_PICKUP_ICON_SIZE = 24
const TRAINING_SWARM_COUNT = 5
const TRAINING_FUEL_CELL_RESPAWN_DELAY = 3
const COMPOSITE_TARGET_OFFSET_X = 130
const COMPOSITE_TARGET_HP = 90
const COMPOSITE_PART_HP = 14

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

export interface HubFiringRangeProps {
	pos: Vec2
	isHubSessionActive: () => boolean
}

export interface HubFiringRange {
	targetPos: Vec2
	getPrimaryTarget: () => GameObj | undefined
}

interface LockedAbilityPickup {
	object: GameObj
	updateReveal: (visible: boolean) => void
}

export function spawnHubFiringRange(
	props: HubFiringRangeProps
): HubFiringRange {
	const root = k.add([
		k.pos(props.pos),
		k.layer(layers.game),
		{
			runtimeCullRadius: RANGE_WIDTH / 2 + 60,
		},
		tags.runtimeCullable,
		tags.props,
		tags.gameLoop,
	])
	const equipmentRoot = root.add([k.pos(0, 0)])
	const targetPos = props.pos.add(0, TARGET_OFFSET_Y)

	spawnRangeFrame(root)
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
	let abilityPickups: GameObj[] = []
	let interactiveAbilityPickups: GameObj[] = []
	let lockedAbilityPickups: LockedAbilityPickup[] = []
	const refreshEquipment = () => {
		const unlocked = ABILITIES.filter(isAbilityDiscovered)
		const nextSignature = [
			getHubLevel(),
			...unlocked.map((ability) => ability.id),
		].join("|")
		if (nextSignature === discoverySignature) return
		discoverySignature = nextSignature
		equipmentRoot.removeAll()
		for (const pickup of abilityPickups) {
			if (pickup.exists()) k.destroy(pickup)
		}
		abilityPickups = []
		interactiveAbilityPickups = []
		lockedAbilityPickups = []
		for (const row of SLOT_ROWS) {
			const rowAbilities = row.slot === "primary"
				? ABILITIES.filter((ability) => ability.slot === row.slot)
				: unlocked.filter((ability) => ability.slot === row.slot)
			spawnAbilityRow(
				equipmentRoot,
				row,
				rowAbilities,
				props.pos,
				abilityPickups,
				interactiveAbilityPickups,
				lockedAbilityPickups
			)
		}
	}
	refreshEquipment()

	registerBatchedEntityUpdate("world", root, () => {
		updateLockedAbilityReveals(
			lockedAbilityPickups,
			interactiveAbilityPickups
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
	spawnTrainingSwarm(targetPos, props.isHubSessionActive)

	return {
		targetPos,
		getPrimaryTarget: () => primaryTarget?.exists()
			? primaryTarget
			: undefined,
	}
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

function spawnRangeFrame(root: GameObj) {
	root.add([
		k.text("LIVE FIRE  //  KEEP LANE CLEAR", {
			size: 8,
			font: "unscii",
		}),
		k.pos(0, 153),
		k.anchor("top"),
		k.color(...UI_COLORS.danger),
		k.layer(layers.gameText),
	])
	for (const x of [-220, -110, 0, 110, 220]) {
		root.add([
			k.rect(56, 2),
			k.pos(x - 28, 178),
			k.color(...UI_COLORS.danger),
			k.opacity(0.72),
			k.z(-2),
		])
	}
}

function spawnAbilityRow(
	root: GameObj,
	row: typeof SLOT_ROWS[number],
	abilities: readonly AbilityDefinition[],
	rangePos: Vec2,
	abilityPickups: GameObj[],
	interactiveAbilityPickups: GameObj[],
	lockedAbilityPickups: LockedAbilityPickup[]
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
			abilityPickups.push(lockedPickup.object)
			lockedAbilityPickups.push(lockedPickup)
			return
		}
		const pickup = spawnAbilityLoadoutPickup(
			ability.slot,
			ability.id,
			position
		)
		if (pickup) {
			abilityPickups.push(pickup)
			interactiveAbilityPickups.push(pickup)
		}
	})
}

function spawnLockedAbilityPickup(
	ability: AbilityDefinition,
	position: Vec2
): LockedAbilityPickup {
	const lockedColor = k.rgb(...UI_COLORS.muted)
	const pickup = k.add([
		k.pos(position),
		k.sprite(ability.icon, {
			width: LOCKED_PICKUP_ICON_SIZE,
			height: LOCKED_PICKUP_ICON_SIZE,
		}),
		k.anchor("center"),
		k.color(18, 25, 31),
		k.opacity(0.78),
		k.outline(1, lockedColor),
		k.layer(layers.game),
		{
			runtimeCullRadius: LOCKED_PICKUP_REVEAL_RADIUS,
		},
		tags.props,
		tags.gameLoop,
		tags.runtimeCullable,
	])
	pickup.add([
		k.circle(18),
		k.anchor("center"),
		k.color(8, 15, 20),
		k.opacity(0.72),
		k.outline(1, lockedColor),
		k.layer(layers.gameEffects),
		k.z(-1),
	])
	pickup.add([
		k.text("?", { font: "unscii", size: 9 }),
		k.pos(0, 1),
		k.anchor("center"),
		k.color(...UI_COLORS.text),
		k.opacity(0.82),
		k.layer(layers.gameText),
	])

	const hubLevelReached = getHubLevel() >= ability.minimumHubLevel
	const requirement = hubLevelReached
		? "AVAILABLE IN WEAPON DROPS"
		: `REQUIRES HUB LEVEL ${ability.minimumHubLevel}`
	const tooltip = pickup.add([
		k.pos(0, -39),
		k.opacity(0),
		k.layer(layers.gameText),
		k.z(20),
	])
	tooltip.hidden = true
	tooltip.add([
		k.text(requirement, {
			font: "unscii",
			size: 6,
			width: 142,
			align: "center",
		}),
		k.anchor("center"),
		k.color(...(hubLevelReached ? UI_COLORS.success : UI_COLORS.text)),
		k.z(1),
	])
	let reveal = 0

	return {
		object: pickup,
		updateReveal(visible) {
			const target = visible ? 1 : 0
			const blend = 1 - Math.exp(-12 * k.dt())
			reveal = k.lerp(reveal, target, blend)
			if (Math.abs(reveal - target) < 0.01) reveal = target
			tooltip.hidden = reveal === 0
			tooltip.opacity = reveal
			tooltip.pos.y = -39 + (1 - reveal) * 5
		},
	}
}

function updateLockedAbilityReveals(
	pickups: readonly LockedAbilityPickup[],
	interactivePickups: readonly GameObj[]
) {
	let nearest: LockedAbilityPickup | undefined
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
	for (const pickup of pickups) {
		pickup.updateReveal(pickup === nearest)
	}
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
