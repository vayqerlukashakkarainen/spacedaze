import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

guard CommandLine.arguments.count == 3 else {
	fputs("Usage: swift scripts/prepareMonochromeEnemySprite.swift <input.png> <output.png>\n", stderr)
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
let decoded = sourcePixels.withUnsafeMutableBytes { bytes -> Bool in
	guard let context = CGContext(
		data: bytes.baseAddress,
		width: width,
		height: height,
		bitsPerComponent: 8,
		bytesPerRow: width * 4,
		space: CGColorSpaceCreateDeviceRGB(),
		bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue |
			CGBitmapInfo.byteOrder32Big.rawValue
	) else { return false }
	context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
	return true
}
guard decoded else { exit(1) }

func isSpritePixel(_ x: Int, _ y: Int) -> Bool {
	let offset = (y * width + x) * 4
	let luminance = Double(sourcePixels[offset]) * 0.2126 +
		Double(sourcePixels[offset + 1]) * 0.7152 +
		Double(sourcePixels[offset + 2]) * 0.0722
	return sourcePixels[offset + 3] > 0 && luminance >= 225
}

let cropMinX = width / 8
let cropMaxX = width - cropMinX
let cropMinY = height / 8
let cropMaxY = height - cropMinY
var minX = cropMaxX
var minY = cropMaxY
var maxX = cropMinX
var maxY = cropMinY
for y in cropMinY..<cropMaxY {
	for x in cropMinX..<cropMaxX where isSpritePixel(x, y) {
		minX = min(minX, x)
		minY = min(minY, y)
		maxX = max(maxX, x)
		maxY = max(maxY, y)
	}
}
guard minX <= maxX && minY <= maxY else {
	fputs("No bright sprite silhouette found\n", stderr)
	exit(1)
}

let outputSize = 32
let padding = 2
let available = outputSize - padding * 2
let sourceWidth = maxX - minX + 1
let sourceHeight = maxY - minY + 1
let scale = min(
	Double(available) / Double(sourceWidth),
	Double(available) / Double(sourceHeight)
)
let drawnWidth = max(1, Int((Double(sourceWidth) * scale).rounded()))
let drawnHeight = max(1, Int((Double(sourceHeight) * scale).rounded()))
let originX = (outputSize - drawnWidth) / 2
let originY = (outputSize - drawnHeight) / 2
var outputPixels = [UInt8](repeating: 0, count: outputSize * outputSize * 4)

for targetY in 0..<drawnHeight {
	for targetX in 0..<drawnWidth {
		let startX = minX + Int(Double(targetX) / scale)
		let endX = min(maxX + 1, minX + Int((Double(targetX + 1) / scale).rounded(.up)))
		let startY = minY + Int(Double(targetY) / scale)
		let endY = min(maxY + 1, minY + Int((Double(targetY + 1) / scale).rounded(.up)))
		var spritePixels = 0
		let sampleCount = max(1, (endX - startX) * (endY - startY))
		for y in startY..<endY {
			for x in startX..<endX where isSpritePixel(x, y) {
				spritePixels += 1
			}
		}
		if Double(spritePixels) / Double(sampleCount) < 0.12 { continue }
		let offset = ((originY + targetY) * outputSize + originX + targetX) * 4
		outputPixels[offset] = 255
		outputPixels[offset + 1] = 255
		outputPixels[offset + 2] = 255
		outputPixels[offset + 3] = 255
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
		bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue |
			CGBitmapInfo.byteOrder32Big.rawValue
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
print("Prepared \(output.lastPathComponent) as a 32x32 white transparent sprite")
