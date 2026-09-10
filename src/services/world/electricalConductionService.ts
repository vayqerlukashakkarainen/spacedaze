import type { Vec2 } from "kaplay"

export type ElectricalNodeId = number | string

export interface ElectricalNode {
	id: ElectricalNodeId
	position: Vec2
}

export interface ElectricalEdge {
	start: ElectricalNode
	end: ElectricalNode
}

export interface ElectricalTrace {
	poweredIds: Set<ElectricalNodeId>
	edges: ElectricalEdge[]
}

/** Builds one inexpensive spanning tree through every conductor in link range. */
export function traceElectricalNetwork(
	source: ElectricalNode,
	conductors: ElectricalNode[],
	linkDistance: number
): ElectricalTrace {
	const poweredIds = new Set<ElectricalNodeId>([source.id])
	const edges: ElectricalEdge[] = []
	const queue = [source]

	while (queue.length > 0) {
		const current = queue.shift()!
		for (const candidate of conductors) {
			if (
				poweredIds.has(candidate.id) ||
				current.position.dist(candidate.position) > linkDistance
			) continue
			poweredIds.add(candidate.id)
			edges.push({ start: current, end: candidate })
			queue.push(candidate)
		}
	}

	return { poweredIds, edges }
}
