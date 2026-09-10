let playerDamageInvulnerable = false
let debugInvulnerable = false

export function setPlayerDamageInvulnerable(invulnerable: boolean) {
	playerDamageInvulnerable = invulnerable
}

export function isPlayerDamageInvulnerable() {
	return playerDamageInvulnerable || debugInvulnerable
}

export function setPlayerDebugInvulnerable(invulnerable: boolean) {
	debugInvulnerable = invulnerable
}

export function isPlayerDebugInvulnerable() {
	return debugInvulnerable
}

export function resetPlayerDamageState() {
	playerDamageInvulnerable = false
	debugInvulnerable = false
}
