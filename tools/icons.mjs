// Erzeugt die App-Symbole. iOS braucht PNG-Dateien.
import sharp from 'sharp';

const svg = (size) => Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff8db6"/><stop offset="1" stop-color="#ff2d78"/></linearGradient>
    <radialGradient id="shine" cx=".3" cy=".15" r=".9"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <rect width="512" height="512" fill="url(#shine)"/>
  <circle cx="256" cy="256" r="156" fill="#fff"/>
  <circle cx="256" cy="256" r="126" fill="none" stroke="#ff2d78" stroke-opacity=".35" stroke-width="8"/>
  <path transform="translate(256 256) scale(10.5) translate(-16 -16)" fill="#ff2d78" d="M9.5 21.500v-11h2.400l4.100 5.900 4.100-5.900h2.400v11h-2.600v-6.900L16 20l-3.900-5.400v6.900Z"/>
</svg>`);

for (const [name, size] of [['icon-192', 192], ['icon-512', 512], ['apple-touch-icon', 180]]) {
  await sharp(svg(size)).flatten({ background: '#ff2d78' }).png().toFile(`docs/icons/${name}.png`);
}
