export type RuntimeDebugCategory =
	| "audio"
	| "boss"
	| "combat"
	| "command"
	| "cutscene"
	| "dialogue"
	| "error"
	| "game"
	| "input"
	| "level"
	| "prologue"
	| "run"

interface RuntimeDebugEntry {
	timestamp: string
	elapsedMs: number
	category: RuntimeDebugCategory
	event: string
	details?: Record<string, unknown>
}

const DEBUG_STORAGE_KEY = "spacedaze_runtime_debug"
const DEBUG_ENDPOINT = "/__spacedaze-debug"
const ENTRY_LIMIT = 1000
const FLUSH_DELAY_MS = 120
const entries: RuntimeDebugEntry[] = []
let pending: RuntimeDebugEntry[] = []
let flushTimer: ReturnType<typeof setTimeout> | undefined
let startedAt = typeof performance !== "undefined" ? performance.now() : 0
let enabled = loadInitialState()

export const runtimeDebug = {
	log(
		category: RuntimeDebugCategory,
		event: string,
		details?: Record<string, unknown>
	) {
		if (!enabled) return
		const now = typeof performance !== "undefined" ? performance.now() : 0
		const entry: RuntimeDebugEntry = {
			timestamp: new Date().toISOString(),
			elapsedMs: Math.round(now - startedAt),
			category,
			event,
			details,
		}
		entries.push(entry)
		if (entries.length > ENTRY_LIMIT) entries.shift()
		pending.push(entry)
		console.info(formatEntry(entry))
		scheduleFlush()
	},

	setEnabled(nextEnabled: boolean) {
		enabled = nextEnabled
		if (typeof localStorage !== "undefined") {
			localStorage.setItem(DEBUG_STORAGE_KEY, nextEnabled ? "1" : "0")
		}
		if (!nextEnabled) {
			flushPending()
			return
		}
		startedAt = typeof performance !== "undefined" ? performance.now() : 0
		runtimeDebug.log("game", "debug:enabled")
	},

	isEnabled() {
		return enabled
	},

	clear() {
		entries.length = 0
		pending.length = 0
		if (isDevelopment()) {
			void fetch(DEBUG_ENDPOINT, { method: "DELETE" })
		}
	},

	format(category?: RuntimeDebugCategory) {
		const selected = category
			? entries.filter((entry) => entry.category === category)
			: entries
		if (selected.length === 0) return "No runtime debug events recorded"
		return selected.map(formatEntry).join("\n")
	},
}

function scheduleFlush() {
	if (!isDevelopment() || flushTimer) return
	flushTimer = setTimeout(flushPending, FLUSH_DELAY_MS)
}

function flushPending() {
	if (flushTimer) clearTimeout(flushTimer)
	flushTimer = undefined
	if (!isDevelopment() || pending.length === 0) return
	const batch = pending
	pending = []
	void fetch(DEBUG_ENDPOINT, {
		method: "POST",
		headers: { "content-type": "application/x-ndjson" },
		body: batch.map((entry) => JSON.stringify(entry)).join("\n"),
	}).catch(() => {
		pending.unshift(...batch)
	})
}

function formatEntry(entry: RuntimeDebugEntry) {
	const details = entry.details ? ` ${JSON.stringify(entry.details)}` : ""
	return `[${entry.elapsedMs.toString().padStart(6, "0")}ms] ` +
		`${entry.category.toUpperCase()} ${entry.event}${details}`
}

function loadInitialState() {
	if (typeof window === "undefined") return false
	const params = new URLSearchParams(window.location.search)
	if (params.get("debug") === "1") return true
	return localStorage.getItem(DEBUG_STORAGE_KEY) === "1"
}

function isDevelopment() {
	return import.meta.env.DEV
}

if (typeof window !== "undefined") {
	window.addEventListener("error", (event) => {
		runtimeDebug.log("error", "window:error", {
			message: event.message,
			filename: event.filename,
			line: event.lineno,
			column: event.colno,
		})
	})
	window.addEventListener("unhandledrejection", (event) => {
		const reason = event.reason
		runtimeDebug.log("error", "promise:unhandled-rejection", {
			message: reason instanceof Error ? reason.message : String(reason),
			stack: reason instanceof Error ? reason.stack : undefined,
		})
	})
}
