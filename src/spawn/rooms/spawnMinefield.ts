import type { GameObj, Vec2 } from "kaplay"
import { checkProjectileIntersection, playerObj } from "../../game"
import { k } from "../../main"
import { applyDamage } from "../../services/damageService"
import { tags } from "../../tags"
import { spawnExplosionEffect } from "../spawnFlash"

interface MinefieldProps {
	pos: Vec2
	radius: number
	count: number
	damage: number
	seed: number
	tags?: string[]
}

export function spawnMinefield(props: MinefieldProps) {
	k.add([
		k.pos(props.pos),
		k.text("MINEFIELD", { size: 9, font: "unscii" }),
		k.anchor("center"),
		k.color(255, 105, 105),
		tags.gameLoop,
		...(props.tags ?? []),
	])

	for (let index = 0; index < props.count; index++) {
		const angle = seededUnit(props.seed, index, 1) * 360
		const distance = props.radius * (0.28 + seededUnit(props.seed, index, 2) * 0.72)
		spawnProximityMine(
			props.pos.add(k.Vec2.fromAngle(angle).scale(distance)),
			props.damage,
			props.tags
		)
	}
}

function spawnProximityMine(pos: Vec2, damage: number, extraTags?: string[]) {
	let triggered = false
	let armedElapsed = 0
	let triggerElapsed = 0
	const mine = k.add([
		k.pos(pos),
		k.sprite("room_proximity_mine"),
		k.anchor("center"),
		k.rotate(k.rand(360)),
		k.scale(0.82),
		k.color(150, 150, 150),
		k.opacity(0.9),
		tags.props,
		tags.gameLoop,
		...(extraTags ?? []),
	])

	mine.onUpdate(() => {
		mine.angle += k.dt() * 18
		armedElapsed += k.dt()
		if (armedElapsed < 0.7) return
		mine.color = triggered
			? k.rgb(255, 65, 65)
			: k.rgb(210, 210, 210)
		mine.opacity = triggered
			? k.wave(0.35, 1, k.time() * 12)
			: k.wave(0.65, 1, k.time() * 3)

		if (!triggered && mine.pos.dist(playerObj.pos) < 28) triggered = true
		checkProjectileIntersection(mine.pos, 10, tags.friendly, (projectile) => {
			if (projectile.exists()) k.destroy(projectile)
			triggered = true
			triggerElapsed = 0.3
		})
		if (!triggered) return
		triggerElapsed += k.dt()
		if (triggerElapsed < 0.3) return
		detonateMine(mine, damage)
	})
}

function detonateMine(mine: GameObj, damage: number) {
	const enemies = k.query({
		include: [tags.enemy, tags.unit],
		includeOp: "and",
	}) as GameObj[]
	for (const target of [playerObj, ...enemies]) {
		if (!target.exists() || target.pos.dist(mine.pos) > 52) continue
		applyDamage(target, damage, {
			position: mine.pos,
			source: {
				name: "PROXIMITY MINE",
				sprite: "room_proximity_mine",
			},
		})
	}
	spawnExplosionEffect(mine.pos, 52)
	k.destroy(mine)
}

function seededUnit(seed: number, index: number, salt: number) {
	let hash = seed ^ Math.imul(index + 1, 73856093) ^ Math.imul(salt, 19349663)
	hash = Math.imul(hash ^ (hash >>> 16), 2246822519)
	return ((hash ^ (hash >>> 13)) >>> 0) / 0x100000000
}
