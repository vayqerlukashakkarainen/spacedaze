export type UiColor = readonly [number, number, number]

interface UiColorPalette {
	background: UiColor
	panel: UiColor
	panelRaised: UiColor
	panelHover: UiColor
	border: UiColor
	accent: UiColor
	text: UiColor
	muted: UiColor
	phaseCore: UiColor
	psionicPlate: UiColor
	thrusterPart: UiColor
	lassoToken: UiColor
	warning: UiColor
	success: UiColor
	danger: UiColor
}

export const UI_COLORS: UiColorPalette = {
	background: [2, 7, 11],
	panel: [3, 10, 14],
	panelRaised: [5, 13, 18],
	panelHover: [10, 28, 35],
	border: [23, 49, 59],
	accent: [0, 207, 255],
	text: [234, 247, 250],
	muted: [88, 114, 125],
	phaseCore: [255, 90, 90],
	psionicPlate: [90, 220, 145],
	thrusterPart: [240, 184, 75],
	lassoToken: [80, 220, 255],
	warning: [240, 184, 75],
	success: [90, 220, 145],
	danger: [255, 90, 90],
}

export const UI_SPACING = {
	xs: 4,
	sm: 8,
	md: 12,
	lg: 18,
	xl: 24,
} as const

export const UI_FONT_SIZES = {
	micro: 9,
	tiny: 9,
	small: 9,
	label: 10,
	body: 12,
	subheading: 14,
	heading: 16,
	sectionTitle: 18,
	title: 20,
	display: 24,
	hero: 32,
	logo: 42,
	countdown: 64,
	death: 72,
} as const

export type UiFontSize = typeof UI_FONT_SIZES[keyof typeof UI_FONT_SIZES]

export const UI_SIZES = {
	border: 1,
	selectionRail: 3,
	row: 42,
	header: 52,
	button: 38,
} as const
