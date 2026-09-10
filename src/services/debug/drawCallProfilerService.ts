interface TextureInfo {
	id: number
	width?: number
	height?: number
}

interface DrawCallSample {
	texture: string
	program: number
	indices: number
}

interface DrawCallFrame {
	draws: DrawCallSample[]
}

let installed = false
let tracing = false
let framesRemaining = 0
let currentFrame: DrawCallFrame | undefined
let capturedFrames: DrawCallFrame[] = []
let lastCapturedFrames: DrawCallFrame[] = []
const FULL_BATCH_INDEX_THRESHOLD = 12000

export function installDrawCallProfiler(canvas: HTMLCanvasElement) {
	if (installed) return
	const gl = canvas.getContext("webgl")
	if (!gl) return
	installed = true

	const textureIds = new WeakMap<WebGLTexture, TextureInfo>()
	const programIds = new WeakMap<WebGLProgram, number>()
	let nextTextureId = 1
	let nextProgramId = 1
	let currentTexture: WebGLTexture | null = null
	let currentProgram: WebGLProgram | null = null

	const originalBindTexture = gl.bindTexture.bind(gl)
	const originalTexImage2D = gl.texImage2D.bind(gl)
	const originalUseProgram = gl.useProgram.bind(gl)
	const originalDrawElements = gl.drawElements.bind(gl)

	gl.bindTexture = ((target: GLenum, texture: WebGLTexture | null) => {
		if (target === gl.TEXTURE_2D) currentTexture = texture
		originalBindTexture(target, texture)
	}) as typeof gl.bindTexture

	gl.texImage2D = ((...args: unknown[]) => {
		if (currentTexture && typeof args[3] === "number" && typeof args[4] === "number") {
			const info = getTextureInfo(currentTexture)
			info.width = args[3]
			info.height = args[4]
		} else if (currentTexture) {
			const source = args.length >= 9 ? args[8] : args[5]
			if (source && typeof source === "object") {
				const sizedSource = source as { width?: number; height?: number }
				if (typeof sizedSource.width === "number" && typeof sizedSource.height === "number") {
					const info = getTextureInfo(currentTexture)
					info.width = sizedSource.width
					info.height = sizedSource.height
				}
			}
		}
		return (originalTexImage2D as (...values: unknown[]) => void)(...args)
	}) as typeof gl.texImage2D

	gl.useProgram = ((program: WebGLProgram | null) => {
		currentProgram = program
		originalUseProgram(program)
	}) as typeof gl.useProgram

	gl.drawElements = ((
		mode: GLenum,
		count: GLsizei,
		type: GLenum,
		offset: GLintptr
	) => {
		if (tracing && currentFrame) {
			currentFrame.draws.push({
				texture: currentTexture ? formatTexture(getTextureInfo(currentTexture)) : "none",
				program: currentProgram ? getProgramId(currentProgram) : 0,
				indices: count,
			})
		}
		originalDrawElements(mode, count, type, offset)
	}) as typeof gl.drawElements

	function getTextureInfo(texture: WebGLTexture) {
		let info = textureIds.get(texture)
		if (!info) {
			info = { id: nextTextureId++ }
			textureIds.set(texture, info)
		}
		return info
	}

	function getProgramId(program: WebGLProgram) {
		let id = programIds.get(program)
		if (!id) {
			id = nextProgramId++
			programIds.set(program, id)
		}
		return id
	}
}

export function beginDrawCallProfilerFrame() {
	if (!tracing) return
	if (currentFrame && currentFrame.draws.length > 0) {
		capturedFrames.push(currentFrame)
		framesRemaining--
		if (framesRemaining <= 0) {
			lastCapturedFrames = capturedFrames
			capturedFrames = []
			currentFrame = undefined
			tracing = false
			return
		}
	}
	currentFrame = { draws: [] }
}

export function startDrawCallTrace(frames = 120) {
	framesRemaining = Math.max(1, Math.min(600, Math.floor(frames)))
	capturedFrames = []
	currentFrame = undefined
	tracing = true
}

export function drawCallTraceRunning() {
	return tracing
}

export function formatDrawCallTraceReport() {
	if (tracing) return `Draw trace running; ${framesRemaining} frames remaining`
	if (lastCapturedFrames.length === 0) {
		return "No draw trace captured. Use drawtrace start [frames]."
	}

	const materialTotals = new Map<string, number>()
	const textureTotals = new Map<string, number>()
	const materialIndices = new Map<string, number>()
	const materialMinIndices = new Map<string, number>()
	const materialMaxIndices = new Map<string, number>()
	const materialFullBatches = new Map<string, number>()
	let totalDraws = 0
	for (const frame of lastCapturedFrames) {
		totalDraws += frame.draws.length
		for (const draw of frame.draws) {
			const material = `${draw.texture} / program ${draw.program}`
			materialTotals.set(material, (materialTotals.get(material) ?? 0) + 1)
			materialIndices.set(material, (materialIndices.get(material) ?? 0) + draw.indices)
			materialMinIndices.set(material, Math.min(materialMinIndices.get(material) ?? draw.indices, draw.indices))
			materialMaxIndices.set(material, Math.max(materialMaxIndices.get(material) ?? draw.indices, draw.indices))
			if (draw.indices >= FULL_BATCH_INDEX_THRESHOLD) {
				materialFullBatches.set(material, (materialFullBatches.get(material) ?? 0) + 1)
			}
			textureTotals.set(draw.texture, (textureTotals.get(draw.texture) ?? 0) + 1)
		}
	}

	const frameCount = lastCapturedFrames.length
	const lines = [
		`Draw trace: ${frameCount} frames, ${(totalDraws / frameCount).toFixed(1)} calls/frame`,
		"TEXTURE | CALLS/FRAME",
		"---|---",
	]
	for (const [texture, count] of sortedEntries(textureTotals)) {
		lines.push(`${texture} | ${(count / frameCount).toFixed(1)}`)
	}
	lines.push("", "MATERIAL | CALLS/F | INDICES AVG/MIN/MAX | FULL/F", "---|---|---|---")
	for (const [material, count] of sortedEntries(materialTotals)) {
		lines.push(`${material} | ${(count / frameCount).toFixed(1)} | ${Math.round((materialIndices.get(material) ?? 0) / count)}/${materialMinIndices.get(material)}/${materialMaxIndices.get(material)} | ${((materialFullBatches.get(material) ?? 0) / frameCount).toFixed(1)}`)
	}
	return lines.join("\n")
}

function formatTexture(info: TextureInfo) {
	const size = info.width && info.height ? ` ${info.width}x${info.height}` : ""
	return `texture ${info.id}${size}`
}

function sortedEntries(values: Map<string, number>) {
	return [...values.entries()].sort(([, left], [, right]) => right - left)
}
