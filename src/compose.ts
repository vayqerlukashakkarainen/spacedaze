import {
	AnimateComp,
	GameObj,
	HealthComp,
	PosComp,
	RotateComp,
	SpriteComp,
	Vec2,
} from "kaplay";
import { k, layers, mainSoundVolume } from "./main";
import { gameSoundService } from "./services/gameSoundService";
import { registerHitAnimation } from "./shared";
import { emitEnemyTrail, sparkEmitter, starsEmitter } from "./particles";
import { spawnDebree } from "./spawn/spawnDebree";
import { JitterComp } from "./comp/jitter";
import { enemyOnDeath } from "./spawn/enemyShared";
import { RewardSource } from "./services/rewardService";
import { registerBatchedEntityUpdate } from "./services/entityUpdateService";
import { gridRegistry } from "./grid/gridRegistry";
import { ACTIVE_RUN_GRID_KEY } from "./grid/gridKeys";
import { spawnFlash } from "./spawn/spawnFlash";
import { tags } from "./tags";
import {
	startShipPartDamageSmoke,
	triggerShipPartExplosion,
} from "./services/shipPartDamageService";

interface Part {
	obj: GameObj<
		HealthComp | AnimateComp | PosComp | SpriteComp | JitterComp | RotateComp
	>;
	hitbox: number;
	hitboxOffset?: Vec2;
	isBody: boolean;
	scoreOnDestroy: number;
}

interface Compose {
	parts: Part[];
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

		part.obj.onHurt(() => {
			c.parts[i].obj.animation.seek(0);
			if (!part.isBody) startShipPartDamageSmoke(part.obj, body!.obj);
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
			if (part.isBody && !c.deferBodyDestruction) {
				gameSoundService.play("enemy_explosion", { volume: mainSoundVolume });
			}

			if (part.isBody) {
				delete unitComponents[part.obj.id!];
				if (!c.deferBodyDestruction) k.destroy(part.obj);
				if (!c.skipDefaultBodyDeath) {
					enemyOnDeath(
						part.obj.pos,
						10 * (c.rewardMultiplier ?? 1),
						c.rewardMultiplier ?? 1,
						c.rewardSource
					);
				}
				c.onBodyDeath?.();
				return;
			}

			part.obj.hidden = true;
			part.obj.paused = true;
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
	const direction = normalizedOrUndefined(options.direction) ??
		k.Vec2.fromAngle(k.rand(0, 360));
	const scale = Math.max(0.05, Math.abs(options.scale ?? 1));
	const lifetime = k.rand(1.55, 2.15);
	const inheritedVelocity = options.inheritedVelocity ?? k.vec2(0, 0);
	const velocity = direction.scale(options.force).add(inheritedVelocity);
	const spinDirection = k.chance(0.5) ? -1 : 1;
	const p = k.add([
		k.pos(pos),
		k.sprite(sprite),
		k.offscreen({ destroy: true }),
		k.opacity(1),
		k.scale(scale),
		k.rotate(options.angle ?? 0),
		k.layer(layers.gameEffects),
		{
			velocity,
			angularVelocity: spinDirection * k.rand(65, 155),
			elapsed: 0,
			lifetime,
			trailTimer: 0,
			bounced: false,
		},
		tags.props,
		tags.gameLoop,
	]);

	registerBatchedEntityUpdate("effects", p, () => {
		const delta = k.dt();
		p.elapsed += delta;
		p.trailTimer -= delta;
		const nextPos = p.pos.add(p.velocity.scale(delta));
		const grid = gridRegistry.get(ACTIVE_RUN_GRID_KEY);
		if (grid && !grid.isWalkable(grid.screenToHex(nextPos))) {
			if (!p.bounced) {
				p.bounced = true;
				p.velocity = p.velocity.scale(-0.38);
				p.angularVelocity *= 0.62;
				spawnPartWallImpact(p.pos, p.velocity);
			} else {
				p.velocity = p.velocity.scale(0.15);
			}
		} else {
			p.pos = nextPos;
		}
		p.velocity = p.velocity.scale(Math.pow(0.982, delta * 60));
		p.angle += p.angularVelocity * delta;
		p.angularVelocity *= Math.pow(0.987, delta * 60);
		if (p.trailTimer <= 0 && p.elapsed < 0.38) {
			p.trailTimer = 0.065;
			emitEnemyTrail(p, p.pos, p.velocity.angle() + 180, 1);
		}
		const fadeProgress = k.clamp(
			(p.elapsed - (p.lifetime - 0.32)) / 0.32,
			0,
			1
		);
		p.opacity = 1 - fadeProgress;
		if (p.elapsed < p.lifetime) return;
		if (options.secondaryBurst) spawnPartSecondaryBurst(p.pos, scale);
		k.destroy(p);
	});
	return p;
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

function spawnPartWallImpact(pos: Vec2, velocity: Vec2) {
	spawnFlash(pos, 2.5, k.rgb(130, 205, 235));
	emitPartSparks(pos, velocity.angle(), 80, 3);
}

function spawnPartSecondaryBurst(pos: Vec2, scale: number) {
	spawnFlash(pos, k.clamp(3.5 * scale, 2.5, 7), k.rgb(135, 210, 240));
	emitPartSparks(pos, 0, 150, 3);
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
