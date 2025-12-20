import { GameObj, PosComp, TextComp, Vec2 } from "kaplay"
import { changeGameState, GameState, k } from "../main"

export function enterMainMenu() {
	const center = k.center()

	// Title
	k.add([
		k.text("SPACEDAZE", { size: 32, font: "unscii" }),
		k.pos(center.x, center.y - 100),
		k.anchor("center"),
		"ui",
	])

	// Start Game button
	addMenuButton("START GAME", k.vec2(center.x, center.y), () => {
		clearMainMenu()
		changeGameState(GameState.Playing)
	})

	// Level Editor button
	addMenuButton("LEVEL EDITOR", k.vec2(center.x, center.y + 80), () => {
		clearMainMenu()
		changeGameState(GameState.LevelEditor)
	})
}

export function updateMainMenuLoop() {
	// Main menu update logic (if needed)
}

export function clearMainMenu() {
	k.destroyAll("ui")
}

function addMenuButton(txt: string, pos: Vec2, onClick: () => void) {
	const btn = k.add([
		k.pos(pos),
		k.rect(300, 50),
		k.area(),
		k.color(0, 0, 0),
		k.anchor("center"),
		k.outline(2, new k.Color(255, 255, 255)),
		"ui",
	])

	btn.add([
		k.text(txt, { size: 16, font: "unscii" }),
		k.anchor("center"),
		k.color(255, 255, 255),
	])

	btn.onClick(onClick)

	return btn
}
