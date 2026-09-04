import { audioService } from "./audioService"

const SHOP_MENU_SOUND_VOLUME = 0.8
const SHOP_MENU_SOUND_SPEED = 2

export function playShopMenuOpenSound() {
	audioService.playSound("shop_menu_open", {
		volume: SHOP_MENU_SOUND_VOLUME,
		speed: SHOP_MENU_SOUND_SPEED,
	})
}

export function playShopMenuCloseSound() {
	audioService.playSound("shop_menu_close", {
		volume: SHOP_MENU_SOUND_VOLUME,
		speed: SHOP_MENU_SOUND_SPEED,
	})
}
