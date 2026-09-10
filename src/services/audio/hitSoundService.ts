import type { GameObj, Vec2 } from "kaplay"
import { k, mainSoundVolume } from "../../main"
import { tags } from "../../tags"
import { audioService } from "./audioService"

export type HitSoundProfileId =
	| "metal"
	| "lightMetal"
	| "heavyMetal"
	| "shield"
	| "stone"
	| "silent"

interface HitSoundProfile {
	sounds: readonly string[]
	volume: number
	detune: number
	cooldown: number
}

interface HitSoundState {
	profile?: HitSoundProfileId
	lastPlayedAt: number
}

const HIT_SOUND_PROFILES: Readonly<Record<Exclude<HitSoundProfileId, "silent">, HitSoundProfile>> = {
	metal: { sounds: ["hit1"], volume: 1, detune: 0, cooldown: 0.045 },
	lightMetal: {
		sounds: ["hit_light_metal"],
		volume: 0.72,
		detune: 0,
		cooldown: 0.04,
	},
	heavyMetal: { sounds: ["hit2"], volume: 0.9, detune: -120, cooldown: 0.07 },
	shield: { sounds: ["hit2"], volume: 0.8, detune: 280, cooldown: 0.055 },
	stone: {
		sounds: [
			"asteroid_impact_1",
			"asteroid_impact_2",
			"asteroid_impact_3",
		],
		volume: 0.65,
		detune: 0,
		cooldown: 0.08,
	},
}

const hitSoundStates = new WeakMap<object, HitSoundState>()

export function setHitSoundProfile(
	target: GameObj,
	profile: HitSoundProfileId
) {
	const owner = getHitSoundOwner(target)
	const state = getHitSoundState(owner)
	state.profile = profile
}

export function playDamageHitSound(target: GameObj, position?: Vec2) {
	const owner = getHitSoundOwner(target)
	const state = getHitSoundState(owner)
	const profileId = state.profile ?? inferHitSoundProfile(owner)
	if (!profileId || profileId === "silent") return
	const profile = HIT_SOUND_PROFILES[profileId]
	const now = k.time()
	if (now - state.lastPlayedAt < profile.cooldown) return
	state.lastPlayedAt = now
	const source = position?.clone() ?? target.pos?.clone() ?? owner.pos?.clone()
	if (!source) return
	const sound = profile.sounds[Math.floor(k.rand(0, profile.sounds.length))]
	audioService.playPositionalSound(sound, source, {
		volume: mainSoundVolume * profile.volume,
		detune: profile.detune + k.rand(-35, 35),
		minDistance: 80,
		maxDistance: 720,
		panDistance: 440,
		voiceLimit: 8,
	})
}

function getHitSoundOwner(target: GameObj) {
	const parent = target.parent as GameObj | undefined
	return parent?.exists() ? parent : target
}

function getHitSoundState(target: GameObj) {
	let state = hitSoundStates.get(target)
	if (state) return state
	state = { lastPlayedAt: Number.NEGATIVE_INFINITY }
	hitSoundStates.set(target, state)
	return state
}

function inferHitSoundProfile(target: GameObj): HitSoundProfileId | undefined {
	return target.tags.includes(tags.enemy) ? "metal" : undefined
}
