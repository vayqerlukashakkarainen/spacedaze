import type { Vec2 } from "kaplay"
import { getRoomStampDefinition } from "../../stamps/roomStampCatalog"
import type { HexCoord } from "../../generation/hexUtils"
import {
	getRoomStampPlans,
	transformRoomStampCoord,
} from "../../generation/rooms/roomStampPlanner"
import type { RoomFloorRoom } from "../../generation/rooms/roomFloorTypes"
import { hexNeighbor } from "../../grid/hexCoord"
import type { HexGrid } from "../../grid/hexGrid"
import { k, layers } from "../../main"
import { spawnProjectile } from "../../services/combat/projectileService"
import { tags } from "../../tags"

const BLASTER_SPEED = 255
const BLASTER_DAMAGE = 1
const WARNING_DURATION = 0.28

export function spawnRoomStampMechanics(
	grid: HexGrid,
	room: RoomFloorRoom,
	center: HexCoord
) {
	if (room.state === "cleared") return
	for (const stamp of getRoomStampPlans(room)) {
		const definition = getRoomStampDefinition(stamp.stampId)
		for (const mechanic of definition.mechanics) {
		if (mechanic.type !== "projectile-emitter") continue
		const coord = transformRoomStampCoord(
			center,
			mechanic.coord,
			stamp.rotation
		)
		spawnProjectileEmitter(
			grid,
			room,
			coord,
			(mechanic.facing + stamp.rotation) % 6,
			mechanic.interval,
			mechanic.phase
		)
		}
	}
}

function spawnProjectileEmitter(
	grid: HexGrid,
	room: RoomFloorRoom,
	coord: HexCoord,
	facing: number,
	interval: number,
	phase: number
) {
	const position = grid.hexToScreen(coord)
	const direction = grid.hexToScreen(hexNeighbor(coord, facing))
		.sub(position)
		.unit()
	const emitter = k.add([
		k.pos(position),
		k.sprite("wake_concussion_plate", { frame: 0 }),
		k.anchor("center"),
		k.rotate(facing * 60),
		k.scale(0.78),
		k.color(150, 36, 48),
		k.layer(layers.game2),
		k.z(-1),
		{
			fireTimer: interval * 0.55 + phase,
			update() {
				if (room.state === "cleared") {
					this.color = k.rgb(70, 70, 70)
					return
				}
				this.fireTimer -= k.dt()
				const warningProgress = k.clamp(
					1 - this.fireTimer / WARNING_DURATION,
					0,
					1
				)
				this.color = k.rgb(
					150 + warningProgress * 105,
					36 + warningProgress * 34,
					48 + warningProgress * 42
				)
				if (this.fireTimer > 0) return
				fireEmitterProjectile(position, direction)
				this.fireTimer += interval
			},
		},
		tags.props,
		tags.roomEnvironment,
		tags.roomTrap,
		tags.runMap,
		tags.runRoom,
		tags.gameLoop,
		tags.runtimeCullable,
	])
	return emitter
}

function fireEmitterProjectile(position: Vec2, direction: Vec2) {
	spawnProjectile({
		pos: position.add(direction.scale(18)),
		dir: direction,
		rotation: direction.angle() + 90,
		sprite: "particle3",
		tint: k.rgb(255, 72, 88),
		effectTint: k.rgb(255, 72, 88),
		speed: BLASTER_SPEED,
		tags: [tags.enemy, tags.blaster, tags.runMap, tags.runRoom],
		impact: { damage: BLASTER_DAMAGE },
		knockback: { strength: 26 },
		lifespan: { duration: 4.5 },
		fireSound: "enemy_blaster_fire",
		fireSoundVolume: 0.5,
		damageSource: {
			name: "CORRIDOR BLASTER",
			sprite: "wake_concussion_plate",
		},
	})
}
