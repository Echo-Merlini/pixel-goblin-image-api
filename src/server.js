const express = require('express');
const { resolveToken, manifestSize } = require('./resolve');
const { renderSVG } = require('./render');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_BASE = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
const COLLECTION_NAME = 'Pixel Goblins';

app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: Date.now(), manifest: manifestSize() }));

function attributes(m) {
  const attrs = (m.traits || []).map((t) => ({ trait_type: cap(t.category), value: t.name }));
  if (m.traitValue) attrs.unshift({ trait_type: m.traitType || 'Type', value: m.traitValue });
  if (m.baseSlot !== undefined) attrs.push({ trait_type: 'Base Slot', value: m.baseSlot });
  return attrs;
}
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// Build an absolute base URL. Prefer PUBLIC_BASE; otherwise honour the proxy's
// x-forwarded-proto, and default to https for any non-localhost host (Railway's
// internal req.protocol is http, but the public edge is https — OpenSea needs https).
function baseUrl(req) {
  if (PUBLIC_BASE) return PUBLIC_BASE;
  const host = req.get('host') || '';
  const proto = req.get('x-forwarded-proto') || (/^localhost|^127\.|^0\.0\.0\.0/.test(host) ? 'http' : 'https');
  return `${proto}://${host}`;
}

// OpenSea metadata
app.get('/api/metadata/:tokenId', async (req, res) => {
  const tokenId = parseInt(req.params.tokenId, 10);
  if (!Number.isInteger(tokenId) || tokenId < 1) return res.status(400).json({ error: 'bad tokenId' });
  try {
    const { content } = await resolveToken(tokenId);
    const base = baseUrl(req);
    res.json({
      name: `Pixel Goblin #${tokenId}`,
      description: '10,000 unique on-chain Pixel Goblins — ETHscriptions on Ethereum.',
      image: `${base}/api/image/${tokenId}.svg`,
      external_url: `https://pixel-goblins.com`,
      attributes: attributes(content.m),
    });
  } catch (e) {
    console.error(`Error in /api/metadata/${tokenId}:`, e.message);
    res.status(502).json({ error: e.message });
  }
});

// SVG image (also accepts /api/image/:id.svg)
app.get('/api/image/:tokenId', async (req, res) => {
  const tokenId = parseInt(String(req.params.tokenId).replace(/\.svg$/, ''), 10);
  if (!Number.isInteger(tokenId) || tokenId < 1) return res.status(400).send('bad tokenId');
  try {
    const { content } = await resolveToken(tokenId);
    res.set('Content-Type', 'image/svg+xml');
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(renderSVG(content));
  } catch (e) {
    console.error(`Error in /api/image/${tokenId}:`, e.message);
    res.status(502).send(e.message);
  }
});

app.listen(PORT, () => console.log(`pixel-goblin-image-api on :${PORT} — ${COLLECTION_NAME}, manifest=${manifestSize()}`));
