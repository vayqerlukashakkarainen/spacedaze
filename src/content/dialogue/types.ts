import type { DroidId } from "../../npcs/droidRegistry"

export interface DialogueLine {
	speaker: string
	text: string | readonly DialogueTextSegment[]
	autoAdvance?: boolean
	holdAfter?: number
	disturbance?: boolean
}

export interface DialogueTextSegment {
	text: string
	reference?: DialogueReference
	waitAfter?: number
	color?: readonly [number, number, number]
	flash?: boolean
	textShake?: number
	sound?: {
		id: string
		volume?: number
		detune?: number
	}
	shake?: number
}

export type DialogueReference =
	| { kind: "reward"; id: string }
	| { kind: "npc"; id: DroidId }

export type DialogueSection = readonly DialogueLine[]
