import { Comp } from "kaplay";

export interface TimescaleComp extends Comp {
	timescale: number;
	timescaleModifiers: Map<number, number>;
	runtimeUpdateScale?: number;
	setTimescale: (value: number) => void;
	getTimescale: () => number;
}

export function timescale(): TimescaleComp {
	const modifiers = new Map<number, number>();
	return {
		timescale: 1,
		timescaleModifiers: modifiers,
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
				Array.from(modifiers.values()).reduce((product, value) => product * value, 1) *
				(this.runtimeUpdateScale ?? 1)
			);
		},
	};
}
