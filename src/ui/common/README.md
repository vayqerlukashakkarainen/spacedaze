# SpaceDaze UI

Import shared UI building blocks from `src/ui/common` rather than styling
Kaplay objects directly. The library keeps terminal screens visually consistent
and makes child components use coordinates relative to their parent.

## Foundations

- `UI_COLORS`, `UI_SPACING`, and `UI_SIZES` are the shared design tokens.
- `addThemedText` provides semantic text variants such as `eyebrow`, `title`,
  `body`, `muted`, and `caption`.
- `createUiVerticalFlow` and `createUiHorizontalFlow` handle sequential layout.
- `createUiGrowingContainer` wraps a vertical flow and grows its surface as
  wrapped text or other children increase the content height.

## Components

- `createUiSurface` creates default, raised, or selected content regions.
- `createUiSectionHeader` creates an eyebrow/title/action header with a divider.
- `createUiSelectableRow` creates aligned interactive records with selected,
  hover, disabled, metadata, and status states.
- `createUiSelectableCard` creates larger interactive comparison cards with
  shared selected, hover, and disabled states.
- `createUiActionButton` creates buttons inside an existing panel or surface.
- `createUiCollapsible` lazily mounts and unmounts expandable UI content and
  exposes explicit expand, collapse, and toggle controls.
- `createUiCommandButton` creates indexed menu commands with leading and
  trailing content plus a high-contrast selected state.
- `createUiBadge` displays compact statuses or rarities.
- `createUiProgressBar` displays normalized progress and supports live updates.
- `createUiStatList` aligns labels and values into stable lanes.
- `createUiTelemetryStrip` creates an unboxed horizontal label/value readout.

## Example

```ts
import {
	createUiSectionHeader,
	createUiSelectableRow,
	createUiSurface,
} from "./common"

createUiSurface(panel, {
	pos: k.vec2(16, 64),
	size: k.vec2(280, 320),
})

createUiSectionHeader(panel, {
	pos: k.vec2(16, 64),
	width: 280,
	eyebrow: "RECORD INDEX",
	title: "RECOVERED SCHEMATICS",
})

createUiSelectableRow(panel, {
	pos: k.vec2(16, 116),
	width: 280,
	title: "COMBAT DRONE",
	meta: "BP-DRN-001",
	status: "SELECTED",
	selected: true,
	onClick: () => selectBlueprint("combatDrone"),
})
```

Use the accent for selection and important actions. Structural borders should
use `UI_COLORS.border`; large cyan outlines make every element compete for
attention. Keep repeated rows on fixed label, content, and trailing-status lanes.
