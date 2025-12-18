import type { Color, Vec2 } from "kaplay";
import { k } from "../main";
import { tags } from "../tags";

interface Props {
	pos1: Vec2;
	pos2: Vec2;
	decayTime: number;
	color: Color;
	opacity: number;
	size: number;
	distortion?: number;
}

export function spawnLink(props: Props) {
	const distortion = props.distortion ?? 0;

	// Calculate number of segments based on distortion
	// More distortion = more jagged segments
	const segmentCount = Math.max(2, Math.floor(2 + distortion * 8));

	// Generate jagged path points
	const centerPoints = generateLightningPath(
		props.pos1,
		props.pos2,
		segmentCount,
		distortion
	);

	// Create polygon points with thickness (top and bottom edges)
	const halfSize = props.size / 2;
	const polygonPoints: Vec2[] = [];

	// Add top edge points (going from start to end)
	for (let i = 0; i < centerPoints.length; i++) {
		const prev = i > 0 ? centerPoints[i - 1] : centerPoints[i];
		const next =
			i < centerPoints.length - 1 ? centerPoints[i + 1] : centerPoints[i];
		const dir = next.sub(prev).unit();
		const perpendicular = k.vec2(-dir.y, dir.x);
		polygonPoints.push(centerPoints[i].add(perpendicular.scale(halfSize)));
	}

	// Add bottom edge points (going from end to start)
	for (let i = centerPoints.length - 1; i >= 0; i--) {
		const prev = i > 0 ? centerPoints[i - 1] : centerPoints[i];
		const next =
			i < centerPoints.length - 1 ? centerPoints[i + 1] : centerPoints[i];
		const dir = next.sub(prev).unit();
		const perpendicular = k.vec2(-dir.y, dir.x);
		polygonPoints.push(centerPoints[i].sub(perpendicular.scale(halfSize)));
	}

	const link = k.add([
		k.pos(0, 0),
		k.polygon(polygonPoints),
		k.color(props.color),
		k.opacity(props.opacity),
		k.anchor("center"),
		k.z(0),
		{
			lifetime: 0,
			decayTime: props.decayTime,
			initialOpacity: props.opacity,
			distortion: distortion,
		},
		tags.props,
		tags.gameLoop,
	]);

	// Apply lightning shader if distortion is enabled
	if (distortion > 0) {
		link.use(
			k.shader("lightning", () => ({
				u_time: k.time(),
				u_distortion: distortion,
			}))
		);
	}

	link.onUpdate(() => {
		link.lifetime += k.dt();

		// Fade out over time
		const fadeProgress = link.lifetime / link.decayTime;
		link.opacity = link.initialOpacity * (1 - fadeProgress);

		// Destroy when fully faded
		if (link.lifetime >= link.decayTime) {
			k.destroy(link);
		}
	});

	return link;
}

function generateLightningPath(
	start: Vec2,
	end: Vec2,
	segments: number,
	distortion: number
): Vec2[] {
	const points: Vec2[] = [start];

	// Direction and perpendicular for offset
	const direction = end.sub(start);
	const segmentLength = direction.len() / segments;
	const normalizedDir = direction.unit();
	const perpendicular = k.vec2(-normalizedDir.y, normalizedDir.x);

	// Generate intermediate points with random offset
	for (let i = 1; i < segments; i++) {
		const t = i / segments;
		const basePoint = start.add(direction.scale(t));

		// Random offset perpendicular to the line
		const offsetAmount = (Math.random() - 0.5) * segmentLength * distortion * 2;
		const jitteredPoint = basePoint.add(perpendicular.scale(offsetAmount));

		points.push(jitteredPoint);
	}

	points.push(end);
	return points;
}
