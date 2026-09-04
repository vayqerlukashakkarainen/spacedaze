import { GameObj, PosComp, Vec2 } from "kaplay";
import {
	checkProjectileIntersection,
	collectDebreeImmediately,
	debrees,
	playerObj,
} from "../game";
import {
	k,
	mainSoundVolume,
	subSoundVolume,
	timeScale,
	velocityScale,
} from "../main";
import { audioService } from "../services/audioService";
import { starsEmitter } from "../particles";
import {
	applySteeringLean,
	lerpAngleBetweenPos,
} from "../shared";
import { tags } from "../tags";
import { randomExplosion } from "../util";
import { player } from "../player";
import {
	spawnBasicBlaster,
	spawnHomingRocket,
} from "../services/projectileHelpers";
import { timescale } from "../comp/timescale";
import { target } from "../comp/target";
import { applyProjectileDamage } from "../services/projectileService";
import { spawnFlash } from "./spawnFlash";
import {
	assignDroneTypes,
	DroneType,
} from "../services/droneRoleService";
import { updatePlayerHealthBar } from "../ui/gameUi";
import { registerBatchedEntityUpdate } from "../services/entityUpdateService";
import { findClosestSpatial } from "../services/runtimeSpatialIndexService";

interface Props {
	hp: number;
	blasterDmg: number;
	speed: number;
	follow: GameObj<PosComp>;
	deploymentStart?: Vec2;
}

const deploymentDuration = 0.7;
const deploymentReleaseProgress = 0.62;
const deploymentDistance = 48;
const deploymentAngleStep = 137.5;
const deploymentScreenMargin = 36;
const interceptorRange = 150;
const interceptorCooldown = 0.85;
const interceptorSearchDelay = 0.08;
const missileDroneCooldown = 2.2;
const gunshipCooldown = 1.55;
const medicKillsPerRepair = 8;
const salvagerSeekRange = 320;
const swarmRadius = 54;
const swarmSeparationRadius = 30;
const swarmSeparationStrength = 38;
const swarmAlignmentLead = 0.08;
const droneTargetEase = 5;
const droneVelocityEase = 7;
const droneArrivalEase = 4;
const droneTurnEase = 9;
type DroneMovementType =
	| "swarm"
	| "intercept"
	| "rearGuard"
	| "salvage";
let configuredDroneSlots = "";

const droneProfiles: Record<
	DroneType,
	{
		sprite: string;
		movementType: DroneMovementType;
		scale: number;
		speedMultiplier: number;
	}
> = {
	combat: {
		sprite: "drone_combat",
		movementType: "swarm",
		scale: 1,
		speedMultiplier: 1,
	},
	missile: {
		sprite: "drone_missile",
		movementType: "swarm",
		scale: 1,
		speedMultiplier: 1.25,
	},
	interceptor: {
		sprite: "drone_interceptor",
		movementType: "intercept",
		scale: 1,
		speedMultiplier: 2,
	},
	gunship: {
		sprite: "drone_gunship",
		movementType: "swarm",
		scale: 1.12,
		speedMultiplier: 0.68,
	},
	medic: {
		sprite: "drone_medic",
		movementType: "rearGuard",
		scale: 0.95,
		speedMultiplier: 1.15,
	},
	salvager: {
		sprite: "drone_salvager",
		movementType: "salvage",
		scale: 0.95,
		speedMultiplier: 1.45,
	},
};

export function spawnFollower(props: Props) {
	const hb = 12;
	const followerIndex = k.get(tags.follower).length;
	const deploymentAngle = -90 + followerIndex * deploymentAngleStep;
	const formationOffset = k.Vec2.fromAngle(deploymentAngle).scale(
		deploymentDistance
	);
	const deploymentTarget = props.follow.pos.add(formationOffset);
	const entersFromLeft = followerIndex % 2 === 0;
	const deploymentScreenY = k.clamp(
		k.height() / 2 + k.rand(-k.height() * 0.25, k.height() * 0.25),
		deploymentScreenMargin,
		k.height() - deploymentScreenMargin
	);
	const deploymentStart = props.deploymentStart?.clone() ??
		k.toWorld(
			k.vec2(
				entersFromLeft
					? -deploymentScreenMargin
					: k.width() + deploymentScreenMargin,
				deploymentScreenY
			)
		);
	const deploymentDirection = deploymentTarget.sub(deploymentStart);
	const deploymentFacingAngle = k.Vec2.toAngle(deploymentDirection) + 90;
	const m = k.add([
		k.pos(deploymentStart),
		k.sprite(droneProfiles.combat.sprite),
		k.rotate(deploymentFacingAngle),
		k.anchor("center"),
		k.scale(1.35, 0.72),
		k.color(k.WHITE),
		k.opacity(1),
		k.health(props.hp),
		target(),
		timescale(),
		k.animate(),
		{
			speed: props.speed,
			hb,
			dmg: props.blasterDmg,
			deployed: false,
			deploymentElapsed: 0,
			deploymentTrailElapsed: 0,
			deploymentStart,
			lastDeploymentPos: deploymentStart.clone(),
			entryVelocity: k.vec2(0),
			formationOffset,
			easedTargetPos: deploymentTarget.clone(),
			movementVelocity: k.vec2(0),
			swarmPhase: followerIndex * 2.399,
			swarmDriftScale: 0.82 + (followerIndex % 4) * 0.1,
			deploymentFacingAngle,
			interceptorCooldown: k.rand(0.1, interceptorCooldown),
			missileCooldown: k.rand(0.35, missileDroneCooldown),
			gunshipCooldown: k.rand(0.2, gunshipCooldown),
			medicKillCharge: 0,
			droneType: "combat" as DroneType,
			movementType: "swarm" as DroneMovementType,
			droneScale: droneProfiles.combat.scale,
		},
		tags.friendly,
		tags.follower,
		tags.unit,
		tags.gameLoop,
	]);

	audioService.playSound("collect1", { volume: mainSoundVolume });
	refreshFollowerTypes();

	registerBatchedEntityUpdate("followers", m, () => {
		if (configuredDroneSlots !== getDroneSlotSignature()) {
			refreshFollowerTypes();
		}

		if (!m.deployed) {
			m.deploymentElapsed += k.dt();
			m.deploymentTrailElapsed += k.dt();
			const progress = k.clamp(
				m.deploymentElapsed / deploymentDuration,
				0,
				1
			);
			const easedProgress = 1 - Math.pow(1 - progress, 3);
			const currentTarget = props.follow.pos.add(m.formationOffset);
			const nextPos = m.deploymentStart.lerp(currentTarget, easedProgress);
			const frameDuration = Math.max(k.dt(), 0.001);
			m.entryVelocity = nextPos
				.sub(m.lastDeploymentPos)
				.scale(1 / frameDuration);
			m.pos = nextPos;
			m.lastDeploymentPos = nextPos.clone();
			m.angle = m.deploymentFacingAngle;
			m.scale = k.vec2(
				k.lerp(1.35, 1, easedProgress),
				k.lerp(0.72, 1, easedProgress)
			);

			if (m.deploymentTrailElapsed >= 0.045) {
				m.deploymentTrailElapsed = 0;
				starsEmitter.emitter.position = m.pos;
				starsEmitter.emit(2);
			}

			if (progress >= deploymentReleaseProgress) {
				m.scale = k.vec2(m.droneScale);
				m.deployed = true;
				starsEmitter.emitter.position = m.pos;
				starsEmitter.emit(10);
			}
			return;
		}

		if (m.entryVelocity.len() > 1) {
			m.move(
				m.entryVelocity.scale(velocityScale() * m.getTimescale())
			);
			m.entryVelocity = m.entryVelocity.lerp(
				k.vec2(0),
				1 - Math.exp(-8 * k.dt())
			);
		}
		updateDroneMovement(m, props.follow);

		checkProjectileIntersection(m.pos, m.hb, tags.enemy, (p) => {
			if (m.droneType === "interceptor") {
				spawnInterceptorPulse(m.pos, p.pos);
				k.destroy(p);
				return;
			}
			const shouldDestroy = applyProjectileDamage(m, p);
			if (shouldDestroy) k.destroy(p);
		});

		if (m.droneType === "interceptor") {
			m.interceptorCooldown -= k.dt() * m.getTimescale();
			if (m.interceptorCooldown <= 0) {
				const hostileProjectile = findClosestHostileProjectile(
					m.pos,
					interceptorRange
				);
				if (hostileProjectile) {
					spawnInterceptorPulse(m.pos, hostileProjectile.pos);
					k.destroy(hostileProjectile);
					m.interceptorCooldown = player.droneSetBonus
						? interceptorCooldown * 0.7
						: interceptorCooldown;
				} else {
					m.interceptorCooldown = interceptorSearchDelay;
				}
			}
		}

		if (m.droneType === "gunship") {
			m.gunshipCooldown -= k.dt() * m.getTimescale();
			if (
				m.gunshipCooldown <= 0 &&
				m.pickTarget(m.pos, 460, tags.enemy)
			) {
				spawnBasicBlaster(
					m.pos,
					k.Vec2.fromAngle(m.targetAngle()),
					m.targetAngle() + 90,
					m.dmg * 4 * getPackDamageMultiplier(m),
					5,
					[tags.friendly, tags.blaster],
					player.followerProjectileLink !== undefined
				);
				m.gunshipCooldown = player.droneSetBonus
					? gunshipCooldown * 0.78
					: gunshipCooldown;
			}
		}

		if (m.droneType === "medic") updateMedicBehavior(m);

		if (m.droneType === "missile") {
			m.missileCooldown -= k.dt() * m.getTimescale();
			if (
				m.missileCooldown <= 0 &&
				m.pickTarget(m.pos, player.rocketSeekDistance, tags.enemy)
			) {
				spawnHomingRocket(
					m.pos,
					k.Vec2.fromAngle(m.angle - 90),
					m.angle,
					player.rocketImpactDmg * player.rocketDmgMultiplier * getPackDamageMultiplier(m),
					player.rocketSplashDmg * player.rocketDmgMultiplier * getPackDamageMultiplier(m),
					player.rocketSplashSize * player.rocketSplashSizeMultiplier,
					true,
					[tags.friendly, tags.rocket],
					player.followerProjectileLink !== undefined
				);
				m.missileCooldown = player.droneSetBonus
					? missileDroneCooldown * 0.75
					: missileDroneCooldown;
			}
		}

		if (
			m.droneType === "combat" &&
			Math.floor(k.rand(0, player.droneSetBonus ? 105 : 150)) == 1
		) {
			if (m.pickTarget(m.pos, 400, tags.enemy)) {
				spawnBasicBlaster(
					m.pos,
					k.Vec2.fromAngle(m.targetAngle()),
					m.targetAngle() + 90,
					m.dmg * getPackDamageMultiplier(m),
					2,
					[tags.friendly, tags.blaster],
					player.followerProjectileLink !== undefined
				);
			}
		}
	});

	m.onDeath(() => {
		starsEmitter.emitter.position = m.pos;
		starsEmitter.emit(20);

		audioService.playSound(randomExplosion(), { volume: subSoundVolume });
		k.destroy(m);
		k.wait(0, refreshFollowerTypes);
	});

	m.onHurt(() => {
		audioService.playSound("hit1", { volume: mainSoundVolume });
		m.animate("opacity", [0, 1, 0, 1], {
			duration: 0.14,
			loops: 1,
		});
	});

	return m;
}

function getPackDamageMultiplier(drone: GameObj) {
	if (player.packIntelligence === undefined || !drone.lockedTarget) return 1;
	const focusedDrones = (k.get(tags.follower) as GameObj[]).filter(
		(candidate) =>
			candidate.exists() &&
			candidate.id !== drone.id &&
			candidate.lockedTarget?.id === drone.lockedTarget.id
	).length;
	return 1 + Math.min(0.8, focusedDrones * 0.2);
}

export function refreshFollowerTypes() {
	const followers = (k.get(tags.follower) as GameObj[])
		.filter((follower) => follower.exists())
		.sort((a, b) => a.id - b.id);
	const assignments = assignDroneTypes(followers.length, {
		missile: player.missileDroneSlots,
		interceptor: player.followerInterceptorProtocol ?? 0,
		gunship: player.gunshipDroneSlots,
		medic: player.medicDroneSlots,
		salvager: player.salvagerDroneSlots,
	});
	configuredDroneSlots = getDroneSlotSignature();

	followers.forEach((follower, index) => {
		const droneType = assignments[index] ?? "combat";
		if (follower.droneType === droneType) return;
		const profile = droneProfiles[droneType];
		follower.droneType = droneType;
		follower.movementType = profile.movementType;
		follower.droneScale = profile.scale;
		follower.use(k.sprite(profile.sprite));
		follower.scale = k.vec2(profile.scale);
		follower.color = k.WHITE;
		starsEmitter.emitter.position = follower.pos;
		starsEmitter.emit(8);
	});
}

function getDroneSlotSignature() {
	return [
		player.missileDroneSlots,
		player.followerInterceptorProtocol ?? 0,
		player.gunshipDroneSlots,
		player.medicDroneSlots,
		player.salvagerDroneSlots,
	].join(":");
}

function updateDroneMovement(drone: GameObj, follow: GameObj<PosComp>) {
	if (drone.movementType === "intercept") {
		updateInterceptorMovement(drone, follow);
		return;
	}
	if (drone.movementType === "rearGuard") {
		updateRearGuardMovement(drone, follow);
		return;
	}
	if (drone.movementType === "salvage") {
		updateSalvagerMovement(drone, follow);
		return;
	}
	updateSwarmMovement(drone, follow);
}

function updateSwarmMovement(
	drone: GameObj,
	follow: GameObj<PosComp>,
	centerOffset = k.vec2(0),
	driftScale = 1
) {
	const phase = drone.swarmPhase ?? 0;
	const time = k.time();
	const personalDriftScale = (drone.swarmDriftScale ?? 1) * driftScale;
	const drift = k.vec2(
		Math.sin(time * 0.83 + phase) * swarmRadius * personalDriftScale,
		Math.sin(time * 1.17 + phase * 1.73) *
			swarmRadius *
			0.62 *
			personalDriftScale
	);
	let separation = k.vec2(0);
	let alignedVelocity = k.vec2(0);
	let neighborCount = 0;

	for (const neighbor of k.get(tags.follower) as GameObj[]) {
		if (neighbor === drone || !neighbor.exists()) continue;
		const away = drone.pos.sub(neighbor.pos);
		const distance = away.len();
		if (distance > 0.001 && distance < swarmSeparationRadius) {
			separation = separation.add(
				away
					.unit()
					.scale(1 - distance / swarmSeparationRadius)
			);
		}
		if (neighbor.movementVelocity) {
			alignedVelocity = alignedVelocity.add(neighbor.movementVelocity);
			neighborCount++;
		}
	}

	const alignment =
		neighborCount > 0
			? alignedVelocity.scale(swarmAlignmentLead / neighborCount)
			: k.vec2(0);
	const targetPos = follow.pos
		.add(centerOffset)
		.add(drift)
		.add(separation.scale(swarmSeparationStrength))
		.add(alignment);
	moveDroneToward(
		drone,
		targetPos,
		drone.speed *
			droneProfiles[drone.droneType as DroneType].speedMultiplier *
			2.2
	);
}

function updateInterceptorMovement(drone: GameObj, follow: GameObj<PosComp>) {
	const projectile = findClosestHostileProjectile(drone.pos, 320);
	if (!projectile) {
		updateSwarmMovement(drone, follow);
		return;
	}
	moveDroneToward(
		drone,
		projectile.pos,
		drone.speed * droneProfiles.interceptor.speedMultiplier
	);
}

function updateRearGuardMovement(drone: GameObj, follow: GameObj<PosComp>) {
	const rearGuardOffset = k.Vec2.fromAngle(
		(follow.angle ?? 0) + 90
	).scale(52);
	updateSwarmMovement(
		drone,
		follow,
		rearGuardOffset,
		0.55
	);
}

function updateSalvagerMovement(drone: GameObj, follow: GameObj<PosComp>) {
	const debris = findClosestDebree(drone.pos, salvagerSeekRange);
	if (!debris) {
		updateSwarmMovement(drone, follow);
		return;
	}
	if (drone.pos.dist(debris.pos) <= 13) {
		collectDebreeImmediately(debris, drone.pos.clone());
		return;
	}
	moveDroneToward(
		drone,
		debris.pos,
		drone.speed * droneProfiles.salvager.speedMultiplier
	);
}

function moveDroneToward(drone: GameObj, targetPos: Vec2, speed: number) {
	const scaledDt = Math.max(
		0,
		k.dt() * drone.getTimescale() * velocityScale()
	);
	if (scaledDt <= 0) return;

	if (!drone.easedTargetPos) drone.easedTargetPos = drone.pos.clone();
	if (!drone.movementVelocity) drone.movementVelocity = k.vec2(0);

	const targetBlend = 1 - Math.exp(-droneTargetEase * scaledDt);
	drone.easedTargetPos = drone.easedTargetPos.lerp(targetPos, targetBlend);
	const delta = drone.easedTargetPos.sub(drone.pos);
	const distance = delta.len();
	const desiredSpeed = Math.min(speed, distance * droneArrivalEase);
	const desiredVelocity =
		distance > 0.001
			? delta.unit().scale(desiredSpeed)
			: k.vec2(0);
	const velocityBlend = 1 - Math.exp(-droneVelocityEase * scaledDt);
	drone.movementVelocity = drone.movementVelocity.lerp(
		desiredVelocity,
		velocityBlend
	);

	let movement = drone.movementVelocity.scale(scaledDt);
	if (movement.len() > distance) movement = delta;
	if (movement.len() <= 0.001) {
		drone.movementVelocity = k.vec2(0);
		return;
	}

	const { lerp, correctedDesiredRot } = lerpAngleBetweenPos(
		drone.angle,
		drone.pos,
		drone.pos.add(movement),
		1 - Math.exp(-droneTurnEase * scaledDt * timeScale),
		-90
	);
	drone.pos = drone.pos.add(movement);
	drone.angle = lerp;
	applySteeringLean(
		drone,
		lerp,
		correctedDesiredRot,
		drone.droneScale
	);
}

export function getMissileDroneCount(): number {
	return getDroneTypeCounts().missile;
}

export function getDroneTypeCounts(): Record<DroneType, number> {
	const counts: Record<DroneType, number> = {
		combat: 0,
		missile: 0,
		interceptor: 0,
		gunship: 0,
		medic: 0,
		salvager: 0,
	};
	for (const follower of k.get(tags.follower) as GameObj[]) {
		if (!follower.exists()) continue;
		const droneType = follower.droneType as DroneType;
		if (droneType in counts) counts[droneType]++;
	}
	return counts;
}

function updateMedicBehavior(medic: GameObj) {
	if ((medic.medicKillCharge ?? 0) < medicKillsPerRepair) return;
	if (!playerObj.exists() || playerObj.hp >= playerObj.maxHP) return;
	medic.medicKillCharge = 0;
	playerObj.hp = Math.min(playerObj.maxHP, playerObj.hp + 1);
	updatePlayerHealthBar(playerObj.hp);
	spawnFlash(playerObj.pos.clone(), 10, k.WHITE);
	audioService.playSound("collect1", { volume: subSoundVolume });
}

function findClosestDebree(pos: Vec2, range: number) {
	let closest: GameObj | undefined;
	let closestDistance = range;
	for (const debris of debrees as GameObj[]) {
		if (!debris.exists() || debris.collection) continue;
		const distance = debris.pos.dist(pos);
		if (distance >= closestDistance) continue;
		closest = debris;
		closestDistance = distance;
	}
	return closest;
}

function findClosestHostileProjectile(pos: Vec2, range: number) {
	return findClosestSpatial(pos, range, {
		allTags: [tags.projectile, tags.enemy],
	}) as GameObj<PosComp> | undefined;
}

function spawnInterceptorPulse(start: Vec2, end: Vec2) {
	const beamStart = start.clone();
	const beamEnd = end.clone();
	const beamDelta = beamEnd.sub(beamStart);
	const color = k.rgb(80, 200, 255);

	k.add([
		k.pos(beamStart),
		k.opacity(0.9),
		k.lifespan(0.12, { fade: 0.08 }),
		{
			draw() {
				k.drawLine({
					p1: k.vec2(),
					p2: beamDelta,
					width: 2,
					color,
					opacity: this.opacity,
				});
			},
		},
		tags.props,
		tags.gameLoop,
	]);

	spawnFlash(beamEnd, 4, color);
}
