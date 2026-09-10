import assert from "node:assert/strict"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"
import type { KAPLAYCtx } from "kaplay"
import {
	loadAudioAssets,
	MUSIC_ASSETS,
	SOUND_ASSETS,
} from "./soundCatalog"
import {
	getSoundCuePolicy,
	isSoundCueId,
	SEMANTIC_SOUND_CUES,
} from "./soundCueCatalog"

const projectRoot = process.cwd()

for (const [id, path] of Object.entries({ ...SOUND_ASSETS, ...MUSIC_ASSETS })) {
	assert.ok(
		existsSync(join(projectRoot, "public", path)),
		`Audio asset ${id} points to missing file public/${path}`
	)
}

const pendingSoundLoads: Array<() => void> = []
const startedSounds: string[] = []
const registeredMusic: string[] = []
const audioLoad = loadAudioAssets({
	loadSound(id: string) {
		startedSounds.push(id)
		return new Promise<void>((resolve) => pendingSoundLoads.push(resolve))
	},
	loadMusic(id: string) {
		registeredMusic.push(id)
	},
} as unknown as KAPLAYCtx)

assert.equal(startedSounds.length, Object.keys(SOUND_ASSETS).length)
assert.equal(registeredMusic.length, Object.keys(MUSIC_ASSETS).length)
for (const resolve of pendingSoundLoads) resolve()
await audioLoad

const rawPlaybackAllowlist = new Set([
	"src/services/audio/audioService.ts",
	"src/services/combat/explosionService.ts",
	"src/services/audio/gameSoundService.ts",
	"src/services/audio/hitSoundService.ts",
	"src/services/combat/projectileService.ts",
])

function sourceFiles(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name)
		return entry.isDirectory() ? sourceFiles(path) : [path]
	})
}

const directLiteralCalls: string[] = []
const unknownCueCalls: string[] = []
for (const path of sourceFiles(join(projectRoot, "src"))) {
	if (!path.endsWith(".ts")) continue
	const projectPath = relative(projectRoot, path)
	if (rawPlaybackAllowlist.has(projectPath)) continue
	const source = readFileSync(path, "utf8")
	const pattern = /audioService\.(?:playSound|playPositionalSound)\(\s*"([^"]+)"/g
	for (const match of source.matchAll(pattern)) {
		directLiteralCalls.push(`${projectPath}: ${match[1]}`)
	}
	const cuePattern = /gameSoundService\.(?:play|playPositional)\(\s*"([^"]+)"/g
	for (const match of source.matchAll(cuePattern)) {
		if (isSoundCueId(match[1])) continue
		unknownCueCalls.push(`${projectPath}: ${match[1]}`)
	}
}

for (const [cueId, policy] of Object.entries(SEMANTIC_SOUND_CUES)) {
	const assets = Array.isArray(policy.asset) ? policy.asset : [policy.asset]
	for (const asset of assets) {
		assert.ok(Object.hasOwn(SOUND_ASSETS, asset), `${cueId} uses unknown asset ${asset}`)
	}
}

assert.equal(getSoundCuePolicy("enemy_blaster_fire").maxVoices, 8)
assert.equal(getSoundCuePolicy("enemy_blaster_fire").group, "enemy-blaster-fire")
assert.equal(getSoundCuePolicy("weapon_burst_driver").maxVoices, 6)
assert.equal(getSoundCuePolicy("player_primary_charge").asset, "primary_weapon_charge")
assert.equal(getSoundCuePolicy("chest_challenge_charge").asset, "rail_lance_charge")
assert.equal(getSoundCuePolicy("lifesteal_health_receive").maxVoices, 3)
assert.deepEqual(getSoundCuePolicy("lifesteal_health_receive").detuneRange, [-60, 60])
assert.deepEqual(getSoundCuePolicy("ship_part_destroyed").asset, [
	"ship_part_destroyed_01",
	"ship_part_destroyed_02",
])
assert.deepEqual(
	getSoundCuePolicy("enemy_ship_destroyed").asset,
	getSoundCuePolicy("ship_part_destroyed").asset
)
assert.deepEqual(getSoundCuePolicy("rock_material_destroyed").asset, [
	"asteroid_destroyed",
	"rock_material_destroyed_02",
])

assert.deepEqual(
	directLiteralCalls,
	[],
	`Use gameSoundService for semantic sound cues:\n${directLiteralCalls.join("\n")}`
)
assert.deepEqual(
	unknownCueCalls,
	[],
	`Register every semantic sound cue in SOUND_ASSETS:\n${unknownCueCalls.join("\n")}`
)

console.log(
	`Audio catalog validated: ${Object.keys(SOUND_ASSETS).length} sounds and ${Object.keys(MUSIC_ASSETS).length} music tracks`
)
