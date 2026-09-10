import { runtimeDebug } from "../debug/runtimeDebugService"

const TRACE_LIMIT = 160

export interface PrologueTraceEntry {
	time: string
	event: string
	details?: Record<string, unknown>
}

const entries: PrologueTraceEntry[] = []

export function clearPrologueTrace() {
	entries.length = 0
}

export function tracePrologue(
	event: string,
	details?: Record<string, unknown>
) {
	const entry: PrologueTraceEntry = {
		time: new Date().toISOString().slice(11, 23),
		event,
		details,
	}
	entries.push(entry)
	if (entries.length > TRACE_LIMIT) entries.shift()
	runtimeDebug.log("prologue", event, details)
}

export function formatPrologueTrace() {
	if (entries.length === 0) return "No prologue recovery events recorded"
	return entries.map((entry) => {
		const details = entry.details
			? ` ${JSON.stringify(entry.details)}`
			: ""
		return `${entry.time} ${entry.event}${details}`
	}).join("\n")
}
