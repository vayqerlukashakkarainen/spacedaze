export const THRUSTER_OVERDRIVE_DURATION_SECONDS = 3
export const THRUSTER_OVERDRIVE_RECHARGE_SECONDS = 3.5

export interface ThrusterOverdriveState {
	charge: number
	overused: boolean
}

export interface ThrusterOverdriveUpdate {
	active: boolean
	charge: number
	overused: boolean
}

export function createThrusterOverdriveState(): ThrusterOverdriveState {
	return {
		charge: 1,
		overused: false,
	}
}

export function updateThrusterOverdrive(
	state: ThrusterOverdriveState,
	requested: boolean,
	deltaSeconds: number,
	recoveryMultiplier = 1
): ThrusterOverdriveUpdate {
	const delta = validPositive(deltaSeconds)
	const recovery = validPositive(recoveryMultiplier)
	const active = requested && !state.overused && state.charge > 0

	if (active) {
		state.charge = Math.max(
			0,
			state.charge - delta / THRUSTER_OVERDRIVE_DURATION_SECONDS
		)
		if (state.charge === 0) state.overused = true
	} else {
		state.charge = Math.min(
			1,
			state.charge +
				delta * recovery / THRUSTER_OVERDRIVE_RECHARGE_SECONDS
		)
		if (state.overused && state.charge === 1) state.overused = false
	}

	return {
		active,
		charge: state.charge,
		overused: state.overused,
	}
}

function validPositive(value: number) {
	return Number.isFinite(value) && value > 0 ? value : 0
}
