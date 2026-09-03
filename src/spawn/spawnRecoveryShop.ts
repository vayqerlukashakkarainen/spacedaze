import { Vec2 } from "kaplay"
import { k } from "../main"
import { showRecoveryShop } from "../ui/recoveryShop"
import { spawnBuilding } from "./spawnBuilding"

export function spawnRecoveryShop(pos: Vec2) {
	const shop = spawnBuilding({
		pos,
		sprite: "recovery_shop",
		scale: 1,
		interactRadius: 180,
		interactPromptOffset: k.vec2(0, -150),
		onInteract: showRecoveryShop,
	})

	const label = shop.add([
		k.text("RECOVERY SHOP", {
			size: 9,
			font: "unscii",
			width: 150,
			align: "center",
		}),
		k.pos(0, 150),
		k.anchor("center"),
		k.opacity(0),
	])

	shop.onUpdate(() => {
		label.opacity = shop.isInRange ? 1 : 0
	})

	return shop
}
