export type ExplosionSoundPoolId = "general" | "plasmaMortar"

const EXPLOSION_SOUND_POOLS: Readonly<
	Record<ExplosionSoundPoolId, readonly string[]>
> = {
	general: ["explosion1", "explosion2", "explosion3"],
	plasmaMortar: [
		"weapon_plasma_mortar_explosion",
		"weapon_plasma_explosion_gearpile",
		"weapon_plasma_explosion_flashtrauma",
	],
}

const previousPoolIndex = new Map<ExplosionSoundPoolId, number>()

export function randomExplosionSound(
	poolId: ExplosionSoundPoolId = "general",
	random: () => number = Math.random
) {
	const pool = EXPLOSION_SOUND_POOLS[poolId]
	let index = Math.floor(random() * pool.length)
	const previousIndex = previousPoolIndex.get(poolId)
	if (pool.length > 1 && index === previousIndex) {
		index = (index + 1) % pool.length
	}
	previousPoolIndex.set(poolId, index)
	return pool[index]
}
