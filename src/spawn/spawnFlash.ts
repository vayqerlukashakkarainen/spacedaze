import { Vec2 } from "kaplay";
import { k, mainSoundVolume } from "../main";

export function spawnFlash(pos: Vec2, multiplier: number) {
	const crit = k.add([
		k.pos(pos),
		k.circle(12 * multiplier),
		k.color(k.WHITE),
		k.scale(1),
		k.opacity(1),
		k.lifespan(0.04),
	]);
}
