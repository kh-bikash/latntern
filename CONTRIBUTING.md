# Contributing to Hinode

## Setup

1. Install Node.js 24 and clone the repository.
2. Run `npm ci`, then `npm run dev`.
3. Open `http://localhost:3000`. Local rooms use SQLite in `.data/`; no production database credentials are needed.
4. Read [README.md](README.md) for the current release scope, controls and deployment setup.

## Making changes

- Create a descriptive branch, for example `codex/improve-flight-controls`.
- Keep each change focused and explain any changes to physics, controls, scenery coverage or saved room state.
- Follow the Prettier configuration. Do not hand-format generated workers, downloaded geographic datasets or third-party assets.
- Keep real credentials, local databases, recordings and generated review output out of Git. `.env.example` may contain variable names and empty placeholders only.
- Preserve existing asset licenses and credits. Document the source, license and modifications of any added aircraft, image, sound or dataset.
- Read `AGENTS.md` when using a coding agent. Next.js documentation for the installed version is available in `node_modules/next/dist/docs/`.

## Before opening a pull request

```sh
npm run format
npm run format:check
npm run typecheck
npm test
npm run build
```

For changes that affect gameplay or rendering, also open the game and check the relevant controls, instruments, camera views and scenes. For multiplayer changes, join from two browser sessions and verify both pilots' movement and recovery. Tests cannot establish visual correctness or realistic flight handling by themselves.

## Pull requests

Target `codex/vercel-release`, the repository's current default and production branch. Include:

- What changed and why.
- How it was tested, including any relevant browser/device details.
- Screenshots for visible changes.
- Known limitations, data migrations or new deployment requirements.

GitHub Actions checks formatting, types, tests and the production build. Vercel deployment is configured separately. A merge to the production branch can publish the change to the live game.

## Bug reports

Include the game version, browser and device, departure/arrival airports, aircraft, starting condition and clear reproduction steps. Explain what you expected and what actually happened. Remove pilot tokens, database connection strings and API keys from screenshots and logs before sharing them.
