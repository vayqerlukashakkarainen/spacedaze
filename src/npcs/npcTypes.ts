export type NpcId =
	| "ring-runner"
	| "ring-watcher"
	| "lamp-keeper"
	| "gloom"
	| "jubilee"
	| "armorer"
	| "quartermaster"
	| "race-marshal"

export type NpcKind = "droid"

export type NpcArchiveStatus = "ACTIVE" | "DESTROYED" | "UNKNOWN"

export interface NpcDefinition {
	id: NpcId
	kind: NpcKind
	name: string
	model: string
	role: string
	sprite: string
	summary: string
	archiveNotes: readonly string[]
}
