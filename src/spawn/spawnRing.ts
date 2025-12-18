import { GameObj, PosComp, Vec2 } from "kaplay";
import { dt, k } from "../main";
import { tags } from "../tags";

interface Props {
	pos: Vec2;
	speed: number;
	intensity: number;
	maxRadius?: number;
	visualize?: boolean;
}

export function spawnRing(props: Props) {
	const visualize = props.visualize !== undefined ? props.visualize : true;
	const maxRadius = props.maxRadius || 500;

	// Track which objects are currently affected
	const affectedObjects = new Map<number, number>();

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
			k.outline(3, k.Color.WHITE),
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
				k.outline(3, k.Color.WHITE),
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
			include: ["timescale"],
		}) as GameObj<PosComp>[];

		// Effect radius (how far from ring edge the effect reaches)
		const effectRadius = 20 + ring.intensity * 30;

		for (const obj of objects) {
			if (!obj.exists() || !obj.pos) continue;

			const dist = obj.pos.dist(ring.pos);
			const distToRing = Math.abs(dist - ring.radius);
			const objId = obj.id!;

			if (distToRing < effectRadius) {
				// Object is near the ring - apply or update shader
				const currentEffect = affectedObjects.get(objId) || 0;
				affectedObjects.set(objId, currentEffect + dt());

				try {
					// Apply shader with ring-specific parameters
					obj.use(
						k.shader("ringDistortion", () => ({
							u_time: k.time(),
							u_intensity: ring.intensity,
							u_ringCenter: ring.pos,
							u_ringRadius: ring.radius,
						}))
					);
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
		// Remove shader from all affected objects
		const objects = k.query({
			include: ["sprite", "pos"],
		}) as GameObj<PosComp>[];

		for (const obj of objects) {
			if (!obj.exists()) continue;
			const objId = obj.id!;

			if (affectedObjects.has(objId)) {
				try {
					obj.unuse("shader");
				} catch (e) {
					// Shader wasn't present
				}
			}
		}

		affectedObjects.clear();
	});

	return ring;
}
