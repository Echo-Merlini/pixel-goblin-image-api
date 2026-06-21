// Render a Pixel Goblin sprite to SVG from its run-length-encoded pixel data.
// content.p is row-major [ [hexColor, runLength], ... ] over a square canvas.
// NOTE: the on-chain `w`/`h` (32) is the inner sprite; the real canvas carries a
// 1px border, so the true side is sqrt(totalPixels) (e.g. 1156 -> 34). We derive
// the side from the data and fall back to w only if it isn't a perfect square.
function canvasSide(content) {
  const total = content.p.reduce((a, [, n]) => a + n, 0);
  const side = Math.sqrt(total);
  return Number.isInteger(side) ? side : content.w;
}

function renderSVG(content, scale = 16) {
  const W = canvasSide(content);
  let x = 0, y = 0;
  const rects = [];
  for (const [color, run] of content.p) {
    let remaining = run;
    while (remaining > 0) {
      const take = Math.min(remaining, W - x);
      rects.push(`<rect x="${x}" y="${y}" width="${take}" height="1" fill="${color}"/>`);
      x += take; remaining -= take;
      if (x >= W) { x = 0; y++; }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W * scale}" height="${W * scale}" viewBox="0 0 ${W} ${W}" shape-rendering="crispEdges">${rects.join('')}</svg>`;
}

module.exports = { renderSVG, canvasSide };
