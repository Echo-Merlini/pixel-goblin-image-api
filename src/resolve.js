// Resolve an ERC-721 tokenId to its goblin content {w,h,p,traits,...}.
// Primary source: the pre-baked static manifest (manifestId -> content), so the
// hot path needs only ONE eth_call (tokenToManifestId) and zero third-party calls.
// Fallback (for tokens minted after the manifest was baked): look the inscription
// up live via the ethscriptions indexer using the token owner, then cache it.
const fs = require('fs');
const path = require('path');
const { tokenToManifestId, ownerOf, fetchT } = require('./chain');

const ETHSCRIPTIONS_API = process.env.ETHSCRIPTIONS_API || 'https://api.ethscriptions.com/v2/ethscriptions';
const MANIFEST_PATH = path.join(__dirname, '..', 'data', 'manifest.json');

let manifest = {};
try { manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')); }
catch { console.warn('[resolve] no manifest.json yet — running in live-fallback mode'); }

const liveCache = new Map(); // manifestId -> content (immutable once seen)

function parseContent(uri) {
  if (!uri || !uri.startsWith('data:application/json,')) return null;
  try { return JSON.parse(decodeURIComponent(uri.slice('data:application/json,'.length))); }
  catch { return null; }
}

async function liveFetchByManifestId(manifestId, tokenId) {
  if (liveCache.has(manifestId)) return liveCache.get(manifestId);
  const owner = await ownerOf(tokenId);
  // v2 indexer filters by current_owner; page through this owner's ethscriptions.
  let pageKey = '';
  for (let guard = 0; guard < 50; guard++) {
    const url = `${ETHSCRIPTIONS_API}?current_owner=${owner}&page_size=100${pageKey ? `&page_key=${pageKey}` : ''}`;
    const res = await fetchT(url, { headers: { 'User-Agent': 'pixel-goblin-image-api' } }, 8000);
    if (!res.ok) throw new Error(`indexer ${res.status}`);
    const body = await res.json();
    const list = body.result || [];
    for (const rec of list) {
      const c = parseContent(rec.content_uri);
      if (c && c.m && c.m.tokenId === manifestId) {
        const entry = { w: c.w, h: c.h, p: c.p, m: c.m };
        liveCache.set(manifestId, entry);
        return entry;
      }
    }
    pageKey = body.pagination && body.pagination.page_key;
    if (!pageKey) break;
  }
  return null;
}

// Returns { manifestId, content } or throws.
async function resolveToken(tokenId) {
  const manifestId = await tokenToManifestId(tokenId);
  if (!manifestId) throw new Error(`token ${tokenId} not minted`);
  let content = manifest[manifestId] || manifest[String(manifestId)];
  if (!content) content = await liveFetchByManifestId(manifestId, tokenId);
  if (!content) throw new Error(`no goblin content for manifestId ${manifestId}`);
  return { manifestId, content };
}

module.exports = { resolveToken, parseContent, manifestSize: () => Object.keys(manifest).length };
