import type { GameObj, Vec2 } from "kaplay"
import { k, layers } from "../main"
import {
	ABILITIES,
	isAbilityDiscovered,
	type AbilityDefinition,
} from "../services/abilityRegistry"
import type { AbilitySlot } from "../services/abilityLoadoutService"
import { spawnAbilityLoadoutPickup } from "../services/abilitySwapService"
import { registerBatchedEntityUpdate } from "../services/entityUpdateService"
import { tags } from "../tags"
import { UI_COLORS } from "../ui/common"
import { spawnMeteorite } from "./spawnAsteroid"
import { spawnSwarmEnemy, type SwarmPatrol } from "./spawnSwarm"

const RANGE_WIDTH = 660
const TARGET_OFFSET_Y = 230
const TARGET_RESPAWN_DELAY = 1.5
const DISCOVERY_REFRESH_INTERVAL = 0.5
const PICKUP_SPACING = 60
const TRAINING_SWARM_COUNT = 5

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
	let discoverySignature = ""
	let refreshTimer = 0
	let abilityPickups: GameObj[] = []
	const refreshEquipment = () => {
		const unlocked = ABILITIES.filter(isAbilityDiscovered)
		const nextSignature = unlocked.map((ability) => ability.id).join("|")
		if (nextSignature === discoverySignature) return
		discoverySignature = nextSignature
		equipmentRoot.removeAll()
		for (const pickup of abilityPickups) {
			if (pickup.exists()) k.destroy(pickup)
		}
		abilityPickups = []
		for (const row of SLOT_ROWS) {
			spawnAbilityRow(
				equipmentRoot,
				row,
				unlocked.filter((ability) => ability.slot === row.slot),
				props.pos,
				abilityPickups
			)
		}
	}
	refreshEquipment()

	registerBatchedEntityUpdate("world", root, () => {
		refreshTimer += k.dt()
		if (refreshTimer < DISCOVERY_REFRESH_INTERVAL) return
		refreshTimer = 0
		refreshEquipment()
	})

	let primaryTarget: GameObj | undefined
	const targetOffsets = [-90, 0, 90]
	for (const offsetX of targetOffsets) {
		spawnTrainingDummy(
			targetPos.add(offsetX, 0),
			props.isHubSessionActive,
			offsetX === 0
				? (target) => primaryTarget = target
				: undefined
		)
	}
	spawnTrainingSwarm(targetPos, props.isHubSessionActive)

	return {
		targetPos,
		getPrimaryTarget: () => primaryTarget?.exists()
			? primaryTarget
			: undefined,
	}
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
		k.sprite("hub_firing_range_control", { width: 92, height: 92 }),
		k.pos(-RANGE_WIDTH / 2 + 34, -205),
		k.anchor("center"),
		k.color(90, 108, 118),
		k.opacity(0.72),
		k.z(-2),
	])
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
	abilityPickups: GameObj[]
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
		const pickup = spawnAbilityLoadoutPickup(
			ability.slot,
			ability.id,
			rangePos.add(startX + index * spacing + 55, row.y)
		)
		if (pickup) abilityPickups.push(pickup)
	})
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
