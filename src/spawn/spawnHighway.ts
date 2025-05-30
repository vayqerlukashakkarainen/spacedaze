import { Vec2 } from "kaplay";
import { k, timeSeconds } from "../main";
import { tags } from "../tags";
import { spawnGenericVehicle } from "./spawnGenericVehicle";

interface Props {
	spawnChance: number;
	startPos: Vec2;
	endPos: Vec2;
	destroyAfterKills: number;
}

export function spawnHighway(props: Props) {
	const m = k.add([
		k.animate(),
		{
			startPos: props.startPos,
			endPos: props.endPos,
			opacity: 0.15,
			killed: 0,
		},
		tags.enemy,
	]);

	m.onUpdate(() => {
		if (Math.floor(k.rand(0, props.spawnChance)) == 1) {
			const offset = smallOffset(6);
			spawnGenericVehicle(
				m,
				m.startPos.add(offset),
				m.endPos.add(offset).sub(m.startPos).unit(),
				4,
				randomVehicle()
			);
		}

		m.opacity = k.wave(0.1, 0.2, k.time());

		if (m.killed >= props.destroyAfterKills) {
			m.destroy();
		}
	});

	m.onDraw(() => {
		k.drawLines({
			pts: [m.startPos, m.endPos],
			width: 40,
			opacity: m.opacity,
		});
	});
}

const sprites = ["enemy_ship1", "bike1"];
function randomVehicle() {
	return sprites[Math.floor(k.rand(0, sprites.length))];
}

function smallOffset(offset) {
	return k.rand(k.vec2(-offset, -offset), k.vec2(offset, offset));
}
