# HINODE — Flight Simulator

**A multiplayer browser flight game with open photogrammetry scenery, an A320 flight deck, weather, traffic and cooperative adventures.**

[Play the game](https://lantern-relay-ten.vercel.app/) · [Japanese expedition](https://lantern-relay-ten.vercel.app/adventure) · [Contributing](CONTRIBUTING.md) · [Scenery and aircraft credits](public/flight/credits.txt)

Built by **Khundrakpam Bikash Meitei**. Game version: **6.2.11**.

## Current release

The home page currently runs in **photoreal-only mode**: seven airports in North Rhine-Westphalia, Germany, and Strasbourg, France, with the FlightGear A320 exterior and modeled flight deck. Photogrammetry streams from open data services without a scenery API key.

| Region                 | Selectable airports                                                                                                                     |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| North Rhine-Westphalia | Cologne/Bonn (`EDDK`), Düsseldorf (`EDDL`), Dortmund (`EDLW`), Münster/Osnabrück (`EDDG`), Paderborn/Lippstadt (`EDLP`), Weeze (`EDLV`) |
| Strasbourg             | Strasbourg (`LFST`)                                                                                                                     |

The code also contains a 72,603-record worldwide airport catalog and 20 aircraft definitions. These are broader engine capabilities; the current planner limits its selection to the photogrammetry regions and the A320. See [`lib/photoreal.ts`](lib/photoreal.ts) and [`components/WorldApp.tsx`](components/WorldApp.tsx) for the active configuration.

## Features

- **Fly together:** two pilot seats, invitation links, separate aircraft, saved flight state and independent recovery.
- **Runway operations:** cold-and-dark or runway starts, taxi steering, takeoff, flaps, gear, spoilers, reverse thrust, braking and landing checks. Cruise and final-approach starts are also available.
- **Flight model:** rigid-body integration with lift, drag, stall behavior, fuel burn, banked turns, ground contact and aircraft-specific parameters.
- **Flight deck:** cockpit, chase, orbit and tower cameras; glass flight instruments, navigation display, engine readouts and warning sounds.
- **Assistance:** autopilot, flight director, heading and route navigation, altitude and speed controls, approach guidance, AI copilot and autoland logic.
- **Live data:** METAR observations, modeled winds aloft and nearby ADS-B traffic when the providers are available. ATC is generated game dialogue with browser speech synthesis.
- **Open scenery:** MapLibre GL JS and Three.js rendering, terrain, orthophotos and regional photogrammetry delivered through a cached scenery relay.
- **Controls:** keyboard, touch and standard gamepad input; optional solo simulation-rate controls.

### Japanese expedition

Visit [`/adventure`](https://lantern-relay-ten.vercel.app/adventure) for a separate cooperative campaign:

- Six distinct Japanese scenery areas: Mount Fuji, Hakone, Seto Inland Sea, Kyoto, Aso and Daisetsuzan.
- Twelve shared assignments including navigation, aerial surveys, supply delivery, formation flight and sea landing.
- Explorer, Pilot and Ace difficulty levels.
- Original amphibious aircraft, chapter briefings and shared progression.

Legacy `?flight=CODE` links still open this expedition. World-flight invitations use `?world=CODE`.

## Play with a friend

1. Open the [game](https://lantern-relay-ten.vercel.app/).
2. Enter a call sign and select departure, arrival and a starting condition.
3. Create a shared flight and use **Invite pilot** to copy its invitation.
4. Have your friend open the invitation on another device or browser and join the second seat.
5. Keep your original browser to resume your seat later. Losing its saved pilot token prevents resuming that seat.

For a first flight, use the AI copilot (`O`) or try a solo practice flight. Open the in-game guide for the controls applicable to your mode.

## World-flight controls

| Action                                | Keyboard                                                |
| ------------------------------------- | ------------------------------------------------------- |
| Pitch                                 | `W` / `S` or arrow keys; `S` raises the nose by default |
| Roll / ground steering                | `A` / `D` or left / right arrows                        |
| Rudder                                | `Z` / `X`                                               |
| Increase / decrease thrust            | `E` / `Q` or `Page Up` / `Page Down`                    |
| Engines / auto-start                  | `I` / `Ctrl+E`                                          |
| Flaps extend / retract                | `V` / `Shift+V`                                         |
| Landing gear                          | `G`                                                     |
| Spoilers / reverse thrust             | `/` / `F`                                               |
| Wheel brakes / parking brake          | `Space` / `Ctrl+.`                                      |
| Elevator trim                         | `[` / `]`                                               |
| Autopilot / autothrottle / AI copilot | `P` / `T` / `O`                                         |
| Set local QNH / standard altimeter    | `B` / `Shift+B`                                         |
| ATC / dialogue selection              | `M` / `1`–`9`                                           |
| Camera / center look                  | `C` / `Home`                                            |
| Instruments / HUD                     | `U` / `H`                                               |
| Solo simulation rate                  | `+` / `-`                                               |
| Recover / settings                    | `R` / `Esc`                                             |

The Japanese expedition has different mission controls: `F` photographs or drops supplies; use its own guide rather than the world-flight reverse-thrust shortcut.

## Run locally

### Requirements

- **Node.js 24** is recommended; the package minimum is 22.13.0 because local storage uses `node:sqlite`.
- npm, Git and an internet connection for streamed scenery and optional live data.
- A browser with WebGL support. Performance depends on the device and scenery load.

```sh
git clone https://github.com/kh-bikash/latntern.git
cd latntern
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). Development and production builds automatically bundle the scenery worker and copy the required MapLibre and Draco runtime files.

### Environment and storage

Local development works without environment variables. It creates a SQLite database at `.data/journeys.sqlite`, which Git ignores.

For Vercel, set a server-side **`DATABASE_URL`** containing a Neon Postgres connection string. See [`.env.example`](.env.example). The application creates its room table on first use. Never put this connection string in a `NEXT_PUBLIC_` variable or commit a real `.env` file.

The default scenery configuration does not need Google Maps, Cesium ion or another paid scenery API key. The source retains an optional Google tiles integration; it is not required for the shipped open-data mode.

## Development commands

| Command                 | Purpose                                                  |
| ----------------------- | -------------------------------------------------------- |
| `npm run dev`           | Bundle workers and start the development server          |
| `npm run format`        | Format maintained source and documentation with Prettier |
| `npm run format:check`  | Check source formatting without changing files           |
| `npm run typecheck`     | Check TypeScript types                                   |
| `npm test`              | Run all Node.js test suites                              |
| `npm run test:campaign` | Run the earlier campaign suite separately                |
| `npm run build`         | Bundle workers and build the production app              |
| `npm start`             | Serve the completed production build                     |

Formatting rules are in [`.prettierrc.json`](.prettierrc.json) and [`.editorconfig`](.editorconfig). Asset files and generated output are excluded in [`.prettierignore`](.prettierignore). GitHub Actions runs formatting, type checking, tests and the production build for pull requests and pushes to the default branch.

## Deploy to Vercel

1. Import this repository and use the **Next.js** framework preset.
2. Use Node.js 24, `npm ci` as the install command and `npm run build` as the build command. Leave the output directory at its framework default.
3. Connect Neon Postgres and set `DATABASE_URL` in the required Vercel environments.
4. Deploy the default branch, **`codex/vercel-release`**. The existing project is configured to deploy from that branch.
5. Check `/api/health` for `ok: true`, the game version and `storage: "postgres"`.

[`vercel.json`](vercel.json) contains the deployment configuration. [`next.config.ts`](next.config.ts) includes the airport and terrain data required by server routes. This application needs a server for multiplayer and API routes; exporting only static HTML is insufficient.

## Project structure

```text
app/                    Next.js pages, styles and API routes
  api/world/            Airport search and authenticated flight-room actions
  api/geo/              Cached relay for configured scenery sources
  api/weather/          Weather data adapter
  api/traffic/          Nearby ADS-B traffic adapter
components/             Planner, flight renderer, aircraft, cockpit and instruments
lib/                    Flight physics, autopilot, ATC, scenery and persistence
public/flight/          Aircraft assets, airport catalog, scenery and credits
scripts/                Worker builds and geographic data preparation
tests/                  Flight, multiplayer and earlier adventure test suites
.github/workflows/      Repository checks
```

## Tests and limits

The test suites cover airport geometry, atmosphere and weather decoding, aircraft handling, copilot flights and landing logic, authenticated two-pilot actions, and the earlier adventure systems. Automated physics checks do not prove visual quality, real-aircraft fidelity or safe real-world performance. Every airport and long-haul route has not been manually flown.

This is an experimental browser game. Aircraft systems and ATC are simplified; speech availability depends on the browser. Weather, traffic and photogrammetry can be delayed, unavailable or throttled. Photogrammetry covers only the listed regions, and scenery capture dates and resolutions vary. Some runway geometry is estimated. There is no verified 56-hour campaign or measured large-scale multiplayer capacity. Do not use the game for real navigation or pilot training.

## Assets and licensing

Third-party code, geographic data, aircraft and audio have separate licenses. In particular, FlightGear / Flightradar24 models include GPL-2.0 notices, and some historical imagery has noncommercial or share-alike conditions. Do not assume all files share a single permissive license.

Preserve source attribution, license notices and applicable redistribution requirements. See:

- [Current and historical flight credits](public/flight/credits.txt)
- [Aircraft model notices](public/flight/models/fr24/README.txt) and [GPL license](public/flight/models/fg/LICENSE)
- [Airport catalog source receipts](public/flight/global/sources.json)
- [Japanese terrain source receipts](public/flight/terrain/sources.json)
- [Earlier adventure asset credits](ASSET_CREDITS.md)
- [Earlier audio sources](AUDIO_SOURCES.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, formatting, validation and pull-request guidance. Use GitHub issues to report bugs with reproduction steps, the selected airport and aircraft, browser/device details, and a screenshot when useful.
