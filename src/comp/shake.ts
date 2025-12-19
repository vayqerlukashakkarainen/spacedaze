import { Comp, Vec2 } from "kaplay";
import { dt } from "../main";

export interface ShakeComp extends Comp {
	shake: (strength: number) => void;
}

export function shake(): ShakeComp {
	let shakeStrength = 0;
	let shakeDuration = 0;
	let shakeElapsed = 0;
	let shakeOffset = { x: 0, y: 0 };

	return {
		id: "shake",
		require: ["pos"],
		shake(strength: number) {
			shakeStrength = strength;
			shakeDuration = strength * 0.1; // Duration based on strength (e.g., 10 strength = 1 second)
			shakeElapsed = 0;
		},
		update() {
			// Remove previous shake offset
			this.pos.x -= shakeOffset.x;
			this.pos.y -= shakeOffset.y;
			shakeOffset.x = 0;
			shakeOffset.y = 0;

			if (shakeStrength > 0) {
				shakeElapsed += dt();

				// Calculate falloff using ease-out (strength decreases over time)
				const progress = Math.min(shakeElapsed / shakeDuration, 1);
				const currentStrength = shakeStrength * (1 - progress);

				// Calculate random offset based on current strength
				shakeOffset.x = (Math.random() - 0.5) * currentStrength * 2;
				shakeOffset.y = (Math.random() - 0.5) * currentStrength * 2;

				// Apply shake offset to current position
				this.pos.x += shakeOffset.x;
				this.pos.y += shakeOffset.y;

				// Reset when shake is done
				if (progress >= 1) {
					shakeStrength = 0;
				}
			}
		},
	};
}
