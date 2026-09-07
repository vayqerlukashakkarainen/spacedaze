import { k } from "../main"

export function getReddishBackgroundTint(shade: number) {
	return k.rgb(
		Math.round(shade * 1.18),
		Math.round(shade * 0.82),
		Math.round(shade * 0.76)
	)
}
