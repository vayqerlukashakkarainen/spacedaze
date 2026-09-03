import type { Vec2 } from "kaplay"
import { playerObj } from "../game"
import { k, mainSoundVolume } from "../main"
import { starsEmitter } from "../particles"
import { collectVolatileCargo } from "../services/shipUpgradeService"
import { audioService } from "../services/audioService"
import { tags } from "../tags"
import { spawnRing } from "./spawnRing"

interface VolatileCargoObjectiveProps {
	pos: Vec2
	onCollect?: () => void
	tags?: string[]
}

export function spawnVolatileCargoObjective(
	props: VolatileCargoObjectiveProps
) {
	let collected = false
	const cargo = k.add([
		k.pos(props.pos),
		k.sprite("crate1"),
		k.anchor("center"),
		k.rotate(0),
		k.scale(0.58),
		k.color(255, 145, 45),
		k.opacity(0.95),
		tags.props,
		tags.gameLoop,
		...(props.tags ?? []),
	])
	const glow = cargo.add([
		k.circle(30),
		k.anchor("center"),
		k.color(255, 110, 25),
		k.opacity(0.12),
		k.z(-1),
	])
	const ring = cargo.add([
		k.circle(35, { fill: false }),
		k.anchor("center"),
		k.outline(2, k.rgb(255, 145, 45)),
		k.opacity(0.75),
		k.z(-1),
	])
	const label = k.add([
		k.pos(props.pos.add(0, -43)),
		k.text("OBJECTIVE // VOLATILE CARGO", {
			size: 8,
			font: "unscii",
		}),
		k.anchor("center"),
		k.color(255, 175, 75),
		tags.gameLoop,
		...(props.tags ?? []),
	])

	cargo.onUpdate(() => {
		cargo.angle += k.dt() * 8
		glow.opacity = k.wave(0.08, 0.22, k.time() * 3)
		ring.scale = k.vec2(k.wave(0.92, 1.12, k.time() * 2.5))
		if (collected || playerObj.pos.dist(cargo.pos) > 24) return
		collected = collectVolatileCargo()
		if (!collected) return
		props.onCollect?.()

		starsEmitter.emitter.position = cargo.pos.clone()
		starsEmitter.emit(28)
		spawnRing({
			pos: cargo.pos,
			speed: 220,
			intensity: 0.4,
			maxRadius: 90,
			color: k.rgb(255, 145, 45),
		})
		spawnCollectionMessage(cargo.pos)
		audioService.playSound("powerup1", {
			volume: mainSoundVolume,
			detune: -160,
		})
		k.destroy(cargo)
	})
	cargo.onDestroy(() => {
		if (label.exists()) k.destroy(label)
	})

	return cargo
}

function spawnCollectionMessage(pos: Vec2) {
	const message = k.add([
		k.pos(pos.clone()),
		k.text("CARGO SECURED // DO NOT TAKE HULL DAMAGE", {
			size: 9,
			font: "unscii",
		}),
		k.anchor("center"),
		k.color(255, 175, 75),
		k.opacity(1),
		k.lifespan(2.2, { fade: 0.7 }),
		{
			elapsed: 0,
		},
		tags.gameLoop,
	])
	message.onUpdate(() => {
		message.elapsed += k.dt()
		message.pos.y -= 16 * k.dt()
	})
}
