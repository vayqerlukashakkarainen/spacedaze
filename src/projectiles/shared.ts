import { chance } from "../powerups";

export interface CriticalDamageResult {
	damage: number;
	critical: boolean;
}

export function resolveCriticalDamage(
	critChance: number,
	dmg: number,
	critMultiplier: number
): CriticalDamageResult {
	const normalizedChance = Math.max(0, Math.min(100, critChance));
	const normalizedMultiplier = Math.max(1, critMultiplier);
	const critical = chance(normalizedChance, 100);
	return {
		damage: critical ? dmg * normalizedMultiplier : dmg,
		critical,
	};
}
