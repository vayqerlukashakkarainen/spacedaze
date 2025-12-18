import { Comp } from "kaplay";
import { k } from "../main";

export interface MassComp extends Comp {
	mass: number;
	velocity: { x: number; y: number };
}

export function mass(value: number): MassComp {
	return {
		mass: value,
		velocity: { x: 0, y: 0 },
		id: "mass",
		require: ["pos"],
		add() {
			this.tag("mass");
		},
	};
}
