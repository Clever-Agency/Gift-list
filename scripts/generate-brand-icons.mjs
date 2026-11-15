#!/usr/bin/env node
/**
 * Builds every raster brand icon from the two source SVGs.
 *
 *   node scripts/generate-brand-icons.mjs
 *
 * The sources in `assets/brand/source` are the masters: the detailed mark and the
 * simplified 16 px mark (thick outline, three craters). Everything else — the ICO,
 * the PWA/Expo PNGs and the copies the apps consume — is derived here, so a re-run
 * is the only way to change them. `sharp` comes from the hoisted root
 * `node_modules` (an optional dependency of Next); the script adds no packages.
 *
 * Android adaptive and PWA maskable images shrink the whole mark until the moon
 * disc, not the canvas, fits the safe zone: the disc already has an 8.4 % white
 * margin, which Android would otherwise crop.
 */
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { PRODUCT_NAME } from "../packages/contracts/src/brand.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.join(repoRoot, "assets/brand/source");
const outDir = path.join(repoRoot, "assets/brand/generated");

const MASTER_SVG = path.join(sourceDir, "wishmoon-mark.svg");
const SIMPLE_SVG = path.join(sourceDir, "wishmoon-mark-16.svg");

/** Opaque icon background: the white of the source SVG, not the paper theme token. */
const ICON_WHITE = "#FEFEFE";

/**
 * Moon disc inside the 1024 viewBox: x 86.2..938.65, y 90.57..937.32. The disc is
 * 852.45/1024 wide, so the source already keeps an 8.4 % margin on every side.
 */
const MOON_DIAMETER = 852.45 / 1024;

/** Android adaptive foreground: the disc stays inside the central 66 % of the canvas. */
const ADAPTIVE_ZONE = 0.66;

/** Maskable icon: the disc stays inside the safe 80 % of the canvas. */
const MASKABLE_ZONE = 0.8;

/** Forest Paper `background` from `packages/ui/src/tokens.ts`; the manifest colour only. */
const PAPER = "#F4F1EA";

const png = { compressionLevel: 9, adaptiveFiltering: false };

/**
 * Rasterises an SVG at exactly `size` px by rewriting its `width`/`height`
 * attributes: libvips then draws the strokes at that size instead of shrinking a
 * 1024 px bitmap. The result is flattened onto opaque white, because SVG
 * antialiasing leaves semi-transparent pixels on the disc edge otherwise.
 *
 * `rgba` keeps an alpha channel filled with 255: Next's ICO decoder rejects
 * PNG-compressed icon entries without one.
 */
async function renderAt(svg, size, { rgba = false } = {}) {
  const sized = Buffer.from(
    svg.replace('width="1024"', `width="${size}"`).replace('height="1024"', `height="${size}"`),
  );
  const image = sharp(sized).flatten({ background: ICON_WHITE });
  return (rgba ? image.ensureAlpha() : image.removeAlpha()).png(png).toBuffer();
}

/** Renders the mark on a `canvas` square, with the moon disc inside `zone` of it. */
async function renderInZone(svg, canvas, zone) {
  const inner = Math.round((canvas * zone) / MOON_DIAMETER);
  const mark = await renderAt(svg, inner);
  const offset = Math.round((canvas - inner) / 2);
  return sharp({
    create: { width: canvas, height: canvas, channels: 3, background: ICON_WHITE },
  })
    .composite([{ input: mark, left: offset, top: offset }])
    .flatten({ background: ICON_WHITE })
    .removeAlpha()
    .png(png)
    .toBuffer();
}

/**
 * ICO with PNG-compressed images (Vista and newer; browsers, Windows and Expo all
 * read it). `sharp` cannot write ICO, and the container is a 6-byte header plus one
 * 16-byte directory entry per image, so it is built here without a dependency.
 */
function buildIco(images) {
  const headerSize = 6 + 16 * images.length;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 = icon
  header.writeUInt16LE(images.length, 4);
  let offset = headerSize;
  images.forEach(function writeEntry({ size, data }, index) {
    const at = 6 + 16 * index;
    header.writeUInt8(size >= 256 ? 0 : size, at); // 0 means 256
    header.writeUInt8(size >= 256 ? 0 : size, at + 1);
    header.writeUInt8(0, at + 2); // colours in palette
    header.writeUInt8(0, at + 3); // reserved
    header.writeUInt16LE(1, at + 4); // colour planes
    header.writeUInt16LE(32, at + 6); // bits per pixel
    header.writeUInt32LE(data.length, at + 8);
    header.writeUInt32LE(offset, at + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map((image) => image.data)]);
}

function webManifest() {
  return {
    name: PRODUCT_NAME,
    short_name: PRODUCT_NAME,
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: PAPER,
    theme_color: PAPER,
    lang: "ru",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

/** Where the generated files are copied: Expo app icons, Expo web root, Next app icons. */
const COPIES = [
  ["icon-1024.png", "apps/mobile/assets/icon.png"],
  ["adaptive-icon-foreground.png", "apps/mobile/assets/adaptive-icon.png"],
  ["favicon.png", "apps/mobile/assets/favicon.png"],
  ["favicon.ico", "apps/mobile/public/favicon.ico"],
  ["favicon.svg", "apps/mobile/public/favicon.svg"],
  ["apple-touch-icon.png", "apps/mobile/public/apple-touch-icon.png"],
  ["icon-192.png", "apps/mobile/public/icon-192.png"],
  ["icon-512.png", "apps/mobile/public/icon-512.png"],
  ["icon-512-maskable.png", "apps/mobile/public/icon-512-maskable.png"],
  ["site.webmanifest", "apps/mobile/public/site.webmanifest"],
  ["favicon.ico", "apps/web/src/app/favicon.ico"],
  ["icon-192.png", "apps/web/src/app/icon.png"],
  ["apple-touch-icon.png", "apps/web/src/app/apple-icon.png"],
];

async function main() {
  const master = await readFile(MASTER_SVG, "utf8");
  const simple = await readFile(SIMPLE_SVG, "utf8");

  await mkdir(outDir, { recursive: true });

  const files = new Map();
  files.set("favicon.svg", Buffer.from(master));
  files.set("apple-touch-icon.png", await renderAt(master, 180));
  files.set("icon-192.png", await renderAt(master, 192));
  files.set("icon-512.png", await renderAt(master, 512));
  files.set("icon-1024.png", await renderAt(master, 1024));
  files.set("favicon.png", await renderAt(master, 48));
  files.set("icon-512-maskable.png", await renderInZone(master, 512, MASKABLE_ZONE));
  files.set("adaptive-icon-foreground.png", await renderInZone(master, 1024, ADAPTIVE_ZONE));
  files.set(
    "favicon.ico",
    buildIco([
      // Only 16 px uses the simplified mark; 32 and 48 keep the detailed one.
      { size: 16, data: await renderAt(simple, 16, { rgba: true }) },
      { size: 32, data: await renderAt(master, 32, { rgba: true }) },
      { size: 48, data: await renderAt(master, 48, { rgba: true }) },
    ]),
  );
  files.set("site.webmanifest", Buffer.from(`${JSON.stringify(webManifest(), null, 2)}\n`));

  for (const [name, data] of files) {
    await writeFile(path.join(outDir, name), data);
  }

  for (const [name, destination] of COPIES) {
    const target = path.join(repoRoot, destination);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(path.join(outDir, name), target);
  }

  console.log(`brand icons: ${files.size} files in assets/brand/generated, ${COPIES.length} copies`);
}

await main();
