import {
	hexDistance,
	hexKey,
	hexNeighbors,
	hexToPixel,
} from "../../generation/hexUtils"
import {
	createHubRestorationFloorStampCells,
	getHubRestorationFloorStampMaterial,
	HUB_RESTORATION_FLOOR_STAMP,
} from "./restorationFloorStamp"

function assert(condition: boolean, message: string) {
	if (!condition) throw new Error(message)
}

const stamp = HUB_RESTORATION_FLOOR_STAMP
const cells = createHubRestorationFloorStampCells()
const cellKeys = new Set(cells.map((coord) => hexKey(coord)))
assert(
	cells.length < 61,
	"The hub floor stamp should have authored gaps instead of a perfect radius-four hex"
)
assert(
	cells.some((coord) => hexDistance(coord, { q: 0, r: 0 }) > stamp.hexRadius),
	"The hub floor stamp should have at least one uneven edge extension"
)
assert(
	!cellKeys.has(hexKey({ q: 2, r: 0 })),
	"The hub floor stamp should preserve its intentional missing interior tile"
)
assert(
	cellKeys.size === cells.length,
	"The hub floor stamp should not contain duplicate cells"
)
assert(cellKeys.has(hexKey({ q: 0, r: 0 })), "The shared floor should keep its center")

const connectedCells = new Set<string>()
const pendingCells = [cells[0]]
while (pendingCells.length > 0) {
	const coord = pendingCells.pop()
	if (!coord) continue
	const key = hexKey(coord)
	if (connectedCells.has(key)) continue
	connectedCells.add(key)
	for (const neighbor of hexNeighbors(coord)) {
		if (cellKeys.has(hexKey(neighbor))) pendingCells.push(neighbor)
	}
}
assert(
	connectedCells.size === cells.length,
	"The imperfect hub floor stamp should remain one connected platform"
)

assert(
	new Set(cells.map(getHubRestorationFloorStampMaterial)).size === 3,
	"The hub floor stamp should use all three grayscale materials for visible repairs"
)

for (let index = 0; index < 8; index++) {
	const angle = (-90 + index * 45) * Math.PI / 180
	const lampX = Math.cos(angle) * stamp.lampRingRadius
	const lampY = Math.sin(angle) * stamp.lampRingRadius + stamp.lampRingOffsetY
	assert(
		cells.some((coord) => {
			const center = hexToPixel(coord, stamp.hexSize)
			return pointIsInsidePointyHex(
				lampX - center.x,
				lampY - center.y,
				stamp.hexSize
			)
		}),
		`Restoration lamp ${index + 1} is outside the shared floor stamp`
	)
}

function pointIsInsidePointyHex(x: number, y: number, size: number) {
	const absoluteX = Math.abs(x)
	const absoluteY = Math.abs(y)
	return absoluteY <= size &&
		absoluteX <= Math.sqrt(3) * size / 2 &&
		Math.sqrt(3) * absoluteY + absoluteX <= Math.sqrt(3) * size
}

console.log("Hub restoration floor stamp tests passed")
