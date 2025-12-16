import { Comp } from "kaplay";

export interface TimescaleComp extends Comp {
	timescale: number;
	timescaleModifier: number;
	setTimescale: (value: number) => void;
}

export function timescale(): TimescaleComp {
	return {
		timescale: 1,
		timescaleModifier: 1,
		id: "timescale",
		require: ["pos"],
		setTimescale(value: number) {
			this.timescale = value;
		},
	};
}
