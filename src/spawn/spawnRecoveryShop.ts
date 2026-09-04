import { Vec2 } from "kaplay"
import { k } from "../main"
import { showRecoveryShop } from "../ui/recoveryShop"
import { spawnBuilding } from "./spawnBuilding"

const recoveryShopScale = 1
const recoveryShopLabelOffsetY = 150

export function spawnRecoveryShop(pos: Vec2) {
	const shop = spawnBuilding({
		pos,
		sprite: "recovery_shop",
		scale: recoveryShopScale,
		interactRadius: 180,
		interactPromptOffset: k.vec2(0, -recoveryShopLabelOffsetY),
		interactionPrompt: {
			title: "RECOVERY SHOP",
			action: "OPEN SHOP",
		},
		onInteract: showRecoveryShop,
	})
	shop.use(k.color(185, 185, 185))
	return shop
}
