import { AnimateComp, GameObj, OpacityComp, RectComp } from "kaplay";
import { k } from "./main";
import { tags } from "./tags";

let healthBars: GameObj<OpacityComp>[] = [];
let specialBar: GameObj<RectComp> | null = null;

const height = 10;
const specialHeight = 80;
export function setupGameLoopUi(health: number) {
	for (let i = 0; i < health; i++) {
		const offset = height * (i + 1);
		const c = k.add([
			k.pos(10, k.height() - offset),
			k.rect(10, 6),
			k.color(k.WHITE),
			k.opacity(1),
			tags.gameLoopUi,
		]);

		healthBars.push(c);
	}

	k.add([
		k.pos(22, k.height() - 4 - specialHeight),
		k.rect(4, specialHeight),
		k.color(k.WHITE),
		k.opacity(0.2),
		tags.gameLoopUi,
	]);
	specialBar = k.add([
		k.pos(22, k.height() - 4 - specialHeight),
		k.rect(4, specialHeight),
		k.color(k.WHITE),
		tags.gameLoopUi,
	]);
}

export function updatePlayerHealthBar(newHealth: number) {
	const clamp = k.clamp(newHealth, 0, healthBars.length - 1);
	for (let i = healthBars.length - 1; i >= clamp; i--) {
		healthBars[i].opacity = 0.2;
	}
}

export function updateSpecialBar(current: number, max: number) {
	specialBar!.height = specialHeight * (current / max);
}

export function clearGameLoopUi() {
	k.destroyAll(tags.gameLoopUi);
	healthBars = [];
	specialBar = null;
}
