# pixel-goblin-image-api

OpenSea **metadata + image** API for [Pixel Goblins](https://pixel-goblins.com) — 10,000 on-chain ETHscriptions on Ethereum.

The ERC-721 wrapper's `tokenURI` points here (`baseURI = .../api/metadata/`). For each token this service returns OpenSea-compatible metadata and renders the goblin sprite as an SVG.

## Why this rewrite (v2)

The previous version reconstructed each goblin by scanning the chain with an archive-range `eth_getLogs`. Public RPCs no longer serve archive `getLogs` for free (`publicnode` now requires a paid token; Alchemy's free tier caps `getLogs` at 10 blocks), so metadata generation broke and OpenSea showed blank goblins.

This version removes that dependency entirely:

```
tokenId ──eth_call: tokenToManifestId()──▶ manifestId ──▶ pre-baked manifest ──▶ {sprite + traits}
```

- **One `eth_call`** per request (no `getLogs`, no archive) — works on any free RPC.
- **Pre-baked manifest** (`data/manifest.json`): every goblin's pixels + traits, keyed by manifest id. The hot path never touches a third-party indexer.
- The 1px-bordered **34×34** sprite is rendered to SVG from the run-length-encoded pixel data.

## Endpoints

| Route | Returns |
|-------|---------|
| `GET /health` | `{ status, timestamp, manifest }` |
| `GET /api/metadata/:tokenId` | OpenSea metadata JSON (`name`, `description`, `image`, `attributes`) |
| `GET /api/image/:tokenId` (or `:tokenId.svg`) | `image/svg+xml` sprite, immutably cacheable |

## Environment

See `.env.example`. The only required var is `RPC_URL` (any Ethereum mainnet endpoint — only `eth_call` is used).

## Rebuilding the manifest

```bash
npm run scrape   # pages the two creator wallets via the ethscriptions v2 indexer,
                 # indexes every goblin by manifest id, writes data/manifest.json
```

Re-run after new mints; it resumes and fills gaps. Goblins were inscribed by two wallets (bulk creator + the contract owner for founder mints 1–5); both are covered. If a token is minted after the last bake, the server falls back to a live indexer lookup and caches the result.

## Deploy (Railway)

Node service, `npm start`. Set `RPC_URL` (mainnet) and `PUBLIC_BASE_URL`. The committed `data/manifest.json` ships with the image, so the running service needs only the RPC.

## Contract

`0x6559807ffd23965d3af54ee454bc69f113ed06ef` — `PixelGoblinsMintControllerV3`. Key views used: `tokenToManifestId(uint256)`, `ownerOf(uint256)`, `totalMinted()`.
