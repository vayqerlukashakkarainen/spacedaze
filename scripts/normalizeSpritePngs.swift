import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

let fileManager = FileManager.default
let root = URL(fileURLWithPath: CommandLine.arguments.dropFirst().first ?? "public/sprites")
let shouldWrite = CommandLine.arguments.contains("--write")
let shouldCheck = CommandLine.arguments.contains("--check")
let workingDirectory = URL(fileURLWithPath: fileManager.currentDirectoryPath)
let resourceKeys: Set<URLResourceKey> = [.isRegularFileKey]
let enumerator = fileManager.enumerator(
	at: root,
	includingPropertiesForKeys: Array(resourceKeys),
	options: [.skipsHiddenFiles]
)

func decode(_ data: Data) -> CGImage? {
	guard let source = CGImageSourceCreateWithData(data as CFData, nil) else { return nil }
	return CGImageSourceCreateImageAtIndex(source, 0, nil)
}

func decode(_ file: URL) -> CGImage? {
	guard let source = CGImageSourceCreateWithURL(file as CFURL, nil) else { return nil }
	return CGImageSourceCreateImageAtIndex(source, 0, nil)
}

func rgbaPixels(_ image: CGImage) -> [UInt8]? {
	var pixels = [UInt8](repeating: 0, count: image.width * image.height * 4)
	let rendered = pixels.withUnsafeMutableBytes { bytes -> Bool in
		guard let context = CGContext(
			data: bytes.baseAddress,
			width: image.width,
			height: image.height,
			bitsPerComponent: 8,
			bytesPerRow: image.width * 4,
			space: CGColorSpaceCreateDeviceRGB(),
			bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue
		) else { return false }
		context.interpolationQuality = .none
		context.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))
		return true
	}
	return rendered ? pixels : nil
}

func gitImage(for file: URL) -> CGImage? {
	let prefix = workingDirectory.path + "/"
	guard file.path.hasPrefix(prefix) else { return nil }
	let relativePath = String(file.path.dropFirst(prefix.count))
	let process = Process()
	let output = Pipe()
	process.executableURL = URL(fileURLWithPath: "/usr/bin/git")
	process.arguments = ["show", "HEAD:\(relativePath)"]
	process.standardOutput = output
	process.standardError = FileHandle.nullDevice
	do {
		try process.run()
		let data = output.fileHandleForReading.readDataToEndOfFile()
		process.waitUntilExit()
		guard process.terminationStatus == 0 else { return nil }
		return decode(data)
	} catch {
		return nil
	}
}

func exteriorMask(width: Int, height: Int, candidates: [Bool]) -> [Bool] {
	var exterior = [Bool](repeating: false, count: width * height)
	var queue = [Int]()
	queue.reserveCapacity(width * 2 + height * 2)

	func enqueue(_ index: Int) {
		if candidates[index] && !exterior[index] {
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
	return exterior
}

func writePng(_ image: CGImage, to file: URL) -> Bool {
	let temporary = file.deletingLastPathComponent().appendingPathComponent(".\(file.lastPathComponent).normalized")
	guard let destination = CGImageDestinationCreateWithURL(
		temporary as CFURL,
		UTType.png.identifier as CFString,
		1,
		nil
	) else { return false }
	CGImageDestinationAddImage(destination, image, nil)
	guard CGImageDestinationFinalize(destination) else { return false }
	do {
		_ = try fileManager.replaceItemAt(file, withItemAt: temporary)
		return true
	} catch {
		return false
	}
}

var inspected = 0
var candidates = 0
var normalized = 0

while let file = enumerator?.nextObject() as? URL {
	guard file.pathExtension.lowercased() == "png" else { continue }
	guard let values = try? file.resourceValues(forKeys: resourceKeys), values.isRegularFile == true else { continue }
	guard let image = decode(file), let pixels = rgbaPixels(image) else {
		fputs("Could not decode \(file.path)\n", stderr)
		exit(1)
	}
	inspected += 1

	let width = image.width
	let height = image.height
	let reference = gitImage(for: file)
	let referencePixels = reference?.width == width && reference?.height == height
		? reference.flatMap(rgbaPixels)
		: nil
	let currentHasTransparency = stride(from: 3, to: pixels.count, by: 4).contains { pixels[$0] < 255 }
	let transparencySource = referencePixels ?? (currentHasTransparency ? pixels : nil)
	var transparentCandidates = [Bool](repeating: false, count: width * height)
	var hasColor = false
	var hasPartialAlpha = false

	for index in 0..<(width * height) {
		let offset = index * 4
		let red = pixels[offset]
		let green = pixels[offset + 1]
		let blue = pixels[offset + 2]
		let alpha = pixels[offset + 3]
		hasColor = hasColor || red != green || green != blue
		hasPartialAlpha = hasPartialAlpha || (alpha > 0 && alpha < 255)
		if let source = transparencySource {
			transparentCandidates[index] = source[offset + 3] == 0
		} else {
			transparentCandidates[index] = red == 0 && green == 0 && blue == 0
		}
	}

	let exterior = exteriorMask(width: width, height: height, candidates: transparentCandidates)
	let hasIncorrectAlpha = exterior.indices.contains { index in
		let expectedAlpha: UInt8 = exterior[index] ? 0 : 255
		return pixels[index * 4 + 3] != expectedAlpha
	}
	let requiresNormalization = hasColor || hasPartialAlpha || hasIncorrectAlpha
	guard requiresNormalization else { continue }
	candidates += 1
	guard shouldWrite else {
		print(file.path)
		continue
	}

	var output = [UInt8](repeating: 0, count: pixels.count)
	for index in 0..<(width * height) {
		let offset = index * 4
		if exterior[index] {
			output[offset + 3] = 0
			continue
		}
		let red = Double(pixels[offset])
		let green = Double(pixels[offset + 1])
		let blue = Double(pixels[offset + 2])
		let gray = UInt8(max(0, min(255, Int((red * 0.2126 + green * 0.7152 + blue * 0.0722).rounded()))))
		output[offset] = gray
		output[offset + 1] = gray
		output[offset + 2] = gray
		output[offset + 3] = 255
	}

	let outputImage = output.withUnsafeMutableBytes { bytes -> CGImage? in
		guard let context = CGContext(
			data: bytes.baseAddress,
			width: width,
			height: height,
			bitsPerComponent: 8,
			bytesPerRow: width * 4,
			space: CGColorSpaceCreateDeviceRGB(),
			bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue
		) else { return nil }
		return context.makeImage()
	}
	guard let outputImage, writePng(outputImage, to: file) else {
		fputs("Could not write \(file.path)\n", stderr)
		exit(1)
	}
	normalized += 1
}

if shouldWrite {
	print("Normalized \(normalized) of \(inspected) PNG sprites")
} else {
	print("Found \(candidates) of \(inspected) PNG sprites requiring normalization")
	if shouldCheck && candidates > 0 {
		exit(1)
	}
}
