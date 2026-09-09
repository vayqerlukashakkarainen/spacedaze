import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

func fail(_ message: String) -> Never {
	fputs("\(message)\n", stderr)
	exit(1)
}

guard (3...5).contains(CommandLine.arguments.count) else {
	fail("Usage: swift scripts/simplifySprite.swift <input.png> <output.png> [gray-levels] [alpha-threshold]")
}

let input = URL(fileURLWithPath: CommandLine.arguments[1])
let output = URL(fileURLWithPath: CommandLine.arguments[2])
let requestedLevels = CommandLine.arguments.count >= 4
	? Int(CommandLine.arguments[3])
	: 8
let requestedAlphaThreshold = CommandLine.arguments.count == 5
	? Int(CommandLine.arguments[4])
	: 128

guard let grayLevels = requestedLevels, (2...256).contains(grayLevels) else {
	fail("gray-levels must be between 2 and 256")
}
guard let alphaThreshold = requestedAlphaThreshold,
	(0...255).contains(alphaThreshold) else {
	fail("alpha-threshold must be between 0 and 255")
}
guard let source = CGImageSourceCreateWithURL(input as CFURL, nil),
	let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
	fail("Could not decode input image: \(input.path)")
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
		bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
			| CGBitmapInfo.byteOrder32Big.rawValue
	) else { return false }
	context.interpolationQuality = .none
	context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
	return true
}
guard rendered else {
	fail("Could not render input image")
}

func unpremultiply(_ value: UInt8, alpha: UInt8) -> Double {
	guard alpha > 0 else { return 0 }
	return min(255, Double(value) * 255 / Double(alpha))
}

func quantize(_ luminance: Double) -> UInt8 {
	let steps = Double(grayLevels - 1)
	let bucket = (luminance / 255 * steps).rounded()
	return UInt8(max(0, min(255, (bucket / steps * 255).rounded())))
}

var outputPixels = [UInt8](repeating: 0, count: sourcePixels.count)
for pixel in 0..<(width * height) {
	let offset = pixel * 4
	let alpha = sourcePixels[offset + 3]
	if Int(alpha) < alphaThreshold {
		continue
	}

	let red = unpremultiply(sourcePixels[offset], alpha: alpha)
	let green = unpremultiply(sourcePixels[offset + 1], alpha: alpha)
	let blue = unpremultiply(sourcePixels[offset + 2], alpha: alpha)
	let luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722
	let gray = quantize(luminance)
	outputPixels[offset] = gray
	outputPixels[offset + 1] = gray
	outputPixels[offset + 2] = gray
	outputPixels[offset + 3] = 255
}

let outputImage = outputPixels.withUnsafeMutableBytes { bytes -> CGImage? in
	guard let context = CGContext(
		data: bytes.baseAddress,
		width: width,
		height: height,
		bitsPerComponent: 8,
		bytesPerRow: width * 4,
		space: CGColorSpaceCreateDeviceRGB(),
		bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
			| CGBitmapInfo.byteOrder32Big.rawValue
	) else { return nil }
	return context.makeImage()
}

do {
	try FileManager.default.createDirectory(
		at: output.deletingLastPathComponent(),
		withIntermediateDirectories: true
	)
} catch {
	fail("Could not create output directory: \(error.localizedDescription)")
}

guard let outputImage,
	let destination = CGImageDestinationCreateWithURL(
		output as CFURL,
		UTType.png.identifier as CFString,
		1,
		nil
	) else {
	fail("Could not create output image")
}
CGImageDestinationAddImage(destination, outputImage, nil)
guard CGImageDestinationFinalize(destination) else {
	fail("Could not write output image")
}

print("Simplified \(input.lastPathComponent) to \(grayLevels) gray levels at \(width)x\(height)")
