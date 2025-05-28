import {
	AnimateComp,
	GameObj,
	HealthComp,
	PosComp,
	SpriteComp,
	Vec2,
} from "kaplay";
import { k } from "./main";
import { registerHitAnimation } from "./shared";
import { starsEmitter } from "./particles";
import { spawnDebree } from "./spawn/spawnDebree";
import { randomExplosion } from "./util";
import { unitComponents } from "./spawn/spawnShip1";
import { JitterComp } from "./comp/jitter";

interface Part {
	obj: GameObj<HealthComp | AnimateComp | PosComp | SpriteComp | JitterComp>;
	hitbox: number;
	isBody: boolean;
	scoreOnDestroy: number;
}

interface Compose {
	parts: Part[];
}

export interface Component {
	obj: GameObj<HealthComp | JitterComp>;
	localPos: Vec2;
	hitbox: number;
	isBody: boolean;
}

export function compose(c: Compose): Component[] {
	const composed: Component[] = [];
	const body = c.parts.find((x) => x.isBody);

	for (let i = 0; i < c.parts.length; i++) {
		const part = c.parts[i];
		registerHitAnimation(part.obj);

		part.obj.onHurt(() => {
			k.play("hit1", { volume: 0.6 });
			c.parts[i].obj.animation.seek(0);
		});

		part.obj.onDeath(() => {
			const pos = part.isBody ? part.obj.pos : body!.obj.pos.sub(part.obj.pos);
			starsEmitter.emitter.position = pos;
			starsEmitter.emit(20);
			spawnDebree(pos, part.scoreOnDestroy);
			k.play(randomExplosion(), { volume: 0.6 });

			if (part.isBody) {
				delete unitComponents[part.obj.id!];
				k.destroy(part.obj);
				return;
			}

			part.obj.hidden = true;
			part.obj.paused = true;
			detach(pos, part.obj.sprite, k.rand(40, 80));
			body!.obj.jitter(20);
		});

		composed.push({
			obj: part.obj,
			localPos: part.isBody ? k.vec2(0, 0) : part.obj.pos,
			hitbox: part.hitbox,
			isBody: part.isBody,
		});
	}

	return composed;
}

export function detach(pos: Vec2, sprite: string, force: number) {
	const p = k.add([
		k.pos(pos),
		k.sprite(sprite),
		k.lifespan(2, {
			fade: 0.2,
		}),
		k.offscreen({ destroy: true }),
		k.opacity(1),
		k.scale(1),
		k.rotate(k.rand(0, 360)),
		k.move(k.rand(k.vec2(-1, -1), k.vec2(1, 1)), force),
		{
			spin: k.rand(2, 8),
		},
	]);

	p.onUpdate(() => {
		const v = k.wave(-1, 1, k.time() * p.spin);
		p.scale = k.vec2(v, v);
	});
}
