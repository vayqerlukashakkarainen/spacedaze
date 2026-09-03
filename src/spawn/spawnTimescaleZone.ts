import { GameObj, PosComp, Vec2 } from "kaplay";
import { TimescaleComp } from "../comp/timescale";
import { dt, k } from "../main";
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

	// Track which objects are currently affected by this zone
	const affectedObjects = new Set<number>();

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

	// Spawn visual ring effect when zone is created
	spawnRing({
		pos: props.pos,
		speed: 100,
		intensity: 0.1,
		maxRadius: props.radius * 1.5,
		visualize: true,
	});

	// Create visual circle outline
	if (visualize) {
		zone.add([
			k.circle(props.radius, { fill: false }),
			k.outline(2, k.Color.WHITE),
			k.anchor("center"),
		]);
	}

	zone.onUpdate(() => {
		zone.lifetime += dt();

		// Destroy zone after duration if specified
		if (props.duration !== undefined && zone.lifetime >= props.duration) {
			k.destroy(zone);
			return;
		}

		// Get all objects with timescale component
		const objects = k.query({
			include: "timescale",
		}) as GameObj<TimescaleComp & PosComp>[];

		// Track objects currently in range
		const currentlyInRange = new Set<number>();

		for (const obj of objects) {
			if (!obj.exists() || !obj.pos) continue;

			const dist = obj.pos.dist(zone.pos);
			const objId = obj.id!;

			if (dist <= zone.radius) {
				// Object is inside the zone
				currentlyInRange.add(objId);

				if (!affectedObjects.has(objId)) {
					// Object just entered the zone
					affectedObjects.add(objId);
					obj.timescaleModifiers.set(zone.id!, zone.timescaleValue);

					// Apply shader effect
					try {
						obj.use(
							k.shader("timescaleJitter", () => ({
								u_time: k.time(),
								u_intensity: 1.0 - zone.timescaleValue, // More intense for slower zones
							}))
						);
					} catch (e) {
						// Shader already applied or object doesn't support shaders
					}
				}
			} else if (affectedObjects.has(objId)) {
				// Object just left the zone
				affectedObjects.delete(objId);
				obj.timescaleModifiers.delete(zone.id!);

				// Remove shader effect
				try {
					obj.unuse("shader");
				} catch (e) {
					// Shader wasn't present
				}
			}
		}

		// Optional: Add pulsing animation to visualize zone
		if (visualize) {
			zone.opacity = k.wave(0.1, 0.3, k.time() * 2);
		}
	});

	zone.onDestroy(() => {
		// Restore timescale for all affected objects when zone is destroyed
		const objects = k.query({
			include: "timescale",
		}) as GameObj<TimescaleComp & PosComp>[];

		for (const obj of objects) {
			if (!obj.exists()) continue;
			const objId = obj.id!;

			if (affectedObjects.has(objId)) {
				obj.timescaleModifiers.delete(zone.id!);

				// Remove shader effect
				try {
					obj.unuse("shader");
				} catch (e) {
					// Shader wasn't present
				}
			}
		}

		affectedObjects.clear();
	});

	return zone;
}
