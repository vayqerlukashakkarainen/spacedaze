import {
	AnimateComp,
	GameObj,
	HealthComp,
	PosComp,
	RotateComp,
	SpriteComp,
	Vec2,
} from "kaplay";
import { k, layers, subSoundVolume } from "./main";
import { registerHitAnimation } from "./shared";
import { emitEnemyTrail, sparkEmitter, starsEmitter } from "./particles";
import { spawnDebree } from "./spawn/spawnDebree";
import { JitterComp } from "./comp/jitter";
import { enemyOnDeath, type EnemyDeathMaterial } from "./spawn/enemyShared";
import { RewardSource } from "./services/economy/rewardService";
import { registerBatchedEntityUpdate } from "./services/core/entityUpdateService";
import { spawnFlash } from "./spawn/spawnFlash";
import { tags } from "./tags";
import {
	startShipPartDamageSmoke,
	triggerShipPartExplosion,
} from "./services/combat/shipPartDamageService";
import { registerShipPartTarget } from "./services/combat/targetingService";
import {
	spawnRockDestructionFragments,
	spawnRockPartDestructionDust,
} from "./services/combat/rockDestructionEffectService";
import { gameSoundService } from "./services/audio/gameSoundService";
import { spawnPersistentShipPart } from "./services/combat/persistentShipPartService";
import { emitMechanicalDamageSmokeBurst } from "./services/combat/enemyDamageEffectService";

interface Part {
	obj: GameObj<
		HealthComp | AnimateComp | PosComp | SpriteComp | JitterComp | RotateComp
	>;
	hitbox: number;
	hitboxOffset?: Vec2;
	isBody: boolean;
	scoreOnDestroy: number;
	onDestroyed?: (part: GameObj, body: GameObj) => void
}

interface Compose {
	parts: Part[];
	material?: EnemyDeathMaterial;
	rewardSource?: Exclude<RewardSource, "crate">;
	rewardMultiplier?: number;
	skipDefaultBodyDeath?: boolean;
	deferBodyDestruction?: boolean;
	onBodyDeath?: () => void;
}

export interface Component {
	obj: GameObj<HealthComp | JitterComp>;
	localPos: Vec2;
	hitbox: number;
	isBody: boolean;
}

export interface DetachPartOptions {
	force: number
	direction?: Vec2
	inheritedVelocity?: Vec2
	angle?: number
	scale?: number
	secondaryBurst?: boolean
}

export const unitComponents: Record<number, Component[]> = {};

export function compose(c: Compose): Component[] {
	const composed: Component[] = [];
	const body = c.parts.find((x) => x.isBody);

	for (let i = 0; i < c.parts.length; i++) {
		const part = c.parts[i];
		registerHitAnimation(part.obj);
		if (!part.isBody) {
			registerShipPartTarget(
				part.obj,
				body!.obj,
				part.hitbox,
				part.hitboxOffset ?? part.obj.pos
			)
		}

		part.obj.onHurt(() => {
			c.parts[i].obj.animation.seek(0);
			if (!part.isBody && c.material !== "rock") {
				startShipPartDamageSmoke(part.obj, body!.obj);
			}
		});

		part.obj.onDeath(() => {
			const localPos = part.hitboxOffset ?? part.obj.pos;
			const visualPos = part.obj.worldPos?.clone() ?? part.obj.pos.clone();
			const seamPos = part.isBody
				? part.obj.pos
				: part.hitboxOffset
					? body!.obj.pos.add(localPos.rotate(body!.obj.angle))
					: visualPos;

			spawnDebree(seamPos, part.scoreOnDestroy);
			if (part.isBody) {
				delete unitComponents[part.obj.id!];
				if (!c.deferBodyDestruction) k.destroy(part.obj);
				if (!c.skipDefaultBodyDeath) {
					enemyOnDeath(
						part.obj.pos,
						10 * (c.rewardMultiplier ?? 1),
						c.rewardMultiplier ?? 1,
						c.rewardSource,
						true,
						{ material: c.material ?? "ship" },
						part.obj
					);
				}
				c.onBodyDeath?.();
				return;
			}

			part.obj.hidden = true;
			part.obj.paused = true;
			part.onDestroyed?.(part.obj, body!.obj)
			if (c.material === "rock") {
				spawnRockDestructionFragments(seamPos, 0.55)
				spawnRockPartDestructionDust(seamPos)
				emitMechanicalDamageSmokeBurst(seamPos, body!.obj, 12)
				gameSoundService.playPositional("rock_material_destroyed", seamPos, {
					volume: subSoundVolume * 0.7,
				})
				body!.obj.jitter(8)
				return
			}
			starsEmitter.emitter.position = seamPos;
			starsEmitter.emit(12);
			spawnPartSeamBurst(seamPos, part.obj.detachImpactDirection);
			const socketOffset = seamPos.sub(body!.obj.pos).rotate(-body!.obj.angle);
			spawnDamagedSocket(body!.obj, socketOffset);
			const outward = seamPos.sub(body!.obj.pos);
			const impactDirection = normalizedOrUndefined(
				part.obj.detachImpactDirection
			);
			const direction = combineDetachDirections(outward, impactDirection);
			detach(visualPos, part.obj.sprite, {
				force: k.rand(55, 90),
				direction,
				inheritedVelocity: getBodyVelocity(body!.obj),
				angle: body!.obj.angle + (part.obj.angle ?? 0),
				scale: getWorldPartScale(body!.obj, part.obj),
				secondaryBurst: true,
			});
			body!.obj.jitter(20);
			triggerShipPartExplosion(part.obj, body!.obj, seamPos);
		});

		composed.push({
			obj: part.obj,
			localPos: part.isBody
				? k.vec2(0, 0)
				: part.hitboxOffset ?? part.obj.pos,
			hitbox: part.hitbox,
			isBody: part.isBody,
		});
	}

	return composed;
}

export function detach(pos: Vec2, sprite: string, options: DetachPartOptions) {
	return spawnPersistentShipPart(pos, sprite, options);
}

function normalizedOrUndefined(direction?: Vec2) {
	if (!direction || direction.len() <= 0.001) return undefined;
	return direction.unit();
}

function combineDetachDirections(outward: Vec2, impactDirection?: Vec2) {
	const outwardDirection = normalizedOrUndefined(outward) ??
		k.Vec2.fromAngle(k.rand(0, 360));
	if (!impactDirection) return outwardDirection;
	return normalizedOrUndefined(
		outwardDirection.scale(0.72).add(impactDirection.scale(0.58))
	) ?? outwardDirection;
}

function getBodyVelocity(body: GameObj) {
	if (!body.vel || typeof body.speed !== "number") return k.vec2(0, 0);
	const direction = normalizedOrUndefined(body.vel);
	return direction?.scale(body.speed * 0.28) ?? k.vec2(0, 0);
}

function getWorldPartScale(body: GameObj, part: GameObj) {
	const bodyScale = typeof body.scale?.x === "number" ? body.scale.x : 1;
	const partScale = typeof part.scale?.x === "number" ? part.scale.x : 1;
	return Math.abs(bodyScale * partScale);
}

function spawnPartSeamBurst(pos: Vec2, direction?: Vec2) {
	const burstDirection = normalizedOrUndefined(direction) ??
		k.Vec2.fromAngle(k.rand(0, 360));
	spawnFlash(pos, 4.5, k.WHITE);
	emitPartSparks(pos, burstDirection.angle(), 65, 6);
}

function emitPartSparks(
	pos: Vec2,
	direction: number,
	spread: number,
	count: number
) {
	const previousDirection = sparkEmitter.emitter.direction;
	const previousSpread = sparkEmitter.emitter.spread;
	sparkEmitter.emitter.position = pos;
	sparkEmitter.emitter.direction = direction;
	sparkEmitter.emitter.spread = spread;
	sparkEmitter.emit(count);
	sparkEmitter.emitter.direction = previousDirection;
	sparkEmitter.emitter.spread = previousSpread;
}

function spawnDamagedSocket(body: GameObj, localPos: Vec2) {
	if (!body.exists()) return;
	const socket = k.add([
		k.pos(body.pos.add(localPos.rotate(body.angle))),
		k.sprite("particle3"),
		k.anchor("center"),
		k.rotate(body.angle),
		k.scale(0.42),
		k.color(75, 100, 112),
		k.opacity(0.8),
		k.layer(layers.gameEffects),
		{
			nextSparkAt: k.time() + k.rand(0.12, 0.3),
		},
		tags.props,
		tags.gameLoop,
	]);
	registerBatchedEntityUpdate("effects", socket, () => {
		if (!body.exists()) {
			k.destroy(socket);
			return;
		}
		socket.pos = body.pos.add(localPos.rotate(body.angle));
		socket.angle = body.angle;
		if (k.time() < socket.nextSparkAt) return;
		socket.nextSparkAt = k.time() + k.rand(0.22, 0.48);
		emitEnemyTrail(socket, socket.pos, body.angle + k.rand(0, 360), 1);
	});
}
