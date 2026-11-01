// Alle Bilder sind von Hand gezeichnete Grafiken und nutzen die Verläufe aus index.html.

const P = 'url(#gPink)';
const S = 'url(#gSoft)';
const W = 'url(#gWhite)';
const G = 'url(#gGlass)';

const sparkle = (x, y, r, fill = '#fff') =>
  `<path transform="translate(${x} ${y}) scale(${r})" fill="${fill}" d="M0-1C.12-.3.3-.12 1 0 .3.12.12.3 0 1-.12.3-.3.12-1 0-.3-.12-.12-.3 0-1Z"/>`;
const bubble = (x, y, r) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" fill-opacity=".55" stroke="#fff" stroke-width="1.4"/><circle cx="${x - r * .3}" cy="${y - r * .3}" r="${r * .2}" fill="#fff"/>`;

const scenes = {
  dishwasher: `
    <rect x="48" y="16" width="104" height="118" rx="13" fill="${W}"/>
    <rect x="48" y="16" width="104" height="20" rx="10" fill="${S}"/>
    <circle cx="66" cy="26" r="4" fill="${P}"/><rect x="118" y="23.5" width="22" height="5" rx="2.5" fill="#fff"/>
    <rect x="58" y="44" width="84" height="80" rx="8" fill="#ffd9e6"/>
    <g fill="#fff" stroke="#ff9cc0" stroke-width="1.5">
      <rect x="64" y="52" width="9" height="50" rx="4.5"/><rect x="77" y="52" width="9" height="50" rx="4.5"/><rect x="90" y="52" width="9" height="50" rx="4.5"/>
    </g>
    <path d="M108 54h25l-2.5 28a9 9 0 0 1-9 8h-2a9 9 0 0 1-9-8Z" fill="${G}" stroke="#ff9cc0" stroke-width="1.5"/>
    <path d="M60 106h80M60 114h80M70 100v20M90 100v20M110 100v20M130 100v20" stroke="${P}" stroke-width="2.2" stroke-linecap="round" fill="none"/>
    ${bubble(36, 58, 8)}${bubble(166, 40, 6)}${bubble(170, 96, 10)}${bubble(28, 104, 5)}
    ${sparkle(120, 66, 7)}`,
  massage: `
    <ellipse cx="100" cy="128" rx="74" ry="8" fill="#ff8fb7" fill-opacity=".35"/>
    <ellipse cx="100" cy="112" rx="50" ry="16" fill="${P}"/>
    <ellipse cx="100" cy="107" rx="50" ry="14" fill="#ff77a8" fill-opacity=".5"/>
    <ellipse cx="100" cy="84" rx="37" ry="13" fill="${S}"/>
    <ellipse cx="100" cy="64" rx="26" ry="10.5" fill="${W}"/>
    <g fill="${P}" transform="translate(100 49)">
      <path d="M0 2C-8-6-8-15 0-23 8-15 8-6 0 2Z"/>
      <path fill="#ff8fb7" d="M0 2C-12 0-18-6-20-16-9-16-2-11 0 2Z"/>
      <path fill="#ff8fb7" d="M0 2C12 0 18-6 20-16 9-16 2-11 0 2Z"/>
      <path fill="#ffd3e3" d="M0 3C-13 5-23 2-30-7-18-11-7-7 0 3Z"/>
      <path fill="#ffd3e3" d="M0 3C13 5 23 2 30-7 18-11 7-7 0 3Z"/>
    </g>
    <path d="M160 34c7 9 10 14 10 19a10 10 0 0 1-20 0c0-5 3-10 10-19Z" fill="${G}" stroke="#ff9cc0" stroke-width="1.5"/>
    ${sparkle(40, 42, 8)}${sparkle(30, 76, 5)}${sparkle(172, 88, 5)}`,
  bathroom: `
    <path d="M136 24c0-8 6-13 13-13s13 5 13 13v42" fill="none" stroke="${P}" stroke-width="6" stroke-linecap="round"/>
    <path d="M122 28h28l5 8h-38Z" fill="${S}"/>
    <g fill="#fff" stroke="#ff9cc0" stroke-width="1"><circle cx="124" cy="46" r="2.4"/><circle cx="136" cy="52" r="2.4"/><circle cx="148" cy="46" r="2.4"/><circle cx="130" cy="60" r="2.4"/><circle cx="143" cy="62" r="2.4"/></g>
    <rect x="22" y="74" width="156" height="11" rx="5.5" fill="${P}"/>
    <path d="M32 85h136v8a30 30 0 0 1-30 30H62a30 30 0 0 1-30-30Z" fill="${W}"/>
    <path d="M52 122l-5 12M148 122l5 12" stroke="${P}" stroke-width="6" stroke-linecap="round"/>
    <g fill="#fff"><circle cx="48" cy="68" r="12"/><circle cx="66" cy="62" r="15"/><circle cx="86" cy="68" r="11"/><circle cx="103" cy="64" r="9"/></g>
    <g fill="#ffd3e3" fill-opacity=".8"><circle cx="66" cy="65" r="9"/></g>
    ${bubble(60, 38, 7)}${bubble(86, 32, 5)}${bubble(40, 44, 4)}
    ${sparkle(108, 28, 8)}${sparkle(30, 26, 6)}`,
  evening: `
    <path d="M132 16a40 40 0 1 0 38 54 32 32 0 0 1-38-54Z" fill="${W}"/>
    ${sparkle(58, 30, 9)}${sparkle(90, 52, 5)}${sparkle(36, 62, 6)}${sparkle(176, 30, 6)}${sparkle(112, 22, 4)}
    <path d="M58 72h44c2 24-6 38-22 38S56 96 58 72Z" fill="${G}" stroke="#fff" stroke-width="2"/>
    <path d="M60 88c12-5 28 5 41 0-2 13-9 20-21 20s-19-7-20-20Z" fill="${P}"/>
    <path d="M80 110v20M64 132h32" stroke="#fff" stroke-width="4.5" stroke-linecap="round"/>`,
  day: `
    <g transform="translate(150 42)">
      <circle r="21" fill="${W}"/>
      <g stroke="#fff" stroke-width="4.5" stroke-linecap="round"><path d="M0-30v-8M0 30v8M-30 0h-8M30 0h8M-21-21l-6-6M21 21l6 6M-21 21l-6 6M21-21l6-6"/></g>
    </g>
    <path d="M0 124c34-13 66-13 100-6s70 6 100-5v37H0Z" fill="#fff" fill-opacity=".75"/>
    <path d="M62 33 V124" stroke="${P}" stroke-width="4.5" stroke-linecap="round"/>
    <path d="M18 56C24 22 100 22 106 56 98 49 88 49 80 56 72 49 62 49 62 56 54 49 44 49 36 56 30 49 24 50 18 56Z" fill="${P}"/>
    <path d="M36 56C40 34 52 26 62 26S84 34 80 56C72 49 54 49 36 56Z" fill="#ffc2d8" fill-opacity=".85"/>
    <path d="M88 122l22-34 42 15" stroke="${P}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path d="M108 124l26-26" stroke="#ff8fb7" stroke-width="5" stroke-linecap="round"/>
    ${sparkle(120, 28, 6)}${sparkle(182, 92, 5)}`,
  custom: `
    <ellipse cx="100" cy="130" rx="66" ry="7" fill="#ff8fb7" fill-opacity=".35"/>
    <rect x="50" y="66" width="100" height="62" rx="9" fill="${W}"/>
    <rect x="42" y="50" width="116" height="26" rx="8" fill="${P}"/>
    <rect x="90" y="50" width="20" height="78" fill="${S}"/>
    <path d="M100 50C82 50 66 42 68 30s24-8 32 20ZM100 50c18 0 34-8 32-20s-24-8-32 20Z" fill="${P}" stroke="#fff" stroke-width="2"/>
    <circle cx="100" cy="48" r="6.5" fill="#fff"/>
    ${sparkle(40, 32, 9)}${sparkle(164, 26, 7)}${sparkle(176, 62, 5)}${sparkle(26, 72, 5)}`,
};

export function art(id) {
  return `<svg class="scene" viewBox="0 0 200 150" role="img" aria-hidden="true">${scenes[id] ?? scenes.custom}</svg>`;
}

export function coin(size = 16) {
  return `<svg class="coin" width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true">
    <circle cx="16" cy="16" r="15" fill="url(#gCoin)"/>
    <circle cx="16" cy="16" r="11.4" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1.3"/>
    <path d="M9.5 21.5v-11h2.4l4.1 5.9 4.1-5.9h2.4v11h-2.6v-6.9L16 20l-3.9-5.4v6.9Z" fill="#fff"/>
  </svg>`;
}

const LINE = 'fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"';

const paths = {
  bag: '<path d="M5 8h14l1 12a1.5 1.5 0 0 1-1.5 1.6h-13A1.5 1.5 0 0 1 4 20Z"/><path d="M8.5 10.500V6.800a3.500 3.500 0 0 1 7 0v3.700"/>',
  box: '<path d="M12 2.800 20.500 7.300v9.400L12 21.200 3.500 16.700V7.300Z"/><path d="M3.800 7.500 12 12l8.200-4.500M12 12v9"/>',
  person: '<circle cx="12" cy="8" r="4"/><path d="M4.500 20.800c1-4 4-6 7.500-6s6.500 2 7.500 6"/>',
  list: '<path d="M8.500 6.500H20M8.500 12H20M8.500 17.500H20"/><circle cx="4.500" cy="6.500" r=".6"/><circle cx="4.500" cy="12" r=".6"/><circle cx="4.500" cy="17.500" r=".6"/>',
  search: '<circle cx="11" cy="11" r="6.800"/><path d="m16 16 4.500 4.500"/>',
  bell: '<path d="M6 16.500V11a6 6 0 0 1 12 0v5.500l1.500 2h-15Z"/><path d="M10 21a2 2 0 0 0 4 0"/>',
  swap: '<path d="M4 8.500h14l-3.500-3.500M20 15.500H6l3.500 3.500"/>',
  phone: '<rect x="7" y="2.800" width="10" height="18.400" rx="2.500"/><path d="M11 18.500h2"/>',
  heart: '<path d="M12 20.500S3.800 15.600 3.800 9.500A4.500 4.500 0 0 1 12 7a4.500 4.500 0 0 1 8.200 2.500c0 6.100-8.200 11-8.200 11Z"/>',
  eye: '<path d="M2.800 12S6.200 5.500 12 5.500 21.200 12 21.200 12 17.800 18.500 12 18.500 2.800 12 2.800 12Z"/><circle cx="12" cy="12" r="2.800"/>',
  check: '<path d="m5 12.500 4.500 4.500L19 7.500"/>',
  chevron: '<path d="m9 5.500 6.500 6.500L9 18.500"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10.5" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
  unlock: '<rect x="5" y="10.5" width="14" height="10.5" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 7.6-1.8"/>',
  trash: '<path d="M4.5 6.5h15M9.5 6.5V4.5h5v2M6.5 6.5l1 14h9l1-14M10.5 10.5v6.500M13.5 10.5v6.500"/>',
  share: '<path d="M12 15V3.500M8 7l4-3.800L16 7"/><path d="M8 10.500H6.500A1.500 1.500 0 0 0 5 12v7.500A1.500 1.500 0 0 0 6.500 21h11a1.500 1.500 0 0 0 1.500-1.500V12a1.500 1.500 0 0 0-1.500-1.500H16"/>',
};

export function icon(name, size = 24) {
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" ${LINE} aria-hidden="true">${paths[name]}</svg>`;
}
