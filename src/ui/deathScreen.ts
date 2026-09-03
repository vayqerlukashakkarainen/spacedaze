import { k, layers } from "../main";
import type { PlayerDeathCause } from "../services/damageService";
import { tags } from "../tags";

export function showDeathScreen(cause: PlayerDeathCause) {
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
		k.pos(k.center().add(0, -58)),
		k.anchor("center"),
		k.color(k.WHITE),
		k.opacity(1),
		k.fixed(),
		k.layer(layers.ui),
		tags.deathScreen,
	]);

	k.add([
		k.sprite(cause.sprite ?? "bullet1", { width: 42, height: 42 }),
		k.pos(k.center().add(0, 28)),
		k.anchor("center"),
		k.color(k.WHITE),
		k.fixed(),
		k.layer(layers.ui),
		tags.deathScreen,
	]);

	k.add([
		k.text(`KILLED BY ${cause.name.toUpperCase()}`, {
			font: "unscii",
			size: 15,
		}),
		k.pos(k.center().add(0, 68)),
		k.anchor("center"),
		k.color(255, 105, 105),
		k.fixed(),
		k.layer(layers.ui),
		tags.deathScreen,
	]);
}

export function hideDeathScreen() {
	k.destroyAll(tags.deathScreen);
}
