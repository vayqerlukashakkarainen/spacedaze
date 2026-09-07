export interface FinaleEvent {
	timeStamp: number
	duration?: number
	begin?: (elapsedMilliseconds: number) => void
	upd: (eventElapsedMilliseconds: number) => void
}

export interface FinaleDefinition {
	id: string
	song: {
		music: string
		title: string
		author: string
		albumCover: string
		bpm: number
	}
	fallbackDurationSeconds: number
	durationSeconds?: () => number | undefined
	isComplete?: () => boolean
	objective?: () => string
	events: FinaleEvent[]
	start?: () => void
	reset: () => void
}

export type RunPhase = "exploration" | "transition" | "finale" | "exitReady"
