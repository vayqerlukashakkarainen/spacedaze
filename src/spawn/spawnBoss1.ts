import { Vec2 } from "kaplay";
import { checkProjectileComponentIntersection, playerObj } from "../game";
import { k, layers } from "../main";
import { trailEmitter } from "../particles";
import { spawnEnemyBlaster } from "../services/projectileHelpers";
import { tags } from "../tags";

const components = {
	body: 1,
	leftBlaster: 2,
	rightBlaster: 3,
	head: 4,
};
import { Component, compose } from "../compose";
import { jitter } from "../comp/jitter";
import { onEnemyHit } from "./enemyShared";
import { lerpAngleBetweenPos } from "../shared";
import { loopService } from "../services/loopService";
import { registerBatchedEntityUpdate } from "../services/entityUpdateService";
import { ENEMY_THREAT_RANK } from "../services/threatService";

const blasterOffset = [22, -2];
const headOffset = 25;
const pipeOffset = 22;
export const unitComponents: Record<number, Component[]> = {};

interface BossOptions {
	onDefeated?: (pos: Vec2) => void;
	tags?: string[];
}

export function spawnBoss1(
	pos: Vec2,
	am: number,
	hp: number,
	scale: number,
	options: BossOptions = {}
) {
	const targetPos = pos.clone();
	const spawnPos = pos.add(0, 180);
	const hb = 100 * scale;
	const m = k.add([
		k.pos(spawnPos),
		k.sprite("boss1_body"),
		k.rotate(0),
		k.anchor("center"),
		k.health(hp),
		k.animate(),
		k.opacity(0),
		k.scale(scale),
		jitter(),
		k.state("entry", [
			"entry",
			"wait",
			"fire_blasters",
			"fire_laser",
			"spawn",
		]),
		{
			hb,
			threatRank: ENEMY_THREAT_RANK.boss,
			entryPos: spawnPos.clone(),
			targetPos,
			baseScale: scale,
		},
		tags.enemy,
		tags.unit,
		tags.enemyRolePressure,
		tags.gameLoop,
		...(options.tags ?? []),
	]);

	const blaster1 = m.add([
		k.pos(k.vec2(-blasterOffset[0], -blasterOffset[1])),
		k.sprite("boss1_blaster"),
		k.anchor("center"),
		k.health(Math.floor(hp / 2)),
		k.animate(),
		k.rotate(0),
		jitter(),
		tags.part,
		tags.gameLoop,
		k.layer(layers.game2),
		{
			fireRate: 0.2,
			timer: 0,
			targetPos: k.center(),
		},
	]);
	blaster1.add([k.pos(k.vec2(0, -pipeOffset)), k.anchor("center")]);
	const blaster2 = m.add([
		k.pos(k.vec2(blasterOffset[0], -blasterOffset[1])),
		k.sprite("boss1_blaster"),
		k.anchor("center"),
		k.health(Math.floor(hp / 2)),
		k.animate(),
		k.rotate(0),
		jitter(),
		k.layer(layers.game2),
		tags.part,
		tags.gameLoop,
		{
			fireRate: 0.2,
			timer: 0,
			targetPos: k.center(),
		},
	]);
	const head = m.add([
		k.pos(k.vec2(0, -headOffset)),
		k.sprite("boss1_head"),
		k.anchor("center"),
		k.health(Math.floor(hp / 2)),
		k.animate(),
		k.rotate(0),
		jitter(),
		tags.part,
		tags.gameLoop,
	]);

	unitComponents[m.id!] = compose({
		rewardSource: "boss",
		onBodyDeath: () => options.onDefeated?.(targetPos.clone()),
		parts: [
			{ obj: m, hitbox: 64, isBody: true, scoreOnDestroy: am },
			{ obj: blaster1, hitbox: 22, isBody: false, scoreOnDestroy: 0 },
			{ obj: blaster2, hitbox: 22, isBody: false, scoreOnDestroy: 0 },
			{ obj: head, hitbox: 32, isBody: false, scoreOnDestroy: 0 },
		],
	});

	m.onStateEnter("entry", () => {
		m.entryPos = m.pos;
	});
	m.onStateUpdate("entry", () => {
		m.moveTo(m.targetPos, 90);

		const remainingDistance = m.pos.dist(m.targetPos);
		k.shake(remainingDistance / 2000);

		if (remainingDistance < 4) {
			m.pos = m.targetPos.clone();
			m.enterState("wait");
		}
	});

	m.onStateEnter("wait", async () => {
		await k.wait(1);
		m.enterState("fire_blasters");
	});

	m.onStateEnter("fire_blasters", async () => {
		for (let i = 0; i < 3; i++) {
			blaster1.targetPos = playerObj.pos.clone();
			blaster2.targetPos = playerObj.pos.add(
				k.rand(k.vec2(-120, -120), k.vec2(120, 120))
			);
			await k.wait(0.6);
			await loopService.loop(
				0.1,
				() => {
					spawnEnemyBlaster(
						blaster1.children[0].worldPos(),
						k.Vec2.fromAngle(blaster1.angle - 90),
						blaster1.angle,
						1,
						{ name: "BOSS", sprite: "boss1_body" }
					);
				},
				10
			);
		}
	});

	m.onStateUpdate("fire_blasters", () => {
		const { lerp: lerp1 } = lerpAngleBetweenPos(
			blaster1.angle,
			m.pos.add(blaster1.pos),
			blaster1.targetPos,
			0.05,
			-90
		);
		const { lerp: lerp2 } = lerpAngleBetweenPos(
			blaster2.angle,
			m.pos.add(blaster2.pos),
			blaster1.targetPos,
			0.05,
			-90
		);
		blaster1.angle = lerp1;
		blaster2.angle = lerp2;
	});

	registerBatchedEntityUpdate("enemies", m, () => {
		const v = k.wave(m.baseScale * 0.98, m.baseScale * 1.02, k.time());
		m.scale = k.vec2(v, v);
		checkProjectileComponentIntersection(
			m.pos,
			m.hb,
			tags.friendly,
			unitComponents[m.id!],
			(p, i) => {
				onEnemyHit(unitComponents[m.id!][i].obj, p);
			}
		);
	});
}
