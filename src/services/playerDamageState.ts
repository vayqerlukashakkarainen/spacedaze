let playerDamageInvulnerable = false

export function setPlayerDamageInvulnerable(invulnerable: boolean) {
	playerDamageInvulnerable = invulnerable
}

export function isPlayerDamageInvulnerable() {
	return playerDamageInvulnerable
}

export function resetPlayerDamageState() {
	playerDamageInvulnerable = false
}
