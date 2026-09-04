import { Color, GameObj, PosComp, Vec2 } from "kaplay";
import { dt, k, layers } from "../main";
import { registerBatchedEntityUpdate } from "../services/entityUpdateService";
import { forEachSpatialNearby } from "../services/runtimeSpatialIndexService";
import { tags } from "../tags";

interface Props {
	pos: Vec2;
	speed: number;
	intensity: number;
	maxRadius?: number;
	visualize?: boolean;
	color?: Color;
	effectWidth?: number;
	outlineWidth?: number;
	visualOpacity?: number;
	shader?: "ringDistortion" | "arrivalShockwave";
	affectAllSprites?: boolean;
	excludeIds?: readonly number[];
}

export function spawnRing(props: Props) {
	const visualize = props.visualize !== undefined ? props.visualize : true;
	const maxRadius = props.maxRadius || 500;
	const color = props.color ?? k.WHITE;
	const visualOpacity = props.visualOpacity ?? 0.6;
	const outlineWidth = props.outlineWidth ?? 3;
	const shader = props.shader ?? "ringDistortion";
	const excludedIds = new Set(props.excludeIds ?? []);
	const affectedObjects = new Map<number, GameObj<PosComp>>();
	const ring = k.add([
		k.pos(props.pos),
		k.anchor("center"),
		k.opacity(visualize ? visualOpacity : 0),
		{
			radius: 0,
			speed: props.speed,
			intensity: props.intensity,
			maxRadius,
		},
		tags.props,
		tags.gameLoop,
	]);

	let visualCircle: GameObj | null = null;
	if (visualize) {
		visualCircle = ring.add([
			k.circle(ring.radius, { fill: false }),
			k.outline(outlineWidth, color),
			k.anchor("center"),
			k.layer(layers.gameEffects),
		]);
	}

	registerBatchedEntityUpdate("effects", ring, () => {
		ring.radius += ring.speed * dt();
		if (visualCircle) {
			k.destroy(visualCircle);
			visualCircle = ring.add([
				k.circle(ring.radius, { fill: false }),
				k.outline(outlineWidth, color),
				k.anchor("center"),
				k.layer(layers.gameEffects),
			]);
		}
		if (ring.radius >= ring.maxRadius) {
			k.destroy(ring);
			return;
		}

		const effectRadius = props.effectWidth ?? 20 + ring.intensity * 30;
		const currentlyAffected = new Set<number>();
		forEachSpatialNearby(ring.pos, ring.radius + effectRadius, {}, (obj) => {
			if (excludedIds.has(obj.id)) return;
			if (props.affectAllSprites && !obj.has("sprite")) return;
			if (!props.affectAllSprites && (!obj.has("timescale") || !obj.has("sprite"))) return;
			const distanceToRing = Math.abs(obj.pos.dist(ring.pos) - ring.radius);
			if (distanceToRing >= effectRadius) return;
			currentlyAffected.add(obj.id);
			if (affectedObjects.has(obj.id)) return;
			// Do not erase bespoke shaders owned by world objects.
			if (obj.has("shader")) return;
			try {
				obj.use(
					k.shader(shader, () => ({
						u_time: k.time(),
						u_intensity: getRingDistortionStrength(
							ring,
							obj,
							effectRadius
						),
					}))
				);
				affectedObjects.set(obj.id, obj);
			} catch (e) {
				// Shader already applied or object does not support shaders.
			}
		});

		for (const [objId, obj] of affectedObjects) {
			if (obj.exists() && currentlyAffected.has(objId)) continue;
			affectedObjects.delete(objId);
			if (obj.exists()) removeRingShader(obj);
		}

		if (visualize) {
			ring.opacity = k.lerp(visualOpacity, 0, ring.radius / ring.maxRadius);
		}
	});

	ring.onDestroy(() => {
		for (const obj of affectedObjects.values()) {
			if (obj.exists()) removeRingShader(obj);
		}
		affectedObjects.clear();
	});

	return ring;
}

function removeRingShader(obj: GameObj<PosComp>) {
	try {
		obj.unuse("shader");
	} catch (e) {
		// Shader was not present.
	}
}

function getRingDistortionStrength(
	ring: GameObj<PosComp | any>,
	obj: GameObj<PosComp>,
	effectRadius: number
) {
	if (!ring.exists() || !obj.exists()) return 0;
	const radiusProgress = k.clamp(ring.radius / ring.maxRadius, 0, 1);
	const distanceToRing = Math.abs(obj.pos.dist(ring.pos) - ring.radius);
	const proximity = 1 - k.clamp(distanceToRing / effectRadius, 0, 1);
	return ring.intensity * proximity * (1 - radiusProgress);
}
