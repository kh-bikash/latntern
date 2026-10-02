# HINODE — Dawn Wing

A cooperative browser flight adventure over real Japanese aerial imagery and elevation.

**Play:** https://lantern-relay-ten.vercel.app/

## What is included

- Two authenticated pilots in a shared, persistent online flight.
- Six distinct ~14–16 km geography snapshots: Fuji, Hakone, Seto Inland Sea, Kyoto, Aso and Daisetsuzan.
- Twelve cooperative assignments: navigation gates, aerial surveys, supply delivery, formation and sea landing.
- Explorer, Pilot and Ace difficulty: wind, gate tolerances and formation duration change.
- Original amphibious aircraft with curved surfaces, cockpit glazing, struts, floats, propellers and navigation lights.
- A modeled cockpit with live airspeed, altimeter, attitude, heading, RPM and radar altitude; chase and orbit cameras.
- Manual banked turns, pitch, momentum, drag and stall descent. Optional terrain-aware navigation guidance.
- An atlas for solo practice anywhere, touch steering, recovery, chapter briefings and a shared ending.
- Responsive synthesized propeller sound mixed with an attributed wind recording.

This is an original browser flight game, not Microsoft Flight Simulator. It has six scenery areas and chapter transfers, not a global streaming planet. Terrain photographs have finite resolution; there are no photogrammetric buildings or independently simulated vegetation. The flight model is simplified, missions are fictional, and it is not for real aviation navigation. A 56-hour campaign and high-concurrency capacity have not been measured or implemented.

## Play

Create a flight, then share its invitation with one friend. A new device joins the second seat. Both pilots must finish each assignment and confirm its next briefing. Keep the original browser to resume; progress saves in the database. Solo practice does not count as a completed cooperative expedition.

Controls: S / Down raises the nose; W / Up lowers it. A / D banks. Q / E adjusts throttle. Space airbrakes. F photographs or drops supplies. C changes camera; R recovers the aircraft. Onscreen directional controls and throttle work with touch. Navigation assist is optional and manual steering overrides it. Flights begin airborne; takeoff systems are not simulated.

## Development

Node.js 24 recommended.

```sh
npm ci
npm run dev -- --hostname 127.0.0.1 --port 4204
npm run typecheck
node --import tsx --test tests/flight.test.ts
npm run build
npm start
```

Local storage uses Node SQLite in `.data/`. Vercel requires `DATABASE_URL` connected to Neon Postgres. The existing deployment already has its database integration. Secrets stay in environment variables; player tokens are stripped from room views. Rooms use a `flight:` namespace to preserve earlier adventure saves.

Vercel: Next.js preset, `npm run build`, automatic output directory. `/api/flight` traces the six local elevation JSON files explicitly. `/api/health` reports version 3.0.0 and the actual storage type. Source branch: `codex/japan-flight-adventure`; production branch: `codex/vercel-release`.

## Geography and attribution

See [public/flight/credits.txt](public/flight/credits.txt) and [public/flight/terrain/sources.json](public/flight/terrain/sources.json). Photography is GSI seamlessphoto under its stated public data terms. Elevation uses Mapzen Terrain Tiles / USGS. Both were edited and resampled. This does not use Google Maps or require a Google billing account.

To rebuild snapshots, install Pillow in Python and run `python scripts/fetch-flight-terrain.py`. Downloads use four workers and a local tile cache. Source URL and SHA256 receipts are retained.

## Verification

The flight suite checks six distinct terrain snapshots, mountain elevation, rendered triangle / collision agreement, control behavior, all guided navigation/survey/delivery/landing approaches, and all twelve shared server mission transitions with token authentication, persistence, concurrency, invalid actions and both-pilot confirmation. Browser visual review is separate from those automated checks; neither establishes simulator-grade realism or large-scale performance.

Earlier lantern-adventure work is retained in Git history and the local branch `codex/lantern-distinct-map-wip`.
