import {
	AnchorComp,
	AnimateComp,
	AreaComp,
	Color,
	GameObj,
	HealthComp,
	PosComp,
	RotateComp,
	SpriteComp,
	Vec2,
} from "kaplay";
import {
	k,
	GameState,
	changeGameState,
	addScore,
	mainSoundVolume,
	setTimescale,
} from "./main";
import {
	addScrapArmorProgress,
	loadPlayer,
	player,
	resetSession,
	session,
} from "./player";

import { clearPlayer, setupPlayer } from "./setupPlayer";
import { tags } from "./tags";
import {
	addHealthBar,
	clearGameLoopUi,
	setupGameLoopUi,
	showSalvageGain,
	updatePlayerHealthBar,
} from "./ui/gameUi";
import { Component } from "./compose";
import { audioService } from "./services/audioService";
import { loopService } from "./services/loopService";
import { InteractableComp } from "./comp/interactable";
import {
	activeLevel,
	activeLevelKey,
	loadLevel,
	updateLvl,
	resetCurrentLevel,
	transitionToLevel,
} from "./levels/levels";
import { hideDeathScreen, showDeathScreen } from "./ui/deathScreen";
import { getPlayerDeathCause } from "./services/damageService";
import { resetLevelLoadout } from "./upg";
import {
	clearRecoveryOffers,
	clearRunInventory,
	prepareDeathRecoveryOffers,
} from "./services/runInventoryService";
import { resetPowerupRuntime, respawnCombatDrones } from "./powerups";
import {
	finishRunStats,
	recordDebreeCollected,
} from "./services/runStatsService";
import type { DebreeCollectionState } from "./spawn/spawnDebree";

export let playerObj: GameObj<
	PosComp | SpriteComp | RotateComp | AreaComp | AnchorComp | HealthComp
>;
let timeSinceLastLevel = 0;
let isPlayerDying = false;

export let debrees: GameObj<AnimateComp | PosComp | SpriteComp>[] = [];
export const projectiles: GameObj<PosComp | any>[] = [];

export function startGame() {
	resetLevelLoadout();
	resetSession();
	clearRunInventory();
	clearRecoveryOffers();
	resetPowerupRuntime();
	loadPlayer();
	playerObj = setupPlayer();
	setupGameLoopUi(player.maxHealth, player.rocketsLvl !== undefined);
}

export function updateGameLoop() {
	if (isPlayerDying) return;

	const deltaTime = k.dt();
	timeSinceLastLevel += deltaTime;

	if (!activeLevel()) {
		loadLevel("hub");
	}

	if (activeLevel()) {
		if (updateLvl()) {
			timeSinceLastLevel = 0;
			transitionToLevel("hub");
		}
	}

	for (let i = 0; i < debrees.length; i++) {
		const d = debrees[i];
		if (!d.exists()) {
			debrees.splice(i, 1);
			i--;
			continue;
		}
		const collectible = d as typeof d & {
			collection?: DebreeCollectionState;
			scale: Vec2;
			angle: number;
			salvageValue: number;
			color: Color;
		};

		if (collectible.collection) {
			const completed = updateDebreeCollection(
				collectible,
				playerObj.pos,
				deltaTime
			);
			if (completed) {
				collectDebreeImmediately(collectible, playerObj.pos.clone());
				i--;
			}
			continue;
		}

		const dist = d.pos.dist(playerObj.pos);

		if (
			dist <
			player.debreeSeekDistance * player.debreeSeekDistanceMultiplier
		) {
			beginDebreeCollection(collectible, playerObj.pos);
		}
	}

	// Check for nearby interactable buildings
	const interactables = k.get("interactable");
	for (const obj of interactables) {
		const interactable = obj as GameObj<InteractableComp | PosComp>;
		if (!interactable.pos) continue;

		const dist = interactable.pos.dist(playerObj.pos);
		interactable.isInRange = dist < interactable.interactRadius;
	}
}

export function collectDebreeImmediately(
	debris: GameObj & {
		salvageValue?: number;
		color?: Color;
	},
	collectionPos: Vec2
) {
	if (!debris.exists()) return 0;
	const salvageValue = debris.salvageValue ?? 1;
	const color = debris.color ?? k.WHITE;
	k.destroy(debris);
	recordDebreeCollected();
	audioService.playSound("collect1", { volume: mainSoundVolume });
	const salvageGained = addScore(
		player.scorePerPickup * salvageValue * player.debreeValueMultiplier
	);
	addScrapArmorProgress(salvageGained);
	showSalvageGain(salvageGained, color, collectionPos);
	return salvageGained;
}

function beginDebreeCollection(
	debris: GameObj<PosComp> & {
		collection?: DebreeCollectionState;
		angle: number;
		scale: Vec2;
	},
	playerPos: Vec2
) {
	const approach = playerPos.sub(debris.pos);
	debris.collection = {
		elapsed: 0,
		duration: 0.48,
		startPos: debris.pos.clone(),
		approachDir: approach.len() > 0 ? approach.unit() : k.vec2(0, -1),
		startAngle: debris.angle,
		startScale: debris.scale.x,
		spin: k.chance(0.5) ? 1 : -1,
	};
}

function updateDebreeCollection(
	debris: GameObj<PosComp> & {
		collection?: DebreeCollectionState;
		scale: Vec2;
		angle: number;
	},
	playerPos: Vec2,
	deltaTime: number
) {
	const collection = debris.collection;
	if (!collection) return false;
	collection.elapsed += deltaTime;
	const progress = k.clamp(collection.elapsed / collection.duration, 0, 1);
	const overshootDistance = 26;
	const overshootAt = 0.72;
	const overshootPos = playerPos.add(
		collection.approachDir.scale(overshootDistance)
	);

	if (progress < overshootAt) {
		const pullProgress = progress / overshootAt;
		const eased = pullProgress * pullProgress * pullProgress;
		debris.pos = collection.startPos.add(
			overshootPos.sub(collection.startPos).scale(eased)
		);
		debris.scale = k.vec2(
			collection.startScale * k.lerp(1, 1.45, eased)
		);
		debris.angle = collection.startAngle + collection.spin * 300 * eased;
	} else {
		const snapProgress = (progress - overshootAt) / (1 - overshootAt);
		const eased = 1 - Math.pow(1 - snapProgress, 3);
		debris.pos = overshootPos.add(playerPos.sub(overshootPos).scale(eased));
		debris.scale = k.vec2(
			collection.startScale * k.lerp(1.45, 0.35, eased)
		);
		debris.angle =
			collection.startAngle + collection.spin * k.lerp(300, 440, eased);
	}
	return progress >= 1;
}

export function beginPlayerDeathSequence() {
	if (isPlayerDying) return;
	isPlayerDying = true;
	const deathCause = getPlayerDeathCause();
	const diedInHub = activeLevelKey() === "hub";
	if (!diedInHub) {
		finishRunStats("DESTROYED");
		prepareDeathRecoveryOffers();
	}

	setTimescale(0.15, 1, false);
	k.shake(8);

	k.wait(2, () => {
		if (!isPlayerDying) return;
		showDeathScreen(deathCause);
	});

	k.wait(5, () => {
		if (!isPlayerDying) return;

		hideDeathScreen();
		const combatDroneCount = diedInHub
			? k.get(tags.follower).length
			: 0;
		clearPlayer();

		if (diedInHub) {
			k.destroyAll(tags.follower);
			transitionToLevel("hub");
			playerObj = setupPlayer({ respawnTransition: true });
			respawnCombatDrones(combatDroneCount);
			updatePlayerHealthBar(player.maxHealth + session.extraHealth);
			setTimescale(1, 0.4, false);
			isPlayerDying = false;
			return;
		}

		clearGameLoopUi();
		k.destroyAll(tags.follower);
		resetLevelLoadout();
		resetSession();
		resetPowerupRuntime();
		loadPlayer();
		transitionToLevel("hub");
		playerObj = setupPlayer({ respawnTransition: true });
		setupGameLoopUi(player.maxHealth, player.rocketsLvl !== undefined);
		setTimescale(1, 0.4, false);
		isPlayerDying = false;
	});
}

export function playerDeathSequenceActive() {
	return isPlayerDying;
}

export function clearGame() {
	isPlayerDying = false;
	hideDeathScreen();
	setTimescale(1, 0.2, false);
	clearPlayer();
	resetLevelLoadout();
	resetSession();
	clearRunInventory();
	clearRecoveryOffers();
	resetPowerupRuntime();
	loadPlayer();
	timeSinceLastLevel = 0;
	debrees = [];
	resetCurrentLevel();
	loopService.cancelAll();
	k.destroyAll(tags.enemy);
	k.destroyAll(tags.blaster);
	k.destroyAll(tags.rocket);
	k.destroyAll(tags.enemy);
	k.destroyAll(tags.levelBg);
	k.destroyAll(tags.unit);
	k.destroyAll(tags.debree);
	k.destroyAll(tags.props);
	k.destroyAll(tags.damageNumber);
	clearGameLoopUi();
	changeGameState(GameState.MainMenu);
}

export function checkProjectileIntersection(
	pos: Vec2,
	dist: number,
	projectilesWithTag: string,
	onHit: (p: GameObj<PosComp | RotateComp | any>) => void
) {
	for (let i = 0; i < projectiles.length; i++) {
		const p = projectiles[i];

		if (p.pos.dist(pos) < dist) {
			if (!p.tags.includes(projectilesWithTag)) continue;

			onHit(p);
		}
	}
}
export function checkProjectileComponentIntersection(
	pos: Vec2,
	dist: number,
	projectilesWithTag: string,
	components: Component[],
	onHit: (p: GameObj<PosComp | RotateComp | any>, index: number) => void
) {
	for (let i = 0; i < projectiles.length; i++) {
		const p = projectiles[i];

		if (p.pos.dist(pos) < dist) {
			if (!p.tags.includes(projectilesWithTag)) continue;

			for (let i = 0; i < components.length; i++) {
				if (components[i].obj.hidden) continue;

				if (
					p.pos.dist(pos.sub(components[i].localPos)) < components[i].hitbox
				) {
					onHit(p, i);
					return;
				}
			}
		}
	}
}

export function pickUnitInDistance(
	pos: Vec2,
	dist: number,
	tag: string,
	onFound: (u: GameObj) => void
) {
	const units = k.query({ include: [tag, tags.unit], includeOp: "and" });
	for (let i = 0; i < units.length; i++) {
		const u = units[i];

		if (u.pos.dist(pos) < dist) {
			onFound(u);
			return true;
		}
	}

	return false;
}

export function addMaxHealth() {
	if (!playerObj) return;

	session.extraHealth++;
	const totalHealth = player.maxHealth + session.extraHealth;
	playerObj.setMaxHP(totalHealth);
	addHealthBar(totalHealth - 1);
	playerObj.heal();
	updatePlayerHealthBar(playerObj.hp());
}
