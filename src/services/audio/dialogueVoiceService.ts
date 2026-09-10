import { audioService } from "./audioService"

export interface DialogueVoiceProfile {
	soundId: string
	volume: number
	detune: number
	color: readonly [number, number, number]
	motion: DialogueVoiceMotionProfile
	disturbance?: DialogueDisturbanceProfile
}

export interface DialogueVoiceMotionProfile {
	bobAmount: number
	scaleAmount: number
	speed: number
}

export interface DialogueDisturbanceProfile {
	dropoutChance: number
	jitter: number
	frequency: number
}

export type DialogueVoiceProfileId =
	| "system"
	| "light"
	| "dark"
	| "ship"
	| "unknown"

const SYSTEM_MOTION: DialogueVoiceMotionProfile = {
	bobAmount: 1.4,
	scaleAmount: 0.08,
	speed: 76,
}

const LIGHT_MOTION: DialogueVoiceMotionProfile = {
	bobAmount: 2.6,
	scaleAmount: 0.12,
	speed: 96,
}

const DARK_MOTION: DialogueVoiceMotionProfile = {
	bobAmount: 0.85,
	scaleAmount: 0.05,
	speed: 52,
}

export const DIALOGUE_VOICE_PROFILES: Record<
	DialogueVoiceProfileId,
	DialogueVoiceProfile
> = {
	system: {
		soundId: "text_print",
		volume: 0.35,
		detune: 0,
		color: [0, 207, 255],
		motion: SYSTEM_MOTION,
	},
	light: {
		soundId: "text_print",
		volume: 0.32,
		detune: 360,
		color: [0, 207, 255],
		motion: LIGHT_MOTION,
	},
	dark: {
		soundId: "text_print",
		volume: 0.4,
		detune: -320,
		color: [0, 207, 255],
		motion: DARK_MOTION,
	},
	ship: {
		soundId: "text_print",
		volume: 0.35,
		detune: -120,
		color: [145, 155, 160],
		motion: DARK_MOTION,
	},
	unknown: {
		soundId: "text_print",
		volume: 0.38,
		detune: -600,
		color: [0, 207, 255],
		motion: DARK_MOTION,
		disturbance: {
			dropoutChance: 0.14,
			jitter: 1,
			frequency: 10,
		},
	},
}

const SPEAKER_VOICE_PROFILES: Record<string, DialogueVoiceProfileId> = {
	BURT: "light",
	JUBILEE: "light",
	"RING RUNNER": "light",
	GLOOM: "dark",
	"LAMP KEEPER": "dark",
	"RANGE KEEPER": "system",
	SHIP: "ship",
	UNKNOWN: "unknown",
}

export function getDialogueVoiceProfile(speaker: string) {
	const profileId = SPEAKER_VOICE_PROFILES[speaker.toUpperCase()] ?? "system"
	return DIALOGUE_VOICE_PROFILES[profileId]
}

export function playDialogueCharacter(speaker: string) {
	const profile = getDialogueVoiceProfile(speaker)
	audioService.playSound(profile.soundId, {
		volume: profile.volume,
		detune: profile.detune,
	})
}
