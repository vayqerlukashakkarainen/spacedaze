import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

struct Raster {
	let width: Int
	let height: Int
	var pixels: [UInt8]
}

let projectRoot = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let spriteRoot = projectRoot.appendingPathComponent("public/sprites/boss/boss1")

func load(_ name: String) -> Raster {
	let url = spriteRoot.appendingPathComponent(name)
	guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
		let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
		fatalError("Could not decode \(url.path)")
	}
	var pixels = [UInt8](repeating: 0, count: image.width * image.height * 4)
	let decoded = pixels.withUnsafeMutableBytes { bytes -> Bool in
		guard let context = CGContext(
			data: bytes.baseAddress,
			width: image.width,
			height: image.height,
			bitsPerComponent: 8,
			bytesPerRow: image.width * 4,
			space: CGColorSpaceCreateDeviceRGB(),
			bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue |
				CGBitmapInfo.byteOrder32Big.rawValue
		) else { return false }
		context.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))
		return true
	}
	guard decoded else { fatalError("Could not rasterize \(url.path)") }
	return Raster(width: image.width, height: image.height, pixels: pixels)
}

func save(_ raster: Raster, as name: String) {
	var raster = raster
	let image = raster.pixels.withUnsafeMutableBytes { bytes -> CGImage? in
		guard let context = CGContext(
			data: bytes.baseAddress,
			width: raster.width,
			height: raster.height,
			bitsPerComponent: 8,
			bytesPerRow: raster.width * 4,
			space: CGColorSpaceCreateDeviceRGB(),
			bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue |
				CGBitmapInfo.byteOrder32Big.rawValue
		) else { return nil }
		return context.makeImage()
	}
	let url = spriteRoot.appendingPathComponent(name)
	guard let image,
		let destination = CGImageDestinationCreateWithURL(
			url as CFURL,
			UTType.png.identifier as CFString,
			1,
			nil
		) else { fatalError("Could not create \(url.path)") }
	CGImageDestinationAddImage(destination, image, nil)
	guard CGImageDestinationFinalize(destination) else {
		fatalError("Could not write \(url.path)")
	}
}

func alpha(_ raster: Raster, _ x: Int, _ y: Int) -> UInt8 {
	raster.pixels[(y * raster.width + x) * 4 + 3]
}

func clearPart(
	_ part: Raster,
	from body: inout Raster,
	atX originX: Int,
	y originY: Int,
	flipped: Bool = false
) {
	for y in 0..<part.height {
		for x in 0..<part.width {
			let sourceX = flipped ? part.width - 1 - x : x
			if alpha(part, sourceX, y) == 0 { continue }
			let targetX = originX + x
			let targetY = originY + y
			if targetX < 0 || targetX >= body.width || targetY < 0 || targetY >= body.height {
				continue
			}
			let offset = (targetY * body.width + targetX) * 4
			body.pixels[offset] = 0
			body.pixels[offset + 1] = 0
			body.pixels[offset + 2] = 0
			body.pixels[offset + 3] = 0
		}
	}
}

func mirrored(_ source: Raster) -> Raster {
	var output = Raster(
		width: source.width,
		height: source.height,
		pixels: [UInt8](repeating: 0, count: source.pixels.count)
	)
	for y in 0..<source.height {
		for x in 0..<source.width {
			let sourceOffset = (y * source.width + (source.width - 1 - x)) * 4
			let targetOffset = (y * source.width + x) * 4
			for channel in 0..<4 {
				output.pixels[targetOffset + channel] = source.pixels[sourceOffset + channel]
			}
		}
	}
	return output
}

func phaseCore(_ phase: Raster, using mask: Raster) -> Raster {
	precondition(phase.width == mask.width && phase.height == mask.height)
	var output = phase
	for y in 0..<phase.height {
		for x in 0..<phase.width where alpha(mask, x, y) == 0 {
			let offset = (y * phase.width + x) * 4
			output.pixels[offset] = 0
			output.pixels[offset + 1] = 0
			output.pixels[offset + 2] = 0
			output.pixels[offset + 3] = 0
		}
	}
	return output
}

let body = load("boss1_body.png")
let blaster = load("boss1_blaster.png")
let crown = load("boss1_head.png")
precondition(body.width == 128 && body.height == 128)
precondition(blaster.width == 28 && blaster.height == 48)
precondition(crown.width == 28 && crown.height == 42)

var core = body
clearPart(blaster, from: &core, atX: 0, y: 35)
clearPart(blaster, from: &core, atX: 100, y: 35, flipped: true)
clearPart(crown, from: &core, atX: 50, y: 6)

save(core, as: "boss1_core.png")
save(phaseCore(load("boss1_body_phase2.png"), using: core), as: "boss1_core_phase2.png")
save(phaseCore(load("boss1_body_phase3.png"), using: core), as: "boss1_core_phase3.png")
save(mirrored(blaster), as: "boss1_blaster_right.png")

print("Split boss1 into three 128x128 hull phases and two 28x48 battery sprites")
