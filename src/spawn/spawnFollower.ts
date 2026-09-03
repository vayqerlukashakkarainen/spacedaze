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
	lerpAngleBetweenPos,
	lerpMoveRotateAndScale,
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

interface Props {
	hp: number;
	blasterDmg: number;
	speed: number;
	follow: GameObj<PosComp>;
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
const missileDroneOrbitRadius = 58;
const missileDroneOrbitSpeed = 42;
const gunshipCooldown = 1.55;
const medicKillsPerRepair = 8;
const salvagerSeekRange = 320;
type DroneMovementType =
	| "escort"
	| "orbit"
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
		movementType: "escort",
		scale: 1,
		speedMultiplier: 1,
	},
	missile: {
		sprite: "drone_missile",
		movementType: "orbit",
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
		movementType: "escort",
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
	const deploymentStart = k.toWorld(
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
		k.color(getDroneColor("combat")),
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
			deploymentFacingAngle,
			interceptorCooldown: k.rand(0.1, interceptorCooldown),
			missileCooldown: k.rand(0.35, missileDroneCooldown),
			gunshipCooldown: k.rand(0.2, gunshipCooldown),
			medicKillCharge: 0,
			droneType: "combat" as DroneType,
			movementType: "escort" as DroneMovementType,
			droneScale: droneProfiles.combat.scale,
			orbitAngle: deploymentAngle,
			orbitDirection: followerIndex % 2 === 0 ? 1 : -1,
		},
		tags.friendly,
		tags.follower,
		tags.unit,
		tags.gameLoop,
	]);

	audioService.playSound("collect1", { volume: mainSoundVolume });
	refreshFollowerTypes();

	m.onUpdate(() => {
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
					m.dmg * 4,
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
					player.rocketImpactDmg * player.rocketDmgMultiplier,
					player.rocketSplashDmg * player.rocketDmgMultiplier,
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
					m.dmg,
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
		follower.color = getDroneColor(droneType);
		starsEmitter.emitter.position = follower.pos;
		starsEmitter.emit(8);
	});
}

function getDroneColor(droneType: DroneType) {
	if (droneType === "missile") return k.rgb(255, 145, 45);
	if (droneType === "interceptor") return k.rgb(80, 200, 255);
	if (droneType === "gunship") return k.rgb(255, 90, 80);
	if (droneType === "medic") return k.rgb(100, 255, 145);
	if (droneType === "salvager") return k.rgb(255, 220, 80);
	return k.WHITE;
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
	if (drone.movementType === "orbit") {
		updateOrbitMovement(drone, follow);
		return;
	}
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
	updateEscortMovement(drone, follow);
}

function updateEscortMovement(drone: GameObj, follow: GameObj<PosComp>) {
	const { lerp, correctedDesiredRot } = lerpAngleBetweenPos(
		drone.angle,
		drone.pos,
		follow.pos,
		0.015 * timeScale * drone.getTimescale(),
		-90
	);

	lerpMoveRotateAndScale(
		drone,
		lerp,
		drone.speed *
			droneProfiles[drone.droneType as DroneType].speedMultiplier *
			drone.getTimescale(),
		correctedDesiredRot,
		drone.droneScale
	);
}

function updateInterceptorMovement(drone: GameObj, follow: GameObj<PosComp>) {
	const projectile = findClosestHostileProjectile(drone.pos, 320);
	if (!projectile) {
		updateEscortMovement(drone, follow);
		return;
	}
	moveDroneToward(
		drone,
		projectile.pos,
		drone.speed * droneProfiles.interceptor.speedMultiplier
	);
}

function updateRearGuardMovement(drone: GameObj, follow: GameObj<PosComp>) {
	const rearGuardPos = follow.pos.add(
		k.Vec2.fromAngle((follow.angle ?? 0) + 90).scale(66)
	);
	moveDroneToward(
		drone,
		rearGuardPos,
		drone.speed * droneProfiles.medic.speedMultiplier
	);
	drone.angle += 30 * k.dt() * drone.getTimescale();
}

function updateSalvagerMovement(drone: GameObj, follow: GameObj<PosComp>) {
	const debris = findClosestDebree(drone.pos, salvagerSeekRange);
	if (!debris) {
		updateOrbitMovement(drone, follow);
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
	const delta = targetPos.sub(drone.pos);
	if (delta.len() <= 1) return;
	drone.move(
		delta.unit().scale(speed * velocityScale() * drone.getTimescale())
	);
	drone.angle = k.Vec2.toAngle(delta) + 90;
	drone.scale = k.vec2(drone.droneScale);
}

function updateOrbitMovement(drone: GameObj, follow: GameObj<PosComp>) {
	drone.orbitAngle +=
		missileDroneOrbitSpeed *
		drone.orbitDirection *
		k.dt() *
		drone.getTimescale();
	const orbitTarget = follow.pos.add(
		k.Vec2.fromAngle(drone.orbitAngle).scale(missileDroneOrbitRadius)
	);
	const delta = orbitTarget.sub(drone.pos);
	if (delta.len() > 1) {
		const catchUpSpeed = Math.min(
			Math.max(drone.speed * 1.25, delta.len() * 5),
			260
		);
		drone.move(
			delta.unit().scale(
				catchUpSpeed * velocityScale() * drone.getTimescale()
			)
		);
	}
	drone.angle += 55 * drone.orbitDirection * k.dt() * drone.getTimescale();
	drone.scale = k.vec2(drone.droneScale);
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
	if (!playerObj.exists() || playerObj.hp() >= playerObj.maxHP) return;
	medic.medicKillCharge = 0;
	playerObj.heal(1);
	updatePlayerHealthBar(playerObj.hp());
	spawnFlash(playerObj.pos.clone(), 10, getDroneColor("medic"));
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
	let closest: GameObj<PosComp> | undefined;
	let closestDistance = range;

	for (const projectile of k.get(tags.projectile) as GameObj<PosComp>[]) {
		if (!projectile.exists() || !projectile.tags.includes(tags.enemy)) continue;
		const distance = projectile.pos.dist(pos);
		if (distance >= closestDistance) continue;
		closest = projectile;
		closestDistance = distance;
	}

	return closest;
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
