const TABLE_SEPARATOR = /^\s*\|?[\s:-]+(?:\|[\s:-]+)+\|?\s*$/
const MAX_CELL_WIDTH = 30
const SPRITE_TOKEN = /:sprite\(([a-zA-Z0-9_-]+)\):/g
const SPRITE_MARKER_START = 0xe000

export interface ConsoleInlineSprite {
	sprite: string
	line: number
	column: number
}

export interface FormattedConsoleMarkdown {
	text: string
	sprites: ConsoleInlineSprite[]
}

export function formatConsoleMarkdown(
	markdown: string,
	maxWidth: number = Number.POSITIVE_INFINITY
): string {
	return formatConsoleMarkdownWithSprites(markdown, maxWidth).text
}

export function formatConsoleMarkdownWithSprites(
	markdown: string,
	maxWidth: number = Number.POSITIVE_INFINITY
): FormattedConsoleMarkdown {
	const spriteNames: string[] = []
	const markedMarkdown = markdown.replace(
		SPRITE_TOKEN,
		(_match, sprite: string) => {
			const marker = String.fromCharCode(
				SPRITE_MARKER_START + spriteNames.length
			)
			spriteNames.push(sprite)
			return marker
		}
	)
	const lines = markedMarkdown.split("\n")
	const output: string[] = []

	for (let index = 0; index < lines.length; index++) {
		const line = lines[index]
		const nextLine = lines[index + 1]

		if (line.includes("|") && nextLine && TABLE_SEPARATOR.test(nextLine)) {
			const tableRows = [parseTableRow(line)]
			index += 2
			while (index < lines.length && lines[index].includes("|")) {
				tableRows.push(parseTableRow(lines[index]))
				index++
			}
			index--
			output.push(...formatTable(tableRows, maxWidth))
			continue
		}

		output.push(formatInlineMarkdown(line))
	}

	const sprites: ConsoleInlineSprite[] = []
	const renderedLines = output.map((line, lineIndex) => {
		return [...line].map((character, column) => {
			const markerIndex = character.charCodeAt(0) - SPRITE_MARKER_START
			const sprite = spriteNames[markerIndex]
			if (!sprite) return character
			sprites.push({ sprite, line: lineIndex, column })
			return " "
		}).join("")
	})

	return {
		text: renderedLines.join("\n"),
		sprites,
	}
}

function parseTableRow(line: string): string[] {
	return line
		.replace(/^\s*\|/, "")
		.replace(/\|\s*$/, "")
		.split("|")
		.map((cell) => formatInlineMarkdown(cell.trim()))
}

function formatTable(rows: string[][], maxWidth: number): string[] {
	const columnCount = Math.max(...rows.map((row) => row.length))
	const widths = Array.from({ length: columnCount }, (_, column) => {
		return Math.min(
			MAX_CELL_WIDTH,
			Math.max(...rows.map((row) => row[column]?.length ?? 0))
		)
	})
	const minimumWidths = widths.map((width, column) => {
		return Math.min(width, Math.max(3, rows[0]?.[column]?.length ?? 3))
	})
	while (tableWidth(widths) > maxWidth) {
		let widestColumn = -1
		let availableWidth = 0
		for (let column = 0; column < widths.length; column++) {
			const available = widths[column] - minimumWidths[column]
			if (available > availableWidth) {
				availableWidth = available
				widestColumn = column
			}
		}
		if (widestColumn < 0) break
		widths[widestColumn]--
	}

	const formatted = rows.map((row) => {
		return widths
			.map((width, column) => fitCell(row[column] ?? "", width))
			.join(" | ")
	})

	formatted.splice(
		1,
		0,
		widths.map((width) => "-".repeat(width)).join("-+-")
	)
	return formatted
}

function tableWidth(widths: number[]): number {
	return widths.reduce((total, width) => total + width, 0) +
		Math.max(0, widths.length - 1) * 3
}

function fitCell(value: string, width: number): string {
	const clipped =
		value.length > width ? `${value.slice(0, Math.max(0, width - 3))}...` : value
	return clipped.padEnd(width, " ")
}

function formatInlineMarkdown(value: string): string {
	return value
		.replace(/^#{1,6}\s+/, "")
		.replace(/\*\*(.*?)\*\*/g, "$1")
		.replace(/__(.*?)__/g, "$1")
		.replace(/`(.*?)`/g, "$1")
}
