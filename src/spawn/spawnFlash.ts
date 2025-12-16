import { Vec2 } from "kaplay";
import { k } from "../main";
import { explosionEmitter } from "../particles";
import { loopService } from "../services/loopService";

export function spawnFlash(pos: Vec2, size: number) {
	const crit = k.add([
		k.pos(pos),
		k.circle(size),
		k.color(k.WHITE),
		k.scale(1),
		k.opacity(1),
		k.lifespan(0.04),
	]);
}

export function spawnExplosionEffect(pos: Vec2, size: number) {
	explosionEmitter.emitter.position = pos;
	explosionEmitter.emit(14);
	let i = 1;
	loopService.loop(
		0.07,
		() => {
			spawnFlash(
				pos.add(
					k.rand(k.vec2(size / 2, size / 2), k.vec2(-size / 2, -size / 2))
				),
				size - i * (size / 5)
			);
			i++;
		},
		7
	);
}
