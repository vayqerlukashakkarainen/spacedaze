import type { Vec2 } from "kaplay"
import { profileSection } from "./frameProfilerService"

export const RUN_LOOP_PHASES = [
	"input",
	"timers",
	"movement",
	"spatialIndex",
	"collision",
	"gameplay",
	"effects",
	"ui",
	"cleanup",
] as const

export type RunLoopPhase = typeof RUN_LOOP_PHASES[number]

export interface RunFrameContext {
	frame: number
	rawDt: number
	dt: number
	scaledDt: number
	timeScale: number
	gameState: number
	gameplayActive: boolean
	paused: boolean
	cameraPos: Vec2
	cameraScale: Vec2
	viewportWidth: number
	viewportHeight: number
}

export interface RunLoopSystem {
	id: string
	phase: RunLoopPhase
	priority?: number
	enabled?: (context: RunFrameContext) => boolean
	update: (context: RunFrameContext) => void
}

export interface RunLoopSystemSnapshot {
	id: string
	phase: RunLoopPhase
	priority: number
}

type PendingMutation = () => void

export class RunLoop {
	private systems = new Map<RunLoopPhase, RunLoopSystem[]>()
	private systemIds = new Set<string>()
	private pendingMutations: PendingMutation[] = []
	private cleanupTasks: Array<() => void> = []
	private updating = false
	private profileSystems = false
	private enabled = true

	constructor() {
		for (const phase of RUN_LOOP_PHASES) this.systems.set(phase, [])
	}

	register(system: RunLoopSystem) {
		if (this.systemIds.has(system.id)) {
			throw new Error(`Run loop system already registered: ${system.id}`)
		}
		this.systemIds.add(system.id)
		const add = () => {
			const phaseSystems = this.systems.get(system.phase)
			if (!phaseSystems) throw new Error(`Unknown run loop phase: ${system.phase}`)
			phaseSystems.push(system)
			phaseSystems.sort(compareSystems)
		}
		this.mutate(add)
		return () => this.unregister(system.id)
	}

	unregister(id: string) {
		if (!this.systemIds.delete(id)) return false
		this.mutate(() => {
			for (const systems of this.systems.values()) {
				const index = systems.findIndex((system) => system.id === id)
				if (index >= 0) {
					systems.splice(index, 1)
					break
				}
			}
		})
		return true
	}

	update(context: RunFrameContext) {
		if (!this.enabled) return
		this.updating = true
		try {
			for (const phase of RUN_LOOP_PHASES) {
				const systems = this.systems.get(phase)
				if (!systems || systems.length === 0) continue
				profileSection(`phase:${phase}`, () => {
					for (let index = 0; index < systems.length; index++) {
						const system = systems[index]
						if (system.enabled && !system.enabled(context)) continue
						if (this.profileSystems) {
							profileSection(`system:${system.id}`, () => system.update(context))
						} else {
							system.update(context)
						}
					}
				})
			}
		} finally {
			this.updating = false
			this.flushMutations()
			this.flushCleanup()
		}
	}

	deferCleanup(task: () => void) {
		this.cleanupTasks.push(task)
	}

	setEnabled(enabled: boolean) {
		this.enabled = enabled
	}

	isEnabled() {
		return this.enabled
	}

	setSystemProfiling(enabled: boolean) {
		this.profileSystems = enabled
	}

	isSystemProfilingEnabled() {
		return this.profileSystems
	}

	snapshot(): RunLoopSystemSnapshot[] {
		return RUN_LOOP_PHASES.flatMap((phase) =>
			(this.systems.get(phase) ?? []).map((system) => ({
				id: system.id,
				phase,
				priority: system.priority ?? 0,
			}))
		)
	}

	clear() {
		const clearSystems = () => {
			for (const systems of this.systems.values()) systems.length = 0
			this.systemIds.clear()
		}
		this.mutate(clearSystems)
	}

	private mutate(mutation: PendingMutation) {
		if (this.updating) this.pendingMutations.push(mutation)
		else mutation()
	}

	private flushMutations() {
		if (this.pendingMutations.length === 0) return
		const mutations = this.pendingMutations
		this.pendingMutations = []
		for (const mutation of mutations) mutation()
	}

	private flushCleanup() {
		if (this.cleanupTasks.length === 0) return
		const tasks = this.cleanupTasks
		this.cleanupTasks = []
		for (const task of tasks) task()
	}
}

function compareSystems(a: RunLoopSystem, b: RunLoopSystem) {
	return (a.priority ?? 0) - (b.priority ?? 0) || a.id.localeCompare(b.id)
}

export const runLoop = new RunLoop()

