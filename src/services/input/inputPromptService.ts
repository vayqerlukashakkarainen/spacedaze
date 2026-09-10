export type InputPromptKey =
	| "escape"
	| "enter"
	| "space"
	| "tab"
	| "mouseLeft"
	| "mouseRight"
	| "w"
	| "a"
	| "s"
	| "d"
	| "f"
	| "r"
	| "t"
	| "1"
	| "2"
	| "3"

export type InputPromptAction =
	| "confirm"
	| "skip"
	| "move"
	| "fire"
	| "special"
	| "interact"
	| "map"
	| "tune"
	| "lock"
	| "charge"
	| "timingHit"
	| "reroll"
	| "retry"
	| "select1"
	| "select2"
	| "select3"

export interface InputPromptGlyph {
	sprite: string
	width: number
	height: number
}

const ACTION_KEYS: Record<InputPromptAction, readonly InputPromptKey[]> = {
	confirm: ["enter"],
	skip: ["escape"],
	move: ["w", "a", "s", "d"],
	fire: ["mouseLeft"],
	special: ["mouseRight"],
	interact: ["f"],
	map: ["tab"],
	tune: ["a", "d"],
	lock: ["space"],
	charge: ["space"],
	timingHit: ["space"],
	reroll: ["r"],
	retry: ["t"],
	select1: ["1"],
	select2: ["2"],
	select3: ["3"],
}

const KEY_GLYPHS: Record<InputPromptKey, InputPromptGlyph> = {
	escape: { sprite: "input_key_escape", width: 16, height: 16 },
	enter: { sprite: "input_key_enter", width: 33, height: 33 },
	space: { sprite: "input_key_space", width: 50, height: 16 },
	tab: { sprite: "input_key_tab", width: 33, height: 16 },
	mouseLeft: { sprite: "input_key_mouseLeft", width: 16, height: 16 },
	mouseRight: { sprite: "input_key_mouseRight", width: 16, height: 16 },
	w: { sprite: "input_key_w", width: 16, height: 16 },
	a: { sprite: "input_key_a", width: 16, height: 16 },
	s: { sprite: "input_key_s", width: 16, height: 16 },
	d: { sprite: "input_key_d", width: 16, height: 16 },
	f: { sprite: "input_key_f", width: 16, height: 16 },
	r: { sprite: "input_key_r", width: 16, height: 16 },
	t: { sprite: "input_key_t", width: 16, height: 16 },
	"1": { sprite: "input_key_1", width: 16, height: 16 },
	"2": { sprite: "input_key_2", width: 16, height: 16 },
	"3": { sprite: "input_key_3", width: 16, height: 16 },
}

export function getInputPromptKeys(action: InputPromptAction) {
	return ACTION_KEYS[action]
}

export function getInputPromptGlyph(key: InputPromptKey) {
	return KEY_GLYPHS[key]
}
