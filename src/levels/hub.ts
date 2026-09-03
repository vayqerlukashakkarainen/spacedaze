import { endSong } from "../web";
import { audioService } from "../services/audioService";
import { spawnLevel } from "../spawn/spawnLevel";
import { getScore, k, spendScore } from "../main";
import { Level } from "./levels";
import { spawnBackgroundObject } from "../spawn/spawnBackgroundObject";
import { spawnChest } from "../spawn/spawnChest";
import { checkProjectileIntersection, playerObj } from "../game";
import { tags } from "../tags";
import { spawnRecoveryShop } from "../spawn/spawnRecoveryShop";
import { interactable } from "../comp/interactable";
import {
	buildFacility,
	HUB_FACILITIES,
	HubFacilityDefinition,
	HubFacilityId,
	isFacilityBuilt,
} from "../services/hubProgressService";
import {
	showBlueprintArchive,
	showArsenal,
	showContractTerminal,
	showRunDebrief,
	showSalvageForge,
	showWarpZoneRegistry,
	showWarpZoneSelector,
} from "../ui/hubFacilities";
import { saveGame } from "../util";
import { starsEmitter } from "../particles";
import { beginRunSession } from "../services/runDirectorService";
import { ASTEROID_SPRITES } from "../asteroidSprites";
import { spawnMeteorite } from "../spawn/spawnAsteroid";
import { spawnDebreeValues } from "../spawn/spawnDebree";
import { phaseJumpActive } from "../setupPlayer";
import { tryBounceProjectile } from "../services/projectileService";
import { applyDamage } from "../services/damageService";
import { spawnGravityPull } from "../spawn/spawnGravityPull";
import { spawnHealthOrb } from "../spawn/spawnHealthOrb";

let lvlData: any = {};
let bgAsteroidTimer = 0;
let phaseFieldDamageCooldown = 0;
const hubHalfWidth = 1050;
const hubHalfHeight = 520;
const boundaryRevealRadius = 160;
const phaseFieldOffsetX = 720;
const phaseFieldOffsetY = 80;
const phaseFieldInnerRadius = 162;
const phaseFieldOuterRadius = 220;
const trainingDummyRespawnDelay = 1.5;
const hubFacilitySprites: Record<
	HubFacilityId,
	{ built: string; destroyed: string }
> = {
	contractTerminal: {
		built: "facility_contract_terminal",
		destroyed: "facility_contract_terminal_destroyed",
	},
	salvageForge: {
		built: "facility_salvage_forge",
		destroyed: "facility_salvage_forge_destroyed",
	},
	debriefTerminal: {
		built: "facility_debrief_terminal",
		destroyed: "facility_debrief_terminal_destroyed",
	},
	trainingRange: {
		built: "facility_training_range",
		destroyed: "facility_training_range_destroyed",
	},
	blueprintArchive: {
		built: "facility_blueprint_archive",
		destroyed: "facility_blueprint_archive_destroyed",
	},
	warpZones: {
		built: "facility_warp_zones",
		destroyed: "facility_warp_zones_destroyed",
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
		audioService.playMusic("hub", { volume: 1, loop: true });
		spawnHubBoundaries();
		const wormholePos = k.center().add(180, -120);
		const wormhole = spawnLevel({
			pos: wormholePos,
			levelName: "level1",
			visual: "wormhole",
			label: "ENTER WORMHOLE",
			onEnter: (_portal, selectLevel, cancel) => {
				showWarpZoneSelector((zoneId) => {
					const firstFloor = beginRunSession(zoneId);
					if (!firstFloor) {
						cancel();
						return;
					}
					selectLevel(firstFloor.levelKey);
				}, cancel);
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
		spawnChest(k.center().add(-50, 0));
		const healthOrb = spawnHealthOrb(k.center().add(-220, 80));
		healthOrb.speed = 0;
		spawnRecoveryShop(k.center().add(-410, -170));
		spawnDebreeValues(k.center().add(90, 55), [1, 2, 3, 4, 5]);
		spawnHubFacilities();
		spawnHubBackgroundDepth();
		spawnPhaseShiftAsteroidField();
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

function spawnHubBackgroundDepth() {
	const center = k.center();
	spawnHubStarLayer(center, 18, 110, 1180, 0.3, -30);
	spawnHubStarLayer(center, 9, 72, 900, 0.46, -20);
	spawnBackgroundObject({
		pos: center,
		sprite: "bg_destroyed_planet",
		scale: 1.1,
		color: k.rgb(9, 13, 17),
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
			color: k.rgb(15, 19, 23),
			opacity: 1,
			parallaxLevel: 18,
			rotation: -12,
			rotationSpeed: 0,
		},
		{
			pos: center.add(410, 205),
			sprite: "bg_destroyed_planet_sliced",
			scale: 0.25,
			color: k.rgb(12, 17, 22),
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
	spawnAsteroidRing(fieldCenter, 177, 46, 0);
	spawnAsteroidRing(fieldCenter, 207, 54, 0.5);
}

function spawnAsteroidRing(
	center: ReturnType<typeof k.vec2>,
	radius: number,
	count: number,
	angleOffset: number
) {
	for (let index = 0; index < count; index++) {
		const angle = ((index + angleOffset) / count) * 360;
		const radialJitter = k.rand(-5, 5);
		const asteroidScale = k.rand(1.35, 1.9);
		const shade = k.rand(220, 256);
		const asteroid = k.add([
			k.pos(center.add(k.Vec2.fromAngle(angle).scale(radius + radialJitter))),
			k.sprite(
				ASTEROID_SPRITES[
					Math.floor(k.rand(0, ASTEROID_SPRITES.length))
				]
			),
			k.anchor("center"),
			k.rotate(k.rand(0, 360)),
			k.scale(asteroidScale),
			k.color(shade, shade, shade),
			k.z(2),
			{
				hitRadius: 8 * asteroidScale,
				rotationSpeed: k.chance(0.65) ? k.rand(-5, 5) : 0,
			},
			tags.hubPhaseField,
			tags.props,
			tags.gameLoop,
		]);

		asteroid.onUpdate(() => {
			asteroid.angle += asteroid.rotationSpeed * k.dt();
			checkProjectileIntersection(
				asteroid.pos,
				asteroid.hitRadius,
				tags.friendly,
				(projectile) => {
					if (!tryBounceProjectile(projectile, asteroid)) {
						k.destroy(projectile);
					}
				}
			);
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
	applyDamage(playerObj, 99);
}

function getPhaseFieldCenter() {
	return k.center().add(phaseFieldOffsetX, phaseFieldOffsetY);
}

function spawnHubStarLayer(
	center: ReturnType<typeof k.vec2>,
	parallaxLevel: number,
	count: number,
	radius: number,
	brightness: number,
	z: number
) {
	const initialCameraPos = k.getCamPos().clone();
	const layer = k.add([
		k.pos(center),
		k.layer("bg"),
		k.z(z),
		tags.levelBg,
		tags.gameLoop,
	]);

	for (let index = 0; index < count; index++) {
		const bright = k.rand(0.55, 1);
		const size = k.chance(0.16) ? 2 : 1;
		layer.add([
			k.rect(size, size),
			k.pos(k.rand(-radius, radius), k.rand(-radius * 0.65, radius * 0.65)),
			k.color(
				120 * bright * brightness,
				190 * bright * brightness,
				220 * bright * brightness
			),
			k.opacity(1),
		]);
	}

	layer.onUpdate(() => {
		const cameraDelta = k.getCamPos().sub(initialCameraPos);
		layer.pos = center.add(
			cameraDelta.scale(1 - 1 / parallaxLevel)
		);
	});
}

function spawnHubFacilities() {
	const center = k.center();
	const positions: Record<HubFacilityId, ReturnType<typeof k.vec2>> = {
		contractTerminal: center.add(80, -180),
		salvageForge: center.add(-370, 70),
		debriefTerminal: center.add(-170, -180),
		trainingRange: center.add(330, 145),
		blueprintArchive: center.add(-120, 155),
		warpZones: center.add(385, -145),
	};

	for (const facility of HUB_FACILITIES) {
		spawnHubFacility(facility, positions[facility.id]);
	}
}

function spawnHubFacility(
	facility: HubFacilityDefinition,
	pos: ReturnType<typeof k.vec2>
) {
	let built = isFacilityBuilt(facility.id);
	const sprites = hubFacilitySprites[facility.id];
	const building = k.add([
		k.pos(pos),
		interactable(72, () => {
			if (!built) {
				if (!spendScore(facility.cost)) return;
				buildFacility(facility.id);
				saveGame("slot1");
				built = true;
				buildingVisual.use(k.sprite(sprites.built));
				buildingVisual.color = k.WHITE;
				buildingVisual.opacity = 1;
				starsEmitter.emitter.position = building.pos;
				starsEmitter.emit(28);
				if (facility.id === "trainingRange") {
					spawnTrainingDummies(building.pos);
				}
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
		k.scale(1),
		k.color(built ? k.WHITE : k.rgb(100, 110, 120)),
		k.opacity(built ? 1 : 0.68),
	]);
	if (built && facility.id === "trainingRange") {
		spawnTrainingDummies(pos);
	}
	const label = building.add([
		k.text("", {
			size: 9,
			font: "unscii",
			width: 220,
			align: "center",
		}),
		k.pos(0, 76),
		k.anchor("center"),
		k.color(k.WHITE),
		k.opacity(0),
	]);

	building.onUpdate(() => {
		label.opacity = building.isInRange ? 1 : 0;
		label.text = built
			? `F  ${facility.name}`
			: facility.cost === 0
				? `F  BUILD ${facility.name}\nFREE`
				: `F  BUILD ${facility.name}\n${facility.cost} SCRAP  |  ${getScore()} AVAILABLE`;
	});
}

function openHubFacility(id: HubFacilityId) {
	if (id === "contractTerminal") showContractTerminal();
	if (id === "salvageForge") showSalvageForge();
	if (id === "debriefTerminal") showRunDebrief();
	if (id === "trainingRange") showArsenal();
	if (id === "blueprintArchive") showBlueprintArchive();
	if (id === "warpZones") showWarpZoneRegistry();
}

function spawnTrainingDummies(facilityPos: ReturnType<typeof k.vec2>) {
	const hubSession = lvlData;
	for (const offsetX of [-60, 0, 60]) {
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
