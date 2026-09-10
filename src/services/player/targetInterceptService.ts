const DEFAULT_MAX_INTERCEPT_TIME = 0.75

export function calculateInterceptTime(
	relativePosition: { x: number; y: number },
	targetVelocity: { x: number; y: number },
	projectileSpeed: number,
	maxInterceptTime: number = DEFAULT_MAX_INTERCEPT_TIME
) {
	if (projectileSpeed <= 0) return 0
	const speedSquared = projectileSpeed * projectileSpeed
	const velocitySquared =
		targetVelocity.x * targetVelocity.x +
		targetVelocity.y * targetVelocity.y
	const a = velocitySquared - speedSquared
	const b = 2 * (
		relativePosition.x * targetVelocity.x +
		relativePosition.y * targetVelocity.y
	)
	const c =
		relativePosition.x * relativePosition.x +
		relativePosition.y * relativePosition.y
	let interceptTime: number | undefined

	if (Math.abs(a) < 0.0001) {
		if (Math.abs(b) > 0.0001) {
			const linearTime = -c / b
			if (linearTime > 0) interceptTime = linearTime
		}
	} else {
		const discriminant = b * b - 4 * a * c
		if (discriminant >= 0) {
			const root = Math.sqrt(discriminant)
			const firstTime = (-b - root) / (2 * a)
			const secondTime = (-b + root) / (2 * a)
			const positiveTimes = [firstTime, secondTime]
				.filter((time) => time > 0)
			interceptTime = positiveTimes.length > 0
				? Math.min(...positiveTimes)
				: undefined
		}
	}

	if (interceptTime === undefined) {
		interceptTime = Math.sqrt(c) / projectileSpeed
	}
	return Math.min(maxInterceptTime, Math.max(0, interceptTime))
}
