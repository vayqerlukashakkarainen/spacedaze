import { Color, Vec2 } from "kaplay";
import { k, layers } from "../main";
import { explosionEmitter } from "../particles";
import { loopService } from "../services/loopService";
import { spawnRing } from "./spawnRing";
import { tags } from "../tags";

export function spawnFlash(pos: Vec2, size: number, color: Color = k.WHITE) {
	if (!Number.isFinite(size) || size <= 0) return;
	k.add([
		k.pos(pos),
		k.circle(size),
		k.color(color),
		k.scale(1),
		k.opacity(1),
		k.layer(layers.gameEffects),
		k.lifespan(0.04),
		tags.gameLoop,
	]);
}

interface ExplosionEffectOptions {
	ringIntensity?: number;
	particleCount?: number;
}

export function spawnExplosionEffect(
	pos: Vec2,
	size: number,
	options: ExplosionEffectOptions = {}
) {
	explosionEmitter.emitter.position = pos;
	explosionEmitter.emit(options.particleCount ?? 14);
	spawnRing({
		pos: pos,
		speed: 200,
		intensity: options.ringIntensity ?? 0.5,
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
			5
		);
}
