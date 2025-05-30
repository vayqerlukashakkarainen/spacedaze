import { AnimateComp, GameObj, OpacityComp, RectComp } from "kaplay";
import { k } from "./main";
import { tags } from "./tags";

let healthBars: GameObj<OpacityComp>[] = [];
let specialBar: GameObj<RectComp> | null = null;

const height = 10;
const specialHeight = 80;
export function setupGameLoopUi(health: number) {
	for (let i = 0; i < health; i++) {
		addHealthBar(i);
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

export function addHealthBar(healthValue: number) {
	const offset = height * healthValue;
	const c = k.add([
		k.pos(10, k.height() - 10 - offset),
		k.rect(10, 6),
		k.color(k.WHITE),
		k.opacity(1),
		tags.gameLoopUi,
	]);

	healthBars.push(c);
}

export function updatePlayerHealthBar(currentHealth: number) {
	for (let i = 0; i < healthBars.length; i++) {
		if (i < currentHealth) {
			healthBars[i].opacity = 1;
			continue;
		}
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
