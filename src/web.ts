export function loadSongData(title: string, author: string, albumSrc: string) {
	const container = document.getElementById("song");

	const titleEl = document.getElementById("song_title");
	const authorEl = document.getElementById("song_author");
	const coverEl = document.getElementById("song_cover");

	authorEl!.textContent = author;
	titleEl!.textContent = title;
	coverEl!.setAttribute("src", albumSrc);

	container?.classList.add("show");
}

export function endSong() {
	const container = document.getElementById("song");

	container?.classList.remove("show");
}
