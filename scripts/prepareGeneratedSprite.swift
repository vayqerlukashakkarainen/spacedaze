import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

guard CommandLine.arguments.count == 4,
	let outputSize = Int(CommandLine.arguments[3]),
	outputSize > 0 else {
	fputs("Usage: swift scripts/prepareGeneratedSprite.swift <input.png> <output.png> <size>\n", stderr)
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

func isBackgroundCandidate(_ index: Int) -> Bool {
	let offset = index * 4
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

let padding = outputSize <= 32 ? 2 : 3
let sourceWidth = maxX - minX + 1
let sourceHeight = maxY - minY + 1
let available = outputSize - padding * 2
let fitScale = min(
	Double(available) / Double(sourceWidth),
	Double(available) / Double(sourceHeight)
)
let drawnWidth = max(1, Int((Double(sourceWidth) * fitScale).rounded()))
let drawnHeight = max(1, Int((Double(sourceHeight) * fitScale).rounded()))
let originX = (outputSize - drawnWidth) / 2
let originY = (outputSize - drawnHeight) / 2
let palette = [UInt8(0), UInt8(88), UInt8(176), UInt8(255)]
var outputPixels = [UInt8](repeating: 0, count: outputSize * outputSize * 4)

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
		let average = UInt8(max(0, min(255, Int((luminance / Double(max(1, occupied))).rounded()))))
		let gray = palette.min(by: {
			abs(Int($0) - Int(average)) < abs(Int($1) - Int(average))
		}) ?? average
		let targetIndex = ((originY + targetY) * outputSize + originX + targetX) * 4
		outputPixels[targetIndex] = gray
		outputPixels[targetIndex + 1] = gray
		outputPixels[targetIndex + 2] = gray
		outputPixels[targetIndex + 3] = 255
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
guard let outputImage,
	let destination = CGImageDestinationCreateWithURL(
		output as CFURL,
		UTType.png.identifier as CFString,
		1,
		nil
	) else { exit(1) }
CGImageDestinationAddImage(destination, outputImage, nil)
guard CGImageDestinationFinalize(destination) else { exit(1) }
print("Prepared \(output.lastPathComponent) at \(outputSize)x\(outputSize)")
