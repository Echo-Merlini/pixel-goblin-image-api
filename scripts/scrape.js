// One-time (re-runnable) manifest builder. Every Pixel Goblin was inscribed by a
// single creator; we page that creator's ethscriptions via the v2 indexer and
// index each goblin by its manifest id (the `m.tokenId` inside the content).
// This is ownership-independent — it does NOT rely on ERC-721 owner == inscription
// owner (those drift when an NFT is sold without moving the inscription).
const fs = require('fs');
const path = require('path');
const { fetchT } = require('../src/chain');
const { parseContent } = require('../src/resolve');

const ETHSCRIPTIONS_API = process.env.ETHSCRIPTIONS_API || 'https://api.ethscriptions.com/v2/ethscriptions';
// Goblins were inscribed by two wallets: the bulk creator, and the contract
// owner (founder mints, tokens 1-5). Page both.
const CREATORS = (process.env.GOBLIN_CREATORS ||
  '0x322b44ff0265eef126c1fa67d8ae47c79314b12e,0x0ab705b9734cb776a8f5b18c9036c14c6828933f')
  .split(',').map((s) => s.trim().toLowerCase());
const OUT = path.join(__dirname, '..', 'data', 'manifest.json');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function page(creator, pageKey, tries = 8) {
  for (let i = 0; i < tries; i++) {
    try {
      const url = `${ETHSCRIPTIONS_API}?creator=${creator}&page_size=100${pageKey ? `&page_key=${pageKey}` : ''}`;
      const res = await fetchT(url, { headers: { 'User-Agent': 'pixel-goblin-image-api/scrape' } }, 10000);
      if (res.status === 521 || res.status === 429 || res.status >= 500) { await sleep(2000 * (i + 1)); continue; }
      if (!res.ok) throw new Error('http ' + res.status);
      return await res.json();
    } catch (e) { await sleep(2000 * (i + 1)); }
  }
  return null;
}

(async () => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const manifest = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
  let pages = 0, goblins = 0, added = 0;

  for (const creator of CREATORS) {
    let pageKey = '';
    for (let guard = 0; guard < 1000; guard++) {
      const body = await page(creator, pageKey);
      if (!body) { console.error(`indexer unreachable (creator ${creator.slice(0, 10)}, page ${pages}) — re-run to resume`); break; }
      const list = body.result || [];
      pages++;
      for (const rec of list) {
        const c = parseContent(rec.content_uri);
        if (!c || !c.m || c.m.tokenId === undefined || !Array.isArray(c.p)) continue; // skip non-goblin inscriptions
        goblins++;
        const id = c.m.tokenId;
        if (!manifest[id]) { manifest[id] = { w: c.w, h: c.h, p: c.p, m: c.m }; added++; }
      }
      fs.writeFileSync(OUT, JSON.stringify(manifest));
      if (pages % 5 === 0) console.log(`  page ${pages}: goblins=${goblins} manifest=${Object.keys(manifest).length}`);
      pageKey = body.pagination && body.pagination.has_more && body.pagination.page_key;
      if (!pageKey) break;
    }
  }

  console.log(`\ndone: ${pages} pages, ${goblins} goblin inscriptions seen, manifest entries=${Object.keys(manifest).length} (+${added} this run)`);
})();
