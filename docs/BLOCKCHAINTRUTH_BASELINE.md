# BlockchainTruth: isolated TxStreet BTC/ETH replay

**Status:** Development proof of concept. This is not production software or live blockchain data. The upstream source remains intact on `main`.

## Completed

- Created a separate `blockchaintruth/baseline` branch from the original TxStreet default-branch revision.
- Retained the original Vue 2, Phaser 3 and legacy animation/sprite assets for behavioral baseline testing.
- Added `src/replay/replay.js`, an opt-in mock data transport that supplies BTC and ETH pending transactions, new blocks, statistics and legacy Socket.IO responses.
- Enabled the mock at the entry point and Socket.IO adapter only when `VUE_APP_REPLAY=true`.
- Added `.env.replay`, with self-contained, nonproduction endpoint settings.
- Blocked unknown `fetch` requests in replay mode and suppressed the legacy onboarding/hardware-wallet promotions.
- Added a prominently visible synthetic-data warning.
- Added a network-independent replay transport contract test and an automated headless Chrome screenshot/Phaser smoke test.
- GitHub Actions builds the original frontend, builds replay mode, uploads compiled assets and captures a screenshot/diagnostics.

## Developer startup (isolated)

Use a development machine or container with Node.js 16.20.2 **only** for reproducing the historical frontend; Node 16 is unsupported and must not be used for a public deployment.

```bash
git clone https://github.com/CyberChangeGit/txstreet-Fork.git
cd txstreet-Fork
git switch blockchaintruth/baseline
npm install -g yarn@1.22.22
yarn install --frozen-lockfile
node tests/replay-contract.test.cjs
yarn serve --mode replay
```

In a browser open `http://localhost:8080/v/btc-eth/launch` (adjust the port if occupied). An explicit top-of-page warning says that events are synthetic. The replay uses no BTC/ETH nodes, MongoDB, Redis, or live TxStreet REST/WebSocket services.

This is a demonstration event stream, not an accurate historic or production blockchain trace. Transaction fees, block times, inclusion ordering, processing capacity and finality are not measurements and must not be presented as such.

## Reproducible build and visual test

See `.github/workflows/blockchaintruth-baseline.yml`. The action:
1. Builds the legacy frontend from the original Yarn lockfile.
2. Executes `node tests/replay-contract.test.cjs`.
3. Builds the frontend with `VUE_APP_REPLAY=true`.
4. Launches headless Google Chrome, navigates to `/v/btc-eth/launch`, and requires real BTC/ETH Phaser scenes containing transactions and blocks.
5. Uploads the production assets as `blockchaintruth-synthetic-replay` and a screenshot/diagnostics as `blockchaintruth-rendering-smoke`.

## Integration boundaries

- `src/components/street-controller.js`: street layout, Phaser texture atlases, scene activation.
- `src/components/street.js`: transaction state, boarding, movement and block handling.
- `src/components/game-objects/person.js`: person movement.
- `src/components/game-objects/bus.js`: buses representing blocks.
- `src/components/utils/index.js`: REST and Socket.IO client adapter.
- `src/replay/replay.js`: isolated synthetic data/event adapter.
- `public/static/img/`: sprite sheets, assets and atlas metadata.

Legacy routes include `/static/live/houses-BTC`, `/static/live/pendingTxs-BTC`, and `/static/blocks/BTC/{hash}`. Socket.IO rooms include `BTC-transactions`, `BTC-blocks` and related ETH equivalents. Event names include `tx`, `block`, `latestblocks`, `fetch-stat` and `stat-updates`.

## Outstanding work before a public BlockchainTruth launch

- Inspect saved Chrome screenshots across resolutions and verify animation over time. Fix any remaining warnings, stale graphics, bus sprites or visual regressions.
- Remove unrelated onboarding, wallet connections, advertising and NFT code, retaining original copyright/license notices.
- Add a versioned, typed, network-agnostic event interface. Verify block-event semantics against real chain-specific data.
- Replace Vue 2 / Vue CLI 4 and the outdated Phaser beta in small, independently testable steps.
- Run a dependency/security/licensing audit. The upstream frontend includes an MIT license. Community sources may impose AGPL obligations.
- Add archival/replay data with provenance and explicit separation between observation, simulation, and network-finality claims.
- Deploy a private preview for visual review before authorizing a public BlockchainTruth.org release.

No changes should be merged into `main` until the replay and browser tests pass and the source has undergone review.
