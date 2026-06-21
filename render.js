// Pixel Goblin renderer: content {w,h,p:[[hexColor,runLength],...]} -> SVG string
function renderSVG(content, scale = 16) {
  const { w, h, p } = content;
  let x = 0, y = 0;
  const rects = [];
  for (const [color, run] of p) {
    let remaining = run;
    while (remaining > 0) {
      const spaceInRow = w - x;
      const take = Math.min(remaining, spaceInRow);
      // merge into one rect per horizontal run segment
      rects.push(`<rect x="${x}" y="${y}" width="${take}" height="1" fill="${color}"/>`);
      x += take; remaining -= take;
      if (x >= w) { x = 0; y++; }
    }
  }
  const px = w * scale, py = h * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${py}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">${rects.join('')}</svg>`;
}
module.exports = { renderSVG };
