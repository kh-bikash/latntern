# Lantern Relay: The Lost Dawn

A two-player cooperative adventure through 16 painted landscapes inspired by Japan. Two complementary lanterns restore the missing light of a mountain village.

## Play

One traveler creates a journey and chooses Story, Adventure, or Expert. Send the invitation link to a companion on another device. Both travelers are required to restore crossings and travel onward.

- A/D or arrows: walk. Shift: run. Space: jump. E: interact or hold a shrine.
- On a touch screen, use the on-screen direction, run, jump, and interaction controls.
- The current objective and lantern clue explain each puzzle. Tell your companion what their rune should be, repeat bell melodies, rescue crane spirits, escort foxes, and coordinate through tides, gusts, and guardian waves.
- Explore for stars, memories, and landmarks. Return to the resident camp to fulfill promises and craft shared movement, navigation, and restoration upgrades.
- Progress is saved on the server. Keep your original browser session to resume your own traveler. An invitation joins the other traveler.

## Included campaign

16 distinct landscapes, 64 cooperative crossings using ten puzzle mechanics, 16 resident promises, 96 collectible stars, 32 memory pages, 48 discoverable landmarks, three relic upgrades, three difficulty settings, chapter cinematics, and a shared ending influenced by both travelers' choices. Recorded natural ambience and surface-specific footsteps are mixed dynamically. Sound starts only after you enable it.

This is a complete browser campaign, not a verified 56-hour campaign. Human completion time and large-scale concurrency have not been measured. Expert changes timing and sequences rather than imposing real-time waiting.

## Run locally

Node.js 24 LTS is recommended.

```sh
npm ci
npm run dev
```

Without DATABASE_URL, local development uses a durable SQLite file in `.data/journeys.sqlite`. That fallback is deliberately unavailable on Vercel.

## Deploy to Vercel

Import this repository using the Next.js preset. Add a Neon Postgres database through Vercel Storage and connect it to this project with the environment variable `DATABASE_URL`. Enable it for Production and Preview, then redeploy. The application creates its room table automatically. `/api/health` must return `ok: true` with Postgres storage before sharing the game.

No secrets are checked into this repository. Environment variables remain on Vercel. Static game assets are served locally from `public/` rather than fetched from third-party sources during gameplay.

## Checks

```sh
npm run typecheck
npm test
npm run build
```

The campaign test traverses all 64 crossings and all progression systems, including concurrency, authentication, proximity, collectibles, crafting, and the ending. It uses a controlled clock and is not evidence of human playtime. See `ASSET_CREDITS.md` and `AUDIO_SOURCES.md` for provenance.

## Architecture

Next.js App Router, Canvas 2D rendering, Web Audio, server-authorized actions, Postgres persistence, optimistic version checks to prevent lost multiplayer updates, and short HTTP polling for two-player synchronization. This release does not contain a 3D renderer. Region scenery, weather, terrain palettes, puzzle arrangements, stories, and resident requests change throughout the journey.
