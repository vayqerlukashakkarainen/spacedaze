import { Vec2 } from "kaplay";
import { changeGameState, GameState, k, layers } from "../main";
import { starsEmitter } from "../particles";
import { spawnBuilding } from "./spawnBuilding";
import { setNextChestDifficulty } from "../ui/chestChallenge";
import { registerBatchedEntityUpdate } from "../services/entityUpdateService";

const CHEST_SCALE = 0.75;

export function spawnChest(pos: Vec2, difficulty: number = 1) {
	let opened = false;
	const chest = spawnBuilding({
		pos,
		sprite: "crate1",
		interactRadius: 60,
		scale: CHEST_SCALE,
		onInteract: () => {
			if (opened) return;
			opened = true;
			setNextChestDifficulty(difficulty);
			starsEmitter.emitter.position = chest.pos.clone();
			starsEmitter.emit(32);
			k.destroy(chest);
			changeGameState(GameState.ChestOpening);
		},
	});
	const aura = chest.add([
		k.circle(14),
		k.anchor("center"),
		k.color(k.WHITE),
		k.opacity(0.08),
		k.z(-1),
		k.layer(layers.gameEffects),
	]);
	const auraRing = chest.add([
		k.circle(17, { fill: false }),
		k.anchor("center"),
		k.opacity(0.3),
		k.outline(1, k.WHITE),
		k.layer(layers.gameEffects),
		k.z(-1),
	]);

	chest.add([
		k.pos(),
		k.z(-1),
		k.particles(
			{
				max: 32,
				speed: [3, 10],
				angle: [0, 360],
				lifeTime: [0.7, 1.4],
				colors: [k.WHITE],
				opacities: [0, 0.9, 0],
				scales: [0.2, 0.8, 0.1],
				angularVelocity: [-60, 60],
				texture: k.getSprite("particle4")!.data!.frames[0].tex,
				quads: [k.getSprite("particle4")!.data!.frames[0].q],
			},
			{
				rate: 7,
				direction: -90,
				spread: 360,
				position: k.vec2(),
			}
		),
	]);

	registerBatchedEntityUpdate("world", chest, () => {
		const pulse = k.wave(0.92, 1.08, k.time() * 2.5);
		aura.scale = k.vec2(pulse);
		auraRing.scale = k.vec2(k.wave(0.96, 1.12, k.time() * 2));
		auraRing.opacity = k.wave(0.15, 0.4, k.time() * 2);
	});

	return chest;
}
