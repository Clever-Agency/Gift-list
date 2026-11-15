import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { PRODUCT_NAME } from "../packages/contracts/src/brand.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = path.join(root, "scripts/generate-brand-icons.mjs");
const sourceDir = path.join(root, "assets/brand/source");
const generatedDir = path.join(root, "assets/brand/generated");

/** `name -> sha256` for everything the generator writes; a re-run must reproduce it. */
function generatedHashes() {
  const hashes = new Map();
  for (const name of readdirSync(generatedDir).sort()) {
    hashes.set(name, createHash("sha256").update(readFileSync(path.join(generatedDir, name))).digest("hex"));
  }
  return hashes;
}

async function pngSize(file) {
  const metadata = await sharp(file).metadata();
  return { width: metadata.width, height: metadata.height, channels: metadata.channels };
}

/** Directory entries of an ICO: size and the PNG payload of every image. */
function readIco(file) {
  const ico = readFileSync(file);
  assert.equal(ico.readUInt16LE(0), 0, "ICO reserved field");
  assert.equal(ico.readUInt16LE(2), 1, "ICO type");
  const count = ico.readUInt16LE(4);
  const images = [];
  for (let index = 0; index < count; index += 1) {
    const entry = 6 + index * 16;
    const size = ico.readUInt8(entry) || 256;
    assert.equal(ico.readUInt16LE(entry + 4), 1, "ICO colour planes");
    assert.equal(ico.readUInt16LE(entry + 6), 32, "ICO bits per pixel");
    const length = ico.readUInt32LE(entry + 8);
    const offset = ico.readUInt32LE(entry + 12);
    const data = ico.subarray(offset, offset + length);
    assert.equal(data.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", "ICO payload is a PNG");
    images.push({ size, data });
  }
  return images;
}

describe("generate-brand-icons", () => {
  it("держит исходные SVG с белым фоном 1024×1024", () => {
    const master = readFileSync(path.join(sourceDir, "wishmoon-mark.svg"), "utf8");
    const simple = readFileSync(path.join(sourceDir, "wishmoon-mark-16.svg"), "utf8");
    for (const [name, svg] of [
      ["wishmoon-mark.svg", master],
      ["wishmoon-mark-16.svg", simple],
    ]) {
      assert.match(svg, /<svg[^>]*viewBox="0 0 1024 1024"/, `${name} viewBox`);
      assert.match(svg, /width="1024"/, `${name} width`);
      assert.match(svg, /height="1024"/, `${name} height`);
      assert.match(svg, /rgb\(254,254,254\)/, `${name} white background`);
    }
    assert.match(simple, /<rect width="1024" height="1024"/, "упрощённый знак — белый квадрат");
  });

  it("пишет растр нужных размеров", async () => {
    const expected = {
      "apple-touch-icon.png": 180,
      "icon-192.png": 192,
      "icon-512.png": 512,
      "icon-512-maskable.png": 512,
      "icon-1024.png": 1024,
      "favicon.png": 48,
      "adaptive-icon-foreground.png": 1024,
    };
    for (const [name, size] of Object.entries(expected)) {
      const image = await pngSize(path.join(generatedDir, name));
      assert.equal(image.width, size, `${name} width`);
      assert.equal(image.height, size, `${name} height`);
      assert.equal(image.channels, 3, `${name} без альфа-канала`);
    }
  });

  it("собирает favicon.ico из 16, 32 и 48 px", async () => {
    const images = readIco(path.join(generatedDir, "favicon.ico"));
    assert.deepEqual(
      images.map((image) => image.size),
      [16, 32, 48],
    );
    for (const image of images) {
      const decoded = await sharp(image.data).metadata();
      assert.equal(decoded.width, image.size);
      // Next.js decodes ICO entries only as RGBA; every pixel must still be opaque.
      assert.equal(decoded.channels, 4, `${image.size} px RGBA`);
      const { data, info } = await sharp(image.data).raw().toBuffer({ resolveWithObject: true });
      for (let at = 3; at < data.length; at += info.channels) {
        assert.equal(data[at], 255, `${image.size} px прозрачный пиксель`);
      }
    }
  });

  it("держит луну в безопасных зонах adaptive и maskable", async () => {
    const cases = [
      ["adaptive-icon-foreground.png", 1024, 0.66],
      ["icon-512-maskable.png", 512, 0.8],
    ];
    for (const [name, canvas, zone] of cases) {
      const { data, info } = await sharp(path.join(generatedDir, name))
        .raw()
        .toBuffer({ resolveWithObject: true });
      let minX = info.width;
      let maxX = -1;
      for (let y = 0; y < info.height; y += 1) {
        for (let x = 0; x < info.width; x += 1) {
          const at = (y * info.width + x) * info.channels;
          if (data[at] < 128) {
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
          }
        }
      }
      const fraction = (maxX - minX + 1) / canvas;
      assert.ok(fraction <= zone, `${name}: луна ${fraction.toFixed(3)} шире зоны ${zone}`);
      assert.ok(fraction > zone - 0.03, `${name}: луна ${fraction.toFixed(3)} сильно меньше зоны ${zone}`);
    }
  });

  it("пишет manifest с именем, цветами и иконками", () => {
    const manifest = JSON.parse(readFileSync(path.join(generatedDir, "site.webmanifest"), "utf8"));
    assert.equal(manifest.name, PRODUCT_NAME);
    assert.equal(manifest.theme_color, "#F4F1EA");
    assert.equal(manifest.background_color, "#F4F1EA");
    assert.deepEqual(
      manifest.icons.map((icon) => [icon.src, icon.sizes, icon.purpose]),
      [
        ["/icon-192.png", "192x192", "any"],
        ["/icon-512.png", "512x512", "any"],
        ["/icon-512-maskable.png", "512x512", "maskable"],
      ],
    );
  });

  it("копирует файлы в Expo, SPA и Next", () => {
    const copies = [
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
    for (const [generated, destination] of copies) {
      assert.equal(
        readFileSync(path.join(root, destination)).toString("base64"),
        readFileSync(path.join(generatedDir, generated)).toString("base64"),
        destination,
      );
    }
  });

  it("подключено в +html.tsx и app.config.ts", () => {
    const html = readFileSync(path.join(root, "apps/mobile/app/+html.tsx"), "utf8");
    for (const link of [
      '<link rel="icon" href="/favicon.ico" sizes="any" />',
      '<link rel="icon" type="image/svg+xml" href="/favicon.svg" />',
      '<link rel="apple-touch-icon" href="/apple-touch-icon.png" />',
      '<link rel="manifest" href="/site.webmanifest" />',
      '<meta name="theme-color" content="#F4F1EA" />',
    ]) {
      assert.ok(html.includes(link), link);
    }
    assert.ok(html.includes(`<html lang="ru">`), "lang");
    assert.ok(html.includes("<ScrollViewStyleReset />"), "ScrollViewStyleReset");

    const config = readFileSync(path.join(root, "apps/mobile/app.config.ts"), "utf8");
    for (const field of [
      'icon: "./assets/icon.png"',
      'foregroundImage: "./assets/adaptive-icon.png"',
      'backgroundColor: "#FFFFFF"',
      'favicon: "./assets/favicon.png"',
    ]) {
      assert.ok(config.includes(field), field);
    }
  });

  it("перезапуск воспроизводит те же файлы без сети", () => {
    const before = generatedHashes();
    const result = spawnSync(process.execPath, [script], { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(generatedHashes(), before);
    assert.ok(before.has("favicon.ico"));
    assert.ok(before.has("site.webmanifest"));
  });
});
