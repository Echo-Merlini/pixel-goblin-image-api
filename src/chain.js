// Minimal JSON-RPC reads against the Pixel Goblins contract. Only eth_call —
// no eth_getLogs, no archive ranges, so any standard RPC (free tier) works.
const RPC_URL = process.env.RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/demo';
const CONTRACT = (process.env.CONTRACT || '0x6559807ffd23965d3af54ee454bc69f113ed06ef').toLowerCase();

// Pre-computed 4-byte selectors (keccak of the signature).
const SEL = {
  ownerOf: '0x6352211e',           // ownerOf(uint256)
  tokenToManifestId: '0x72de5b04', // tokenToManifestId(uint256)
  totalMinted: '0xa2309ff8',       // totalMinted()
  maxSupply: '0x32cb6b0c',         // MAX_SUPPLY()
};

// fetch with a hard timeout — a hung upstream must never hang the request.
async function fetchT(url, opts = {}, ms = 8000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ac.signal }); }
  finally { clearTimeout(t); }
}

async function ethCall(data) {
  const res = await fetchT(RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: CONTRACT, data }, 'latest'] }),
  });
  const j = await res.json();
  if (j.error) throw new Error(`eth_call: ${j.error.message}`);
  return j.result;
}

const uint = (n) => BigInt(n).toString(16).padStart(64, '0');

async function tokenToManifestId(tokenId) {
  const r = await ethCall(SEL.tokenToManifestId + uint(tokenId));
  return parseInt(r, 16);
}
async function ownerOf(tokenId) {
  const r = await ethCall(SEL.ownerOf + uint(tokenId));
  return '0x' + r.slice(-40);
}
async function totalMinted() {
  return parseInt(await ethCall(SEL.totalMinted), 16);
}

module.exports = { ethCall, fetchT, tokenToManifestId, ownerOf, totalMinted, CONTRACT, RPC_URL };
