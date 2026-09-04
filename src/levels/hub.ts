import { endSong } from "../web";
import type { Color, Vec2 } from "kaplay";
import { audioService } from "../services/audioService";
import { spawnLevel } from "../spawn/spawnLevel";
import { getScore, k, layers, spendScore } from "../main";
import { Level } from "./levels";
import { spawnBackgroundObject } from "../spawn/spawnBackgroundObject";
import { spawnChest } from "../spawn/spawnChest";
import { spawnCrate } from "../spawn/spawnCrate";
import { playerObj, projectiles } from "../game";
import { tags } from "../tags";
import { interactable } from "../comp/interactable";
import {
	createInteractionPrompt,
	UI_COLORS,
	UI_FONT_SIZES,
} from "../ui/common";
import {
	consumeHubGhostChest,
	getFacilityConstruction,
	getFacilityConstructionRemainingMs,
	getHubGhostChestCapacity,
	getHubGhostChestStock,
	getHubLevel,
	hasUnseenBlueprints,
	HUB_FACILITY_BUILD_DURATION_MS,
	HUB_FACILITIES,
	HubFacilityDefinition,
	HubFacilityId,
	isFacilityBuilt,
	isFacilityUnlocked,
	startFacilityConstruction,
} from "../services/hubProgressService";
import {
	showPhaseStation,
	showRunPreparation,
	showRunTerminal,
} from "../ui/hubFacilities";
import { saveGame } from "../util";
import { starsEmitter } from "../particles";
import { beginRunSession } from "../services/runDirectorService";
import { getUnlockedWarpZones } from "../services/warpZoneService";
import { ASTEROID_SPRITES } from "../asteroidSprites";
import { spawnMeteorite } from "../spawn/spawnAsteroid";
import { spawnDebreeValues } from "../spawn/spawnDebree";
import { phaseJumpActive } from "../setupPlayer";
import { tryBounceProjectile } from "../services/projectileService";
import { applyDamage } from "../services/damageService";
import { spawnGravityPull } from "../spawn/spawnGravityPull";
import { spawnHealthOrb } from "../spawn/spawnHealthOrb";
import { registerBatchedEntityUpdate } from "../services/entityUpdateService";
import { PLANET_CHUNK_SPRITES } from "../planetChunkSprites";
import {
	purchaseBurstParticleCount,
	spawnCurrencyBurst,
} from "../spawn/spawnCurrencyBurst";
import { showPendingRunEndSummary } from "../ui/runEndSummary";
import { spawnHubRestoration } from "../spawn/spawnHubRestoration";
import {
	HubRepairCrew,
	spawnHubRepairCrew,
} from "../spawn/spawnHubRepairCrew";
import { playRequirementErrorSound } from "../services/uiSoundService";

let lvlData: any = {};
let bgAsteroidTimer = 0;
let phaseFieldDamageCooldown = 0;
const hubHalfWidth = 1400;
const hubHalfHeight = 760;
const boundaryRevealRadius = 160;
const phaseFieldOffsetX = 980;
const phaseFieldOffsetY = 120;
const phaseFieldInnerRadius = 162;
const phaseFieldOuterRadius = 220;
const trainingDummyRespawnDelay = 1.5;
const hubFacilityScale = 1.35;
const hubFacilityInteractRadius = 120;
const hubFacilityLabelOffsetY = 126;
const ghostChestCosts = [15, 30, 50] as const;
const ghostWeaponChestCost = 30;
const hubFacilitySprites: Record<
	HubFacilityId,
	{ built: string; destroyed: string }
> = {
	contractTerminal: {
		built: "facility_contract_terminal_1bit",
		destroyed: "facility_contract_terminal_destroyed_1bit",
	},
	trainingRange: {
		built: "facility_phase_station_minimal",
		destroyed: "facility_training_range_destroyed",
	},
	salvageForge: {
		built: "facility_salvage_forge_1bit",
		destroyed: "facility_salvage_forge_destroyed_1bit",
	},
	debriefTerminal: {
		built: "facility_debrief_terminal_1bit",
		destroyed: "facility_debrief_terminal_destroyed_1bit",
	},
};
export const hub: Level = {
	reset: () => {
		lvlData = {};
		phaseFieldDamageCooldown = 0;
		audioService.stopMusic();
		endSong();
	},
	onStart: () => {
		audioService.playMusic("hub", {
			volume: 1,
			loop: true,
			continueIfPlaying: true,
		});
		spawnHubBoundaries();
		const wormholePos = k.center().add(650, -350);
		const wormhole = spawnLevel({
			pos: wormholePos,
			levelName: "level1",
			visual: "wormhole",
			label: "",
			onEnter: (_portal, selectLevel, cancel) => {
				const zone = getUnlockedWarpZones()[0];
				if (!zone) {
					cancel();
					return;
				}
				showRunPreparation({
					zone,
					onLaunch: () => {
						const firstFloor = beginRunSession(zone.id);
						if (!firstFloor) {
							cancel();
							return;
						}
						selectLevel(firstFloor.levelKey);
					},
					onCancel: cancel,
				});
			},
		});
		const wormholeGravity = spawnGravityPull({
			pos: wormholePos,
			radius: 130,
			strength: 14,
			falloff: 1.35,
			visualizePull: true,
			targetTags: [
				tags.unit,
				tags.friendly,
				tags.enemy,
				tags.debree,
				tags.projectile,
			],
			tagStrengthMultipliers: {
				[tags.projectile]: 10,
			},
		});
		wormhole.onDestroy(() => {
			if (wormholeGravity.exists()) k.destroy(wormholeGravity);
		});
		spawnHubGhostChest(k.center().add(-60, 20));
		spawnHubGhostWeaponChest(k.center().add(80, 20));
		spawnCrate({
			pos: k.center().add(-300, -50),
			am: 4,
			hp: 4,
			powerupMultiplier: 0,
			tier: "normal",
			speed: 0,
			destroyOffscreen: false,
		});
		spawnCrate({
			pos: k.center().add(230, 110),
			am: 4,
			hp: 6,
			powerupMultiplier: 0,
			tier: "golden",
			speed: 0,
			destroyOffscreen: false,
		});
		const healthOrb = spawnHealthOrb(k.center().add(-330, 90));
		healthOrb.speed = 0;
		spawnDebreeValues(k.center().add(90, 55), [1, 2, 3, 4, 5]);
		const hubFacilityPositions = getHubFacilityPositions();
		const repairCrew = spawnHubRepairCrew(hubFacilityPositions.trainingRange);
		spawnHubFacilities(hubFacilityPositions, repairCrew);
		spawnHubRestoration(
			k.center(),
			hubFacilityPositions.trainingRange,
			k.vec2(hubHalfWidth, hubHalfHeight)
		);
		spawnHubBackgroundDepth();
		spawnPhaseShiftAsteroidField();
		saveGame("slot1");
		k.wait(0.45, showPendingRunEndSummary);
	},
	lvlUpd: () => {
		const center = k.center();
		playerObj.pos.x = k.clamp(
			playerObj.pos.x,
			center.x - hubHalfWidth,
			center.x + hubHalfWidth
		);
		playerObj.pos.y = k.clamp(
			playerObj.pos.y,
			center.y - hubHalfHeight,
			center.y + hubHalfHeight
		);
		phaseFieldDamageCooldown = Math.max(
			0,
			phaseFieldDamageCooldown - k.dt()
		);
		damagePlayerInPhaseField();

		// Continuously spawn background asteroids
		bgAsteroidTimer += k.dt();

		if (bgAsteroidTimer >= 2) {
			bgAsteroidTimer = 0;

			// Randomly choose spawn side and direction
			const side = k.rand(0, 4);
			let startPos: any;
			let endPos: any;

			if (side < 1) {
				// Spawn from left, move right
				startPos = k.vec2(-50, k.rand(0, k.height()));
				endPos = k.vec2(k.width() + 50, k.rand(0, k.height()));
			} else if (side < 2) {
				// Spawn from right, move left
				startPos = k.vec2(k.width() + 50, k.rand(0, k.height()));
				endPos = k.vec2(-50, k.rand(0, k.height()));
			} else if (side < 3) {
				// Spawn from top, move down
				startPos = k.vec2(k.rand(0, k.width()), -50);
				endPos = k.vec2(k.rand(0, k.width()), k.height() + 50);
			} else {
				// Spawn from bottom, move up
				startPos = k.vec2(k.rand(0, k.width()), k.height() + 50);
				endPos = k.vec2(k.rand(0, k.width()), -50);
			}

			spawnBackgroundObject({
				pos: startPos,
				moveTo: endPos,
				speed: k.rand(1, 2),
				sprite:
					ASTEROID_SPRITES[
						Math.floor(k.rand(0, ASTEROID_SPRITES.length))
					],
				scale: k.rand(0.5, 1.5),
				color: k.rgb(k.rand(80, 120), k.rand(80, 120), k.rand(80, 120)),
				parallaxLevel: k.rand(4, 10),
				opacity: k.rand(0.3, 0.7),
				rotation: k.rand(0, 360),
				rotationSpeed: k.chance(0.5) ? k.rand(-0.5, 0.5) : 0,
			});
		}
	},
};

function spawnHubGhostChest(pos: Vec2) {
	const stock = getHubGhostChestStock("salvage");
	if (stock <= 0) return;
	const purchaseIndex = getHubGhostChestCapacity("salvage") - stock;
	const cost = ghostChestCosts[purchaseIndex];
	if (cost === undefined) return;
	spawnChest(pos, 1, {
		ghostCost: cost,
		debreeBurstCount: 12 + Math.round(cost * 0.7),
		onPurchased: () => {
			consumeHubGhostChest("salvage");
			saveGame("slot1");
		},
		onOpened: () => spawnHubGhostChest(pos),
	});
}

function spawnHubGhostWeaponChest(pos: Vec2) {
	if (getHubGhostChestStock("weapon") <= 0) return;
	spawnChest(pos, 1, {
		rewardType: "weapon",
		ghostCost: ghostWeaponChestCost,
		debreeBurstCount: 12 + Math.round(ghostWeaponChestCost * 0.7),
		onPurchased: () => {
			consumeHubGhostChest("weapon");
			saveGame("slot1");
		},
	});
}

function spawnHubBackgroundDepth() {
	const center = k.center();
	spawnBackgroundObject({
		pos: center,
		sprite: "bg_destroyed_planet",
		scale: 1.76,
		color: k.rgb(16, 24, 32),
		opacity: 1,
		parallaxLevel: 36,
		rotation: -8,
		rotationSpeed: 0,
	});

	const scenery = [
		{
			pos: center.add(-390, -190),
			sprite: "bg_destroyed_planet",
			scale: 0.28,
			color: k.rgb(21, 29, 37),
			opacity: 1,
			parallaxLevel: 18,
			rotation: -12,
			rotationSpeed: 0,
		},
		{
			pos: center.add(410, 205),
			sprite: "bg_destroyed_planet_sliced",
			scale: 0.25,
			color: k.rgb(19, 27, 35),
			opacity: 1,
			parallaxLevel: 15,
			rotation: 28,
			rotationSpeed: 0,
		},
		...[
			[-430, -135, 2.1, -15, 12, 0],
			[420, -150, 1.8, 32, 10, 0],
			[-420, 155, 2.2, 18, 8, 0],
			[430, 145, 2, -28, 9, 0],
			[-40, -265, 1.7, 8, 11, 0],
			[70, 255, 1.9, -8, 10, 0],
		].map(([x, y, scale, rotation, parallaxLevel, rotationSpeed]) => ({
			pos: center.add(x, y),
			sprite: "bg_building1",
			scale,
			color: k.rgb(13, 16, 20),
			opacity: 1,
			parallaxLevel,
			rotation,
			rotationSpeed,
		})),
		...[
			[-260, -125, 1, 7],
			[275, -120, 0.85, 11],
			[-285, 135, 0.9, 9],
			[290, 120, 1.05, 6],
			[15, -210, 0.75, 14],
			[-20, 210, 0.8, 12],
		].map(([x, y, scale, parallaxLevel]) => ({
			pos: center.add(x, y),
			sprite: "bg_moon1",
			scale,
			color: k.rgb(34, 39, 45),
			opacity: 1,
			parallaxLevel,
			rotation: x % 360,
			rotationSpeed: 0,
		})),
	];

	for (const object of scenery) spawnBackgroundObject(object);

	const planetChunks = [
		[-620, -270, 7, 0.62, -18, 24, -0.025],
		[650, -230, 5, 0.52, 24, 19, 0.035],
		[-680, 280, 6, 0.48, 16, 17, 0.03],
		[660, 300, 4, 0.6, -32, 21, -0.02],
		[20, -390, 1, 0.6, 8, 14, 0.04],
		[40, 390, 3, 0.65, -12, 15, -0.035],
	] as const;
	for (const [x, y, spriteIndex, scale, rotation, parallaxLevel, rotationSpeed]
		of planetChunks) {
		spawnBackgroundObject({
			pos: center.add(x, y),
			sprite: PLANET_CHUNK_SPRITES[spriteIndex],
			scale,
			color: k.rgb(28, 36, 44),
			opacity: 0.72,
			parallaxLevel,
			rotation,
			rotationSpeed,
		});
	}

	for (let index = 0; index < 28; index++) {
		const angle = (360 / 28) * index + k.rand(-4, 4);
		const distance = 205 + (index % 4) * 78 + k.rand(-22, 22);
		spawnBackgroundObject({
			pos: center.add(k.Vec2.fromAngle(angle).scale(distance)),
			sprite:
				ASTEROID_SPRITES[
					Math.floor(k.rand(0, ASTEROID_SPRITES.length))
				],
			scale: k.rand(0.45, 1.25),
			color: k.rgb(
				k.rand(27, 40),
				k.rand(32, 46),
				k.rand(38, 52)
			),
			opacity: 1,
			parallaxLevel: k.rand(6, 14),
			rotation: k.rand(0, 360),
			rotationSpeed: k.chance(0.45) ? k.rand(-0.9, 0.9) : 0,
		});
	}
}

function spawnPhaseShiftAsteroidField() {
	const fieldCenter = getPhaseFieldCenter();
	const asteroids: PhaseFieldAsteroid[] = [];
	spawnAsteroidRing(177, 46, 0, asteroids);
	spawnAsteroidRing(207, 54, 0.5, asteroids);
	const collisionInnerRadius = 150;
	const collisionOuterRadius = 235;
	const controller = k.add([
		k.pos(fieldCenter),
		k.layer(layers.bg),
		k.z(2),
		{
			draw() {
				for (const asteroid of asteroids) {
					k.drawSprite({
						sprite: asteroid.sprite,
						pos: asteroid.offset,
						anchor: "center",
						angle: asteroid.angle,
						scale: k.vec2(asteroid.scale),
						color: asteroid.color,
					});
				}
			},
		},
		tags.hubPhaseField,
		tags.props,
		tags.gameLoop,
	]);

	registerBatchedEntityUpdate("world", controller, () => {
		for (const asteroid of asteroids) {
			asteroid.angle += asteroid.rotationSpeed * k.dt();
		}

		for (const projectile of projectiles) {
			if (
				!projectile.exists() ||
				!projectile.tags.includes(tags.friendly)
			) continue;
			const fieldDistance = projectile.pos.dist(fieldCenter);
			if (
				fieldDistance < collisionInnerRadius ||
				fieldDistance > collisionOuterRadius
			) continue;

			for (const asteroid of asteroids) {
				const asteroidPos = fieldCenter.add(asteroid.offset);
				if (
					projectile.pos.dist(asteroidPos) >= asteroid.hitRadius
				) continue;
				const normal = projectile.pos.sub(asteroidPos);
				if (!tryBounceProjectile(
					projectile,
					undefined,
					normal.len() > 0 ? normal.unit() : undefined
				)) {
					k.destroy(projectile);
				}
				break;
			}
		}
	});
}

interface PhaseFieldAsteroid {
	offset: Vec2;
	sprite: string;
	angle: number;
	scale: number;
	color: Color;
	hitRadius: number;
	rotationSpeed: number;
}

function spawnAsteroidRing(
	radius: number,
	count: number,
	angleOffset: number,
	asteroids: PhaseFieldAsteroid[]
) {
	for (let index = 0; index < count; index++) {
		const angle = ((index + angleOffset) / count) * 360;
		const radialJitter = k.rand(-5, 5);
		const asteroidScale = k.rand(1.35, 1.9);
		const shade = k.rand(220, 256);
		asteroids.push({
			offset: k.Vec2.fromAngle(angle).scale(radius + radialJitter),
			sprite:
				ASTEROID_SPRITES[
					Math.floor(k.rand(0, ASTEROID_SPRITES.length))
				],
			angle: k.rand(0, 360),
			scale: asteroidScale,
			color: k.rgb(shade, shade, shade),
			hitRadius: 8 * asteroidScale,
			rotationSpeed: k.chance(0.65) ? k.rand(-5, 5) : 0,
		});
	}
}

function damagePlayerInPhaseField() {
	if (phaseJumpActive()) return;
	if (phaseFieldDamageCooldown > 0) return;

	const fieldCenter = getPhaseFieldCenter();
	const offset = playerObj.pos.sub(fieldCenter);
	const distance = offset.len();
	if (
		distance <= phaseFieldInnerRadius ||
		distance >= phaseFieldOuterRadius
	) return;

	phaseFieldDamageCooldown = 0.3;
	applyDamage(playerObj, 99, {
		source: {
			name: "PHASE-FIELD ASTEROID",
			sprite: "asteroid1",
		},
	});
}

function getPhaseFieldCenter() {
	return k.center().add(phaseFieldOffsetX, phaseFieldOffsetY);
}

function getHubFacilityPositions() {
	const center = k.center();
	return {
		contractTerminal: center.add(160, -300),
		trainingRange: center.add(570, 260),
		salvageForge: center.add(-360, -260),
		debriefTerminal: center.add(-560, 100),
	} satisfies Record<HubFacilityId, ReturnType<typeof k.vec2>>;
}

function spawnHubFacilities(
	positions: Record<HubFacilityId, ReturnType<typeof k.vec2>>,
	repairCrew: HubRepairCrew
) {
	for (const facility of HUB_FACILITIES) {
		spawnHubFacility(facility, positions[facility.id], repairCrew);
	}
}

function spawnHubFacility(
	facility: HubFacilityDefinition,
	pos: ReturnType<typeof k.vec2>,
	repairCrew: HubRepairCrew
) {
	let built = isFacilityBuilt(facility.id);
	const unlocked = () => isFacilityUnlocked(facility.id);
	const sprites = hubFacilitySprites[facility.id];
	const building = k.add([
		k.pos(pos),
		interactable(hubFacilityInteractRadius, () => {
			if (!built) {
				const activeConstruction = getFacilityConstruction();
				if (activeConstruction || !unlocked() || getScore() < facility.cost) {
					playRequirementErrorSound();
					return;
				}
				if (!startFacilityConstruction(facility.id)) return;
				if (!spendScore(facility.cost)) {
					playRequirementErrorSound();
					return;
				}
				if (facility.cost > 0) {
					spawnCurrencyBurst(building.pos.clone(), {
						particleCount: purchaseBurstParticleCount(facility.cost),
					});
				}
				saveGame("slot1");
				repairCrew.setRepairTarget(building.pos);
				return;
			}
			openHubFacility(facility.id);
		}),
		tags.gameLoop,
		tags.props,
	]);
	const buildingVisual = building.add([
		k.sprite(built ? sprites.built : sprites.destroyed),
		k.anchor("center"),
		k.layer(layers.buildings),
		k.scale(getHubFacilityVisualScale(facility.id, built)),
		k.color(getHubFacilityVisualColor(facility.id, built)),
		k.opacity(built ? 1 : 0.68),
	]);
	const newInfoMarker = facility.id === "trainingRange"
		? building.add([
			k.text("!", { size: UI_FONT_SIZES.display, font: "unscii" }),
			k.pos(0, -150),
			k.anchor("center"),
			k.color(...UI_COLORS.warning),
			k.opacity(1),
			k.layer(layers.gameText),
			k.z(210),
		])
		: undefined;
	if (newInfoMarker) {
		newInfoMarker.hidden = !built || !hasUnseenBlueprints();
	}
	if (built && facility.id === "trainingRange") {
		spawnTrainingDummies(pos);
	}
	if (getFacilityConstruction()?.facilityId === facility.id) {
		repairCrew.setRepairTarget(pos);
	}
	const finishBuilding = () => {
		if (built) return;
		built = true;
		buildingVisual.use(k.sprite(sprites.built));
		buildingVisual.scale = k.vec2(getHubFacilityVisualScale(facility.id, true));
		buildingVisual.color = getHubFacilityVisualColor(facility.id, true);
		buildingVisual.opacity = 1;
		repairCrew.setRepairTarget(undefined);
		starsEmitter.emitter.position = building.pos;
		starsEmitter.emit(28);
		if (facility.id === "trainingRange") {
			spawnTrainingDummies(building.pos);
		}
		saveGame("slot1");
	};
	const prompt = createInteractionPrompt({
		target: building,
		offset: k.vec2(0, hubFacilityLabelOffsetY),
		width: 280,
		content: () => built
			? {
				title: facility.name,
				notification: facility.id === "trainingRange" && hasUnseenBlueprints(),
				action: "OPEN FACILITY",
			}
			: getFacilityConstruction()?.facilityId === facility.id
				? {
					title: facility.name,
					action: "DRONES REPAIRING",
					detailLeft: `${Math.ceil(getFacilityConstructionRemainingMs(facility.id) / 1000)} SECONDS`,
					detailRight: `${Math.min(100, Math.round((1 - getFacilityConstructionRemainingMs(facility.id) / HUB_FACILITY_BUILD_DURATION_MS) * 100))}%`,
				}
			: getFacilityConstruction()
				? {
					title: facility.name,
					action: "REPAIR CREW BUSY",
				}
			: !unlocked()
				? {
					title: facility.name,
					action: "RESTORATION LOCKED",
					detailLeft: `REQUIRES HUB LEVEL ${facility.requiredHubLevel}`,
					detailRight: `LEVEL ${getHubLevel()}`,
				}
				: {
				title: facility.name,
				action: "BUILD FACILITY",
				detailLeft: facility.cost === 0
					? "FREE"
					: `COST ${facility.cost} SCRAP`,
				detailRight: `${getScore()} AVAILABLE`,
			},
	});

	registerBatchedEntityUpdate("world", building, () => {
		const construction = getFacilityConstruction();
		if (!built && isFacilityBuilt(facility.id)) finishBuilding();
		if (!built && construction?.facilityId === facility.id) {
			buildingVisual.opacity = k.wave(0.46, 0.76, k.time() * 5);
		}
		if (newInfoMarker) {
			const visible = built && hasUnseenBlueprints();
			newInfoMarker.hidden = !visible;
			if (visible) {
				newInfoMarker.pos.y = -150 + Math.sin(k.time() * 3.2) * 4;
				newInfoMarker.opacity = k.wave(0.55, 1, k.time() * 5);
			}
		}
		prompt.update(building.isInRange);
	});
}

function getHubFacilityVisualScale(id: HubFacilityId, built: boolean) {
	if (id === "trainingRange" && !built) return hubFacilityScale
	return hubFacilityScale * 0.5
}

function getHubFacilityVisualColor(id: HubFacilityId, built: boolean) {
	if (!built) return k.rgb(100, 110, 120)
	return k.rgb(145, 160, 170)
}

function openHubFacility(id: HubFacilityId) {
	if (id === "contractTerminal") showRunTerminal("contracts");
	if (id === "salvageForge") showRunTerminal("forge");
	if (id === "debriefTerminal") showRunTerminal("debrief");
	if (id === "trainingRange") showPhaseStation();
}

function spawnTrainingDummies(facilityPos: ReturnType<typeof k.vec2>) {
	const hubSession = lvlData;
	const offsets = getHubLevel() >= 5 ? [-60, 0, 60] : [0];
	for (const offsetX of offsets) {
		spawnTrainingDummy(facilityPos, offsetX, hubSession);
	}
}

function spawnTrainingDummy(
	facilityPos: ReturnType<typeof k.vec2>,
	offsetX: number,
	hubSession: typeof lvlData
) {
	spawnMeteorite({
		pos: facilityPos.add(offsetX, 90),
		dir: k.vec2(0, 0),
		scoreOnKill: 0,
		hp: 10000,
		speed: 0,
		splitOnDeath: 0,
		destroyOffscreen: false,
		powerupMultiplier: 0,
		tags: [tags.trainingTarget],
		onDeath: () => {
			k.wait(trainingDummyRespawnDelay, () => {
				if (lvlData !== hubSession) return;
				spawnTrainingDummy(facilityPos, offsetX, hubSession);
			});
		},
	});
}

function spawnHubBoundaries() {
	const center = k.center();
	const minX = center.x - hubHalfWidth;
	const maxX = center.x + hubHalfWidth;
	const minY = center.y - hubHalfHeight;
	const maxY = center.y + hubHalfHeight;
	const edgeThickness = 5;

	const edges = [
		{
			pos: k.vec2(minX, center.y),
			size: k.vec2(edgeThickness, hubHalfHeight * 2),
		},
		{
			pos: k.vec2(maxX, center.y),
			size: k.vec2(edgeThickness, hubHalfHeight * 2),
		},
		{
			pos: k.vec2(center.x, minY),
			size: k.vec2(hubHalfWidth * 2, edgeThickness),
		},
		{
			pos: k.vec2(center.x, maxY),
			size: k.vec2(hubHalfWidth * 2, edgeThickness),
		},
	];

	for (const edge of edges) {
		k.add([
			k.rect(edge.size.x, edge.size.y),
			k.pos(edge.pos),
			k.anchor("center"),
			k.color(k.WHITE),
			k.shader("hubBoundaryFade", () => ({
				u_time: k.time(),
				u_playerPos: playerObj.pos,
				u_revealRadius: boundaryRevealRadius,
			})),
			tags.hubBoundary,
			tags.props,
		]);
	}
}
