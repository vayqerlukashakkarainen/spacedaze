import { GameObj, PosComp, Vec2 } from "kaplay";
import { TimescaleComp } from "../comp/timescale";
import { dt, k, layers } from "../main";
import { registerBatchedEntityUpdate } from "../services/entityUpdateService";
import { forEachSpatialNearby } from "../services/runtimeSpatialIndexService";
import { tags } from "../tags";
import { spawnRing } from "./spawnRing";

interface Props {
	pos: Vec2;
	radius: number;
	timescaleValue: number;
	duration?: number;
	visualize?: boolean;
	tags?: string[];
}

export function spawnTimescaleZone(props: Props) {
	const visualize = props.visualize !== undefined ? props.visualize : true;
	const affectedObjects = new Map<number, GameObj<TimescaleComp & PosComp>>();
	const zone = k.add([
		k.pos(props.pos),
		k.anchor("center"),
		k.opacity(visualize ? 0.2 : 0),
		k.z(0),
		{
			radius: props.radius,
			timescaleValue: props.timescaleValue,
			lifetime: 0,
		},
		tags.props,
		tags.gameLoop,
		...(props.tags ?? []),
	]);

	spawnRing({
		pos: props.pos,
		speed: 100,
		intensity: 0.1,
		maxRadius: props.radius * 1.5,
		visualize: true,
	});

	if (visualize) {
		zone.add([
			k.circle(props.radius, { fill: false }),
			k.outline(2, k.Color.WHITE),
			k.anchor("center"),
			k.layer(layers.gameEffects),
		]);
	}

	registerBatchedEntityUpdate("world", zone, () => {
		zone.lifetime += dt();
		if (props.duration !== undefined && zone.lifetime >= props.duration) {
			k.destroy(zone);
			return;
		}

		const currentlyInRange = new Set<number>();
		forEachSpatialNearby(zone.pos, zone.radius, {
			allTags: ["timescale"],
		}, (candidate) => {
			const obj = candidate as GameObj<TimescaleComp & PosComp>;
			const objId = obj.id!;
			currentlyInRange.add(objId);
			if (affectedObjects.has(objId)) return;
			affectedObjects.set(objId, obj);
			obj.timescaleModifiers.set(zone.id!, zone.timescaleValue);
			try {
				obj.use(
					k.shader("timescaleJitter", () => ({
						u_time: k.time(),
						u_intensity: 1.0 - zone.timescaleValue,
					}))
				);
			} catch (e) {
				// Shader already applied or object does not support shaders.
			}
		});

		for (const [objId, obj] of affectedObjects) {
			if (obj.exists() && currentlyInRange.has(objId)) continue;
			affectedObjects.delete(objId);
			if (obj.exists()) removeTimescaleEffect(zone.id!, obj);
		}

		if (visualize) zone.opacity = k.wave(0.1, 0.3, k.time() * 2);
	});

	zone.onDestroy(() => {
		for (const obj of affectedObjects.values()) {
			if (obj.exists()) removeTimescaleEffect(zone.id!, obj);
		}
		affectedObjects.clear();
	});

	return zone;
}

function removeTimescaleEffect(
	zoneId: number,
	obj: GameObj<TimescaleComp & PosComp>
) {
	obj.timescaleModifiers.delete(zoneId);
	try {
		obj.unuse("shader");
	} catch (e) {
		// Shader was not present.
	}
}
