# HINODE — World Flight 4.0

A cooperative browser flight game with a streaming Earth, worldwide airport planning, runway takeoff and landing, and a Japanese expedition.

**Play:** https://lantern-relay-ten.vercel.app/

## World flight

- Search 72,603 active OurAirports records by airport, city, country, IATA or ICAO.
- Continuous geographic travel at 1× speed on the Earth, with streamed Mapzen elevation, NASA global imagery and GSI Japan photography.
- Two authenticated pilot seats, invitations, saved poses, fuel and independent recovery.
- Runway taxiing, engine start/stop, takeoff rotation, gear, flaps, trim, fuel consumption, banked turns, stalls, touchdown checks and ground braking.
- Optional guided departure/navigation and approach/landing, with manual steering override.
- Sourced Cesium Air twin-prop model, animated propellers, original modeled cockpit, working instruments and GPS readouts.
- Daylight preset or real clock, touch controls, standard gamepad support, look-around cockpit and clear HUD view.

**Limits:** This is a game prototype, not Microsoft Flight Simulator or an aviation tool. Airport records are a dated snapshot, not NOTAMs or live airport operations. Only 10,953 airports have surveyed runway endpoints in this snapshot; 37,322 have usable runway dimensions, including inferred locations. Missing locations use labeled approximate practice strips. Airport terminals, taxiways, traffic and interiors are not reproduced worldwide. Global NASA imagery is coarse, Japan is more detailed. Terrain availability depends on public services. The aircraft is a sourced sample model with approximate handling and an original interior, not a certified or branded systems replica. Engine sound is synthesized. Weather, ATC, multiple authentic aircraft systems, real traffic, and a measured 56-hour campaign are not implemented.

## Japanese expedition (/adventure)


- Two authenticated pilots in a shared, persistent online flight.
- Six distinct ~14–16 km geography snapshots: Fuji, Hakone, Seto Inland Sea, Kyoto, Aso and Daisetsuzan.
- Twelve cooperative assignments: navigation gates, aerial surveys, supply delivery, formation and sea landing.
- Explorer, Pilot and Ace difficulty: wind, gate tolerances and formation duration change.
- Original amphibious aircraft with curved surfaces, cockpit glazing, struts, floats, propellers and navigation lights.
- A modeled cockpit with live airspeed, altimeter, attitude, heading, RPM and radar altitude; chase and orbit cameras.
- Manual banked turns, pitch, momentum, drag and stall descent. Optional terrain-aware navigation guidance.
- An atlas for solo practice anywhere, touch steering, recovery, chapter briefings and a shared ending.
- Responsive synthesized propeller sound mixed with an attributed wind recording.

This is an original browser flight game, not Microsoft Flight Simulator. It has six scenery areas and chapter transfers, not a global streaming planet. Terrain photographs have finite resolution. Mapped OSM building footprints are extruded in 3D, with estimated heights when source heights are absent. Wind-animated trees are sampled inside mapped forests; this is not photogrammetry. Reflective water covers the sea and selected mapped lakes. The flight model is simplified, missions are fictional, and it is not for real aviation navigation. A 56-hour campaign and high-concurrency capacity have not been measured or implemented.

## Play

World flight is the home page. Choose departure and arrival, then create a shared flight or practice solo. Use Flight assist for guided takeoff, navigation or approach. Manual: I engine, Q / E throttle, S / W pitch, A / D bank or taxi steering, Z / X rudder, V flaps, G gear, Space brakes, [ / ] trim, C camera, H overlays, R recovery. Gear must be down for a normal runway landing. Aim below 85 knots, under 4 m/s descent and less than 10° bank. Keep your original browser to resume. Images and flight geometry are approximate and must never be used for real navigation.

Japanese expedition: Create a flight, then share its invitation with one friend. A new device joins the second seat. Both pilots must finish each assignment and confirm its next briefing. Keep the original browser to resume; progress saves in the database. Solo practice does not count as a completed cooperative expedition.

Controls: S / Down raises the nose; W / Up lowers it. A / D banks. Q / E adjusts throttle. Space airbrakes. F photographs or drops supplies. C changes camera; R recovers the aircraft. Onscreen directional controls and throttle work with touch. Navigation assist is optional and manual steering overrides it. The Japanese expedition begins airborne; runway departures are available in the world-flight mode.

## Development

Node.js 24 recommended.

```sh
npm ci
npm run dev -- --hostname 127.0.0.1 --port 4204
npm run typecheck
node --import tsx --test tests/flight.test.ts tests/world-flight.test.ts
npm run build
npm start
```

Local storage uses Node SQLite in `.data/`. Vercel requires `DATABASE_URL` connected to Neon Postgres. The existing deployment already has its database integration. Secrets stay in environment variables; player tokens are stripped from room views. Rooms use a `flight:` namespace to preserve earlier adventure saves.

Vercel: Next.js preset, `npm run build`, automatic output directory. `/api/flight` traces local elevation JSON, and `/api/world` traces the airport catalog. `/api/health` reports version 4.0.0 and the actual storage type. Source branch: `codex/japan-flight-adventure`; production branch: `codex/vercel-release`.

## Geography and attribution

See [public/flight/credits.txt](public/flight/credits.txt) and [public/flight/terrain/sources.json](public/flight/terrain/sources.json). Photography is GSI seamlessphoto under its stated public data terms. Elevation uses Mapzen Terrain Tiles / USGS. Both were edited and resampled. This does not use Google Maps or require a Google billing account.

To rebuild snapshots, install Pillow in Python and run `python scripts/fetch-flight-terrain.py`. Downloads use four workers and a local tile cache. Source URL and SHA256 receipts are retained.

## Rebuilding open scenery

`python scripts/fetch-airports.py` imports public-domain airport and runway snapshots. `python scripts/fetch-flight-scenery.py` imports OSM footprints/forests/water and publishes adapted ODbL datasets. Data receipts are retained. `node scripts/sync-cesium.mjs` refreshes the vendored browser engine from the installed Cesium package. The engine is self-hosted; no account key is used.

## Verification

The world-flight suite checks global airport lookup, antimeridian travel and distances, actual runway acceleration and rotation, low-speed descent and hard-contact behavior, a complete guided approach/touchdown/braking sequence, and two-pilot authentication, movement persistence and recovery. A takeoff and two-pilot join were also reviewed through the browser UI; the full Haneda-to-Narita journey and every airport have not been manually flown.

The flight suite checks six distinct terrain snapshots, mountain elevation, rendered triangle / collision agreement, control behavior, all guided navigation/survey/delivery/landing approaches, and all twelve shared server mission transitions with token authentication, persistence, concurrency, invalid actions and both-pilot confirmation. Browser visual review is separate from those automated checks; neither establishes simulator-grade realism or large-scale performance.

Earlier lantern-adventure work is retained in Git history and the local branch `codex/lantern-distinct-map-wip`.
