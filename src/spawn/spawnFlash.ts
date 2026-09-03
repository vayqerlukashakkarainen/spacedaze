import { Color, Vec2 } from "kaplay";
import { k } from "../main";
import { explosionEmitter } from "../particles";
import { loopService } from "../services/loopService";
import { spawnRing } from "./spawnRing";
import { tags } from "../tags";

export function spawnFlash(pos: Vec2, size: number, color: Color = k.WHITE) {
	k.add([
		k.pos(pos),
		k.circle(size),
		k.color(color),
		k.scale(1),
		k.opacity(1),
		k.lifespan(0.04),
		tags.gameLoop,
	]);
}

export function spawnExplosionEffect(pos: Vec2, size: number) {
	explosionEmitter.emitter.position = pos;
	explosionEmitter.emit(14);
	spawnRing({
		pos: pos,
		speed: 200,
		intensity: 0.5,
		maxRadius: size * 1.5,
		visualize: true,
	});
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
