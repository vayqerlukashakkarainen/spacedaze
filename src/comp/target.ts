import { Comp, GameObj, PosComp, Vec2 } from "kaplay";
import { k } from "../main";
import { pickUnitInDistance } from "../game";

export interface TargetComp extends Comp {
	lockedTarget: GameObj<PosComp> | null;
	pickTarget: (pos: Vec2, dist: number, tag: string) => boolean;
	targetAngle: () => number;
	hasTarget: () => boolean;
}

export function target(): TargetComp {
	return {
		lockedTarget: null,
		id: "target",
		require: ["pos"],

		pickTarget(pos: Vec2, dist: number, tag: string) {
			if (this.lockedTarget) return true;
			return pickUnitInDistance(pos, dist, tag, (u) => {
				this.lockedTarget = u;

				this.lockedTarget.onDestroy(() => {
					this.lockedTarget = null;
				});
			});
		},
		hasTarget() {
			return this.lockedTarget;
		},
		targetAngle() {
			if (!this.lockedTarget) return this.angle;

			return this.lockedTarget.pos.angle(this.pos);
		},
	};
}
