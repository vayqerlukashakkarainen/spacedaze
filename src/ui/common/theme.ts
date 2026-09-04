export const UI_COLORS = {
	background: [2, 7, 11] as const,
	panel: [3, 10, 14] as const,
	panelRaised: [5, 13, 18] as const,
	panelHover: [10, 28, 35] as const,
	border: [23, 49, 59] as const,
	accent: [0, 207, 255] as const,
	text: [234, 247, 250] as const,
	muted: [88, 114, 125] as const,
	warning: [240, 184, 75] as const,
	success: [90, 220, 145] as const,
	danger: [255, 90, 90] as const,
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
