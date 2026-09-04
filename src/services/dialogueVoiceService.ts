import { audioService } from "./audioService"

export interface DialogueVoiceProfile {
	soundId: string
	volume: number
	detune: number
	color: readonly [number, number, number]
	disturbance?: DialogueDisturbanceProfile
}

export interface DialogueDisturbanceProfile {
	dropoutChance: number
	jitter: number
	frequency: number
}

export type DialogueVoiceProfileId = "system" | "ship" | "unknown"

export const DIALOGUE_VOICE_PROFILES: Record<
	DialogueVoiceProfileId,
	DialogueVoiceProfile
> = {
	system: {
		soundId: "text_print",
		volume: 0.35,
		detune: 0,
		color: [0, 207, 255],
	},
	ship: {
		soundId: "text_print",
		volume: 0.35,
		detune: 0,
		color: [145, 155, 160],
	},
	unknown: {
		soundId: "text_print",
		volume: 0.38,
		detune: -600,
		color: [0, 207, 255],
		disturbance: {
			dropoutChance: 0.14,
			jitter: 1,
			frequency: 10,
		},
	},
}

const SPEAKER_VOICE_PROFILES: Record<string, DialogueVoiceProfileId> = {
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
