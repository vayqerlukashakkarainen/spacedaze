import { Comp } from "kaplay";
import { k } from "../main";

export interface JitterComp extends Comp {
	jitterValue: number;
	jitter: (value: number) => void;
}

export function jitter(): JitterComp {
	return {
		jitterValue: 0,
		id: "jitter",
		require: ["pos"],
		update() {
			if (this.jitterValue > 0) {
				const strength = this.jitterValue * 8;
				var toJitter = k.rand(
					k.vec2(-strength, -strength),
					k.vec2(strength, strength)
				);
				this.move(toJitter);
				this.jitterValue -= k.dt() * 100;
			}
		},
		jitter(value: number) {
			this.jitterValue = value;
		},
	};
}
