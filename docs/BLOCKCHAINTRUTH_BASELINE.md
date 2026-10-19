# BlockchainTruth: TxStreet baseline reproduction

Status: experimental. This branch does not serve production traffic. The original `main` branch is preserved.

## Reproducible build

See `.github/workflows/blockchaintruth-baseline.yml` for a bounded compatibility build on Node 16.20.2 with the original `yarn.lock`. Node 16 is end-of-life and is **not** an endorsed runtime for new deployments.

The build explicitly supplies local placeholder endpoints instead of the legacy TxStreet and third-party servers. This proves compilation only, **not** that the application is operational or that transactions are rendered correctly.

## Source components to preserve

- `src/components/street-controller.js`: Phaser scenes, atlas loading, screen layout and selection.
- `src/components/street.js`: visualization state and source-specific transactions.
- `src/components/game-objects/person.js`: animated character movement.
- `src/components/game-objects/bus.js`: animated block movement.
- `src/components/utils/index.js`: Socket.IO subscriptions, REST retrieval and routing.
- `public/static/img/`: original sprite sheets, fonts and associated atlas metadata.

## Verified legacy interface

Frontend environment variables:
- `VUE_APP_REST_API`
- `VUE_APP_WS_SERVER`
- `VUE_APP_REST_API_ETH`
- `VUE_APP_WS_SERVER_ETH`
- `VUE_APP_MOONHEADS_SERVER`
- `VUE_APP_STORAGE_URL`

REST calls include `/static/live/houses-BTC`, `/static/live/pendingTxs-BTC`, and `/static/blocks/BTC/{hash}`. Socket.IO client emits `join-room` with `BTC-transactions` or `BTC-blocks`. Server emits `tx` and `block`. Statistics use `fetch-stat` and chain-specific keys. The protocol requires further end-to-end verification before it is treated as a stable contract.

## Immediate development sequence

1. Check the baseline GitHub Action build result. If failure occurs, capture the exact failing dependency or compiler error.
2. Add a dedicated `replay` mode and use a deterministic BTC/ETH transaction fixture. It should require no API keys, subscriptions, blockchain nodes, MongoDB, or Redis.
3. Validate person creation, prioritization, bus boarding, new blocks and transaction removal using the fixture. Capture actual screenshots and browser console errors.
4. Repair scene layout, retina scaling and atlas/render glitches against a fixed fixture.
5. Extract a typed normalized transaction event adapter, **after** existing behavior is reproduced.
6. Create a standalone Vue 3/Vite shell or migrate progressively, with the Phaser scene isolated from UI state.
7. Add authenticated, rate-limited and provenance-tracked BTC and ETH feeds; distinguish node-observed mempool transactions, block inclusion and network-specific finality.
8. Perform a dependency/security/license review before public hosting. Preserve the original MIT copyright and notices. Review processor ISC declaration and separately licensed AGPL community code.

## Known unresolved issues

- The legacy application calls multiple third-party endpoints and has optional advertisements/wallet integrations; disabling them with build-time env variables is insufficient to guarantee no runtime requests.
- Node.js 16 and Vue 2 are obsolete; the current CI baseline is deliberately quarantined.
- Original processor setup examples show URI formats different from its validation checks.
- The original processor uses MongoDB, Redis, RPC nodes and background jobs. A frontend build does not exercise them.
- The user's community-reference deployment at txcity.io may use patched rendering code; no equivalence to this source revision has been verified.

**No change from this branch should be merged to the default branch until the UI runs in replay mode and passes human review.**
