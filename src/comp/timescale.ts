import { Comp } from "kaplay";

export interface TimescaleComp extends Comp {
	timescale: number;
	timescaleModifiers: Map<number, number>;
	setTimescale: (value: number) => void;
	getTimescale: () => number;
}

export function timescale(): TimescaleComp {
	return {
		timescale: 1,
		timescaleModifiers: new Map(),
		id: "timescale",
		require: ["pos"],
		setTimescale(value: number) {
			this.timescale = value;
		},
		add() {
			this.tag("timescale");
		},
		getTimescale() {
			return (
				this.timescale *
				Array.from(this.timescaleModifiers.values()).reduce((a, b) => a * b, 1)
			);
		},
	};
}
