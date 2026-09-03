import { Vec2 } from "kaplay";
import { checkProjectileIntersection, playerObj } from "../game";
import { k } from "../main";
import { tags } from "../tags";
import { timescale } from "../comp/timescale";
import { LevelKey } from "../levels/levels";
import { startLevelTransition } from "../services/levelTransitionService";

interface Props {
	pos: Vec2;
	levelName: LevelKey;
	spriteName?: string;
	label?: string;
	visual?: "sprite" | "wormhole";
	portalState?: "dormant" | "charging" | "active";
	onEnter?: (
		portal: any,
		selectLevel: (levelKey: LevelKey) => void,
		cancel: () => void
	) => void;
}

export function spawnLevel(props: Props) {
	let collected = false;
	let waitingForExit = false;
	const components: any[] = [
		k.pos(props.pos),
		k.rotate(0),
		k.scale(1),
		k.anchor("center"),
		timescale(),
		{
			levelName: props.levelName,
			portalState: props.portalState ?? "active",
			portalProgress: props.portalState === "dormant" ? 0 : 1,
		},
		tags.props,
		tags.unit,
		tags.gameLoop,
	];
	if (props.visual !== "wormhole" && props.spriteName) {
		components.splice(1, 0, k.sprite(props.spriteName));
	}
	const m = k.add(components);

	if (props.visual === "wormhole") {
		addWormholeEffect(m);
	} else {
		m.add([
			k.circle(16),
			k.scale(1),
			k.anchor("center"),
			k.opacity(0.2),
		]);
	}

	const portalLabel = m.add([
		k.text(props.label ?? "START RUN", { size: 8, font: "unscii" }),
		k.pos(0, props.visual === "wormhole" ? -78 : -28),
		k.anchor("center"),
		k.color(k.WHITE),
	]);
	m.setPortalState = (
		state: "dormant" | "charging" | "active",
		label?: string
	) => {
		m.portalState = state;
		if (label) portalLabel.text = label;
	};
	m.setPortalProgress = (progress: number) => {
		m.portalProgress = k.clamp(progress, 0, 1);
	};

	// Helper function to collect the level portal
	const collectPortal = () => {
		if (collected || waitingForExit) return;
		collected = true;
		if (props.onEnter) {
			props.onEnter(
				m,
				(levelKey) => {
					startLevelTransition({
						portal: m,
						player: playerObj,
						targetLevel: levelKey,
					});
				},
				() => {
					collected = false;
					waitingForExit = true;
				}
			);
			return;
		}

		startLevelTransition({
			portal: m,
			player: playerObj,
			targetLevel: props.levelName,
		});
	};

	m.onUpdate(() => {
		if (props.visual !== "wormhole") {
			checkProjectileIntersection(m.pos, 16, tags.friendly, () => {
				collectPortal();
			});
		}

		const dist = m.pos.dist(playerObj.pos);
		if (dist >= 20) waitingForExit = false;

		if (dist < 20) collectPortal();
	});

	return m;
}

function addWormholeEffect(portal: any) {
	const core = portal.add([
		k.circle(9),
		k.anchor("center"),
		k.color(0, 0, 0),
		k.opacity(0.95),
		k.outline(1, k.WHITE),
	]);
	const rings = [
		{ radius: 16, speed: 38, squash: 0.48, phase: 0, activationAt: 0.08 },
		{ radius: 20, speed: -27, squash: 0.58, phase: 1.2, activationAt: 0.22 },
		{ radius: 24, speed: 24, squash: 0.68, phase: 2.1, activationAt: 0.36 },
		{ radius: 29, speed: -20, squash: 0.76, phase: 3.4, activationAt: 0.5 },
		{ radius: 34, speed: 16, squash: 0.84, phase: 4.3, activationAt: 0.66 },
		{ radius: 40, speed: -13, squash: 0.92, phase: 5.1, activationAt: 0.82 },
	].map((ring) => ({
		...ring,
		distanceOpacity: k.lerp(1, 0.24, (ring.radius - 16) / (40 - 16)),
		obj: portal.add([
			k.circle(ring.radius, { fill: false }),
			k.anchor("center"),
			k.scale(1, ring.squash),
			k.rotate(ring.phase * 20),
			k.opacity(0.55),
			k.outline(1, k.WHITE),
		]),
	}));
	const particles = Array.from({ length: 40 }, (_, index) => ({
		phase: index / 40,
		speed: 0.1 + (index % 5) * 0.012,
		startRadius: 82 + (index % 4) * 7,
		activationAt: 0.04 + (index / 40) * 0.88,
		obj: portal.add([
			k.rect(index % 4 === 0 ? 5 : 3, index % 5 === 0 ? 2 : 1),
			k.anchor("center"),
			k.color(k.WHITE),
			k.opacity(0.2),
		]),
	}));

	portal.onUpdate(() => {
		const time = k.time();
		const localTimescale = portal.getTimescale();
		const transitionIntensity = portal.transitionIntensity ?? 0;
		const activationProgress = portal.portalProgress ?? 0;
		const isCharging = portal.portalState === "charging";
		const isDormant = portal.portalState === "dormant";
		const coreBaseScale = isDormant
			? 0.55
			: isCharging
				? k.lerp(0.55, 1.55, activationProgress)
				: 1;
		const corePulseRange = isDormant
			? 0
			: isCharging
				? k.lerp(0.01, 0.22, activationProgress)
				: 0.08;
		const corePulse = k.wave(
			1 - corePulseRange,
			1 + corePulseRange,
			time * (isCharging ? k.lerp(1.5, 8, activationProgress) : 2.4)
		);
		core.scale = k.vec2(coreBaseScale * corePulse);
		core.opacity = 1;

		for (const ring of rings) {
			const reveal = isDormant
				? 0
				: isCharging
					? k.clamp(
							(activationProgress - ring.activationAt) / 0.12,
							0,
							1
						)
					: 1;
			ring.obj.angle +=
				ring.speed *
				k.dt() *
				localTimescale *
				(1 + transitionIntensity * 2.5) *
				(portal.portalState === "dormant"
					? 0.45
					: isCharging
						? k.lerp(0.45, 5, activationProgress)
						: 1);
			const ringPulse = k.wave(
				0.94,
				1.06,
				time * 1.8 + ring.phase
			);
			const activationScale = isCharging
				? k.lerp(0.72, 1.16, activationProgress) * k.lerp(0.7, 1, reveal)
				: 1;
			ring.obj.scale = k.vec2(
				ringPulse * activationScale,
				ring.squash * ringPulse * activationScale
			);
			ring.obj.opacity =
				reveal *
				ring.distanceOpacity *
				(isCharging ? k.lerp(0.25, 0.8, activationProgress) : 0.55);
		}

		for (let index = 0; index < particles.length; index++) {
			const particle = particles[index];
			const reveal = isDormant
				? 0
				: isCharging
					? k.clamp(
							(activationProgress - particle.activationAt) / 0.1,
							0,
							1
						)
					: 1;
			const progress = (time * particle.speed + particle.phase) % 1;
			const acceleratedProgress = progress * progress;
			const radius =
				particle.startRadius -
				acceleratedProgress * (particle.startRadius - 6);
			const angle =
				progress * 620 +
				index * (360 / particles.length) +
				time * (isCharging ? k.lerp(8, 52, activationProgress) : 18);
			const direction = k.Vec2.fromAngle(angle);
			particle.obj.pos = k.vec2(
				direction.x * radius,
				direction.y * radius * 0.72
			);
			particle.obj.angle = angle;
			particle.obj.scale = k.vec2(0.65 + progress * 0.75);
			particle.obj.opacity = k.clamp(reveal * (
				progress < 0.15
					? 0.15 + progress * 2.5
					: progress > 0.9
						? (1 - progress) * 8
						: 0.55 + progress * 0.35
			), 0, 1);
		}
	});
}
