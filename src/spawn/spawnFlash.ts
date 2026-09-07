import { Color, Vec2 } from "kaplay";
import { k, layers } from "../main";
import { explosionEmitter } from "../particles";
import { registerBatchedEntityUpdate } from "../services/entityUpdateService";
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
	color?: Color;
}

interface DelayedExplosionPulseOptions {
	pos: Vec2;
	size: number;
	duration: number;
	color?: Color;
	onComplete: () => void;
}

export function spawnDelayedExplosionPulse(
	options: DelayedExplosionPulseOptions
) {
	const color = options.color ?? k.WHITE;
	const pulse = k.add([
		k.pos(options.pos),
		k.circle(options.size * 0.82, { fill: false }),
		k.outline(3, color),
		k.anchor("center"),
		k.scale(0.05),
		k.opacity(0.35),
		k.layer(layers.gameEffects),
		{
			elapsed: 0,
			completed: false,
		},
		tags.gameLoop,
	]);

	registerBatchedEntityUpdate("effects", pulse, () => {
		pulse.elapsed += k.dt();
		const progress = k.clamp(pulse.elapsed / options.duration, 0, 1);
		const scale = progress < 0.45
			? k.lerp(0.05, 1, progress / 0.45)
			: k.lerp(1, 0.08, (progress - 0.45) / 0.55);
		pulse.scale = k.vec2(scale);
		pulse.opacity = k.lerp(0.35, 1, Math.min(1, progress / 0.45));
		if (progress < 1 || pulse.completed) return;
		pulse.completed = true;
		k.destroy(pulse);
		options.onComplete();
	});

	return pulse;
}

export function spawnExplosionEffect(
	pos: Vec2,
	size: number,
	options: ExplosionEffectOptions = {}
) {
	const color = options.color ?? k.WHITE;
	explosionEmitter.emitter.position = pos;
	explosionEmitter.emit(options.particleCount ?? 14);
	spawnRing({
		pos: pos,
		speed: 200,
		intensity: options.ringIntensity ?? 0.5,
		maxRadius: size * 1.5,
		visualize: true,
		color,
	});
	let i = 1;
	loopService.loop(
		0.07,
		() => {
			spawnFlash(
				pos.add(
					k.rand(k.vec2(size / 2, size / 2), k.vec2(-size / 2, -size / 2))
				),
				size - i * (size / 5),
				color
			);
			i++;
		},
			5
		);
}
