import { GenerationMap } from "../generationTypes";
import { HexCoord, hexToPixel } from "../hexUtils";
import * as fs from "fs";

/**
 * Debug visualizer - exports generation map as ASCII, SVG, or PNG
 * SVG/JSON for Node.js, PNG for browser environments
 */

/**
 * Render map as ASCII art for terminal debugging
 */
export function renderASCII(map: GenerationMap): string {
	const lines: string[] = [];

	for (let r = 0; r < map.height; r++) {
		let line = "";
		// Offset every other row for hex grid visual
		if (r % 2 === 1) line += " ";

		for (let q = 0; q < map.width; q++) {
			const cell = map.getCell({ q, r });
			if (!cell) {
				line += "? ";
				continue;
			}

			if (cell.locked) {
				line += "L "; // Locked cell
			} else if (cell.solid) {
				// Show hardness as intensity
				if (cell.hardness > 2) line += "█ ";
				else if (cell.hardness > 1.5) line += "▓ ";
				else if (cell.hardness > 1) line += "▒ ";
				else line += "░ ";
			} else {
				// Empty cells - show tags
				if (cell.tags.has("player_spawn")) line += "P ";
				else if (cell.tags.has("resource_node")) line += "R ";
				else if (cell.tags.has("hazard")) line += "H ";
				else if (cell.tags.has("tunnel")) line += "· ";
				else if (cell.tags.has("chamber")) line += "○ ";
				else line += "  ";
			}
		}
		lines.push(line);
	}

	return lines.join("\n");
}

/**
 * Export detailed statistics
 */
export function getStatistics(map: GenerationMap): string {
	const stats = {
		totalCells: map.getAllCells().length,
		solidCells: 0,
		emptyCells: 0,
		lockedCells: 0,
		regions: new Set<number>(),
		avgHardness: 0,
		avgDensity: 0,
		tags: {} as Record<string, number>,
	};

	let hardnessSum = 0;
	let densitySum = 0;

	for (const cell of map.getAllCells()) {
		if (cell.solid) {
			stats.solidCells++;
			hardnessSum += cell.hardness;
			densitySum += cell.density;
		} else {
			stats.emptyCells++;
			if (cell.regionId >= 0) {
				stats.regions.add(cell.regionId);
			}
		}

		if (cell.locked) stats.lockedCells++;

		for (const tag of cell.tags) {
			stats.tags[tag] = (stats.tags[tag] || 0) + 1;
		}
	}

	stats.avgHardness = stats.solidCells > 0 ? hardnessSum / stats.solidCells : 0;
	stats.avgDensity = stats.solidCells > 0 ? densitySum / stats.solidCells : 0;

	const output = [
		"=== Generation Statistics ===",
		`Grid Size: ${map.width}x${map.height}`,
		`Total Cells: ${stats.totalCells}`,
		`Solid: ${stats.solidCells} (${((stats.solidCells / stats.totalCells) * 100).toFixed(1)}%)`,
		`Empty: ${stats.emptyCells} (${((stats.emptyCells / stats.totalCells) * 100).toFixed(1)}%)`,
		`Locked: ${stats.lockedCells}`,
		`Regions: ${stats.regions.size}`,
		`Avg Hardness: ${stats.avgHardness.toFixed(2)}`,
		`Avg Density: ${stats.avgDensity.toFixed(2)}`,
		"\nTags:",
	];

	for (const [tag, count] of Object.entries(stats.tags)) {
		output.push(`  ${tag}: ${count}`);
	}

	return output.join("\n");
}

/**
 * Export map data as JSON
 */
export function exportJSON(map: GenerationMap, filepath: string): void {
	const data = {
		width: map.width,
		height: map.height,
		cells: map.getAllCells().map((cell) => ({
			q: cell.coord.q,
			r: cell.coord.r,
			solid: cell.solid,
			hardness: cell.hardness,
			density: cell.density,
			regionId: cell.regionId,
			tags: Array.from(cell.tags),
			locked: cell.locked,
		})),
	};

	fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
	console.log(`📄 Exported JSON to ${filepath}`);
}

/**
 * Generate SVG visualization (browser/file compatible)
 */
export function exportSVG(
	map: GenerationMap,
	filepath: string,
	hexSize: number = 20
): void {
	const width = map.width * hexSize * Math.sqrt(3) + 100;
	const height = map.height * hexSize * 1.5 + 100;
	const offsetX = 50;
	const offsetY = 50;

	let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
<rect width="${width}" height="${height}" fill="#000"/>
`;

	// Draw hexes
	for (const cell of map.getAllCells()) {
		const pixel = hexToPixel(cell.coord, hexSize);
		const x = pixel.x + offsetX;
		const y = pixel.y + offsetY;

		// Generate hex polygon points
		const points: string[] = [];
		for (let i = 0; i < 6; i++) {
			const angleDeg = 60 * i - 30;
			const angleRad = (Math.PI / 180) * angleDeg;
			const px = x + hexSize * Math.cos(angleRad);
			const py = y + hexSize * Math.sin(angleRad);
			points.push(`${px},${py}`);
		}

		let fill = "#000";
		let stroke = "#333";
		let strokeWidth = 0.5;

		if (cell.solid) {
			// Solid cells - color by hardness
			const intensity = Math.min(255, Math.floor(cell.hardness * 50));
			fill = `rgb(${intensity},${intensity},${intensity})`;
			if (cell.locked) {
				stroke = "#ff0";
				strokeWidth = 2;
			}
		} else {
			// Empty cells
			fill = "#000";
			stroke = "#222";

			// Color by tag
			if (cell.tags.has("player_spawn")) {
				fill = "#0f0";
			} else if (cell.tags.has("resource_node")) {
				fill = "#00f";
			} else if (cell.tags.has("hazard")) {
				fill = "#f00";
			} else if (cell.tags.has("chamber")) {
				fill = "#333";
			} else if (cell.tags.has("tunnel")) {
				fill = "#222";
			}
		}

		svg += `<polygon points="${points.join(" ")}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>\n`;
	}

	svg += `</svg>`;

	fs.writeFileSync(filepath, svg);
	console.log(`🖼️  Exported SVG to ${filepath}`);
}

/**
 * Generate PNG visualization (browser environment only)
 * Downloads the image automatically
 */
export function exportPNG(
	map: GenerationMap,
	filename: string = "cave_generation.png",
	hexSize: number = 20
): void {
	const width = map.width * hexSize * Math.sqrt(3) + 100;
	const height = map.height * hexSize * 1.5 + 100;
	const offsetX = 50;
	const offsetY = 50;

	// Create canvas
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext("2d");
	if (!ctx) {
		console.error("Failed to get canvas context");
		return;
	}

	// Black background
	ctx.fillStyle = "#000";
	ctx.fillRect(0, 0, width, height);

	// Draw hexes
	for (const cell of map.getAllCells()) {
		const pixel = hexToPixel(cell.coord, hexSize);
		const x = pixel.x + offsetX;
		const y = pixel.y + offsetY;

		// Generate hex polygon path
		ctx.beginPath();
		for (let i = 0; i < 6; i++) {
			const angleDeg = 60 * i - 30;
			const angleRad = (Math.PI / 180) * angleDeg;
			const px = x + hexSize * Math.cos(angleRad);
			const py = y + hexSize * Math.sin(angleRad);
			if (i === 0) ctx.moveTo(px, py);
			else ctx.lineTo(px, py);
		}
		ctx.closePath();

		let fillColor = "#000";
		let strokeColor = "#333";
		let strokeWidth = 0.5;

		if (cell.solid) {
			// Solid cells - color by hardness
			const intensity = Math.min(255, Math.floor(cell.hardness * 50));
			fillColor = `rgb(${intensity},${intensity},${intensity})`;
			if (cell.locked) {
				strokeColor = "#ff0";
				strokeWidth = 2;
			}
		} else {
			// Empty cells
			fillColor = "#000";
			strokeColor = "#222";

			// Color by tag
			if (cell.tags.has("player_spawn")) {
				fillColor = "#0f0";
			} else if (cell.tags.has("resource_node")) {
				fillColor = "#00f";
			} else if (cell.tags.has("hazard")) {
				fillColor = "#f00";
			} else if (cell.tags.has("chamber")) {
				fillColor = "#333";
			} else if (cell.tags.has("tunnel")) {
				fillColor = "#222";
			}
		}

		ctx.fillStyle = fillColor;
		ctx.fill();
		ctx.strokeStyle = strokeColor;
		ctx.lineWidth = strokeWidth;
		ctx.stroke();
	}

	// Convert to blob and download
	canvas.toBlob((blob) => {
		if (!blob) {
			console.error("Failed to create blob");
			return;
		}
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);
		console.log(`🖼️  Downloaded PNG: ${filename}`);
	});
}
