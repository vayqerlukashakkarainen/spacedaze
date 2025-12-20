import { k, layers, GameState } from "../main";
import { player } from "../player";

let isStatsWindowOpen = false;

export function setupStatsWindow() {
	// Use a different key to avoid conflict with pause
	k.onKeyPress("i", () => {
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
	const windowWidth = 600;
	const windowHeight = 700;

	// Dark overlay background
	k.add([
		k.rect(k.width(), k.height()),
		k.pos(0, 0),
		k.color(0, 0, 0),
		k.opacity(0.8),
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
		k.layer(layers.ui),
		k.z(201),
		"statsWindow",
	]);

	// Title
	window.add([
		k.text("PLAYER STATS", { size: 24, font: "unscii" }),
		k.pos(windowWidth / 2, 20),
		k.anchor("center"),
	]);

	// Stats content
	const statsContainer = window.add([k.pos(20, 60)]);

	// Get all player stats as array of [key, value] pairs
	const stats: [string, any][] = Object.entries(player);

	const rowHeight = 18;
	const labelX = 0;
	const valueX = 350;

	stats.forEach(([key, value], index) => {
		const yPos = index * rowHeight;

		// Format the label (add spaces before capitals)
		const formattedLabel = key
			.replace(/([A-Z])/g, " $1")
			.replace(/^./, (str) => str.toUpperCase());

		// Label
		statsContainer.add([
			k.text(formattedLabel, { size: 12, font: "unscii" }),
			k.pos(labelX, yPos),
			k.anchor("left"),
		]);

		// Value (format based on type)
		let displayValue = "";
		if (value === undefined) {
			displayValue = "N/A";
		} else if (typeof value === "number") {
			// Round to 2 decimal places if float
			displayValue = Number.isInteger(value)
				? value.toString()
				: value.toFixed(2);
		} else {
			displayValue = String(value);
		}

		statsContainer.add([
			k.text(displayValue, { size: 12, font: "unscii" }),
			k.pos(valueX, yPos),
			k.anchor("left"),
			k.color(100, 200, 255),
		]);
	});

	// Close instruction
	window.add([
		k.text("Press I to close", { size: 12, font: "unscii" }),
		k.pos(windowWidth / 2, windowHeight - 20),
		k.anchor("center"),
		k.opacity(0.7),
	]);
}

function closeStatsWindow() {
	if (!isStatsWindowOpen) return;
	isStatsWindowOpen = false;
	k.destroyAll("statsWindow");
}
