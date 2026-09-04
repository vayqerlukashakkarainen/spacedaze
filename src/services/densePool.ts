export type DensePoolId = string | number

type PendingMutation = () => void

export class DensePool<T> {
	private denseItems: T[] = []
	private indices = new Map<DensePoolId, number>()
	private pendingMutations: PendingMutation[] = []
	private iterationDepth = 0

	constructor(private getId: (item: T) => DensePoolId) {}

	get size() {
		return this.denseItems.length
	}

	get items(): readonly T[] {
		return this.denseItems
	}

	add(item: T) {
		this.mutate(() => this.addNow(item))
	}

	remove(id: DensePoolId) {
		const exists = this.indices.has(id)
		this.mutate(() => this.removeNow(id))
		return exists
	}

	get(id: DensePoolId) {
		const index = this.indices.get(id)
		return index === undefined ? undefined : this.denseItems[index]
	}

	has(id: DensePoolId) {
		return this.indices.has(id)
	}

	forEach(visitor: (item: T, index: number) => void) {
		this.iterationDepth++
		try {
			for (let index = 0; index < this.denseItems.length; index++) {
				visitor(this.denseItems[index], index)
			}
		} finally {
			this.iterationDepth--
			if (this.iterationDepth === 0) this.flush()
		}
	}

	clear() {
		this.mutate(() => {
			this.denseItems.length = 0
			this.indices.clear()
		})
	}

	flush() {
		if (this.iterationDepth > 0 || this.pendingMutations.length === 0) return
		const mutations = this.pendingMutations
		this.pendingMutations = []
		for (const mutation of mutations) mutation()
	}

	private mutate(mutation: PendingMutation) {
		if (this.iterationDepth > 0) this.pendingMutations.push(mutation)
		else mutation()
	}

	private addNow(item: T) {
		const id = this.getId(item)
		const existingIndex = this.indices.get(id)
		if (existingIndex !== undefined) {
			this.denseItems[existingIndex] = item
			return
		}
		this.indices.set(id, this.denseItems.length)
		this.denseItems.push(item)
	}

	private removeNow(id: DensePoolId) {
		const index = this.indices.get(id)
		if (index === undefined) return
		const lastIndex = this.denseItems.length - 1
		const lastItem = this.denseItems[lastIndex]
		if (index !== lastIndex) {
			this.denseItems[index] = lastItem
			this.indices.set(this.getId(lastItem), index)
		}
		this.denseItems.pop()
		this.indices.delete(id)
	}
}
