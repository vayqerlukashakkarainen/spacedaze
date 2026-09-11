export const PROJECTILE_VISUALS = {
	player: { worldScale: 0.7 },
	enemy: { worldScale: 1, minimumSize: 8 },
} as const

export function getMinimumProjectileVisualScale(
	baseScale: number,
	spriteWidth: number,
	spriteHeight: number,
	lengthScale: number = 1,
	pulseAmplitude: number = 0,
	minimumSize: number = PROJECTILE_VISUALS.enemy.minimumSize
) {
	if (spriteWidth <= 0 || spriteHeight <= 0) return baseScale
	const minimumPulseScale = Math.max(0.01, 1 - Math.abs(pulseAmplitude))
	const shortestAxis = Math.min(
		spriteWidth * baseScale * minimumPulseScale,
		spriteHeight * baseScale * lengthScale * minimumPulseScale
	)
	if (shortestAxis >= minimumSize) return baseScale
	return baseScale * minimumSize / shortestAxis
}
