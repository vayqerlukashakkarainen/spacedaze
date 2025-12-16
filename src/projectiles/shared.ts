import { Vec2 } from "kaplay";
import { chance } from "../powerups";
import { spawnFlash } from "../spawn/spawnFlash";
import { k, mainSoundVolume } from "../main";
import { audioService } from "../services/audioService";

export function getDmg(
	critChance: number,
	dmg: number,
	critMultiplier: number,
	pos: Vec2
) {
	if (chance(critChance, 100)) {
		spawnFlash(pos, critMultiplier);

		audioService.playSound("hit1", { volume: mainSoundVolume });
		return dmg * critMultiplier;
	}

	return dmg;
}
