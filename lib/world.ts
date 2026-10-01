export type SoundKind = "bell" | "wind" | "water" | "wood" | "leaves" | "rain" | "snow" | "fire";
export type Hotspot = { id: string; label: string; x: number; y: number; sound: SoundKind; discovery: string };
export type Scene = { title: string; story: string; image: string; ambient: "wind" | "forest" | "rain" | "sea" | "snow" | "river" | "cave" | "village"; hotspots: [Hotspot, Hotspot, Hotspot] };
export type Chapter = Scene & { subtitle: string; relic: string; second: Scene };

export const WORLD: Chapter[] = [
  {
    title: "Moonlit Pass", subtitle: "The light has vanished", story: "The village lantern went dark at dusk. Follow its first glimmer beyond the mountains.", image: "/night-landscape.webp", ambient: "wind", relic: "The first ember", hotspots: [
      { id: "blossoms", label: "Windblown blossoms", x: 18, y: 17, sound: "leaves", discovery: "A petal glows gold. The missing light crossed this valley." },
      { id: "lantern", label: "Old path lantern", x: 14, y: 68, sound: "bell", discovery: "Its glass is warm. Someone carried the light east." },
      { id: "torii", label: "Torii gate", x: 85, y: 60, sound: "wood", discovery: "An inscription points toward the bamboo forest." },
    ],
    second: { title: "Ridge of Stars", story: "A rope bridge leads above the clouds. Search the ridge before the next trail appears.", image: "/ridge-of-stars.webp", ambient: "wind", hotspots: [
      { id: "rope", label: "Old rope bridge", x: 26, y: 69, sound: "wood", discovery: "The bridge sways, but its ropes still hold." },
      { id: "summit", label: "Starry summit", x: 53, y: 28, sound: "wind", discovery: "A line of stars points toward the eastern grove." },
      { id: "ridge-lantern", label: "Ridge lantern", x: 79, y: 57, sound: "bell", discovery: "A tiny ember dances in the glass." },
    ] },
  },
  {
    title: "Bamboo Hollow", subtitle: "The listening forest", story: "The grove shifts with the wind. Listen for the trail beneath the leaves.", image: "/bamboo-hollow.webp", ambient: "forest", relic: "The listening leaf", hotspots: [
      { id: "bamboo", label: "Whispering bamboo", x: 22, y: 40, sound: "leaves", discovery: "The stalks whisper of a stranger carrying a golden flame." },
      { id: "stones", label: "Mossy stepping stones", x: 52, y: 75, sound: "wood", discovery: "Fresh marks lead toward the old city." },
      { id: "grove-lantern", label: "Grove lantern", x: 80, y: 46, sound: "bell", discovery: "A small spark answers your touch." },
    ],
    second: { title: "Hidden Falls", story: "Beyond the bamboo, a waterfall hides a path the wind cannot reach.", image: "/hidden-falls.webp", ambient: "river", hotspots: [
      { id: "bamboo-arch", label: "Bamboo arch", x: 23, y: 38, sound: "leaves", discovery: "The stalks bend aside to reveal the falls." },
      { id: "falls-pool", label: "Waterfall pool", x: 53, y: 73, sound: "water", discovery: "A floating light turns toward the city." },
      { id: "moss-rock", label: "Moss-covered rock", x: 81, y: 64, sound: "wood", discovery: "An old traveler left a mark here." },
    ] },
  },
  {
    title: "Rain Lantern Alley", subtitle: "The city of reflections", story: "Rain has washed the streets clean, but the missing light left a reflection behind.", image: "/rain-alley.webp", ambient: "rain", relic: "The rain mirror", hotspots: [
      { id: "eaves", label: "Rain on the eaves", x: 25, y: 23, sound: "rain", discovery: "The rain carries a faint ringing from the coast." },
      { id: "puddle", label: "Golden reflection", x: 54, y: 80, sound: "water", discovery: "The puddle shows a sea gate beneath a storm." },
      { id: "shop-lantern", label: "Paper lantern", x: 78, y: 36, sound: "bell", discovery: "A folded note inside reads: follow the tide." },
    ],
    second: { title: "Canal of Echoes", story: "The market sleeps while rain paints the canal silver.", image: "/canal-of-echoes.webp", ambient: "rain", hotspots: [
      { id: "canal-bridge", label: "Canal bridge", x: 25, y: 63, sound: "wood", discovery: "Wet footprints stop at the edge of the bridge." },
      { id: "market-awning", label: "Market awning", x: 55, y: 34, sound: "rain", discovery: "Rain taps out a rhythm like a distant bell." },
      { id: "canal-lights", label: "Canal lights", x: 82, y: 70, sound: "water", discovery: "Their reflections point toward the coast." },
    ] },
  },
  {
    title: "Tidebound Gate", subtitle: "The sea remembers", story: "At the edge of the sea, the old gate stands against wind and salt.", image: "/tidebound-gate.webp", ambient: "sea", relic: "The tide pearl", hotspots: [
      { id: "surf", label: "Breaking surf", x: 24, y: 78, sound: "water", discovery: "Something bright moves beneath the waves, then turns inland." },
      { id: "sea-gate", label: "Sea torii", x: 57, y: 50, sound: "wood", discovery: "The gate marks the trail to a snowbound shrine." },
      { id: "shell", label: "Wind-worn shell", x: 82, y: 82, sound: "wind", discovery: "Hold it close: the mountain wind is calling." },
    ],
    second: { title: "Watchfire Cliff", story: "A lonely watchfire burns above the sea. Its keeper has left three signs.", image: "/watchfire-cliff.webp", ambient: "sea", hotspots: [
      { id: "cliff-edge", label: "Cliff edge", x: 22, y: 76, sound: "wind", discovery: "The waves below hide an old passage." },
      { id: "watchfire", label: "Ancient watchfire", x: 55, y: 42, sound: "fire", discovery: "Its sparks rise toward the snow-covered mountain." },
      { id: "sea-stone", label: "Carved sea stone", x: 82, y: 70, sound: "wood", discovery: "The carving shows a shrine among pines." },
    ] },
  },
  {
    title: "Snow Shrine", subtitle: "The winter vow", story: "A quiet mountain shrine guards the memory of winter and a clue to the light.", image: "/snow-shrine.webp", ambient: "snow", relic: "The winter vow", hotspots: [
      { id: "snow-pine", label: "Snow-covered pine", x: 20, y: 43, sound: "snow", discovery: "Beneath the snow are footprints heading down the valley." },
      { id: "shrine-bell", label: "Shrine bell", x: 56, y: 35, sound: "bell", discovery: "Its clear note reveals a hidden path among the maples." },
      { id: "hearth", label: "Warm brazier", x: 81, y: 74, sound: "fire", discovery: "The embers share the missing light's golden color." },
    ],
    second: { title: "Iced Cedar Cave", story: "Under the shrine, winter has sealed an older memory in ice.", image: "/iced-cedar-cave.webp", ambient: "snow", hotspots: [
      { id: "ice-wall", label: "Blue ice wall", x: 22, y: 50, sound: "snow", discovery: "A golden shape is frozen deep inside." },
      { id: "cedar-root", label: "Ancient cedar root", x: 53, y: 33, sound: "wood", discovery: "The root points down toward an autumn valley." },
      { id: "cave-flame", label: "Sheltered flame", x: 81, y: 69, sound: "fire", discovery: "The little flame has survived every winter." },
    ] },
  },
  {
    title: "Maple Crossing", subtitle: "The autumn trail", story: "Autumn covers the bridge. The river below carries a secret toward the earth.", image: "/maple-crossing.webp", ambient: "river", relic: "The red leaf", hotspots: [
      { id: "maple", label: "Falling maple leaves", x: 23, y: 26, sound: "leaves", discovery: "A leaf bears the mark of a hidden cavern." },
      { id: "bridge", label: "Red bridge", x: 56, y: 61, sound: "wood", discovery: "The bridge creaks above a hollow in the rock." },
      { id: "river", label: "Flowing river", x: 84, y: 80, sound: "water", discovery: "The current disappears behind a waterfall." },
    ],
    second: { title: "Koi Garden", story: "An old temple garden keeps the colors of autumn reflected in its pond.", image: "/koi-garden.webp", ambient: "river", hotspots: [
      { id: "koi-pond", label: "Koi pond", x: 24, y: 73, sound: "water", discovery: "A fish circles where the water drains underground." },
      { id: "garden-bell", label: "Garden bell", x: 56, y: 37, sound: "bell", discovery: "Its echo answers from beneath the earth." },
      { id: "maple-arch", label: "Maple arch", x: 81, y: 33, sound: "leaves", discovery: "The leaves conceal a path to the cavern." },
    ] },
  },
  {
    title: "Cavern of Echoes", subtitle: "The light beneath the earth", story: "Behind the waterfall, every sound returns with a little more light.", image: "/echo-cavern.webp", ambient: "cave", relic: "The hidden flame", hotspots: [
      { id: "falls", label: "Waterfall curtain", x: 24, y: 46, sound: "water", discovery: "The water parts, revealing the village on the far side." },
      { id: "crystal", label: "Glowing crystal", x: 56, y: 38, sound: "bell", discovery: "The missing light is inside. It waits for two hands to guide it home." },
      { id: "stone-lantern", label: "Ancient stone lantern", x: 82, y: 77, sound: "wood", discovery: "Its base bears the words: wisdom is shared." },
    ],
    second: { title: "The Luminous River", story: "A subterranean river glows with the fragments of the missing light.", image: "/luminous-river.webp", ambient: "cave", hotspots: [
      { id: "river-steps", label: "Stone steps", x: 22, y: 65, sound: "wood", discovery: "The steps rise toward the village." },
      { id: "glow-current", label: "Glowing current", x: 56, y: 74, sound: "water", discovery: "The light flows beside you now." },
      { id: "echo-arch", label: "Echoing arch", x: 81, y: 35, sound: "bell", discovery: "A clear tone calls you home." },
    ] },
  },
  {
    title: "Village of Dawn", subtitle: "The return of wisdom", story: "The long road ends where it began. Bring the recovered light into the heart of the village.", image: "/village-dawn.webp", ambient: "village", relic: "Wisdom and prosperity", hotspots: [
      { id: "rooftops", label: "Waking rooftops", x: 22, y: 47, sound: "wind", discovery: "Windows open as the village senses the light's return." },
      { id: "dawn-tree", label: "Dawn tree", x: 54, y: 33, sound: "leaves", discovery: "Its branches shine as the first wisdom returns." },
      { id: "great-lantern", label: "Great village lantern", x: 80, y: 68, sound: "bell", discovery: "This is where the missing light belongs." },
    ],
    second: { title: "Square of Dawn", story: "The whole village waits in the first sunlight for the great lantern to shine again.", image: "/square-of-dawn.webp", ambient: "village", hotspots: [
      { id: "village-square", label: "Village square", x: 23, y: 75, sound: "wood", discovery: "The stones remember every journey made together." },
      { id: "dawn-sky", label: "Rising sun", x: 54, y: 25, sound: "wind", discovery: "Morning reveals the last place the light must go." },
      { id: "heart-lantern", label: "Heart lantern", x: 80, y: 54, sound: "bell", discovery: "Its flame is ready to welcome the missing light." },
    ] },
  },
];

export const CROSSING_NAMES = ["The first trail", "The veiled turn", "The lantern cipher", "The narrow path", "The silent crossing", "The last bend", "The far shore"];

// The locations form one walkable route through a 4-by-4 landscape.
export const WORLD_SCENES: Scene[] = WORLD.flatMap((chapter) => [chapter, chapter.second]);
export const WORLD_LIMIT = 72;
export function zoneCenter(place: Scene): { x: number; z: number } {
  const index = Math.max(0, WORLD_SCENES.findIndex((scene) => scene.title === place.title));
  const row = Math.floor(index / 4);
  const column = index % 4;
  return { x: (row % 2 === 0 ? column : 3 - column) * 28 - 42, z: 42 - row * 28 };
}
