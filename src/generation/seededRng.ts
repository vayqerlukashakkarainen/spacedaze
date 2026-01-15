/**
 * Seeded pseudo-random number generator using Linear Congruential Generator (LCG)
 * Ensures deterministic generation from seed
 */
export class SeededRNG {
	private state: number;

	constructor(seed: number) {
		// Ensure seed is positive 32-bit integer
		this.state = Math.abs(seed) % 2147483647;
		if (this.state === 0) this.state = 1;
	}

	/**
	 * Generate next random float [0, 1)
	 */
	nextFloat(): number {
		// LCG parameters from Numerical Recipes
		this.state = (this.state * 48271) % 2147483647;
		return (this.state - 1) / 2147483646;
	}

	/**
	 * Generate random integer [min, max)
	 */
	nextInt(min: number, max: number): number {
		return Math.floor(this.nextFloat() * (max - min)) + min;
	}

	/**
	 * Generate random boolean with threshold
	 */
	nextBool(threshold: number = 0.5): boolean {
		return this.nextFloat() < threshold;
	}

	/**
	 * Shuffle array in-place (Fisher-Yates)
	 */
	shuffle<T>(array: T[]): T[] {
		for (let i = array.length - 1; i > 0; i--) {
			const j = this.nextInt(0, i + 1);
			[array[i], array[j]] = [array[j], array[i]];
		}
		return array;
	}

	/**
	 * Pick random element from array
	 */
	choice<T>(array: T[]): T {
		return array[this.nextInt(0, array.length)];
	}
}
