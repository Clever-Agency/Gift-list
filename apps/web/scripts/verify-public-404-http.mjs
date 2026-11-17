/**
 * CLE-103 followup — live HTTP check of the public 404 document of `/l` and `/i`.
 *
 * What it proves (no database, no `.env*`, no shared services):
 * - a malformed public token is answered with a real `404`, not `200`;
 * - the 404 document carries `<meta name="robots" content="noindex">`;
 * - its `<head>` carries the closed not-found title and description
 *   (`Список не найден — WishMoon` / `Приглашение не найдено — WishMoon`), so
 *   crawlers and link previews read the right document instead of the brand-only
 *   `<title>WishMoon</title>` the root layout used to leak here.
 *
 * Why a malformed token: `isPublicTokenSegment()` closes the answer before the
 * session and the database, so the check runs without PostgreSQL. A well-formed
 * unknown token would need a live database (see `link-page.ts`).
 *
 * `DATABASE_URL` deliberately points at a closed loopback port: if the route ever
 * started to read the database on this path, the check would fail loudly instead
 * of silently needing one.
 *
 * Known framework limitation (documented in the CLE-103 followup report): Next
 * 16.4.3 answers a real 404 with its not-found recovery document, so the shared
 * sentence and the footer are rendered into the RSC payload and appear after
 * hydration, not in the HTML body. This script asserts the head, the status and
 * `noindex`, and prints the body limitation as a note rather than a failure.
 *
 * Preconditions: `npm run build` (the standalone server and its assets).
 * Run: node apps/web/scripts/verify-public-404-http.mjs
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const monorepoRoot = resolve(webRoot, "../..");
const serverEntry = resolve(webRoot, ".next/standalone/apps/web/server.js");
const HOST = "127.0.0.1";
const MALFORMED_TOKEN = "a".repeat(129); // over PUBLIC_TOKEN_MAX_LENGTH (128)

const CASES = [
  {
    path: `/l/${MALFORMED_TOKEN}`,
    title: "Список не найден — WishMoon",
  },
  {
    path: `/i/${MALFORMED_TOKEN}`,
    title: "Приглашение не найдено — WishMoon",
  },
];

function fail(message) {
  console.error(`✗ ${message}`);
  process.exitCode = 1;
}

function freePort() {
  return new Promise(function start(accept, reject) {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, HOST, function onListen() {
      const address = probe.address();
      const port = typeof address === "object" && address !== null ? address.port : 0;
      probe.close(function onClose() {
        accept(port);
      });
    });
  });
}

async function waitForServer(baseUrl, child) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`сервер завершился с кодом ${child.exitCode}`);
    try {
      const response = await fetch(`${baseUrl}/404`);
      if (response.status > 0) return;
    } catch {
      // not listening yet
    }
    await new Promise(function delay(done) {
      setTimeout(done, 250);
    });
  }
  throw new Error("сервер не начал отвечать за 15 с");
}

function checkHtml({ path, title }, html) {
  if (!html.includes(`<title>${title}</title>`)) {
    fail(`${path}: в <head> нет <title>${title}</title>`);
  }
  if (!html.includes('name="robots" content="noindex"')) {
    fail(`${path}: нет <meta name="robots" content="noindex">`);
  }
  if (!/<meta name="description" content="[^"]+"/.test(html)) {
    fail(`${path}: нет <meta name="description">`);
  }
  const body = /<body[^>]*>([\s\S]*?)<\/body>/.exec(html)?.[1] ?? "";
  const visible = body
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  console.log(`  body: ${visible.length === 0 ? "пусто (RSC-payload, см. отчёт)" : visible.slice(0, 80)}`);
}

async function main() {
  if (!existsSync(serverEntry)) {
    fail(`нет ${serverEntry}: сначала npm run build`);
    return;
  }

  const port = await freePort();
  const baseUrl = `http://${HOST}:${port}`;
  const child = spawn(process.execPath, [serverEntry], {
    cwd: monorepoRoot,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      PATH: process.env.PATH,
      NODE_ENV: "production",
      PORT: String(port),
      HOSTNAME: HOST,
      NEXT_TELEMETRY_DISABLED: "1",
      // Closed loopback port: this path must never need a database.
      DATABASE_URL: "postgresql://unused:unused@127.0.0.1:1/unused",
      BETTER_AUTH_SECRET: "public-404-check-secret-0123456789ab",
      BETTER_AUTH_URL: baseUrl,
    },
  });

  let serverLog = "";
  child.stdout.on("data", function onStdout(chunk) {
    serverLog += String(chunk);
  });
  child.stderr.on("data", function onStderr(chunk) {
    serverLog += String(chunk);
  });

  try {
    await waitForServer(baseUrl, child);

    for (const testCase of CASES) {
      const response = await fetch(`${baseUrl}${testCase.path}`, {
        headers: { "accept-language": "ru-RU,ru;q=0.9" },
        redirect: "manual",
      });
      const html = await response.text();
      console.log(`${testCase.path.slice(0, 2)}: ${response.status}`);
      if (response.status !== 404) fail(`${testCase.path}: статус ${response.status}, ожидался 404`);
      checkHtml(testCase, html);
    }
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
    if (serverLog.trim().length > 0) console.error(serverLog.trim());
  } finally {
    child.kill();
    await new Promise(function waitExit(done) {
      child.once("exit", done);
      setTimeout(done, 5000);
    });
  }

  if (process.exitCode === 1) {
    console.error("✗ публичный 404 не соответствует ожиданиям");
    return;
  }
  console.log("✓ /l и /i: 404, noindex, закрытый <title> и description в серверном HTML");
}

await main();
