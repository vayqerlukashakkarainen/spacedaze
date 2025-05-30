import { Vec2 } from "kaplay";
import { k } from "../main";
import { tags } from "../tags";

interface Props {
	spawnChance: number;
	pos: Vec2;
	maxSpawns: number;
	onSpawn: (pos: Vec2) => void;
}

export function spawnSpawner(props: Props) {
	const m = k.add([
		k.pos(props.pos),
		k.anchor("center"),
		k.circle(12),
		k.animate(),
		{
			opacity: 0.15,
			spawned: 0,
			maxSpawn: props.maxSpawns,
		},
		tags.enemy,
	]);

	m.onUpdate(() => {
		if (Math.floor(k.rand(0, props.spawnChance)) == 1) {
			props.onSpawn(m.pos);
			m.spawned++;
		}

		if (m.spawned >= m.maxSpawn) {
			m.destroy();
		}

		m.opacity = k.wave(0.03, 0.4, k.time() * 3);
	});
}
