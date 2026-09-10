import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

guard (4...7).contains(CommandLine.arguments.count),
	let outputSize = Int(CommandLine.arguments[3]),
	outputSize > 0 else {
	fputs("Usage: swift scripts/prepareGeneratedSprite.swift <input.png> <output.png> <size> [logical-size] [grayscale|ink|dither] [ink-threshold]\n", stderr)
	exit(1)
}
let requestedLogicalSize = CommandLine.arguments.count >= 5
	? Int(CommandLine.arguments[4])
	: outputSize
guard let logicalSize = requestedLogicalSize,
	logicalSize > 0,
	logicalSize <= outputSize,
	outputSize % logicalSize == 0 else {
	fputs("logical-size must divide size evenly\n", stderr)
	exit(1)
}
let requestedStyle = CommandLine.arguments.count >= 6
	? CommandLine.arguments[5]
	: "grayscale"
let style = requestedStyle == "1bit" ? "ink" : requestedStyle
guard ["grayscale", "ink", "dither"].contains(style) else {
	fputs("style must be grayscale, ink, or dither\n", stderr)
	exit(1)
}
let requestedInkThreshold = CommandLine.arguments.count == 7
	? Int(CommandLine.arguments[6])
	: 128
guard let inkThreshold = requestedInkThreshold,
	(0...255).contains(inkThreshold) else {
	fputs("ink threshold must be between 0 and 255\n", stderr)
	exit(1)
}

let input = URL(fileURLWithPath: CommandLine.arguments[1])
let output = URL(fileURLWithPath: CommandLine.arguments[2])
guard let source = CGImageSourceCreateWithURL(input as CFURL, nil),
	let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
	fputs("Could not decode input image\n", stderr)
	exit(1)
}

let width = image.width
let height = image.height
var sourcePixels = [UInt8](repeating: 0, count: width * height * 4)
let rendered = sourcePixels.withUnsafeMutableBytes { bytes -> Bool in
	guard let context = CGContext(
		data: bytes.baseAddress,
		width: width,
		height: height,
		bitsPerComponent: 8,
		bytesPerRow: width * 4,
		space: CGColorSpaceCreateDeviceRGB(),
		bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue
	) else { return false }
	context.interpolationQuality = .none
	context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
	return true
}
guard rendered else { exit(1) }

let cornerIndices = [
	0,
	width - 1,
	(height - 1) * width,
	height * width - 1,
]
let cornerLuminance = cornerIndices.reduce(0) { result, index in
	let offset = index * 4
	return result + Int(sourcePixels[offset]) + Int(sourcePixels[offset + 1]) + Int(sourcePixels[offset + 2])
} / (cornerIndices.count * 3)
// Generated images can contain a mostly opaque dark background plus a few
// transparent edge pixels. Corner luminance is the reliable signal here.
let sourceHasDarkBackground = cornerLuminance < 128

func isBackgroundCandidate(_ index: Int) -> Bool {
	let offset = index * 4
	if sourcePixels[offset + 3] == 0 { return true }
	if sourceHasDarkBackground {
		return sourcePixels[offset] <= 48 &&
			sourcePixels[offset + 1] <= 48 &&
			sourcePixels[offset + 2] <= 48
	}
	return sourcePixels[offset] >= 225 &&
		sourcePixels[offset + 1] >= 225 &&
		sourcePixels[offset + 2] >= 225
}

var exterior = [Bool](repeating: false, count: width * height)
var queue = [Int]()
func enqueue(_ index: Int) {
	if !exterior[index] && isBackgroundCandidate(index) {
		exterior[index] = true
		queue.append(index)
	}
}
for x in 0..<width {
	enqueue(x)
	enqueue((height - 1) * width + x)
}
for y in 0..<height {
	enqueue(y * width)
	enqueue(y * width + width - 1)
}
var cursor = 0
while cursor < queue.count {
	let index = queue[cursor]
	cursor += 1
	let x = index % width
	let y = index / width
	if x > 0 { enqueue(index - 1) }
	if x + 1 < width { enqueue(index + 1) }
	if y > 0 { enqueue(index - width) }
	if y + 1 < height { enqueue(index + width) }
}

var minX = width
var minY = height
var maxX = 0
var maxY = 0
for index in exterior.indices where !exterior[index] {
	let x = index % width
	let y = index / width
	minX = min(minX, x)
	minY = min(minY, y)
	maxX = max(maxX, x)
	maxY = max(maxY, y)
}
guard minX <= maxX && minY <= maxY else {
	fputs("No sprite silhouette found\n", stderr)
	exit(1)
}

let padding = logicalSize <= 32 ? 2 : 3
let sourceWidth = maxX - minX + 1
let sourceHeight = maxY - minY + 1
let available = logicalSize - padding * 2
let fitScale = min(
	Double(available) / Double(sourceWidth),
	Double(available) / Double(sourceHeight)
)
let drawnWidth = max(1, Int((Double(sourceWidth) * fitScale).rounded()))
let drawnHeight = max(1, Int((Double(sourceHeight) * fitScale).rounded()))
let originX = (logicalSize - drawnWidth) / 2
let originY = (logicalSize - drawnHeight) / 2
let grayscalePalette = [UInt8(0), UInt8(88), UInt8(176), UInt8(255)]
let bayer4x4 = [
	0, 8, 2, 10,
	12, 4, 14, 6,
	3, 11, 1, 9,
	15, 7, 13, 5,
]
var logicalPixels = [UInt8](repeating: 0, count: logicalSize * logicalSize * 4)

for targetY in 0..<drawnHeight {
	for targetX in 0..<drawnWidth {
		let sourceStartX = minX + Int(Double(targetX) / fitScale)
		let sourceEndX = min(maxX + 1, minX + Int((Double(targetX + 1) / fitScale).rounded(.up)))
		let sourceStartY = minY + Int(Double(targetY) / fitScale)
		let sourceEndY = min(maxY + 1, minY + Int((Double(targetY + 1) / fitScale).rounded(.up)))
		var occupied = 0
		var luminance = 0.0
		for sourceY in sourceStartY..<sourceEndY {
			for sourceX in sourceStartX..<sourceEndX {
				let sourceIndex = sourceY * width + sourceX
				if exterior[sourceIndex] { continue }
				let offset = sourceIndex * 4
				occupied += 1
				luminance += Double(sourcePixels[offset]) * 0.2126
					+ Double(sourcePixels[offset + 1]) * 0.7152
					+ Double(sourcePixels[offset + 2]) * 0.0722
			}
		}
		let sampleCount = max(1, (sourceEndX - sourceStartX) * (sourceEndY - sourceStartY))
		if Double(occupied) / Double(sampleCount) < 0.18 { continue }
		let average = max(0, min(255, luminance / Double(max(1, occupied))))
		let gray: UInt8
		switch style {
		case "ink":
			gray = average >= Double(inkThreshold) ? 255 : 0
		case "dither":
			let matrixIndex = (targetY % 4) * 4 + targetX % 4
			let threshold = (Double(bayer4x4[matrixIndex]) + 0.5) / 16 * 255
			gray = average >= threshold ? 255 : 0
		default:
			let roundedAverage = UInt8(average.rounded())
			gray = grayscalePalette.min(by: {
				abs(Int($0) - Int(roundedAverage)) < abs(Int($1) - Int(roundedAverage))
			}) ?? roundedAverage
		}
		let targetIndex = ((originY + targetY) * logicalSize + originX + targetX) * 4
		logicalPixels[targetIndex] = gray
		logicalPixels[targetIndex + 1] = gray
		logicalPixels[targetIndex + 2] = gray
		logicalPixels[targetIndex + 3] = 255
	}
}

if style == "ink" {
	var cleanedPixels = logicalPixels
	for y in 0..<logicalSize {
		for x in 0..<logicalSize {
			let index = y * logicalSize + x
			let offset = index * 4
			if logicalPixels[offset + 3] == 0 { continue }
			let value = logicalPixels[offset]
			var sameColorNeighbors = 0
			var oppositeColorNeighbors = 0
			for neighborY in max(0, y - 1)...min(logicalSize - 1, y + 1) {
				for neighborX in max(0, x - 1)...min(logicalSize - 1, x + 1) {
					if neighborX == x && neighborY == y { continue }
					let neighborOffset = (neighborY * logicalSize + neighborX) * 4
					if logicalPixels[neighborOffset + 3] == 0 { continue }
					if logicalPixels[neighborOffset] == value {
						sameColorNeighbors += 1
					} else {
						oppositeColorNeighbors += 1
					}
				}
			}
			if sameColorNeighbors == 0 && oppositeColorNeighbors >= 3 {
				let cleanedValue: UInt8 = value == 0 ? 255 : 0
				cleanedPixels[offset] = cleanedValue
				cleanedPixels[offset + 1] = cleanedValue
				cleanedPixels[offset + 2] = cleanedValue
			}
		}
	}
	logicalPixels = cleanedPixels
}

let minimumComponentPixels = max(2, logicalSize / 32)
var visited = [Bool](repeating: false, count: logicalSize * logicalSize)
for start in 0..<(logicalSize * logicalSize) {
	if visited[start] || logicalPixels[start * 4 + 3] == 0 { continue }
	var component = [start]
	var componentCursor = 0
	visited[start] = true
	while componentCursor < component.count {
		let index = component[componentCursor]
		componentCursor += 1
		let x = index % logicalSize
		let y = index / logicalSize
		let neighbors = [
			x > 0 ? index - 1 : -1,
			x + 1 < logicalSize ? index + 1 : -1,
			y > 0 ? index - logicalSize : -1,
			y + 1 < logicalSize ? index + logicalSize : -1,
		]
		for neighbor in neighbors where neighbor >= 0 {
			if visited[neighbor] || logicalPixels[neighbor * 4 + 3] == 0 { continue }
			visited[neighbor] = true
			component.append(neighbor)
		}
	}
	if component.count >= minimumComponentPixels { continue }
	for index in component {
		let offset = index * 4
		logicalPixels[offset] = 0
		logicalPixels[offset + 1] = 0
		logicalPixels[offset + 2] = 0
		logicalPixels[offset + 3] = 0
	}
}

var outputPixels = [UInt8](repeating: 0, count: outputSize * outputSize * 4)
let pixelScale = outputSize / logicalSize
for logicalY in 0..<logicalSize {
	for logicalX in 0..<logicalSize {
		let sourceIndex = (logicalY * logicalSize + logicalX) * 4
		for offsetY in 0..<pixelScale {
			for offsetX in 0..<pixelScale {
				let targetX = logicalX * pixelScale + offsetX
				let targetY = logicalY * pixelScale + offsetY
				let targetIndex = (targetY * outputSize + targetX) * 4
				outputPixels[targetIndex] = logicalPixels[sourceIndex]
				outputPixels[targetIndex + 1] = logicalPixels[sourceIndex + 1]
				outputPixels[targetIndex + 2] = logicalPixels[sourceIndex + 2]
				outputPixels[targetIndex + 3] = logicalPixels[sourceIndex + 3]
			}
		}
	}
}

let outputImage = outputPixels.withUnsafeMutableBytes { bytes -> CGImage? in
	guard let context = CGContext(
		data: bytes.baseAddress,
		width: outputSize,
		height: outputSize,
		bitsPerComponent: 8,
		bytesPerRow: outputSize * 4,
		space: CGColorSpaceCreateDeviceRGB(),
		bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue
	) else { return nil }
	return context.makeImage()
}
do {
	try FileManager.default.createDirectory(
		at: output.deletingLastPathComponent(),
		withIntermediateDirectories: true
	)
} catch {
	fputs("Could not create output directory\n", stderr)
	exit(1)
}
guard let outputImage,
	let destination = CGImageDestinationCreateWithURL(
		output as CFURL,
		UTType.png.identifier as CFString,
		1,
		nil
	) else { exit(1) }
CGImageDestinationAddImage(destination, outputImage, nil)
guard CGImageDestinationFinalize(destination) else { exit(1) }
print("Prepared \(output.lastPathComponent) at \(outputSize)x\(outputSize) from \(logicalSize)x\(logicalSize) logical pixels using \(style)")
