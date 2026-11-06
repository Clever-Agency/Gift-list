/**
 * Story 4.2.4 — live HTTP acceptance for accepting/rejecting a friendship invite.
 *
 * This is NOT a unit or mock test. It starts the built standalone Next.js server
 * as its own child process on its own loopback port, points it only at the
 * disposable PostgreSQL named by `DISPOSABLE_*`, and drives the real `/api/v1`
 * routes with cookie sessions minted by `POST /api/v1/register`.
 *
 * Safety:
 * - the target is first accepted by the same `resolveDisposableTarget()` gate as
 *   the F5 / friendship harness (loopback, dynamic port, `gift_f5_*` name and
 *   explicit confirmation);
 * - the run refuses a database that already has a `"User"` table, so it cannot
 *   touch an app database by accident;
 * - the server and Prisma CLI receive only process-local synthetic
 *   `DATABASE_URL`/`DIRECT_URL`, a synthetic Better Auth secret and an empty
 *   `DOTENV_CONFIG_PATH`; inherited database/auth credentials are removed first;
 * - the standalone directory has no `.env*` files (the build removes them) and
 *   `server.js` changes its working directory to it;
 * - nothing reads `apps/web/.env*`, a live/shared database or a remote service.
 *
 * Preconditions:
 *   npm run build
 *   a new, empty, disposable PostgreSQL on a loopback dynamic port
 *   DISPOSABLE_DATABASE_URL / DISPOSABLE_DIRECT_URL / DISPOSABLE_PG_CONFIRM
 *
 * Run:
 *   npm run verify:friendship-42-http -w @gift-list/web
 *
 * The script writes a Russian-readable evidence file under
 * `_bmad-output/implementation-artifacts/opencode-microtasks/` and exits non-zero
 * if any check fails. It does not create the Docker container; the operator does.
 */

import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import {
  describeDisposableTarget,
  DisposablePgRefusal,
  resolveDisposableTarget,
} from "../src/db/disposable-pg/guard.ts";

const WEB_DIR = fileURLToPath(new URL("../", import.meta.url));
const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const SERVER_JS = join(WEB_DIR, ".next", "standalone", "apps", "web", "server.js");
const PRISMA_CLI = join(REPO_ROOT, "node_modules", "prisma", "build", "index.js");
const EVIDENCE_DIR = join(
  REPO_ROOT,
  "_bmad-output",
  "implementation-artifacts",
  "opencode-microtasks",
);
const PASSWORD = `synthetic-${randomUUID()}`;
const AUTH_SECRET = `${randomUUID()}${randomUUID()}`;

let target;
let database;
let server;
let serverLog = "";
let serverLogStream;
let serverVersion = "";
let baseUrl = "";
let tempDir = "";
let passed = 0;
let failed = 0;
let setupError = null;
const evidence = [];

function record(line) {
  evidence.push(`- ${line}`);
}

function describeError(error) {
  if (error instanceof Error) return error.message;
  return String(error);
}

function check(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
    record(`PASS — ${name}${detail ? `: ${detail}` : ""}`);
  } else {
    failed += 1;
    console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
    record(`FAIL — ${name}${detail ? `: ${detail}` : ""}`);
  }
}

function checkEqual(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  check(name, ok, `actual=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`);
}

function checkIncludes(name, actual, expected) {
  const ok = Array.isArray(actual) && expected.every((item) => actual.includes(item));
  check(name, ok, `actual=${JSON.stringify(actual)} expected includes=${JSON.stringify(expected)}`);
}

function checkExcludes(name, actual, forbidden) {
  const ok = Array.isArray(actual) && forbidden.every((item) => !actual.includes(item));
  check(name, ok, `actual=${JSON.stringify(actual)} forbidden=${JSON.stringify(forbidden)}`);
}

function resolveTargetOrExit() {
  try {
    return resolveDisposableTarget();
  } catch (error) {
    if (error instanceof DisposablePgRefusal) {
      console.error(`\n${error.message}\n`);
      console.error(
        "Set DISPOSABLE_DATABASE_URL, DISPOSABLE_DIRECT_URL and DISPOSABLE_PG_CONFIRM " +
          "for a new, empty, loopback database. This harness never reads apps/web/.env.",
      );
    }
    throw error;
  }
}

function childEnv(extra) {
  const env = { ...process.env };
  delete env.DATABASE_URL;
  delete env.DIRECT_URL;
  delete env.BETTER_AUTH_SECRET;
  delete env.BETTER_AUTH_URL;
  delete env.EMAIL_FROM;
  delete env.RESEND_API_KEY;
  delete env.DISPOSABLE_DATABASE_URL;
  delete env.DISPOSABLE_DIRECT_URL;
  delete env.DISPOSABLE_PG_CONFIRM;
  return {
    ...env,
    DATABASE_URL: target.databaseUrl,
    DIRECT_URL: target.directUrl,
    DOTENV_CONFIG_PATH: join(tempDir, "empty.env"),
    ...extra,
  };
}

function runPrisma(args) {
  const result = spawnSync(process.execPath, [PRISMA_CLI, ...args], {
    cwd: WEB_DIR,
    env: childEnv({ PRISMA_HIDE_UPDATE_MESSAGE: "1" }),
    encoding: "utf8",
    timeout: 240_000,
    windowsHide: true,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  if (result.status !== 0) {
    throw new Error(`prisma ${args.join(" ")} exited with ${String(result.status)}\n${output}`);
  }
  record(`prisma ${args.join(" ")}: exit 0`);
  return output;
}

function freePort() {
  return new Promise(function reservePort(resolve, reject) {
    const probe = createServer();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", function onListening() {
      const address = probe.address();
      const port = typeof address === "object" && address !== null ? address.port : 0;
      probe.close(function onClosed() {
        resolve(port);
      });
    });
  });
}

function delay(milliseconds) {
  return new Promise(function resolveAfterDelay(resolve) {
    setTimeout(resolve, milliseconds);
  });
}

function serverLogTail() {
  try {
    return readFileSync(serverLog, "utf8").slice(-4_000);
  } catch {
    return "<server log not readable>";
  }
}

async function waitForServer(child, port) {
  const url = `http://127.0.0.1:${port}/api/v1/me`;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`standalone server exited early with ${String(child.exitCode)}\n${serverLogTail()}`);
    }
    try {
      const response = await fetch(url, {
        headers: { "x-forwarded-for": "127.0.0.1" },
        signal: AbortSignal.timeout(2_000),
      });
      if (response.status === 401) return;
    } catch {
      // Not listening yet.
    }
    await delay(250);
  }
  throw new Error(`standalone server did not answer on 127.0.0.1:${port}\n${serverLogTail()}`);
}

async function startServer() {
  if (!existsSync(SERVER_JS)) {
    throw new Error(
      `missing ${SERVER_JS}; run "npm run build" before the live HTTP acceptance`,
    );
  }
  const port = await freePort();
  const logDir = mkdtempSync(join(tmpdir(), "gift-list-424-http-"));
  const logPath = join(logDir, "server.log");
  const logStream = createWriteStream(logPath, { flags: "a" });
  const child = spawn(process.execPath, [SERVER_JS], {
    cwd: join(WEB_DIR, ".next", "standalone", "apps", "web"),
    env: childEnv({
      BETTER_AUTH_SECRET: AUTH_SECRET,
      BETTER_AUTH_URL: `http://127.0.0.1:${port}`,
      HOSTNAME: "127.0.0.1",
      PORT: String(port),
      AUTH_RATE_LIMIT_MAX: "1000",
      AUTH_RATE_LIMIT_WINDOW_SECONDS: "3600",
      NEXT_TELEMETRY_DISABLED: "1",
    }),
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  child.stdout.pipe(logStream);
  child.stderr.pipe(logStream);
  serverLogStream = logStream;
  server = child;
  serverLog = logPath;
  baseUrl = `http://127.0.0.1:${port}`;
  await waitForServer(child, port);
  record(`standalone server: ${SERVER_JS} on ${baseUrl} (own process, real HTTP)`);
  record(`server log kept outside the repository: ${logPath}`);
}

async function stopServer() {
  const child = server;
  server = null;
  if (child && child.exitCode === null) {
    child.kill();
    for (let attempt = 0; attempt < 40; attempt += 1) {
      if (child.exitCode !== null) break;
      await delay(100);
    }
    if (child.exitCode === null) {
      spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
      });
    }
  }
  if (serverLogStream) {
    serverLogStream.end();
    serverLogStream = undefined;
  }
}

async function request(path, options = {}) {
  const headers = {
    accept: "application/json",
    "x-forwarded-for": "127.0.0.1",
    ...(options.headers ?? {}),
  };
  if (options.user) headers.cookie = options.user.cookie;
  if (options.body !== undefined) headers["content-type"] = "application/json";
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    redirect: "manual",
  });
  const text = await response.text();
  let json = null;
  try {
    json = text === "" ? null : JSON.parse(text);
  } catch {
    // A non-JSON body is a failure detail, not a crash.
  }
  return {
    status: response.status,
    cacheControl: response.headers.get("cache-control"),
    json,
    text,
  };
}

async function sql(text, values = []) {
  const result = await database.query(text, values);
  return result.rows;
}

function pairIds(first, second) {
  return first.id < second.id
    ? { low: first.id, high: second.id }
    : { low: second.id, high: first.id };
}

async function pairState(first, second) {
  const { low, high } = pairIds(first, second);
  const invites = await sql(
    `SELECT count(*)::int AS count FROM "FriendshipInvite"
      WHERE ("fromUserId" = $1 AND "toUserId" = $2)
         OR ("fromUserId" = $2 AND "toUserId" = $1)`,
    [first.id, second.id],
  );
  const friendships = await sql(
    `SELECT count(*)::int AS count FROM "Friendship"
      WHERE "userLowId" = $1 AND "userHighId" = $2`,
    [low, high],
  );
  const cooldowns = await sql(
    `SELECT "until", "rejectedFromUserId" FROM "InviteCooldown"
      WHERE "userLowId" = $1 AND "userHighId" = $2`,
    [low, high],
  );
  const edge = await sql(
    `SELECT "userLowId", "userHighId" FROM "Friendship"
      WHERE "userLowId" = $1 AND "userHighId" = $2`,
    [low, high],
  );
  return {
    invites: invites[0].count,
    friendships: friendships[0].count,
    cooldowns: cooldowns.length,
    cooldown: cooldowns[0] ?? null,
    ordered: edge[0] ? edge[0].userLowId === low && edge[0].userHighId === high : false,
  };
}

async function addGifts(user, prefix) {
  const lists = await sql(`SELECT id FROM "List" WHERE "ownerId" = $1`, [user.id]);
  const list = lists[0];
  for (const visibility of ["PUBLIC", "FRIENDS", "SECRET"]) {
    await sql(
      `INSERT INTO "Gift"
        ("id", "listId", "title", "visibility", "quantity", "status", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4::"GiftVisibility", 'SINGLE', 'OPEN', now(), now())`,
      [randomUUID(), list.id, `${prefix} ${visibility}`, visibility],
    );
  }
  return list;
}

async function publicTokenOf(user) {
  const rows = await sql(`SELECT "publicToken" FROM "List" WHERE "ownerId" = $1`, [user.id]);
  return rows[0].publicToken;
}

function titlesOf(response) {
  const gifts = response.json?.data?.gifts;
  if (!Array.isArray(gifts)) return [];
  return gifts.map((gift) => gift.title).sort();
}

function profilePath(user) {
  return `/api/v1/u/${user.nick}`;
}

async function profile(viewer, owner) {
  return request(profilePath(owner), { user: viewer });
}

async function invite(from, to) {
  return request(`${profilePath(to)}/invite`, { method: "POST", user: from });
}

async function accept(from, to) {
  return request(`${profilePath(to)}/invite/accept`, { method: "POST", user: from });
}

async function reject(from, to) {
  return request(`${profilePath(to)}/invite/reject`, { method: "POST", user: from });
}

function cookieHeader(response) {
  const getter = response.headers?.getSetCookie;
  if (typeof getter !== "function") return "";
  return getter
    .call(response.headers)
    .map(function cookiePair(value) {
      return value.split(";")[0];
    })
    .filter(Boolean)
    .join("; ");
}

async function registerWithCookies(label) {
  const nick = `${RUN_PREFIX}${label}`.slice(0, 24).toLowerCase();
  const email = `${nick}@r424.invalid`;
  const response = await fetch(`${baseUrl}/api/v1/register`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "x-forwarded-for": "127.0.0.1",
    },
    body: JSON.stringify({
      email,
      password: PASSWORD,
      displayName: `R424 ${label}`,
      nick,
    }),
  });
  const json = await response.json();
  if (response.status !== 200 || json?.ok !== true) {
    throw new Error(`register ${label} failed: ${String(response.status)} ${JSON.stringify(json)}`);
  }
  return {
    nick,
    email,
    id: json.data.user.id,
    cookie: cookieHeader(response),
  };
}

const RUN_PREFIX = `r424${randomUUID().replaceAll("-", "").slice(0, 8)}`;

async function readProfileKinds(viewer, owner) {
  const response = await profile(viewer, owner);
  return {
    response,
    relationship: response.json?.data?.relationship,
    cooldown: response.json?.data?.inviteCooldown,
    titles: titlesOf(response),
    hasToken: Object.prototype.hasOwnProperty.call(response.json?.data ?? {}, "publicToken"),
    hasOwner: Object.prototype.hasOwnProperty.call(response.json?.data ?? {}, "owner"),
  };
}

async function runAcceptScenario(accounts) {
  const { a, b } = accounts;
  await addGifts(a, "A");
  await addGifts(b, "B");
  const aToken = await publicTokenOf(a);

  const aBefore = await readProfileKinds(a, b);
  check("A→B profile before any relation: relationship NONE", aBefore.relationship === "NONE");
  check("A→B profile before any relation: no gifts by nick (AD-7)", aBefore.titles.length === 0);
  check("A→B profile cache is private, no-store", aBefore.response.cacheControl === "private, no-store");

  const bBefore = await readProfileKinds(b, a);
  check("B→A profile before any relation: relationship NONE", bBefore.relationship === "NONE");
  check("B→A profile before any relation: no gifts by nick (AD-7)", bBefore.titles.length === 0);

  const anonBefore = await request(`/api/v1/l/${aToken}`);
  check("anonymous /l before friendship: access gifts", anonBefore.json?.data?.access === "gifts");
  checkEqual("anonymous /l before friendship: only PUBLIC", titlesOf(anonBefore), ["A PUBLIC"]);
  check(
    "anonymous /l: no relationship and no inviteCooldown",
    !Object.prototype.hasOwnProperty.call(anonBefore.json?.data ?? {}, "relationship") &&
      !Object.prototype.hasOwnProperty.call(anonBefore.json?.data ?? {}, "inviteCooldown"),
  );
  check(
    "anonymous /l: no owner share token",
    !Object.prototype.hasOwnProperty.call(anonBefore.json?.data ?? {}, "publicToken"),
  );
  check("anonymous /l cache is private, no-store", anonBefore.cacheControl === "private, no-store");

  const firstInvite = await invite(a, b);
  checkEqual("A invites B: HTTP 200", firstInvite.status, 200);
  checkEqual("A invites B: INVITED", firstInvite.json?.data?.outcome, "INVITED");
  check("invite response cache is private, no-store", firstInvite.cacheControl === "private, no-store");

  const repeatInvite = await invite(a, b);
  checkEqual("repeat A→B: PENDING, no duplicate", repeatInvite.json?.data?.outcome, "PENDING");
  checkEqual("repeat A→B keeps exactly one invite", (await pairState(a, b)).invites, 1);

  const bIncoming = await readProfileKinds(b, a);
  checkEqual("B sees INCOMING_PENDING", bIncoming.relationship, "INCOMING_PENDING");
  const aOutgoing = await readProfileKinds(a, b);
  checkEqual("A sees OUTGOING_PENDING", aOutgoing.relationship, "OUTGOING_PENDING");
  check("pending does not open FRIENDS wishes to A", !aOutgoing.titles.includes("B FRIENDS"));
  check("pending does not open FRIENDS wishes to B", !bIncoming.titles.includes("A FRIENDS"));

  const accepted = await accept(b, a);
  checkEqual("B accepts A: HTTP 200", accepted.status, 200);
  checkEqual("B accepts A: FRIENDS_CREATED", accepted.json?.data?.outcome, "FRIENDS_CREATED");
  check("accept response cache is private, no-store", accepted.cacheControl === "private, no-store");

  const acceptedAgain = await accept(b, a);
  checkEqual("repeated accept: HTTP 200", acceptedAgain.status, 200);
  checkEqual("repeated accept: ALREADY_FRIENDS", acceptedAgain.json?.data?.outcome, "ALREADY_FRIENDS");

  const state = await pairState(a, b);
  checkEqual("accept: exactly one Friendship edge", state.friendships, 1);
  checkEqual("accept: zero invites for the pair", state.invites, 0);
  checkEqual("accept: no cooldown row", state.cooldowns, 0);
  check("accept: edge is stored userLowId < userHighId", state.ordered);

  const aViewB = await readProfileKinds(a, b);
  checkEqual("A sees B as FRIENDS", aViewB.relationship, "FRIENDS");
  checkIncludes("A sees B PUBLIC and FRIENDS wishes", aViewB.titles, ["B PUBLIC", "B FRIENDS"]);
  checkExcludes("A does not see B SECRET wish", aViewB.titles, ["B SECRET"]);
  check("A does not receive B publicToken", !aViewB.hasToken);
  checkEqual("B profile says A is FRIENDS", (await readProfileKinds(b, a)).relationship, "FRIENDS");

  const bViewA = await readProfileKinds(b, a);
  checkEqual("B sees A as FRIENDS", bViewA.relationship, "FRIENDS");
  checkIncludes("B sees A PUBLIC and FRIENDS wishes", bViewA.titles, ["A PUBLIC", "A FRIENDS"]);
  checkExcludes("B does not see A SECRET wish", bViewA.titles, ["A SECRET"]);
  check("B does not receive A publicToken", !bViewA.hasToken);

  const friendLink = await request(`/api/v1/l/${aToken}`, { user: b });
  checkEqual("friend /l: access gifts", friendLink.json?.data?.access, "gifts");
  checkIncludes("friend /l: PUBLIC + FRIENDS", titlesOf(friendLink), ["A PUBLIC", "A FRIENDS"]);
  checkExcludes("friend /l: no SECRET", titlesOf(friendLink), ["A SECRET"]);
  check(
    "friend /l: no relationship and no inviteCooldown",
    !Object.prototype.hasOwnProperty.call(friendLink.json?.data ?? {}, "relationship") &&
      !Object.prototype.hasOwnProperty.call(friendLink.json?.data ?? {}, "inviteCooldown"),
  );
  check(
    "friend /l: no owner share token",
    !Object.prototype.hasOwnProperty.call(friendLink.json?.data ?? {}, "publicToken"),
  );

  const anonAfter = await request(`/api/v1/l/${aToken}`);
  checkEqual("anonymous /l after friendship: only PUBLIC", titlesOf(anonAfter), ["A PUBLIC"]);

  const meA = await request("/api/v1/me", { user: a });
  const meB = await request("/api/v1/me", { user: b });
  check(
    "GET /me carries no relationship and no inviteCooldown",
    !Object.prototype.hasOwnProperty.call(meA.json?.data ?? {}, "relationship") &&
      !Object.prototype.hasOwnProperty.call(meA.json?.data ?? {}, "inviteCooldown") &&
      !Object.prototype.hasOwnProperty.call(meB.json?.data ?? {}, "relationship") &&
      !Object.prototype.hasOwnProperty.call(meB.json?.data ?? {}, "inviteCooldown"),
  );
}

async function runRejectScenario(accounts) {
  const { c, d } = accounts;
  const invited = await invite(c, d);
  checkEqual("C invites D: INVITED", invited.json?.data?.outcome, "INVITED");

  const rejected = await reject(d, c);
  checkEqual("D rejects C: HTTP 200", rejected.status, 200);
  checkEqual("D rejects C: REJECTED", rejected.json?.data?.outcome, "REJECTED");
  check("reject response cache is private, no-store", rejected.cacheControl === "private, no-store");

  const afterReject = await pairState(c, d);
  checkEqual("reject: zero invites", afterReject.invites, 0);
  checkEqual("reject: no Friendship edge", afterReject.friendships, 0);
  checkEqual("reject: one InviteCooldown row", afterReject.cooldowns, 1);
  checkEqual("reject: rejectedFromUserId is the sender C", afterReject.cooldown?.rejectedFromUserId, c.id);
  const untilMs = new Date(afterReject.cooldown.until).getTime() - Date.now();
  check(
    "reject: until is about 24 hours ahead",
    untilMs > 23 * 60 * 60 * 1000 && untilMs <= 24.5 * 60 * 60 * 1000,
    `remainingMs=${String(untilMs)}`,
  );

  const dViewC = await readProfileKinds(d, c);
  checkEqual("rejector D sees relationship NONE", dViewC.relationship, "NONE");
  checkEqual("rejector D sees inviteCooldown.rejected=false", dViewC.cooldown?.rejected, false);
  check(
    "rejector D sees whole hours 1..24",
    Number.isInteger(dViewC.cooldown?.hours) &&
      dViewC.cooldown.hours >= 1 &&
      dViewC.cooldown.hours <= 24,
    `hours=${String(dViewC.cooldown?.hours)}`,
  );

  const cViewD = await readProfileKinds(c, d);
  checkEqual("sender C sees relationship NONE", cViewD.relationship, "NONE");
  checkEqual("sender C sees inviteCooldown.rejected=true", cViewD.cooldown?.rejected, true);
  check(
    "sender C sees whole hours 1..24",
    Number.isInteger(cViewD.cooldown?.hours) &&
      cViewD.cooldown.hours >= 1 &&
      cViewD.cooldown.hours <= 24,
    `hours=${String(cViewD.cooldown?.hours)}`,
  );
  check("sender and rejector DTO do not expose the other user's token", !cViewD.hasToken && !dViewC.hasToken);

  const untilBefore = afterReject.cooldown.until;
  const repeat = await invite(c, d);
  checkEqual("repeat invite during cooldown: HTTP 429", repeat.status, 429);
  checkEqual("repeat invite: code RATE_LIMITED", repeat.json?.code, "RATE_LIMITED");
  checkEqual("repeat invite: reason INVITE_COOLDOWN", repeat.json?.reason, "INVITE_COOLDOWN");
  check(
    "repeat invite: params.hours is a whole 1..24",
    Number.isInteger(repeat.json?.params?.hours) &&
      repeat.json.params.hours >= 1 &&
      repeat.json.params.hours <= 24,
    `hours=${String(repeat.json?.params?.hours)}`,
  );
  const afterRepeat = await pairState(c, d);
  checkEqual("repeat invite creates no invite row", afterRepeat.invites, 0);
  checkEqual("repeat invite does not extend until", afterRepeat.cooldown?.until, untilBefore);

  const secondRepeat = await invite(c, d);
  checkEqual("second repeat invite is still HTTP 429", secondRepeat.status, 429);
  checkEqual("second repeat invite still creates no invite row", (await pairState(c, d)).invites, 0);

  const secondReject = await reject(d, c);
  checkEqual("repeated reject with no pending: HTTP 404", secondReject.status, 404);
  checkEqual("repeated reject: closed NOT_FOUND", secondReject.json?.code, "NOT_FOUND");
  const afterSecondReject = await pairState(c, d);
  checkEqual("repeated reject leaves one cooldown row", afterSecondReject.cooldowns, 1);
  checkEqual("repeated reject does not rewrite until", afterSecondReject.cooldown?.until, untilBefore);

  await sql(
    `UPDATE "InviteCooldown" SET "until" = now() - interval '1 minute'
      WHERE "userLowId" = $1 AND "userHighId" = $2`,
    [pairIds(c, d).low, pairIds(c, d).high],
  );
  const expired = await pairState(c, d);
  checkEqual("fixture: cooldown row remains expired (no cron)", expired.cooldowns, 1);

  const afterExpiry = await invite(c, d);
  checkEqual("send after expiry: HTTP 200", afterExpiry.status, 200);
  checkEqual("send after expiry: INVITED", afterExpiry.json?.data?.outcome, "INVITED");
  const afterExpiryState = await pairState(c, d);
  checkEqual("send after expiry creates one invite", afterExpiryState.invites, 1);
  checkEqual("send after expiry deletes the expired cooldown", afterExpiryState.cooldowns, 0);

  const cViewD2 = await readProfileKinds(c, d);
  const dViewC2 = await readProfileKinds(d, c);
  checkEqual("after expiry C sees OUTGOING_PENDING", cViewD2.relationship, "OUTGOING_PENDING");
  checkEqual("after expiry D sees INCOMING_PENDING", dViewC2.relationship, "INCOMING_PENDING");
  checkEqual("after expiry no inviteCooldown is exposed", cViewD2.cooldown ?? null, null);

  const rejectAgain = await reject(d, c);
  checkEqual("D rejects the new invite: REJECTED", rejectAgain.json?.data?.outcome, "REJECTED");
  const finalState = await pairState(c, d);
  checkEqual("second legitimate reject: no edge", finalState.friendships, 0);
  checkEqual("second legitimate reject: one cooldown", finalState.cooldowns, 1);
  checkEqual("second legitimate reject: invite gone", finalState.invites, 0);
}

async function runBlockScenario(accounts) {
  const { e, f } = accounts;
  await addGifts(e, "E");
  const invited = await invite(e, f);
  checkEqual("E invites F before Block: INVITED", invited.json?.data?.outcome, "INVITED");
  await sql(
    `INSERT INTO "Block" ("id", "blockerId", "blockedId", "createdAt")
     VALUES ($1, $2, $3, now())`,
    [randomUUID(), e.id, f.id],
  );

  for (const [viewer, owner, label] of [
    [e, f, "blocker E→F"],
    [f, e, "blocked F→E"],
  ]) {
    const view = await profile(viewer, owner);
    checkEqual(`${label} profile: HTTP 200`, view.status, 200);
    checkEqual(`${label} profile: closed not_found`, view.json?.data?.access, "not_found");
    check(`${label} profile: no owner, relationship or cooldown`, !view.json?.data?.owner && !view.json?.data?.relationship && !view.json?.data?.inviteCooldown);
    check(`${label} profile cache is private, no-store`, view.cacheControl === "private, no-store");
  }

  const acceptBlocked = await accept(f, e);
  checkEqual("Block: recipient accept is HTTP 403", acceptBlocked.status, 403);
  checkEqual("Block: recipient accept is closed FORBIDDEN", acceptBlocked.json?.code, "FORBIDDEN");
  check("Block: accept refusal carries no reason", !Object.prototype.hasOwnProperty.call(acceptBlocked.json ?? {}, "reason"));

  const rejectBlocked = await reject(f, e);
  checkEqual("Block: recipient reject is HTTP 403", rejectBlocked.status, 403);
  checkEqual("Block: recipient reject is closed FORBIDDEN", rejectBlocked.json?.code, "FORBIDDEN");
  check("Block: reject writes no cooldown", (await pairState(e, f)).cooldowns === 0);
  check("Block: reject leaves the pending row untouched", (await pairState(e, f)).invites === 1);

  const inviteBlocked = await invite(e, f);
  checkEqual("Block: send is HTTP 403", inviteBlocked.status, 403);
  checkEqual("Block: send is closed FORBIDDEN", inviteBlocked.json?.code, "FORBIDDEN");
  check("Block: send writes no cooldown", (await pairState(e, f)).cooldowns === 0);
  check("Block: send creates no edge", (await pairState(e, f)).friendships === 0);

  const tokenE = await publicTokenOf(e);
  const blockedLink = await request(`/api/v1/l/${tokenE}`, { user: f });
  checkEqual("Block: blocked viewer /l is closed not_found", blockedLink.json?.data?.access, "not_found");
  check(
    "Block: blocked /l carries no gifts or owner",
    Array.isArray(blockedLink.json?.data?.gifts) &&
      blockedLink.json.data.gifts.length === 0 &&
      !Object.prototype.hasOwnProperty.call(blockedLink.json?.data ?? {}, "owner"),
  );
}

async function runAnonymousAndRecipientScenario(accounts) {
  const { a, g, h } = accounts;
  const anonAccept = await request(`${profilePath(a)}/invite/accept`, { method: "POST" });
  checkEqual("anonymous accept: HTTP 401", anonAccept.status, 401);
  checkEqual("anonymous accept: UNAUTHENTICATED", anonAccept.json?.code, "UNAUTHENTICATED");
  check("anonymous accept response is private, no-store", anonAccept.cacheControl === "private, no-store");

  const anonReject = await request(`${profilePath(a)}/invite/reject`, { method: "POST" });
  checkEqual("anonymous reject: HTTP 401", anonReject.status, 401);
  checkEqual("anonymous reject: UNAUTHENTICATED", anonReject.json?.code, "UNAUTHENTICATED");
  check("anonymous reject response is private, no-store", anonReject.cacheControl === "private, no-store");

  const bogus = { cookie: "better-auth.session_token=not-a-real-session" };
  const bogusAccept = await accept(bogus, a);
  checkEqual("invalid session accept: HTTP 401", bogusAccept.status, 401);
  checkEqual("invalid session accept: UNAUTHENTICATED", bogusAccept.json?.code, "UNAUTHENTICATED");

  const invited = await invite(g, h);
  checkEqual("G invites H: INVITED", invited.json?.data?.outcome, "INVITED");

  const senderAccept = await accept(g, h);
  checkEqual("sender cannot accept on recipient's behalf: HTTP 404", senderAccept.status, 404);
  checkEqual("sender accept: closed NOT_FOUND", senderAccept.json?.code, "NOT_FOUND");
  check("sender accept changes nothing", (await pairState(g, h)).invites === 1);

  const senderReject = await reject(g, h);
  checkEqual("sender cannot reject on recipient's behalf: HTTP 404", senderReject.status, 404);
  checkEqual("sender reject: closed NOT_FOUND", senderReject.json?.code, "NOT_FOUND");
  check("sender reject writes no cooldown", (await pairState(g, h)).cooldowns === 0);
  check("sender reject leaves the pending invite", (await pairState(g, h)).invites === 1);

  const recipientAccept = await accept(h, g);
  checkEqual("recipient H accepts G: FRIENDS_CREATED", recipientAccept.json?.data?.outcome, "FRIENDS_CREATED");
  const state = await pairState(g, h);
  checkEqual("recipient accept: one edge", state.friendships, 1);
  checkEqual("recipient accept: zero invites", state.invites, 0);
  checkEqual("recipient accept: zero cooldown", state.cooldowns, 0);

  const afterFriends = await reject(g, h);
  checkEqual("sender reject after friendship: HTTP 404", afterFriends.status, 404);
  checkEqual("sender reject after friendship: NOT_FOUND", afterFriends.json?.code, "NOT_FOUND");
}

async function runRaceScenario(accounts) {
  const { p, q, r, s } = accounts;
  const invited = await invite(p, q);
  checkEqual("P invites Q for concurrent accept: INVITED", invited.json?.data?.outcome, "INVITED");

  const [first, second] = await Promise.all([accept(q, p), accept(q, p)]);
  checkEqual("concurrent accepts: both HTTP 200", [first.status, second.status], [200, 200]);
  const outcomes = [first.json?.data?.outcome, second.json?.data?.outcome].sort();
  checkEqual("concurrent accepts: one created, one already friends", outcomes, [
    "ALREADY_FRIENDS",
    "FRIENDS_CREATED",
  ]);
  const concurrentState = await pairState(p, q);
  checkEqual("concurrent accepts: exactly one edge", concurrentState.friendships, 1);
  checkEqual("concurrent accepts: zero invites", concurrentState.invites, 0);
  checkEqual("concurrent accepts: zero cooldown", concurrentState.cooldowns, 0);

  const thirdAccept = await accept(q, p);
  checkEqual("repeated accept after race: ALREADY_FRIENDS", thirdAccept.json?.data?.outcome, "ALREADY_FRIENDS");

  const raceInvite = await invite(r, s);
  checkEqual("R invites S for accept/reject race: INVITED", raceInvite.json?.data?.outcome, "INVITED");
  const [raceAccept, raceReject] = await Promise.all([accept(s, r), reject(s, r)]);
  checkEqual(
    "accept/reject race: exactly one success and one closed NOT_FOUND",
    [raceAccept.status, raceReject.status].sort(),
    [200, 404],
  );
  const raceState = await pairState(r, s);
  checkEqual("accept/reject race: no invites remain", raceState.invites, 0);
  if (raceAccept.status === 200) {
    checkEqual("accept/reject race: accept won with FRIENDS_CREATED", raceAccept.json?.data?.outcome, "FRIENDS_CREATED");
    checkEqual("accept/reject race: accept state has one edge", raceState.friendships, 1);
    checkEqual("accept/reject race: accept state has no cooldown", raceState.cooldowns, 0);
    const after = await accept(s, r);
    checkEqual("accept/reject race: later accept is ALREADY_FRIENDS", after.json?.data?.outcome, "ALREADY_FRIENDS");
  } else {
    checkEqual("accept/reject race: reject won with REJECTED", raceReject.json?.data?.outcome, "REJECTED");
    checkEqual("accept/reject race: reject state has no edge", raceState.friendships, 0);
    checkEqual("accept/reject race: reject state has one cooldown", raceState.cooldowns, 1);
    const after = await accept(s, r);
    checkEqual("accept/reject race: later accept is NOT_FOUND", after.status, 404);
  }
}

function writeEvidence() {
  if (!target) return;
  if (evidence.length === 0) return;
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(":", "").replace(/\..+$/, "");
  const path = join(EVIDENCE_DIR, `4.2.4-live-evidence-${stamp}.md`);
  const total = passed + failed;
  const body = [
    "# 4.2.4 — живая приёмка Story 4.2: одноразовая PostgreSQL + реальный HTTP",
    "",
    `Run: ${new Date().toISOString()}`,
    `Target: ${target ? describeDisposableTarget(target) : "<not resolved>"}`,
    `PostgreSQL: ${serverVersion || "<not read>"}`,
    `HTTP: ${baseUrl || "<not started>"} (${SERVER_JS})`,
    `Итог: ${passed}/${total} PASS, ${failed} FAIL`,
    "",
    "Это доказательство действительно только для указанной одноразовой базы.",
    "Живая, общая и боевая PostgreSQL не читались и не менялись;",
    "`apps/web/.env*` не читался; shared serve и другие worktrees не затрагивались.",
    "",
    setupError ? `Ошибка подготовки: ${setupError}` : "Все проверки выполнены реальным HTTP и реальной PostgreSQL, без моков.",
    "",
    ...evidence,
    "",
  ].join("\n");
  writeFileSync(path, body, "utf8");
  console.log(`4.2.4 evidence: ${path}`);
}

async function preflight() {
  target = resolveTargetOrExit();
  tempDir = mkdtempSync(join(tmpdir(), "gift-list-424-"));
  writeFileSync(join(tempDir, "empty.env"), "");
  record(`target: ${describeDisposableTarget(target)}`);

  database = new Client({ connectionString: target.directUrl });
  await database.connect();
  const identity = await database.query(
    `SELECT current_database() AS database, current_setting('server_version') AS version`,
  );
  if (identity.rows[0]?.database !== target.database) {
    throw new Error(`connected to ${identity.rows[0]?.database}, expected ${target.database}`);
  }
  serverVersion = identity.rows[0]?.version ?? "";
  record(`server: PostgreSQL ${serverVersion}`);

  const isolation = await database.query(`SHOW default_transaction_isolation`);
  check(
    "PostgreSQL default_transaction_isolation is read committed",
    isolation.rows[0]?.default_transaction_isolation === "read committed",
    isolation.rows[0]?.default_transaction_isolation,
  );

  const existing = await database.query(`SELECT to_regclass('"User"') AS user_table`);
  check("target database is empty before migrate", existing.rows[0]?.user_table === null);

  runPrisma(["migrate", "deploy"]);
  const migration = await database.query(
    `SELECT finished_at, rolled_back_at FROM "_prisma_migrations"
      WHERE migration_name = '20261107120000_invite_cooldown'`,
  );
  check(
    "InviteCooldown migration applied and not rolled back",
    migration.rows[0]?.finished_at != null && migration.rows[0]?.rolled_back_at == null,
  );
}

async function main() {
  await preflight();
  await startServer();

  const labels = ["a", "b", "c", "d", "e", "f", "g", "h", "p", "q", "r", "s"];
  const accounts = {};
  for (const label of labels) {
    accounts[label] = await registerWithCookies(label);
    record(`registered synthetic account ${label} (@${accounts[label].nick})`);
  }
  checkEqual("registered all synthetic accounts with session cookies", labels.length, 12);

  await runAcceptScenario(accounts);
  await runRejectScenario(accounts);
  await runBlockScenario(accounts);
  await runAnonymousAndRecipientScenario(accounts);
  await runRaceScenario(accounts);
}

try {
  await main();
} catch (error) {
  setupError = describeError(error);
  console.error(`\n4.2.4 harness stopped: ${setupError}\n`);
  record(`HARNESS STOPPED: ${setupError}`);
} finally {
  try {
    await stopServer();
  } catch (error) {
    record(`server cleanup warning: ${describeError(error)}`);
  }
  try {
    await database?.end();
  } catch {
    // Ignore a double close.
  }
  writeEvidence();
  console.log(`4.2.4 result: ${passed} passed, ${failed} failed`);
  if (failed > 0 || setupError) process.exitCode = 1;
}
