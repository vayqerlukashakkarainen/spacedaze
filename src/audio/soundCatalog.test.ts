import assert from "node:assert/strict"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"
import { MUSIC_ASSETS, SOUND_ASSETS } from "./soundCatalog"
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

const rawPlaybackAllowlist = new Set([
	"src/services/audioService.ts",
	"src/services/explosionService.ts",
	"src/services/gameSoundService.ts",
	"src/services/hitSoundService.ts",
	"src/services/projectileService.ts",
	"src/spawn/spawnAsteroid.ts",
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

assert.equal(getSoundCuePolicy("enemy_explosion").maxVoices, 6)
assert.equal(getSoundCuePolicy("enemy_explosion").group, "enemy-explosion")
assert.equal(getSoundCuePolicy("enemy_blaster_fire").maxVoices, 8)
assert.equal(getSoundCuePolicy("enemy_blaster_fire").group, "enemy-blaster-fire")
assert.equal(getSoundCuePolicy("weapon_burst_driver").maxVoices, 6)
assert.equal(getSoundCuePolicy("player_primary_charge").asset, "primary_weapon_charge")
assert.equal(getSoundCuePolicy("chest_challenge_charge").asset, "rail_lance_charge")

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
