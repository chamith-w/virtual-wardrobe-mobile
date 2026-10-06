#!/usr/bin/env node
/**
 * Renders the placeholder garment cutouts for the demo wardrobe (WebP with
 * alpha, ~1200px full + ~400px thumb), a staged "original photo" of each
 * garment (JPEG, for the flip on item detail), and the app icon / splash
 * artwork, then writes src/db/seed/assets.ts (a static require() map Metro
 * can bundle).
 *
 *   npm run assets
 *
 * Garments come from src/db/seed/garments.json; colours from FASHION_PALETTE in
 * src/lib/color.ts. Cutouts are transparent PNGs — the silhouette shadow is
 * drawn at runtime from the alpha mask, never baked in.
 */
import { Buffer } from 'node:buffer';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const FULL = 1200;
const THUMB = 400;

// ---------------------------------------------------------------- palette --
const colorSrc = readFileSync(join(root, 'src/lib/color.ts'), 'utf8');
const PALETTE = Object.fromEntries(
  [...colorSrc.matchAll(/name: '([^']+)', hex: '(#[0-9A-Fa-f]{6})'/g)].map((m) => [m[1], m[2]]),
);
const hexOf = (name) => {
  const hex = PALETTE[name];
  if (!hex) throw new Error(`Colour "${name}" is not in FASHION_PALETTE`);
  return hex;
};

// ------------------------------------------------------------------ shapes --
const T = [0, 0, 100, 120];
const S = [0, 0, 120, 80];
const A = [0, 0, 100, 110];

const SHAPES = {
  coat: {
    vb: T,
    d: 'M33 8L45 4L50 24L55 4L67 8L82 16Q88 20 89 28L95 92Q95 96 91 96L85 96Q82 96 82 92L77 46L80 114Q80 117 77 117L23 117Q20 117 20 114L23 46L18 92Q18 96 15 96L9 96Q5 96 5 92L11 28Q12 20 18 16Z',
    l: 'M45 4L50 24L55 4M50 24L50 116M33 8L41 30L50 24M67 8L59 30L50 24M27 76L38 76M62 76L73 76M7 86L18 86M82 86L93 86',
    buttons: [
      [46, 46],
      [46, 62],
      [46, 78],
    ],
  },
  jacket: {
    vb: T,
    d: 'M33 10L45 6L50 26L55 6L67 10L82 18Q88 22 89 30L94 88Q94 92 90 92L85 92Q82 92 82 88L77 48L78 100Q78 103 75 103L25 103Q22 103 22 100L23 48L18 88Q18 92 15 92L10 92Q6 92 6 88L11 30Q12 22 18 18Z',
    l: 'M45 6L50 26L55 6M50 26L50 102M33 10L41 32L50 26M67 10L59 32L50 26M23 93L77 93M29 62L40 62M60 62L71 62',
    buttons: [
      [47, 50],
      [47, 66],
      [47, 82],
    ],
  },
  puffer: {
    vb: T,
    d: 'M33 10L45 6L50 22L55 6L67 10L84 18Q90 22 91 30L95 88Q95 93 90 93L84 93Q81 93 81 89L77 50L79 100Q79 104 75 104L25 104Q21 104 21 100L23 50L19 89Q19 93 16 93L10 93Q5 93 5 88L9 30Q10 22 16 18Z',
    l: 'M50 22L50 104M22 40L78 40M22 56L78 56M22 72L78 72M22 88L78 88M8 50L19 50M81 50L92 50M7 70L18 70M82 70L93 70',
  },
  shirt: {
    vb: T,
    d: 'M35 8L44 4L50 12L56 4L65 8L80 16Q86 19 87 26L94 90Q94 94 90 94L85 94Q82 94 82 90L76 44L76 112Q76 115 73 115L27 115Q24 115 24 112L24 44L18 90Q18 94 15 94L10 94Q6 94 6 90L13 26Q14 19 20 16Z',
    l: 'M44 4L46 14L50 12L54 14L56 4M50 12L50 114M8 84L18 84M82 84L92 84M30 30L40 30L40 39L30 39Z',
    buttons: [
      [52, 26],
      [52, 44],
      [52, 62],
      [52, 80],
      [52, 98],
    ],
    buttonR: 1.4,
  },
  tee: {
    vb: T,
    d: 'M32 10L42 6Q50 14 58 6L68 10L90 24Q93 26 92 29L84 44Q83 46 80 45L74 41L74 112Q74 115 71 115L29 115Q26 115 26 112L26 41L20 45Q17 46 16 44L8 29Q7 26 10 24Z',
    l: 'M42 6Q50 17 58 6M17 40L21 33M83 40L79 33M26 108L74 108',
  },
  knit: {
    vb: T,
    d: 'M32 10L42 6Q50 14 58 6L68 10L84 18Q90 22 90 30L95 94Q95 98 91 98L85 98Q82 98 82 94L75 46L75 108Q75 112 71 112L29 112Q25 112 25 108L25 46L18 94Q18 98 15 98L9 98Q5 98 5 94L10 30Q10 22 16 18Z',
    l: 'M42 6Q50 16 58 6M25 102L75 102M32 103L32 111M40 103L40 111M48 103L48 111M56 103L56 111M64 103L64 111M7 88L18 88M82 88L93 88M40 34L40 96M50 30L50 96M60 34L60 96',
  },
  dress: {
    vb: T,
    d: 'M38 6Q40 4 41 6L44 22Q50 26 56 22L59 6Q60 4 62 6L66 28Q67 36 62 44L80 110Q81 116 75 116L25 116Q19 116 20 110L38 44Q33 36 34 28Z',
    l: 'M37 44Q50 48 63 44M44 22Q50 26 56 22M50 50L46 112',
  },
  skirt: {
    vb: T,
    d: 'M32 20L68 20L84 104Q85 108 80 108L20 108Q15 108 16 104Z',
    l: 'M32 28L68 28M42 28L36 106M58 28L64 106',
  },
  pants: {
    vb: T,
    d: 'M27 6L73 6L78 112Q78 115 75 115L57 115Q54 115 54 112L50 42L46 112Q46 115 43 115L25 115Q22 115 22 112Z',
    l: 'M27 14L73 14M50 14L50 40M30 14Q34 26 44 24M70 14Q66 26 56 24',
  },
  widepants: {
    vb: T,
    d: 'M26 6L74 6L86 112Q86 115 83 115L57 115Q54 115 54 112L50 40L46 112Q46 115 43 115L17 115Q14 115 14 112Z',
    l: 'M26 14L74 14M50 14L50 38M38 14L34 112M62 14L66 112',
  },
  leggings: {
    vb: T,
    d: 'M31 6L69 6L70 112Q70 115 67 115L56 115Q53 115 53 112L50 46L47 112Q47 115 44 115L33 115Q30 115 30 112Z',
    l: 'M31 16L69 16M50 16L50 44',
  },
  socks: {
    vb: T,
    d: 'M38 8L62 8L62 68Q62 76 68 80L86 92Q94 98 90 106Q86 113 76 109L44 92Q36 87 36 78L38 8Z',
    l: 'M38 22L62 22M38 26L62 26M64 84Q72 92 68 102M82 92Q88 100 82 108',
  },
  sneaker: {
    vb: S,
    d: 'M10 54Q10 42 20 40L42 36Q48 28 58 30L68 38Q76 44 88 46Q110 50 112 62L112 64L10 64Z',
    d2: 'M8 64L114 64Q114 72 106 72L14 72Q8 72 8 66Z',
    f2: '#E6E1D7',
    l: 'M46 36L54 44M52 32L60 40M58 30L64 36M20 54Q58 56 88 46',
  },
  boot: {
    vb: S,
    d: 'M30 6L62 6Q64 6 64 8L64 46Q66 50 72 52Q100 58 106 66L106 68L28 68L28 8Q28 6 30 6Z',
    d2: 'M26 68L108 68Q108 76 100 76L30 76Q26 76 26 72Z',
    f2: '#2B2521',
    l: 'M40 8Q44 28 40 48M56 8Q52 28 56 48M31 6L31 1L37 1',
  },
  loafer: {
    vb: S,
    d: 'M10 56Q10 46 20 44Q40 40 56 44Q80 48 98 52Q112 55 112 62L112 64L10 64Z',
    d2: 'M8 64L114 64Q114 71 106 71L14 71Q8 71 8 66Z',
    f2: '#2B2521',
    l: 'M52 46Q68 43 80 50M58 50L74 52',
  },
  tote: {
    vb: A,
    d: 'M18 40L82 40Q86 40 86 44L90 100Q90 104 86 104L14 104Q10 104 10 100L14 44Q14 40 18 40Z',
    l: 'M32 40Q32 14 50 14Q68 14 68 40M38 40Q38 22 50 22Q62 22 62 40M12 56L88 56',
    strokeHandles: true,
  },
  crossbody: {
    vb: A,
    d: 'M20 56Q20 48 28 48L72 48Q80 48 80 56L80 92Q80 98 74 98L26 98Q20 98 20 92Z',
    l: 'M22 52Q50 -4 78 52M20 66Q50 80 80 66M47 70L53 70L53 77L47 77Z',
    strokeHandles: true,
  },
  belt: {
    vb: A,
    d: 'M50 20A34 34 0 1 1 49.9 20ZM50 33A21 21 0 1 0 50.1 33Z',
    l: 'M42 14L58 14L58 27L42 27ZM50 14L50 22',
    buckle: true,
  },
  scarf: {
    vb: A,
    d: 'M28 12Q50 4 72 12L74 28Q50 20 26 28ZM40 28L56 28L62 98L44 98ZM57 28L66 28L82 88L70 93Z',
    l: 'M46 98L46 106M50 98L50 106M54 98L54 106M58 98L58 106M72 93L74 101M76 91L78 99M80 89L82 97M41 44L57 44M43 64L59 64M44 82L60 82',
  },
  hat: {
    vb: A,
    d: 'M28 56Q28 28 50 28Q72 28 72 56ZM10 62Q12 56 28 56L72 56Q88 56 90 62Q92 70 80 70L20 70Q8 70 10 62Z',
    l: 'M28 50L72 50M36 38Q50 34 64 38',
  },
  necklace: { vb: A, d: 'M45 74Q50 66 55 74L55 82Q50 90 45 82Z', l: 'M20 14Q24 64 50 70Q76 64 80 14', chain: true },
};

// ------------------------------------------------------------------ colour --
const rgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const toHex = (c) =>
  `#${c
    .map((v) =>
      Math.round(Math.max(0, Math.min(255, v)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
const lum = (hex) => {
  const [r, g, b] = rgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b;
};
/** Detail-line colour: lighter on dark fabrics, darker on light ones. */
const detail = (hex) => {
  const c = rgb(hex);
  const dark = lum(hex) < 90;
  const t = dark ? 255 : 0;
  const a = dark ? 0.3 : 0.26;
  return toHex(c.map((v) => v + (t - v) * a));
};
const shade = (hex, amount) => toHex(rgb(hex).map((v) => v * (1 - amount)));

// ------------------------------------------------------------------- render --
function garmentSvg(shapeName, colorNames) {
  const s = SHAPES[shapeName];
  if (!s) throw new Error(`Unknown shape "${shapeName}"`);
  const fill = hexOf(colorNames[0]);
  const second = colorNames[1] ? hexOf(colorNames[1]) : null;
  const [x, y, w, h] = s.vb;
  const pad = Math.max(w, h) * 0.06;
  const vb = [x - pad, y - pad, w + pad * 2, h + pad * 2];
  const line = detail(fill);
  const sole = second && shapeName === 'sneaker' ? second : s.f2;
  const strokeWidth = s.vb === S ? 1.3 : 1.1;

  const buttons = (s.buttons ?? [])
    .map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="${s.buttonR ?? 2}" fill="${second ?? shade(fill, 0.35)}"/>`)
    .join('');
  const chain = s.chain
    ? `<path d="${s.l}" fill="none" stroke="${fill}" stroke-width="1.6" stroke-linecap="round"/>`
    : '';
  const buckle = s.buckle
    ? `<rect x="42" y="14" width="16" height="13" rx="2" fill="none" stroke="#C9A03B" stroke-width="2.2"/>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.join(' ')}">
  <defs>
    <linearGradient id="shade" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.24"/>
      <stop offset="0.5" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.2"/>
    </linearGradient>
    <filter id="grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="2" seed="7"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="table" tableValues="0 0.12"/></feComponentTransfer>
    </filter>
    <clipPath id="clip"><path d="${s.d}" fill-rule="evenodd"/></clipPath>
  </defs>
  <path d="${s.d}" fill="${fill}" fill-rule="evenodd"/>
  ${s.d2 ? `<path d="${s.d2}" fill="${sole}"/>` : ''}
  <path d="${s.d}" fill="url(#shade)" fill-rule="evenodd"/>
  <rect x="${vb[0]}" y="${vb[1]}" width="${vb[2]}" height="${vb[3]}" filter="url(#grain)" clip-path="url(#clip)"/>
  ${s.chain ? chain : `<path d="${s.l}" fill="none" stroke="${line}" stroke-width="${s.strokeHandles ? 1.8 : strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>`}
  ${buttons}${buckle}
</svg>`;
}

/** Rasterise at high density, then fit inside maxSide × maxSide. */
function raster(svg, maxSide) {
  return sharp(Buffer.from(svg), { density: 1000 }).resize({
    width: maxSide,
    height: maxSide,
    fit: 'inside',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });
}
const toWebp = (svg, maxSide) => raster(svg, maxSide).webp({ quality: 88, alphaQuality: 95, effort: 6 }).toBuffer();

// ---------------------------------------------------------- original photos --
// A stand-in for the photo the cutout was made from: the garment hung on a
// wall hook by a door (shoes stand on the floor), as on the back of the flip
// in docs/design/ItemDetail.dc.html. 5:6, like the detail stage.
const PHOTO_W = 750;
const PHOTO_H = 900;
const WALLS = ['#9A9184', '#A39A8C', '#8E8A82', '#A69F92', '#958B7E'];
const HOOK = { x: 318, y: 118 };
const FLOOR_Y = 752;
const slugHash = (slug) => Math.abs([...slug].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7));
const lighten = (hex, amount) => toHex(rgb(hex).map((v) => v + (255 - v) * amount));

/** The garment SVG placed in a box of the photo. */
function placed(garment, x, y, width, height) {
  return garment.replace(
    '<svg xmlns="http://www.w3.org/2000/svg" ',
    `<svg x="${x}" y="${y}" width="${width}" height="${height}" `,
  );
}

function photoSvg(g) {
  const s = SHAPES[g.shape];
  const h = slugHash(g.slug);
  const wall = WALLS[h % WALLS.length];
  const door = lighten(wall, 0.1);
  const garment = garmentSvg(g.shape, g.colors);
  const tilt = (h % 7) - 3;
  const onFloor = s.vb === S;
  const accessory = s.vb === A;

  let subject;
  if (onFloor) {
    const w = 450;
    const hgt = w / 1.424;
    subject = `<g filter="url(#drop)">${placed(garment, 120 + (h % 40), 850 - hgt, w, hgt)}</g>`;
  } else {
    const w = accessory ? 330 : 430;
    const hgt = accessory ? w * 1.1 : w * 1.175;
    // Bags and jewellery hang by their handle or chain, right on the hook.
    const top = accessory ? HOOK.y - 50 : HOOK.y + 44;
    const hanger = accessory
      ? ''
      : `<path d="M${HOOK.x} ${HOOK.y + 8} L${HOOK.x} ${HOOK.y + 26} M${HOOK.x} ${HOOK.y + 26} L${HOOK.x - 118} ${HOOK.y + 78} L${HOOK.x + 118} ${HOOK.y + 78} Z" fill="none" stroke="#3B342D" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"/>`;
    subject = `<g transform="rotate(${tilt} ${HOOK.x} ${HOOK.y})" filter="url(#drop)">${hanger}${placed(garment, HOOK.x - w / 2, top, w, hgt)}</g>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PHOTO_W}" height="${PHOTO_H}" viewBox="0 0 ${PHOTO_W} ${PHOTO_H}">
  <defs>
    <filter id="drop" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="12" dy="18" stdDeviation="12" flood-color="#000000" flood-opacity="0.3"/>
    </filter>
    <linearGradient id="light" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.16"/>
      <stop offset="0.6" stop-color="#FFFFFF" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="vignette" cx="0.45" cy="0.42" r="0.8">
      <stop offset="0.55" stop-color="#000000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.32"/>
    </radialGradient>
  </defs>
  <rect width="${PHOTO_W}" height="${PHOTO_H}" fill="${wall}"/>
  <rect x="452" y="-20" width="262" height="${FLOOR_Y + 20}" rx="6" fill="${door}"/>
  <rect x="478" y="26" width="210" height="300" rx="5" fill="none" stroke="${lighten(wall, 0.2)}" stroke-width="5"/>
  <rect x="478" y="360" width="210" height="350" rx="5" fill="none" stroke="${lighten(wall, 0.2)}" stroke-width="5"/>
  <circle cx="476" cy="420" r="10" fill="${shade(wall, 0.42)}"/>
  <rect y="${FLOOR_Y - 14}" width="${PHOTO_W}" height="16" fill="${shade(wall, 0.14)}"/>
  <rect y="${FLOOR_Y}" width="${PHOTO_W}" height="${PHOTO_H - FLOOR_Y}" fill="${shade(wall, 0.3)}"/>
  <circle cx="${HOOK.x}" cy="${HOOK.y}" r="12" fill="${shade(wall, 0.5)}"/>
  ${subject}
  <rect width="${PHOTO_W}" height="${PHOTO_H}" fill="url(#light)"/>
  <rect width="${PHOTO_W}" height="${PHOTO_H}" fill="url(#vignette)"/>
</svg>`;
}

const toPhoto = (svg) => sharp(Buffer.from(svg)).jpeg({ quality: 74, mozjpeg: true }).toBuffer();
const toPng = (svg, size) => raster(svg, size).png({ compressionLevel: 9 }).toBuffer();

// ------------------------------------------------------------ demo garments --
const data = JSON.parse(readFileSync(join(root, 'src/db/seed/garments.json'), 'utf8'));
const entries = [...data.garments, ...data.wishlist];
const outDir = join(root, 'assets/seed');
rmSync(outDir, { recursive: true, force: true });
mkdirSync(join(outDir, 'thumbs'), { recursive: true });
mkdirSync(join(outDir, 'originals'), { recursive: true });

const owned = new Set(data.garments.map((g) => g.slug));
for (const g of entries) {
  const svg = garmentSvg(g.shape, g.colors);
  writeFileSync(join(outDir, `${g.slug}.webp`), await toWebp(svg, FULL));
  writeFileSync(join(outDir, 'thumbs', `${g.slug}.webp`), await toWebp(svg, THUMB));
  // Wishlist entries were never photographed: no original.
  if (owned.has(g.slug)) writeFileSync(join(outDir, 'originals', `${g.slug}.jpg`), await toPhoto(photoSvg(g)));
}

const manifest = `// Generated by scripts/generate-assets.mjs — do not edit by hand.
/* eslint-disable */

/** Bundled placeholder images for the demo wardrobe, keyed by slug. */
export const SEED_IMAGES: Record<string, { cutout: number; thumb: number; original?: number }> = {
${entries
  .map((g) =>
    [
      `  '${g.slug}': {`,
      `    cutout: require('../../../assets/seed/${g.slug}.webp'),`,
      `    thumb: require('../../../assets/seed/thumbs/${g.slug}.webp'),`,
      owned.has(g.slug) ? `    original: require('../../../assets/seed/originals/${g.slug}.jpg'),` : null,
      `  },`,
    ]
      .filter(Boolean)
      .join('\n'),
  )
  .join('\n')}
};
`;
writeFileSync(join(root, 'src/db/seed/assets.ts'), manifest);

// ------------------------------------------------------------- app artwork --
const HANGER =
  'M30 14L30 11Q30 9 32 8.2Q35 7 35 4.5Q35 1.5 32 1.5Q29.5 1.5 29 4M30 14L5 26.5Q3 28 5.5 28.5L54.5 28.5Q57 28 55 26.5Z';
const coat = SHAPES.coat;

/** Hanger + camel coat composition on a 100×100 artboard. */
function mark({ hangerColor, coatFill = hexOf('Camel'), withCoat = true, mono = false }) {
  const coatColor = mono ? '#FFFFFF' : coatFill;
  return `
  <g transform="translate(28 14) scale(0.7333)">
    <path d="${HANGER}" fill="none" stroke="${hangerColor}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
  ${
    withCoat
      ? `<g transform="translate(26.5 31) scale(0.47)">
    <path d="${coat.d}" fill="${coatColor}"/>
    ${mono ? '' : `<path d="${coat.d}" fill="url(#shade)"/><path d="${coat.l}" fill="none" stroke="${detail(coatFill)}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>`}
  </g>`
      : ''
  }`;
}

const defs = `<defs><linearGradient id="shade" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.24"/><stop offset="0.5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.2"/></linearGradient></defs>`;
const art = (body, bg) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${defs}${bg ? `<rect width="100" height="100" fill="${bg}"/>` : ''}${body}</svg>`;

const img = join(root, 'assets/images');
mkdirSync(img, { recursive: true });
// iOS / default icon: opaque cream with a soft rail line.
writeFileSync(
  join(img, 'icon.png'),
  await toPng(
    art(
      `<rect x="0" y="23" width="100" height="1.6" fill="#B9AE9F" opacity="0.7"/>${mark({ hangerColor: '#1C1A17' })}`,
      '#F7F3EE',
    ),
    1024,
  ),
);
// Android adaptive icon layers (foreground must sit inside the 66% safe zone).
writeFileSync(
  join(img, 'android-icon-foreground.png'),
  await toPng(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-25 -25 150 150">${defs}${mark({ hangerColor: '#1C1A17' })}</svg>`,
    1024,
  ),
);
writeFileSync(join(img, 'android-icon-background.png'), await toPng(art('', '#F7F3EE'), 1024));
writeFileSync(
  join(img, 'android-icon-monochrome.png'),
  await toPng(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-25 -25 150 150">${mark({ hangerColor: '#FFFFFF', mono: true })}</svg>`,
    1024,
  ),
);
// Splash marks (transparent; background colour comes from app.json).
writeFileSync(join(img, 'splash-icon.png'), await toPng(art(mark({ hangerColor: '#1C1A17' })), 600));
writeFileSync(
  join(img, 'splash-icon-dark.png'),
  await toPng(art(mark({ hangerColor: '#F3EEE8', coatFill: '#C99A6B' })), 600),
);

console.log(`Rendered ${entries.length} garments (+ thumbs) and app artwork.`);
