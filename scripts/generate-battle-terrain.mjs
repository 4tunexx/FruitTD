import fs from 'node:fs';
const terrains = [
  ['casual-fallen-orchard', '#537347', '#3d5538', '#a09372', 2048],
  ['campaign-old-orchard', '#64734e', '#394a34', '#ae9470', 2048],
  ['horde-night-harvest', '#354c46', '#253934', '#827b68', 2048],
  ['coop-shared-grove', '#54785d', '#344f42', '#aa9773', 2048],
  ['pvp-twin-pass', '#637347', '#3e4d32', '#ac9471', 6144],
];
for (const [name, ground, edge, road, height] of terrains) {
  let seed = 29471;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const details = [];
  for (let i = 0; i < height / 4; i++) {
    const x = Math.round(random() * 1024), y = Math.round(random() * height);
    const inRoad = x > 205 && x < 819;
    details.push(`<path d="M${x} ${y}l${2 + Math.round(random()*11)} -2" stroke="${inRoad ? '#554d37' : '#d1ce94'}" opacity="${inRoad ? '.13' : '.19'}" stroke-width="2"/>`);
  }
  for (let i = 0; i < height / 72; i++) {
    const x = random() > .5 ? 38 + random() * 80 : 905 + random() * 70;
    const y = random() * height, size = 9 + random() * 23;
    details.push(`<ellipse cx="${x+5}" cy="${y+8}" rx="${size}" ry="${size*.5}" fill="#17261c" opacity=".36"/><path d="M${x-size} ${y}l${size*.4} -${size*.65} ${size*1.2} -${size*.1} ${size*.55} ${size*.7} -${size*.6} ${size*.5}Z" fill="#778078" stroke="#3b4b3d" stroke-width="3"/><path d="M${x-size*.6} ${y-size*.5}l${size*1.1} -2" stroke="#bac0a0" opacity=".55" stroke-width="3"/>`);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="${height}" viewBox="0 0 1024 ${height}">
  <defs><linearGradient id="g" x2="1" y2="0"><stop stop-color="${edge}"/><stop offset=".25" stop-color="${ground}"/><stop offset=".75" stop-color="${ground}"/><stop offset="1" stop-color="${edge}"/></linearGradient><pattern id="c" width="96" height="128" patternUnits="userSpaceOnUse"><path d="M12 24l32 4 12 31-10 34-34-2M72 0l-5 32 29 11M52 103l22 6 11 19" fill="none" stroke="#544a37" stroke-width="2" opacity=".17"/></pattern></defs>
  <rect width="1024" height="${height}" fill="url(#g)"/>
  <path d="M174 0H850L832 ${height}H191Z" fill="${edge}" opacity=".4"/>
  <path d="M217 0H807L794 ${height}H231Z" fill="${road}"/>
  <path d="M217 0H807L794 ${height}H231Z" fill="url(#c)"/>
  <path d="M223 0L238 ${height}M803 0L788 ${height}" fill="none" stroke="#cfb68a" stroke-width="5" opacity=".32"/>
  <path d="M140 0V${height}M884 0V${height}" stroke="#263b2c" stroke-width="12" opacity=".28"/>
  ${details.join('\n')}
  </svg>`;
  fs.writeFileSync(`public/assets/maps/samples/${name}.svg`, svg);
}
