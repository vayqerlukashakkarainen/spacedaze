export type HubPuzzleStampId =
	| "hub-live-circuit"
	| "hub-cargo-press"

export type HubPuzzleStampPurpose =
	| "puzzle"
	| "physics"
	| "traversal"

export type HubStampPoint = readonly [number, number]

export interface HubPuzzleStampPlacement {
	stampId: HubPuzzleStampId
	offset: HubStampPoint
	rotation: number
}

interface HubPuzzleStampBase {
	id: HubPuzzleStampId
	title: string
	purposes: readonly HubPuzzleStampPurpose[]
	minimumHubLevel: number
	bounds: {
		width: number
		height: number
	}
	headerOffset: HubStampPoint
	rewardOffset: HubStampPoint
}

export interface HubCircuitConductorStampElement {
	id: string
	offset: HubStampPoint
	sprite: string
	angle: number
	scale: number
	radius: number
	mass: number
}

export interface HubLiveCircuitStampDefinition extends HubPuzzleStampBase {
	type: "live-circuit"
	sourceCoilOffset: HubStampPoint
	targetCoilOffset: HubStampPoint
	linkDistance: number
	conductors: readonly HubCircuitConductorStampElement[]
}

export interface HubCargoObstacleStampElement {
	id: string
	offset: HubStampPoint
	sprite: string
	radius: number
	angle: number
	scale: number
	shade: number
}

export interface HubCargoPressStampDefinition extends HubPuzzleStampBase {
	type: "cargo-press"
	crate: {
		offset: HubStampPoint
		sprite: string
		angle: number
		scale: number
		radius: number
		mass: number
	}
	plate: {
		offset: HubStampPoint
		radius: number
		captureRadius: number
		captureSpeed: number
	}
	obstacles: readonly HubCargoObstacleStampElement[]
}

export type HubPuzzleStampDefinition =
	| HubLiveCircuitStampDefinition
	| HubCargoPressStampDefinition
