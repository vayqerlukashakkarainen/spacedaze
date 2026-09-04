import { Vec2 } from "kaplay";
import { k, layers } from "../main";
import { tags } from "../tags";
import { registerBatchedEntityUpdate } from "../services/entityUpdateService";

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
		k.layer(layers.gameEffects),
		k.animate(),
		{
			opacity: 0.15,
			spawned: 0,
			maxSpawn: props.maxSpawns,
		},
		tags.enemy,
		tags.gameLoop,
	]);

	registerBatchedEntityUpdate("enemies", m, () => {
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
