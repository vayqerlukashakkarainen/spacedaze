import { Color, GameObj, PosComp, Vec2 } from "kaplay";
import { dt, k } from "../main";
import { tags } from "../tags";

interface Props {
	pos: Vec2;
	speed: number;
	intensity: number;
	maxRadius?: number;
	visualize?: boolean;
	color?: Color;
}

export function spawnRing(props: Props) {
	const visualize = props.visualize !== undefined ? props.visualize : true;
	const maxRadius = props.maxRadius || 500;
	const color = props.color ?? k.WHITE;

	// Track which objects are currently affected
	const affectedObjects = new Map<number, GameObj<PosComp>>();

	const ring = k.add([
		k.pos(props.pos),
		k.anchor("center"),
		k.opacity(visualize ? 0.6 : 0),
		{
			radius: 0,
			speed: props.speed,
			intensity: props.intensity,
			maxRadius: maxRadius,
		},
		tags.props,
		tags.gameLoop,
	]);

	// Create visual ring outline
	let visualCircle: GameObj | null = null;
	if (visualize) {
		visualCircle = ring.add([
			k.circle(ring.radius, { fill: false }),
			k.outline(3, color),
			k.anchor("center"),
		]);
	}

	ring.onUpdate(() => {
		// Expand ring
		ring.radius += ring.speed * dt();

		// Update visual circle
		if (visualCircle) {
			k.destroy(visualCircle);
			visualCircle = ring.add([
				k.circle(ring.radius, { fill: false }),
				k.outline(3, color),
				k.anchor("center"),
			]);
		}

		// Destroy when max radius reached
		if (ring.radius >= ring.maxRadius) {
			k.destroy(ring);
			return;
		}

		// Get all objects with sprites that can have shaders
		const objects = k.query({
			include: ["timescale", "sprite"],
			includeOp: "and",
		}) as GameObj<PosComp>[];

		// Effect radius (how far from ring edge the effect reaches)
		const effectRadius = 20 + ring.intensity * 30;

		for (const obj of objects) {
			if (!obj.exists() || !obj.pos) continue;

			const dist = obj.pos.dist(ring.pos);
			const distToRing = Math.abs(dist - ring.radius);
			const objId = obj.id!;

			if (distToRing < effectRadius) {
				if (affectedObjects.has(objId)) continue;

				try {
					obj.use(
						k.shader("ringDistortion", () => ({
							u_time: k.time(),
							u_intensity: getRingDistortionStrength(
								ring,
								obj,
								effectRadius
							),
						}))
					);
					affectedObjects.set(objId, obj);
				} catch (e) {
					// Shader already applied or object doesn't support shaders
				}
			} else if (affectedObjects.has(objId)) {
				// Object is no longer near ring - remove effect
				affectedObjects.delete(objId);

				try {
					obj.unuse("shader");
				} catch (e) {
					// Shader wasn't present
				}
			}
		}

		// Fade out visual as ring expands
		if (visualize) {
			ring.opacity = k.lerp(0.6, 0, ring.radius / ring.maxRadius);
		}
	});

	ring.onDestroy(() => {
		for (const obj of affectedObjects.values()) {
			if (!obj.exists()) continue;
			try {
				obj.unuse("shader");
			} catch (e) {
				// Shader wasn't present
			}
		}

		affectedObjects.clear();
	});

	return ring;
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
