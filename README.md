# HINODE — Flight Simulator 6.0

A browser flight simulator on a streaming Earth: a six-degree-of-freedom aerodynamic flight model, three aircraft, live weather, live air traffic, ATC with voice, autopilot and autoland, at 72,603 real airports. Fly solo with time acceleration or share a flight with a second pilot.

**Play:** https://lantern-relay-ten.vercel.app/

## Engine

Rendering uses **MapLibre GL JS** (open-source, BSD) for terrain, satellite imagery, runways, lights and sky, with a **three.js** layer inside the map for aircraft, live traffic, clouds and OpenStreetMap buildings, and a three.js overlay for cockpits. It starts in well under a second and runs on phones. Elevation tiles pass through a custom protocol that clamps the sea floor and flattens airports so the rendered ground matches the physics.

## What is simulated

- **Flight dynamics** (`lib/flightModel.ts`): rigid-body 6-DOF integration at 120 Hz on a spherical Earth with meridian convergence. Lift/drag polars with flaps, slats, spoilers, ground effect, post-stall break and wing drop; stability and control derivatives; moments of inertia; quaternion attitude. Ground contact with rotation about the main gear, nose-wheel steering, rolling friction, brakes, autobrake, reversers and tail-strike limits.
- **Aircraft** (`lib/aircraft.ts`): 20 types in eight classes — Kestrel T-180, PA-28, ASK 21 glider, piston twin, Citation II, ATR 42, Dash 8 Q400, CRJ900, E190, A220-300, A320, A321, 737-800, 757-200, A330-300, 787-9, 777-300, A350-900, 747-400 and A380. Published masses, wing geometry, thrust/power, speeds and flap detents; class-based stability derivatives; fly-by-wire on the Airbus, E-Jet, 777 and 787. Every powered type completes an automated takeoff-to-autoland flight in the test suite. Exterior models are the GPL Flightradar24/FlightGear models (see public/flight/models/fr24).
- **Engines**: propeller thrust from power with altitude lapse; turbofans with N1 spool lag, density and Mach lapse and realistic fuel flow. Fuel burn changes weight and range.
- **Atmosphere and weather** (`lib/weather.ts`): ISA with real temperature and QNH, a working altimeter (B sets QNH), live METARs (NOAA AWC) and winds aloft (Open-Meteo), turbulence and gusts, wind shear near the ground. Presets from clear to thunderstorms, fog and snow.
- **Autopilot** (`lib/autopilot.ts`): AP/FD, HDG, NAV (GPS route with intermediate fixes), APR (localizer + glideslope), ALT, V/S, FLC, autothrottle, flare and rollout. The AI copilot (O) flies a complete departure, cruise, descent, ILS approach, autoland and go-around.
- **ATC** (`lib/atc.ts`): clearance delivery, tower, departure, centre hand-offs, top-of-descent, approach with ILS clearance, landing clearance, ground; altitude-deviation calls and traffic advisories from live ADS-B traffic. Standard phraseology, spoken by the browser speech engine.
- **World**: Sentinel-2 cloudless global imagery with national orthophotos (USGS, IGN, swisstopo, PDOK, GSI), night city lights, ocean water mask, flattened airports, textured runways with ICAO markings, edge/threshold/approach lights and a working PAPI, METAR-driven cloud layers, visibility fog, rain, snow and lightning, real time of day.
- **Cockpit**: glass PFD (tapes, V-speed bugs, FMA, flight director, ILS deviation, flight-path vector), navigation display (route, airports, TCAS-style traffic, wind) and engine/systems page, also painted in the 3D cockpit. GPWS and radio-altitude callouts, stall horn, gear horn, overspeed clacker.
- **Live traffic**: real aircraft around you from adsb.lol, drawn with the matching type model and on the ND.
- **3D scenery**: OpenStreetMap buildings at their mapped heights with windowed facades that light up at night, forests, aprons and taxiways, streamed from OpenFreeMap vector tiles and built in a web worker.
- **Cockpits**: modelled airliner flight deck (glareshield FCU, two PFD/ND pairs, upper and lower ECAM, thrust levers, sidestick or yoke, overhead panel), light-aircraft G1000-style panel, glider instruments.

## Controls

W/S or ↑/↓ pitch (S raises the nose; invertible in settings) · A/D or ←/→ roll · Z/X rudder · **E/Q or Page Up/Down thrust** (W/A/S/D never add power) · I engines (Ctrl+E auto-start) · V/Shift+V flaps · G gear · / spoilers · F reverse · Space brakes · Ctrl+. parking brake · [ ] trim · P autopilot · T autothrottle · O AI copilot · B altimeter QNH · M ATC window, 1–9 to talk · C view (chase, cockpit, orbit, tower) · U instrument panel · H HUD · +/− sim rate (solo) · R recover · Esc settings. Gamepads and touch are supported.

## Limits

This is a browser game, not Microsoft Flight Simulator and not an aviation tool. There are no photogrammetry cities, taxiway graphs or gates; aircraft are the three listed; systems are simplified (no electrical, hydraulic or FMS pages); ATC frequencies, aircraft names and liveries are fictional; imagery resolution depends on public services, and some services may throttle. Weather and traffic depend on third-party availability and fall back to standard conditions. Long flights run in real time unless you use sim rate in solo mode.

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

Vercel: Next.js preset, `npm run build`, automatic output directory. `/api/flight` traces local elevation JSON, and `/api/world` traces the airport catalog. `/api/health` reports version 5.0.0 and the actual storage type. Source branch: `codex/japan-flight-adventure`; production branch: `codex/vercel-release`.

## Geography and attribution

See [public/flight/credits.txt](public/flight/credits.txt) and [public/flight/terrain/sources.json](public/flight/terrain/sources.json). Photography is GSI seamlessphoto under its stated public data terms. Elevation uses Mapzen Terrain Tiles / USGS. Both were edited and resampled. This does not use Google Maps or require a Google billing account.

To rebuild snapshots, install Pillow in Python and run `python scripts/fetch-flight-terrain.py`. Downloads use four workers and a local tile cache. Source URL and SHA256 receipts are retained.

## Rebuilding open scenery

`python scripts/fetch-airports.py` imports public-domain airport and runway snapshots. `python scripts/fetch-flight-scenery.py` imports OSM footprints/forests/water and publishes adapted ODbL datasets. Data receipts are retained. `node scripts/sync-cesium.mjs` refreshes the vendored browser engine from the installed Cesium package. The engine is self-hosted; no account key is used.

## Verification

The world-flight suite (tests/world-flight.test.ts) checks the airport catalog and both runway directions, ISA atmosphere and altimeter values, METAR decoding, wind-based runway selection and ATIS, published-class takeoff roll, climb rate and stall speed for each aircraft, fly-by-wire alpha protection, crash detection (gear-up, hard impact, wingtip strike, ditching), a complete AI-copilot flight from Haneda to Narita in all three aircraft (takeoff, climb, cruise, ILS capture, autoland, rollout), an airliner landing in gusty crosswind and turbulence with go-around logic, and two-pilot authentication with different aircraft and airliner speeds. The browser build was also exercised in headless Edge: planner with live METARs, takeoff under the AI copilot, ATC hand-off and a live-traffic advisory, all four camera views and the phone layout. Long-haul flights and every airport have not been manually flown.

The flight suite checks six distinct terrain snapshots, mountain elevation, rendered triangle / collision agreement, control behavior, all guided navigation/survey/delivery/landing approaches, and all twelve shared server mission transitions with token authentication, persistence, concurrency, invalid actions and both-pilot confirmation. Browser visual review is separate from those automated checks; neither establishes simulator-grade realism or large-scale performance.

Earlier lantern-adventure work is retained in Git history and the local branch `codex/lantern-distinct-map-wip`.
