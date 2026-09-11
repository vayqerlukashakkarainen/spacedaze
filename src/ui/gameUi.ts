import {
	AnimateComp,
	type Color,
	ColorComp,
	GameObj,
	OpacityComp,
	PosComp,
	RectComp,
	Vec2,
} from "kaplay";
import { getScore, k, layers, mainSoundVolume } from "../main";
import {
	getRewardDefinition,
	isAbilityReward,
	Reward,
	REWARD_RARITY_COLORS,
	getRewardDisplayColor,
} from "../services/economy/rewardService";
import { tags } from "../tags";
import { recordRunReward } from "../services/runs/runInventoryService";
import { discoverBlueprint } from "../services/hub/hubProgressService";
import { recordRunReward as recordRunRewardStat } from "../services/runs/runStatsService";
import {
	recordTelemetryRewardSelected,
	type RewardTelemetryDetails,
} from "../services/runs/runTelemetryService";
import {
	showCollectedRewardPopover,
	showDiscoveredRewardPopover,
} from "../services/ui/popoverService";
import { createUiPanel } from "./common/panel";
import { UI_COLORS, UI_FONT_SIZES } from "./common/theme";
import { registerBatchedUiUpdate } from "../services/ui/uiUpdateService";
import { getRerollTokens, player } from "../player";
import type { ActiveModuleDefinition } from "../services/abilities/activeModuleService";
import { getPickupVisual } from "../visuals/pickupVisualCatalog";
import { requirePrimaryVisualSprite } from "../visuals/visualRepresentation";
import { getEquippedWeapon } from "../services/player/weaponService";
import { debreeRunActive } from "../services/economy/debreeEconomyService";
import { getPhaseCores } from "../services/economy/phaseCoreService";
import { getPsionicPlates } from "../services/economy/psionicPlateService";
import { getThrusterParts } from "../services/economy/thrusterPartService";
import type { AbilityDefinition } from "../services/abilities/abilityRegistry";
import { getAbilityDefinition } from "../services/abilities/abilityRegistry";
import {
	getEquippedMobilityAbilityId,
} from "../services/abilities/abilityLoadoutService";
import { gameSoundService } from "../services/audio/gameSoundService"
import { getRunLevelSnapshot } from "../services/runs/runLevelService";
import { createUiProgressBar } from "./common/progressBar";
import { hideRunLevelChoice, showRunLevelChoice } from "./runLevelChoice";
import { RewardRarity } from "../types/rewardTypes";
import {
	getActiveRoomFloor,
	getFloorKeyCount,
} from "../services/world/roomFloorService";

let healthBarBaseFill: GameObj<RectComp | ColorComp> | null = null;
let healthBarBonusFill: GameObj<RectComp | ColorComp | PosComp> | null = null;
let healthBarLabel: GameObj | null = null;
let steeringModeLabel: GameObj | null = null;
let healthCapacity = 0;
let displayedHealth = 0;
let specialBar: GameObj<RectComp> | null = null;
let missileCooldownGroup: GameObj | null = null;
let activeModuleIcon: GameObj | null = null;
let primaryWeaponIcon: GameObj | null = null;
let secondaryWarning: GameObj<OpacityComp> | null = null;
let secondaryEmptyRing: GameObj<OpacityComp> | null = null;
let phaseJumpIcon: GameObj | null = null;
let phaseJumpSegments: GameObj<OpacityComp | ColorComp>[] = [];
let mobilityChargeLabel: GameObj | null = null;
let mobilityWarning: GameObj<OpacityComp> | null = null;
let ultimateIcon: GameObj | null = null;
let ultimateEmptyRing: GameObj<OpacityComp> | null = null;
let ultimateBar: GameObj<RectComp> | null = null;
let ultimateWarning: GameObj<OpacityComp> | null = null;
let ultimateReadyGodrays: GameObj<OpacityComp> | null = null;
let ultimatePulseScale = 1;
let shipStatusPanel: GameObj | null = null;
let salvageDisplay: GameObj | null = null;
let rerollDisplay: GameObj | null = null;
let phaseCoreDisplay: GameObj | null = null;
let psionicPlateDisplay: GameObj | null = null;
let thrusterPartDisplay: GameObj | null = null;
let roomKeyDisplay: GameObj | null = null;
let systemsPanel: GameObj | null = null;
const debugHiddenHudTexts = new Map<
	number,
	{ object: GameObj; wasHidden: boolean }
>();
let runLevelHud: GameObj | null = null;
const collectedItems = new Map<
	string,
	{
		count: number;
		reward: Reward;
	}
>();

const statusPanelWidth = 408;
const statusPanelHeight = 30;
const systemsPanelWidth = 286;
const systemsPanelHeight = 32;
const abilityBarWidth = 100;
const weaponSocketSize = 28;
const weaponSocketGap = 14;
const secondaryCooldownWidth = 24;
const ultimateBarWidth = 24;
const phaseJumpSegmentCount = 10;
const HUD_SCALE = 1.5;
const HUD_MARGIN = 12;
const SALVAGE_GAIN_LIFETIME = 0.7;
const HEALTH_BAR_X = 4;
const HEALTH_BAR_Y = 17;
const HEALTH_BAR_WIDTH = 104;
const HEALTH_BAR_HEIGHT = 7;
const HEALTH_BAR_SEGMENTS = 10;
const LOW_HEALTH_COLOR_THRESHOLD = 0.7;
const LOW_HEALTH_COLOR = [255, 70, 70] as const;
const ULTIMATE_READY_COLOR = [255, 142, 36] as const;
let displayedSalvage = Number.NaN;
let displayedDebreeMode = "";
let displayedRerollTokens = Number.NaN;
let displayedPhaseCores = Number.NaN;
let displayedPsionicPlates = Number.NaN;
let displayedThrusterParts = Number.NaN;
let displayedRoomKeys = Number.NaN;
let displayedSpecialWidth = Number.NaN;
let displayedMissileVisibility: boolean | undefined;
let displayedActiveModuleId = "";
let displayedPrimaryWeaponId = "";
let emptySecondaryFlashRemaining = 0;
let emptyMobilityFlashRemaining = 0;
let emptyUltimateFlashRemaining = 0;
let displayedJumpCharges = Number.NaN;
let displayedJumpMaxCharges = Number.NaN;
let displayedJumpProgress = Number.NaN;
let displayedMobilityId = "";
let displayedUltimateId = "";
let displayedUltimateProgress = Number.NaN;
let displayedSteeringMode = "";
export function setupGameLoopUi(health: number, missilesUnlocked = false) {
	setupRunLevelHud();
	shipStatusPanel = createUiPanel({
		pos: k.vec2(
			HUD_MARGIN,
			k.height() - statusPanelHeight * HUD_SCALE - HUD_MARGIN
		),
		size: k.vec2(statusPanelWidth, statusPanelHeight),
		tags: [tags.gameLoopUi],
		frameless: true,
		scale: HUD_SCALE,
	});
	setupPlayerHealthBar(health);
	const inventoryDetails = shipStatusPanel.add([]);
	inventoryDetails.hidden = true;
	shipStatusPanel.add([
		k.pos(116, 5),
		k.rect(1, 20),
		k.color(...UI_COLORS.border),
		k.layer(layers.hudShapes),
	]);
	inventoryDetails.add([
		k.pos(180, 5),
		k.rect(1, 20),
		k.color(...UI_COLORS.border),
		k.layer(layers.hudShapes),
	]);
	inventoryDetails.add([
		k.pos(228, 5),
		k.rect(1, 20),
		k.color(...UI_COLORS.border),
		k.layer(layers.hudShapes),
	]);
	inventoryDetails.add([
		k.pos(276, 5),
		k.rect(1, 20),
		k.color(...UI_COLORS.border),
		k.layer(layers.hudShapes),
	]);
	const roomKeySeparator = shipStatusPanel.add([
		k.pos(180, 5),
		k.rect(1, 20),
		k.color(...UI_COLORS.border),
		k.layer(layers.hudShapes),
	]);
	inventoryDetails.add([
		k.pos(324, 5),
		k.rect(1, 20),
		k.color(...UI_COLORS.border),
		k.layer(layers.hudShapes),
	]);
	salvageDisplay = shipStatusPanel.add([
		k.pos(172, 15),
		k.scale(1),
		{
			pulseScale: 1,
		},
	]);
	const salvageIcon = salvageDisplay.add([
		k.sprite("salvage_shard", { width: 16, height: 16 }),
		k.pos(-33, 0),
		k.anchor("center"),
		k.color(...UI_COLORS.accent),
		k.layer(layers.hudSprites),
	]);
	const salvageLabel = salvageDisplay.add([
		k.text("", { size: 7, font: "unscii" }),
		k.pos(0, 0),
		k.anchor("right"),
		k.color(...UI_COLORS.accent),
		k.layer(layers.hudText),
	]);
	const salvageModeLabel = salvageDisplay.add([
		k.text("", { size: 7, font: "unscii" }),
		k.pos(0, -10),
		k.anchor("right"),
		k.color(...UI_COLORS.muted),
		k.layer(layers.hudText),
	]);
	rerollDisplay = inventoryDetails.add([
		k.pos(223, 15),
		k.scale(1),
		{
			pulseScale: 1,
		},
	]);
	const rerollIcon = rerollDisplay.add([
		k.sprite("reroll_token", { width: 16, height: 16 }),
		k.pos(-26, 0),
		k.anchor("center"),
		k.color(190, 75, 255),
		k.layer(layers.hudSprites),
	]);
	const rerollLabel = rerollDisplay.add([
		k.text("", { size: UI_FONT_SIZES.small, font: "unscii" }),
		k.pos(0, 0),
		k.anchor("right"),
		k.color(190, 75, 255),
		k.layer(layers.hudText),
	]);
	phaseCoreDisplay = inventoryDetails.add([
		k.pos(271, 15),
		k.scale(1),
		{
			pulseScale: 1,
		},
	]);
	const phaseCoreIcon = phaseCoreDisplay.add([
		k.sprite("phase_core", { width: 18, height: 18 }),
		k.pos(-26, 0),
		k.anchor("center"),
		k.color(...UI_COLORS.phaseCore),
		k.layer(layers.hudSprites),
	]);
	const phaseCoreLabel = phaseCoreDisplay.add([
		k.text("", { size: UI_FONT_SIZES.small, font: "unscii" }),
		k.pos(0, 0),
		k.anchor("right"),
		k.color(...UI_COLORS.phaseCore),
		k.layer(layers.hudText),
	]);
	psionicPlateDisplay = inventoryDetails.add([
		k.pos(319, 15),
		k.scale(1),
		{
			pulseScale: 1,
		},
	]);
	const psionicPlateIcon = psionicPlateDisplay.add([
		k.sprite("psionic_plate", { width: 18, height: 18 }),
		k.pos(-26, 0),
		k.anchor("center"),
		k.color(...UI_COLORS.psionicPlate),
		k.layer(layers.hudSprites),
	]);
	const psionicPlateLabel = psionicPlateDisplay.add([
		k.text("", { size: UI_FONT_SIZES.small, font: "unscii" }),
		k.pos(0, 0),
		k.anchor("right"),
		k.color(...UI_COLORS.psionicPlate),
		k.layer(layers.hudText),
	]);
	thrusterPartDisplay = inventoryDetails.add([
		k.pos(367, 15),
		k.scale(1),
		{
			pulseScale: 1,
		},
	]);
	const thrusterPartIcon = thrusterPartDisplay.add([
		k.sprite("thruster_part", { width: 16, height: 16 }),
		k.pos(-26, 0),
		k.anchor("center"),
		k.color(...UI_COLORS.thrusterPart),
		k.layer(layers.hudSprites),
	]);
	const thrusterPartLabel = thrusterPartDisplay.add([
		k.text("", { size: UI_FONT_SIZES.small, font: "unscii" }),
		k.pos(0, 0),
		k.anchor("right"),
		k.color(...UI_COLORS.thrusterPart),
		k.layer(layers.hudText),
	]);
	roomKeyDisplay = shipStatusPanel.add([
		k.pos(223, 15),
		k.scale(1),
		{
			pulseScale: 1,
		},
	]);
	const roomKeyIcon = roomKeyDisplay.add([
		k.sprite(requirePrimaryVisualSprite(getPickupVisual("room-key")), { width: 16, height: 16 }),
		k.pos(-25, 0),
		k.anchor("center"),
		k.color(...UI_COLORS.warning),
		k.layer(layers.hudSprites),
	]);
	const roomKeyLabel = roomKeyDisplay.add([
		k.text("", { size: UI_FONT_SIZES.small, font: "unscii" }),
		k.pos(0, 0),
		k.anchor("right"),
		k.color(...UI_COLORS.warning),
		k.layer(layers.hudText),
	]);
	registerBatchedUiUpdate("hud", salvageDisplay, () => {
		const score = getScore();
		const debreeMode = debreeRunActive() ? "CARRIED" : "";
		if (debreeMode !== displayedDebreeMode) {
			displayedDebreeMode = debreeMode;
			salvageModeLabel.text = debreeMode;
		}
		if (score !== displayedSalvage) {
			displayedSalvage = score;
			salvageLabel.text = `${score}`;
			salvageIcon.pos.x = salvageLabel.pos.x - salvageLabel.width - 12;
		}
		salvageDisplay!.pulseScale = k.lerp(
			salvageDisplay!.pulseScale,
			1,
			k.clamp(14 * k.dt(), 0, 1)
		);
		salvageDisplay!.scale = k.vec2(salvageDisplay!.pulseScale);
		if (inventoryDetails.hidden) return;

		const rerollTokens = getRerollTokens();
		if (rerollTokens !== displayedRerollTokens) {
			if (!Number.isNaN(displayedRerollTokens)) {
				rerollDisplay!.pulseScale = Math.min(
					1.45,
					rerollDisplay!.pulseScale + 0.3
				);
			}
			displayedRerollTokens = rerollTokens;
			rerollLabel.text = `${rerollTokens}`;
			rerollIcon.pos.x = rerollLabel.pos.x - rerollLabel.width - 11;
		}
		rerollDisplay!.pulseScale = k.lerp(
			rerollDisplay!.pulseScale,
			1,
			k.clamp(14 * k.dt(), 0, 1)
		);
		rerollDisplay!.scale = k.vec2(rerollDisplay!.pulseScale);

		const phaseCores = getPhaseCores();
		if (phaseCores !== displayedPhaseCores) {
			if (!Number.isNaN(displayedPhaseCores)) {
				phaseCoreDisplay!.pulseScale = Math.min(
					1.45,
					phaseCoreDisplay!.pulseScale + 0.35
				);
			}
			displayedPhaseCores = phaseCores;
			phaseCoreLabel.text = `${phaseCores}`;
			phaseCoreIcon.pos.x = phaseCoreLabel.pos.x - phaseCoreLabel.width - 12;
		}
		phaseCoreDisplay!.pulseScale = k.lerp(
			phaseCoreDisplay!.pulseScale,
			1,
			k.clamp(14 * k.dt(), 0, 1)
		);
		phaseCoreDisplay!.scale = k.vec2(phaseCoreDisplay!.pulseScale);

		const psionicPlates = getPsionicPlates();
		if (psionicPlates !== displayedPsionicPlates) {
			if (!Number.isNaN(displayedPsionicPlates)) {
				psionicPlateDisplay!.pulseScale = Math.min(
					1.45,
					psionicPlateDisplay!.pulseScale + 0.35
				);
			}
			displayedPsionicPlates = psionicPlates;
			psionicPlateLabel.text = `${psionicPlates}`;
			psionicPlateIcon.pos.x = psionicPlateLabel.pos.x -
				psionicPlateLabel.width - 12;
		}
		psionicPlateDisplay!.pulseScale = k.lerp(
			psionicPlateDisplay!.pulseScale,
			1,
			k.clamp(14 * k.dt(), 0, 1)
		);
		psionicPlateDisplay!.scale = k.vec2(psionicPlateDisplay!.pulseScale);

		const thrusterParts = getThrusterParts();
		if (thrusterParts !== displayedThrusterParts) {
			if (!Number.isNaN(displayedThrusterParts)) {
				thrusterPartDisplay!.pulseScale = Math.min(
					1.45,
					thrusterPartDisplay!.pulseScale + 0.35
				);
			}
			displayedThrusterParts = thrusterParts;
			thrusterPartLabel.text = `${thrusterParts}`;
			thrusterPartIcon.pos.x = thrusterPartLabel.pos.x -
				thrusterPartLabel.width - 11;
		}
		thrusterPartDisplay!.pulseScale = k.lerp(
			thrusterPartDisplay!.pulseScale,
			1,
			k.clamp(14 * k.dt(), 0, 1)
		);
		thrusterPartDisplay!.scale = k.vec2(thrusterPartDisplay!.pulseScale);
	});
	registerBatchedUiUpdate("hud", roomKeyDisplay, () => {
		const visible = getActiveRoomFloor() !== undefined;
		roomKeyDisplay!.hidden = !visible;
		roomKeySeparator.hidden = !visible;
		if (!visible) return;
		const keys = getFloorKeyCount();
		if (keys !== displayedRoomKeys) {
			if (!Number.isNaN(displayedRoomKeys)) {
				roomKeyDisplay!.pulseScale = Math.min(
					1.45,
					roomKeyDisplay!.pulseScale + 0.3
				);
			}
			displayedRoomKeys = keys;
			roomKeyLabel.text = `${keys}`;
			roomKeyIcon.pos.x = roomKeyLabel.pos.x - roomKeyLabel.width - 11;
		}
		roomKeyDisplay!.pulseScale = k.lerp(
			roomKeyDisplay!.pulseScale,
			1,
			k.clamp(14 * k.dt(), 0, 1)
		);
		roomKeyDisplay!.scale = k.vec2(roomKeyDisplay!.pulseScale);
	});
	systemsPanel = createUiPanel({
		pos: k.vec2(
			k.width() - systemsPanelWidth * HUD_SCALE - HUD_MARGIN,
			k.height() - systemsPanelHeight * HUD_SCALE - HUD_MARGIN
		),
		size: k.vec2(systemsPanelWidth, systemsPanelHeight),
		tags: [tags.gameLoopUi],
		frameless: true,
		scale: HUD_SCALE,
	});
	primaryWeaponIcon = systemsPanel.add([
		k.sprite(getEquippedWeapon().icon, { width: 20, height: 20 }),
		k.pos(weaponSocketSize / 2, weaponSocketSize / 2),
		k.anchor("center"),
		k.layer(layers.hudSprites),
	]);
	systemsPanel.add([
		k.pos(34, 4),
		k.rect(1, 22),
		k.color(...UI_COLORS.border),
		k.layer(layers.hudShapes),
	]);
	missileCooldownGroup = systemsPanel.add([
		k.pos(weaponSocketSize + weaponSocketGap, 0),
	]);
	secondaryEmptyRing = missileCooldownGroup.add([
		k.pos(weaponSocketSize / 2, weaponSocketSize / 2 - 1),
		k.circle(9),
		k.anchor("center"),
		k.color(...UI_COLORS.muted),
		k.opacity(missilesUnlocked ? 0 : 0.18),
		k.outline(1, k.rgb(...UI_COLORS.muted)),
		k.layer(layers.hudShapes),
	]);
	activeModuleIcon = missileCooldownGroup.add([
		k.sprite("rocket_upg1", { width: 20, height: 20 }),
		k.pos(weaponSocketSize / 2, weaponSocketSize / 2 - 2),
		k.anchor("center"),
		k.opacity(missilesUnlocked ? 1 : 0),
		k.layer(layers.hudSprites),
	]);
	missileCooldownGroup.add([
		k.pos(2, weaponSocketSize - 3),
		k.rect(secondaryCooldownWidth, 3),
		k.color(...UI_COLORS.muted),
		k.layer(layers.hudShapes),
	]);
	specialBar = missileCooldownGroup.add([
		k.pos(2, weaponSocketSize - 3),
		k.rect(secondaryCooldownWidth, 3),
		k.color(...UI_COLORS.accent),
		k.layer(layers.hudShapes),
	]);
	secondaryWarning = missileCooldownGroup.add([
		k.pos(0, 0),
		k.rect(weaponSocketSize, weaponSocketSize),
		k.color(...UI_COLORS.danger),
		k.opacity(0),
		k.layer(layers.hudShapes),
	]);
	systemsPanel.add([
		k.pos(76, 4),
		k.rect(1, 22),
		k.color(...UI_COLORS.border),
		k.layer(layers.hudShapes),
	]);
	registerBatchedUiUpdate("hud", systemsPanel, () => {
		emptySecondaryFlashRemaining = updateEmptySlotWarning(
			secondaryWarning,
			emptySecondaryFlashRemaining
		);
		emptyMobilityFlashRemaining = updateEmptySlotWarning(
			mobilityWarning,
			emptyMobilityFlashRemaining
		);
		emptyUltimateFlashRemaining = updateEmptySlotWarning(
			ultimateWarning,
			emptyUltimateFlashRemaining
		);
	});

}

function setupRunLevelHud() {
	runLevelHud = createUiPanel({
		pos: k.vec2(0, k.height() - 8),
		size: k.vec2(k.width(), 6),
		tags: [tags.gameLoopUi],
		frameless: true,
	});
	const progress = createUiProgressBar(runLevelHud, {
		pos: k.vec2(HUD_MARGIN, 0),
		width: k.width() - HUD_MARGIN * 2,
		height: 4,
		value: 0,
	});
	progress.obj.use(k.layer(layers.hudShapes));
	const levelLabel = runLevelHud.add([
		k.text("", { size: UI_FONT_SIZES.small, font: "unscii" }),
		k.pos(k.width() / 2, -8),
		k.anchor("bot"),
		k.color(...UI_COLORS.accent),
		k.layer(layers.hudText),
	]);
	let displayedLevel = Number.NaN;
	let displayedXp = Number.NaN;
	let displayedRequiredXp = Number.NaN;
	let displayedProgress = 0;
	registerBatchedUiUpdate("hud", runLevelHud, () => {
		const snapshot = getRunLevelSnapshot();
		runLevelHud!.hidden = !snapshot.active;
		if (!snapshot.active) return;
		if (!Number.isNaN(displayedLevel) && snapshot.level > displayedLevel) {
			const gainedLevels = snapshot.level - displayedLevel;
			const levelHud = runLevelHud;
			for (let index = 0; index < gainedLevels; index++) {
				k.wait(index * 0.12, () => {
					if (!levelHud?.exists() || runLevelHud !== levelHud) return;
					gameSoundService.play("run_level_up", {
						volume: mainSoundVolume * 0.85,
						detune: index * 120,
					});
				});
			}
		}
		if (
			snapshot.level !== displayedLevel ||
			snapshot.xp !== displayedXp ||
			snapshot.requiredXp !== displayedRequiredXp
		) {
			displayedLevel = snapshot.level;
			displayedXp = snapshot.xp;
			displayedRequiredXp = snapshot.requiredXp;
			levelLabel.text = `LEVEL ${snapshot.level}`;
		}
		displayedProgress = k.lerp(
			displayedProgress,
			snapshot.progress,
			k.clamp(k.dt() * 10, 0, 1)
		);
		progress.setValue(displayedProgress);
		if (snapshot.pendingSelections > 0) showRunLevelChoice();
	});
}

export function showSalvageGain(
	amount: number,
	color: Color = k.rgb(...UI_COLORS.accent),
	pos: Vec2 = k.center()
) {
	if (!Number.isFinite(amount) || amount <= 0) return;
	if (salvageDisplay?.exists()) {
		salvageDisplay.pulseScale = Math.min(
			1.6,
			salvageDisplay.pulseScale + 0.32
		);
	}

	const gain = k.add([
		k.text(`+${amount}`, { size: 7, font: "unscii" }),
		k.pos(pos.add(k.rand(-7, 7), k.rand(-25, -19))),
		k.anchor("center"),
		k.color(color),
		k.opacity(1),
		k.scale(1),
		k.z(100),
		k.layer(layers.gameText),
		{
			elapsed: 0,
			startY: 0,
		},
		tags.gameLoop,
	]);
	gain.startY = gain.pos.y;

	registerBatchedUiUpdate("overlay", gain, () => {
		gain.elapsed += k.dt();
		const progress = k.clamp(gain.elapsed / SALVAGE_GAIN_LIFETIME, 0, 1);
		const rise = 1 - Math.pow(1 - progress, 3);
		gain.pos.y = gain.startY - rise * 24;
		gain.opacity = 1 - progress * progress;
		const popScale = progress < 0.18
			? k.lerp(1, 1.15, progress / 0.18)
			: k.lerp(1.15, 0.75, (progress - 0.18) / 0.82);
		gain.scale = k.vec2(popScale);

		if (progress >= 1) k.destroy(gain);
	});
}

function setupPlayerHealthBar(maxHealth: number) {
	if (!shipStatusPanel) return;
	healthCapacity = Math.max(1, maxHealth);
	steeringModeLabel = shipStatusPanel.add([
		k.pos(HEALTH_BAR_X, -5),
		k.text("", { size: 6, font: "unscii" }),
		k.color(...UI_COLORS.text),
		k.layer(layers.hudText),
	]);
	displayedSteeringMode = "";
	updatePlayerSteeringModeUi(false);
	healthBarLabel = shipStatusPanel.add([
		k.pos(HEALTH_BAR_X, 4),
		k.text("", { size: 6, font: "unscii" }),
		k.color(...UI_COLORS.text),
		k.layer(layers.hudText),
	]);
	shipStatusPanel.add([
		k.pos(HEALTH_BAR_X, HEALTH_BAR_Y),
		k.rect(HEALTH_BAR_WIDTH, HEALTH_BAR_HEIGHT),
		k.color(...UI_COLORS.muted),
		k.opacity(0.22),
		k.layer(layers.hudShapes),
	]);
	healthBarBaseFill = shipStatusPanel.add([
		k.pos(HEALTH_BAR_X, HEALTH_BAR_Y),
		k.rect(HEALTH_BAR_WIDTH, HEALTH_BAR_HEIGHT),
		k.color(...UI_COLORS.text),
		k.layer(layers.hudShapes),
	]);
	healthBarBonusFill = shipStatusPanel.add([
		k.pos(HEALTH_BAR_X, HEALTH_BAR_Y),
		k.rect(0, HEALTH_BAR_HEIGHT),
		k.color(...REWARD_RARITY_COLORS[RewardRarity.Rare]),
		k.layer(layers.hudShapes),
	]);
	for (let index = 1; index < HEALTH_BAR_SEGMENTS; index++) {
		shipStatusPanel.add([
			k.pos(
				HEALTH_BAR_X + Math.round(HEALTH_BAR_WIDTH * index / HEALTH_BAR_SEGMENTS),
				HEALTH_BAR_Y
			),
			k.rect(1, HEALTH_BAR_HEIGHT),
				k.color(...UI_COLORS.panel),
				k.opacity(0.9),
				k.layer(layers.hudShapes),
			]);
	}
	updatePlayerHealthBar(maxHealth);
}

export function updatePlayerSteeringModeUi(strafeModeActive: boolean) {
	const mode = strafeModeActive ? "STRAFE" : "NORMAL";
	if (displayedSteeringMode === mode) return;
	displayedSteeringMode = mode;
	if (!steeringModeLabel) return;
	steeringModeLabel.text = `MODE: ${mode}`;
	steeringModeLabel.color = strafeModeActive
		? k.rgb(...UI_COLORS.accent)
		: k.rgb(...UI_COLORS.text);
}

export function updatePlayerHealthBar(currentHealth: number) {
	displayedHealth = k.clamp(currentHealth, 0, healthCapacity);
	if (!healthBarBaseFill || !healthBarBonusFill || !healthBarLabel) return;
	const healthRatio = displayedHealth / healthCapacity;
	const lowHealthProgress = k.clamp(
		(LOW_HEALTH_COLOR_THRESHOLD - healthRatio) / LOW_HEALTH_COLOR_THRESHOLD,
		0,
		1
	);
	const healthColor = k.rgb(
		255,
		k.lerp(255, LOW_HEALTH_COLOR[1], lowHealthProgress),
		k.lerp(255, LOW_HEALTH_COLOR[2], lowHealthProgress)
	);
	const baseCapacity = Math.min(player.maxHealth, healthCapacity);
	const baseHealth = Math.min(displayedHealth, baseCapacity);
	const bonusHealth = Math.max(0, displayedHealth - baseCapacity);
	const baseWidth = k.clamp(
		HEALTH_BAR_WIDTH * baseHealth / healthCapacity,
		0,
		HEALTH_BAR_WIDTH
	);
	const bonusStart = k.clamp(
		HEALTH_BAR_WIDTH * baseCapacity / healthCapacity,
		0,
		HEALTH_BAR_WIDTH
	);
	const bonusWidth = k.clamp(
		HEALTH_BAR_WIDTH * bonusHealth / healthCapacity,
		0,
		HEALTH_BAR_WIDTH - bonusStart
	);
	healthBarBaseFill.width = baseWidth;
	healthBarBaseFill.color = healthColor;
	healthBarBonusFill.pos.x = HEALTH_BAR_X + bonusStart;
	healthBarBonusFill.width = bonusWidth;
	healthBarBonusFill.color = healthRatio < LOW_HEALTH_COLOR_THRESHOLD
		? healthColor
		: k.rgb(...REWARD_RARITY_COLORS[RewardRarity.Rare]);
	healthBarLabel.color = healthColor;
	healthBarLabel.text = `HULL ${formatHullValue(displayedHealth)} / ${formatHullValue(healthCapacity)}`;
}

function formatHullValue(value: number) {
	return `${Math.round(value * 100) / 100}`;
}

export function syncPlayerHealthBarCapacity(maxHealth: number) {
	healthCapacity = Math.max(1, maxHealth);
	updatePlayerHealthBar(displayedHealth);
}

export function updateSpecialBar(
	current: number,
	max: number,
	module?: ActiveModuleDefinition
) {
	const weapon = getEquippedWeapon();
	if (weapon.id !== displayedPrimaryWeaponId) {
		displayedPrimaryWeaponId = weapon.id;
		if (primaryWeaponIcon) primaryWeaponIcon.sprite = weapon.icon;
	}
	const moduleAvailable = module !== undefined;
	if (missileCooldownGroup && displayedMissileVisibility !== moduleAvailable) {
		displayedMissileVisibility = moduleAvailable;
		if (activeModuleIcon) activeModuleIcon.opacity = moduleAvailable ? 1 : 0;
		if (secondaryEmptyRing) secondaryEmptyRing.opacity = moduleAvailable ? 0 : 0.18;
	}
	if (module && displayedActiveModuleId !== module.id) {
		displayedActiveModuleId = module.id;
		if (activeModuleIcon) activeModuleIcon.sprite = module.icon;
	}
	if (!specialBar) return;
	const width = moduleAvailable
		? secondaryCooldownWidth * k.clamp(current / max, 0, 1)
		: 0;
	if (Math.abs(width - displayedSpecialWidth) < 0.05) return;
	displayedSpecialWidth = width;
	specialBar.width = width;
}

export function flashEmptySecondarySocket() {
	emptySecondaryFlashRemaining = 0.42;
}

export function flashEmptyMobilitySocket() {
	emptyMobilityFlashRemaining = 0.42;
}

export function flashEmptyUltimateSocket() {
	emptyUltimateFlashRemaining = 0.42;
}

function updateEmptySlotWarning(
	warning: GameObj<OpacityComp> | null,
	remaining: number
) {
	if (!warning) return remaining;
	if (remaining <= 0) {
		warning.opacity = 0;
		return 0;
	}
	const nextRemaining = Math.max(0, remaining - k.dt());
	const envelope = nextRemaining / 0.42;
	warning.opacity = k.wave(0.08, 0.34, k.time() * 26) * envelope;
	return nextRemaining;
}

export function updatePhaseJumpUi(
	charges: number,
	maxCharges: number,
	rechargeProgress: number
) {
	const mobilityId = getEquippedMobilityAbilityId();
	const mobility = mobilityId ? getAbilityDefinition(mobilityId) : undefined;
	if (!phaseJumpIcon && systemsPanel) {
		phaseJumpIcon = systemsPanel.add([
			k.sprite(mobility?.icon ?? "space_jump_upg1", { width: 16, height: 16 }),
			k.pos(88, 15),
			k.anchor("center"),
			k.opacity(1),
			k.layer(layers.hudSprites),
		]);

		const segmentGap = 2;
		const segmentWidth =
			(abilityBarWidth - segmentGap * (phaseJumpSegmentCount - 1)) /
			phaseJumpSegmentCount;
		for (let index = 0; index < phaseJumpSegmentCount; index++) {
			phaseJumpSegments.push(systemsPanel.add([
				k.pos(101 + index * (segmentWidth + segmentGap), 19),
				k.rect(segmentWidth, 7),
				k.color(...UI_COLORS.accent),
				k.opacity(0.22),
				k.layer(layers.hudShapes),
			]));
		}
		mobilityChargeLabel = systemsPanel.add([
			k.text("", { size: UI_FONT_SIZES.micro, font: "unscii" }),
			k.pos(240, 15),
			k.anchor("right"),
			k.color(...UI_COLORS.accent),
			k.opacity(0),
			k.layer(layers.hudText),
		]);

		mobilityWarning = systemsPanel.add([
			k.pos(79, 0),
			k.rect(166, weaponSocketSize),
			k.color(...UI_COLORS.danger),
			k.opacity(0),
			k.z(20),
			k.layer(layers.hudShapes),
		]);
	}
	const mobilityChanged = mobilityId !== displayedMobilityId;
	if (mobilityChanged) {
		displayedMobilityId = mobilityId ?? "";
		if (phaseJumpIcon && mobility) phaseJumpIcon.sprite = mobility.icon;
	}

	if (
		!mobilityChanged &&
		charges === displayedJumpCharges &&
		maxCharges === displayedJumpMaxCharges &&
		Math.abs(rechargeProgress - displayedJumpProgress) < 0.001
	) return;
	displayedJumpCharges = charges;
	displayedJumpMaxCharges = maxCharges;
	displayedJumpProgress = rechargeProgress;
	phaseJumpIcon.opacity = mobility ? charges > 0 ? 1 : 0.25 : 0.18;
	if (mobilityChargeLabel) {
		const hasMultipleCharges = mobility !== undefined && maxCharges > 1;
		mobilityChargeLabel.text = hasMultipleCharges
			? `x${Math.max(0, Math.floor(charges))}`
			: "";
		mobilityChargeLabel.color = charges > 0
			? k.rgb(...UI_COLORS.accent)
			: k.rgb(...UI_COLORS.danger);
		mobilityChargeLabel.opacity = hasMultipleCharges
			? charges > 0 ? 1 : 0.55
			: 0;
	}
	const filledSegments = rechargeProgress * phaseJumpSegmentCount;
	const overdriveOverused =
		mobilityId === "thrusterOverdrive" && charges <= 0;
	for (let index = 0; index < phaseJumpSegments.length; index++) {
		phaseJumpSegments[index].color = mobility
			? overdriveOverused
				? k.rgb(...UI_COLORS.danger)
				: k.rgb(...UI_COLORS.accent)
			: k.rgb(...UI_COLORS.muted);
		phaseJumpSegments[index].opacity = mobility
			? index < filledSegments ? 1 : 0.22
			: 0.12;
	}
}

export function updateUltimateUi(
	progress: number,
	ability?: AbilityDefinition
) {
	if (!systemsPanel) return;
	if (!ultimateIcon) {
			systemsPanel.add([
			k.pos(248, 4),
				k.rect(1, 22),
				k.color(...UI_COLORS.border),
				k.layer(layers.hudShapes),
			]);
		ultimateEmptyRing = systemsPanel.add([
			k.pos(267, 13),
			k.circle(9),
			k.anchor("center"),
			k.color(...UI_COLORS.muted),
			k.opacity(0.18),
			k.outline(1, k.rgb(...UI_COLORS.muted)),
			k.layer(layers.hudShapes),
		]);
		ultimateReadyGodrays = systemsPanel.add([
			k.pos(267, 12),
			k.opacity(0),
			k.z(-1),
			k.layer(layers.hudShapes),
			{
				draw() {
					for (let index = 0; index < 10; index++) {
						const angle = index * 36 + k.time() * 16;
						const direction = k.Vec2.fromAngle(angle);
						const pulse = k.wave(0, 3.5, k.time() * 4 + index * 0.63);
						k.drawLine({
							p1: direction.scale(10),
							p2: direction.scale(17 + pulse),
							width: index % 2 === 0 ? 2 : 1,
							color: k.rgb(...ULTIMATE_READY_COLOR),
							opacity: this.opacity * (index % 2 === 0 ? 0.9 : 0.55),
						});
					}
				},
			},
		]);
		ultimateIcon = systemsPanel.add([
			k.sprite(ability?.icon ?? "space_jump_upg1", { width: 18, height: 18 }),
			k.pos(267, 12),
			k.anchor("center"),
			k.opacity(ability ? 1 : 0),
			k.scale(1),
			k.layer(layers.hudSprites),
		]);
		systemsPanel.add([
			k.pos(255, 27),
			k.rect(ultimateBarWidth, 3),
			k.color(...UI_COLORS.muted),
			k.layer(layers.hudShapes),
		]);
		ultimateBar = systemsPanel.add([
			k.pos(255, 27),
			k.rect(0, 3),
			k.color(190, 90, 255),
			k.layer(layers.hudShapes),
		]);
		ultimateWarning = systemsPanel.add([
			k.pos(251, 0),
			k.rect(32, weaponSocketSize),
			k.color(...UI_COLORS.danger),
			k.opacity(0),
			k.z(20),
			k.layer(layers.hudShapes),
		]);
	}
	const abilityId = ability?.id ?? "";
	if (abilityId !== displayedUltimateId) {
		displayedUltimateId = abilityId;
		if (ability && ultimateIcon) ultimateIcon.sprite = ability.icon;
		if (ultimateIcon) ultimateIcon.opacity = ability ? 1 : 0;
		if (ultimateEmptyRing) ultimateEmptyRing.opacity = ability ? 0 : 0.18;
	}
	const normalizedProgress = ability ? k.clamp(progress, 0, 1) : 0;
	if (
		!Number.isFinite(displayedUltimateProgress) ||
		Math.abs(normalizedProgress - displayedUltimateProgress) >= 0.001
	) {
		displayedUltimateProgress = normalizedProgress;
		if (ultimateBar) ultimateBar.width = ultimateBarWidth * normalizedProgress;
	}
	if (ultimateIcon) {
		ultimatePulseScale = k.lerp(
			ultimatePulseScale,
			1,
			k.clamp(k.dt() * 12, 0, 1)
		);
		ultimateIcon.scale = k.vec2(ultimatePulseScale);
		ultimateIcon.opacity = ability
			? normalizedProgress >= 1
				? k.wave(0.65, 1, k.time() * 8)
				: 0.45 + normalizedProgress * 0.55
			: 0;
	}
	if (ultimateReadyGodrays) {
		ultimateReadyGodrays.opacity = ability && normalizedProgress >= 1
			? k.wave(0.45, 0.95, k.time() * 5)
			: 0;
	}
}

export function pulseUltimateChargeUi(amount: number = 1) {
	if (!ultimateIcon?.exists()) return;
	ultimatePulseScale = Math.min(
		1.75,
		ultimatePulseScale + 0.16 + Math.sqrt(Math.max(1, amount)) * 0.035
	);
}

export function showUltimateReadyAnnouncement() {
	const announcement = k.add([
		k.text("ULTIMATE READY", {
			font: "unscii",
			size: UI_FONT_SIZES.sectionTitle,
		}),
		k.pos(k.width() / 2, k.height() - 58),
		k.anchor("center"),
		k.color(...ULTIMATE_READY_COLOR),
		k.opacity(0),
		k.scale(0.9),
		k.fixed(),
		k.layer(layers.uiEffects),
		k.z(320),
		{
			elapsed: 0,
		},
		tags.gameLoopUi,
	]);
	registerBatchedUiUpdate("overlay", announcement, () => {
		announcement.elapsed += k.dt();
		const enter = k.clamp(announcement.elapsed / 0.18, 0, 1);
		const exit = k.clamp((3 - announcement.elapsed) / 0.55, 0, 1);
		announcement.opacity = Math.min(enter, exit);
		announcement.scale = k.vec2(k.lerp(0.9, 1, enter));
		if (announcement.elapsed >= 3 && announcement.exists()) {
			k.destroy(announcement);
		}
	});
}

export function addCollectedPowerup(
	rewardOrId: Reward | string,
	telemetryDetails: RewardTelemetryDetails = {}
) {
	const reward = typeof rewardOrId === "string"
		? getRewardDefinition(rewardOrId)
		: rewardOrId;
	if (!reward) return;
	showRewardAcquisitionPopover(reward);
	recordRunReward(reward);
	recordRunRewardStat(reward.rarity);
	recordTelemetryRewardSelected(
		reward.id,
		reward.rarity,
		isAbilityReward(reward),
		telemetryDetails
	);
	if (isAbilityReward(reward)) return;
	const collectionKey = reward.weaponId
		? "primaryWeapon"
		: reward.activeModuleId
			? "secondaryWeapon"
		: reward.upgradeKey ?? reward.powerupKey ?? reward.id;

	const existing = collectedItems.get(collectionKey);
	if (existing) {
		const replacesLoadoutSlot = reward.weaponId || reward.activeModuleId;
		existing.count = replacesLoadoutSlot ? 1 : existing.count + 1;
		existing.reward = reward;
		return;
	}

	collectedItems.set(collectionKey, {
		count: 1,
		reward,
	});
}

export function showRewardAcquisitionPopover(reward: Reward) {
	if (reward.newDiscovery) {
		reward.newDiscovery = false;
		showDiscoveredRewardPopover(reward);
		return;
	}
	const blueprintKey = reward.upgradeKey ?? reward.powerupKey ?? reward.id;
	if (discoverBlueprint(blueprintKey)) {
		showDiscoveredRewardPopover(reward);
		return;
	}
	showCollectedRewardPopover(reward);
}
export function getGameLoopStatusSnapshot() {
	const runLevel = getRunLevelSnapshot();
	return {
		health: displayedHealth,
		maxHealth: healthCapacity,
		steeringMode: displayedSteeringMode,
		runLevel: runLevel.level,
		runXp: runLevel.xp,
		requiredRunXp: runLevel.requiredXp,
		salvage: getScore(),
		rerollTokens: getRerollTokens(),
		phaseCores: getPhaseCores(),
		psionicPlates: getPsionicPlates(),
		thrusterParts: getThrusterParts(),
		roomKeys: getActiveRoomFloor() === undefined ? 0 : getFloorKeyCount(),
		upgrades: [...collectedItems.values()].map((item) => ({
			name: item.reward.name,
			sprite: item.reward.sprite,
			count: item.count,
			color: getRewardDisplayColor(item.reward),
		})),
	};
}

export function setGameLoopUiTextVisible(visible: boolean) {
	if (visible) {
		let restored = 0;
		for (const state of debugHiddenHudTexts.values()) {
			if (!state.object.exists()) continue;
			state.object.hidden = state.wasHidden;
			restored++;
		}
		debugHiddenHudTexts.clear();
		return restored;
	}

	const visited = new Set<number>();
	for (const root of k.get<GameObj>(tags.gameLoopUi)) {
		const textObjects = root.has("text")
			? [root, ...root.get<GameObj>("text", { recursive: true })]
			: root.get<GameObj>("text", { recursive: true });
		for (const object of textObjects) {
			if (visited.has(object.id)) continue;
			visited.add(object.id);
			if (!debugHiddenHudTexts.has(object.id)) {
				debugHiddenHudTexts.set(object.id, {
					object,
					wasHidden: object.hidden,
				});
			}
			object.hidden = true;
		}
	}
	return visited.size;
}

export function gameLoopUiTextVisible() {
	return debugHiddenHudTexts.size === 0;
}

export function clearGameLoopUi() {
	hideRunLevelChoice();
	k.destroyAll(tags.gameLoopUi);
	healthBarBaseFill = null;
	healthBarBonusFill = null;
	healthBarLabel = null;
	steeringModeLabel = null;
	healthCapacity = 0;
	displayedHealth = 0;
	specialBar = null;
	missileCooldownGroup = null;
	activeModuleIcon = null;
	primaryWeaponIcon = null;
	secondaryWarning = null;
	secondaryEmptyRing = null;
	phaseJumpIcon = null;
	phaseJumpSegments = [];
	mobilityChargeLabel = null;
	mobilityWarning = null;
	ultimateIcon = null;
	ultimateEmptyRing = null;
	ultimateBar = null;
	ultimateWarning = null;
	ultimateReadyGodrays = null;
	ultimatePulseScale = 1;
	shipStatusPanel = null;
	salvageDisplay = null;
	rerollDisplay = null;
	phaseCoreDisplay = null;
	psionicPlateDisplay = null;
	thrusterPartDisplay = null;
	roomKeyDisplay = null;
	systemsPanel = null;
	runLevelHud = null;
	displayedSalvage = Number.NaN;
	displayedDebreeMode = "";
	displayedRerollTokens = Number.NaN;
	displayedPhaseCores = Number.NaN;
	displayedPsionicPlates = Number.NaN;
	displayedThrusterParts = Number.NaN;
	displayedRoomKeys = Number.NaN;
	displayedSpecialWidth = Number.NaN;
	displayedMissileVisibility = undefined;
	displayedActiveModuleId = "";
	displayedPrimaryWeaponId = "";
	displayedSteeringMode = "";
	emptySecondaryFlashRemaining = 0;
	emptyMobilityFlashRemaining = 0;
	emptyUltimateFlashRemaining = 0;
	displayedJumpCharges = Number.NaN;
	displayedJumpMaxCharges = Number.NaN;
	displayedJumpProgress = Number.NaN;
	displayedMobilityId = "";
	displayedUltimateId = "";
	displayedUltimateProgress = Number.NaN;
	debugHiddenHudTexts.clear();
	collectedItems.clear();
}
