import { k, layers } from "../main";
import { player } from "../player";
import { commandService } from "../services/commandService";
import { getPlayerPowerupStatus } from "../powerups";
import { getEquippedWeapon } from "../services/weaponService";
import { uiState } from "./uiState";
import { UI_FONT_SIZES } from "./common";

let isStatsWindowOpen = false;

const STAT_LABELS: Record<string, string> = {
	debreeSeekDistanceMultiplier: "Debree Seek Dist Mult",
	rocketSplashSizeMultiplier: "Rocket Splash Size Mult",
	rocketSplashDmgFallOverDistance: "Splash Falloff Amount",
	rocketSplashDmgFallDistanceValue: "Splash Falloff Distance",
	followerBlasterDmgMultiplier: "Follower Dmg Mult",
	speedPwrUpMultiplier: "Powerup Speed Mult",
	missileDroneSlots: "Missile Drones",
	followerInterceptorProtocol: "Interceptor Drones",
	gunshipDroneSlots: "Gunship Drones",
	medicDroneSlots: "Medic Drones",
	salvagerDroneSlots: "Salvager Drones",
	projectilePierces: "Projectile Pierces",
	projectileSlowPercentage: "Projectile Slow %",
	projectileDotDamage: "Projectile DOT Dmg",
	projectileChainCount: "Chain Targets",
	projectileSplitCount: "Split Count",
	projectileGravityStrength: "Gravity Pull",
	projectileBounceCount: "Projectile Bounces",
	projectileBounceDamageRetention: "Bounce Damage Retention",
	projectileGuidance: "Guidance Strength",
	projectileGuidanceDistance: "Guidance Range",
	ricochetInheritsModifiers: "Ricochet Modifier Link",
	critChance: "Critical Chance",
	critMultiplier: "Critical Damage",
	explosionPulseStrength: "Explosion Pulse Force",
};

export function setupStatsWindow() {
	// Use a different key to avoid conflict with pause
	k.onKeyPress("i", () => {
		if (commandService.isCapturingInput()) return;
		if (uiState.modalOpen) return;
		if (isStatsWindowOpen) {
			closeStatsWindow();
		} else {
			openStatsWindow();
		}
	});
}

function openStatsWindow() {
	if (isStatsWindowOpen) return;
	isStatsWindowOpen = true;

	const center = k.center();
	const windowWidth = Math.min(820, k.width() - 40);
	const windowHeight = Math.min(680, k.height() - 40);

	// Dark overlay background
	k.add([
		k.rect(k.width(), k.height()),
		k.pos(0, 0),
		k.color(0, 0, 0),
		k.opacity(0.8),
		k.fixed(),
		k.layer(layers.ui),
		k.z(200),
		"statsWindow",
	]);

	// Main window
	const window = k.add([
		k.rect(windowWidth, windowHeight),
		k.pos(center),
		k.anchor("center"),
		k.color(0, 0, 0),
		k.outline(4, new k.Color(255, 255, 255)),
		k.fixed(),
		k.layer(layers.ui),
		k.z(201),
		"statsWindow",
	]);

	// Title
	window.add([
		k.text("PLAYER STATS", { size: UI_FONT_SIZES.display, font: "unscii" }),
		k.pos(0, -windowHeight / 2 + 30),
		k.anchor("center"),
	]);
	window.add([
		k.text(`PRIMARY: ${getEquippedWeapon().name}`, {
			size: UI_FONT_SIZES.label,
			font: "unscii",
		}),
		k.pos(0, -windowHeight / 2 + 52),
		k.anchor("center"),
		k.color(80, 200, 255),
	]);

	// Stats content
	const statsContainer = window.add([
		k.pos(-windowWidth / 2 + 24, -windowHeight / 2 + 70),
	]);

	// Get all player stats as array of [key, value] pairs
	const stats: [string, any][] = Object.entries(player);

	const rowHeight = 14;
	const labelX = 0;
	const valueX = Math.min(225, windowWidth * 0.28);
	const statFontSize = UI_FONT_SIZES.small;

	stats.forEach(([key, value], index) => {
		const yPos = index * rowHeight;

		// Format the label (add spaces before capitals)
		const formattedLabel = STAT_LABELS[key] ?? key
			.replace(/([A-Z])/g, " $1")
			.replace(/^./, (str) => str.toUpperCase());

		// Label
		statsContainer.add([
			k.text(formattedLabel, { size: statFontSize, font: "unscii" }),
			k.pos(labelX, yPos),
			k.anchor("left"),
		]);

		// Value (format based on type)
		const displayValue = formatStatValue(key, value);

		statsContainer.add([
			k.text(displayValue, { size: statFontSize, font: "unscii" }),
			k.pos(valueX, yPos),
			k.anchor("left"),
			k.color(100, 200, 255),
		]);
	});

	const powerupX = windowWidth * 0.1;
	const powerupY = -windowHeight / 2 + 76;
	const dividerX = windowWidth * 0.04;
	window.add([
		k.rect(2, windowHeight - 120),
		k.pos(dividerX, 4),
		k.anchor("center"),
		k.color(70, 70, 70),
	]);
	window.add([
		k.text("POWERUPS", { size: UI_FONT_SIZES.sectionTitle, font: "unscii" }),
		k.pos(powerupX, powerupY),
		k.color(k.WHITE),
	]);

	getPlayerPowerupStatus().forEach(([name, value], index) => {
		const yPos = powerupY + 38 + index * 48;
		window.add([
			k.text(name.toUpperCase(), {
				size: UI_FONT_SIZES.body,
				font: "unscii",
				width: windowWidth * 0.34,
			}),
			k.pos(powerupX, yPos),
			k.color(k.WHITE),
		]);
		window.add([
			k.text(value, { size: UI_FONT_SIZES.subheading, font: "unscii" }),
			k.pos(powerupX, yPos + 18),
			k.color(100, 200, 255),
		]);
	});

	// Close instruction
	window.add([
		k.text("Press I to close", { size: UI_FONT_SIZES.body, font: "unscii" }),
		k.pos(0, windowHeight / 2 - 20),
		k.anchor("center"),
		k.opacity(0.7),
	]);
}

function formatStatValue(key: string, value: unknown): string {
	if (value === undefined || value === null) return "N/A";
	if (typeof value !== "number") return String(value);
	if (!Number.isFinite(value)) return "N/A";
	if (key === "critChance") return `${formatNumber(value)}%`;
	if (key === "critMultiplier") return `${formatNumber(value)}x`;
	return formatNumber(value);
}

function formatNumber(value: number): string {
	return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function closeStatsWindow() {
	if (!isStatsWindowOpen) return;
	isStatsWindowOpen = false;
	k.destroyAll("statsWindow");
}
