import { k, layers } from "../main";
import { tags } from "../tags";

export function showDeathScreen() {
	k.add([
		k.rect(k.width(), k.height()),
		k.pos(0, 0),
		k.color(0, 0, 0),
		k.opacity(0.45),
		k.fixed(),
		k.layer(layers.ui),
		tags.deathScreen,
	]);

	k.add([
		k.text("DEAD", { font: "", size: 72 }),
		k.pos(k.center()),
		k.anchor("center"),
		k.color(k.WHITE),
		k.opacity(1),
		k.fixed(),
		k.layer(layers.ui),
		tags.deathScreen,
	]);
}

export function hideDeathScreen() {
	k.destroyAll(tags.deathScreen);
}
