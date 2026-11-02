import { createServer, Server as HttpServer } from "node:http";
import { Server as HttpsServer } from "node:https";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { adoptPeerAddress, installPeerAddress } from "./peer-address";

const originalHttpEmit = HttpServer.prototype.emit;
const originalHttpsEmit = HttpsServer.prototype.emit;
const vercel = process.env.VERCEL;

afterEach(() => {
  HttpServer.prototype.emit = originalHttpEmit;
  HttpsServer.prototype.emit = originalHttpsEmit;
  if (vercel === undefined) delete process.env.VERCEL;
  else process.env.VERCEL = vercel;
});

describe("adoptPeerAddress", () => {
  it("replaces a spoofed forwarding header with the socket address", () => {
    delete process.env.VERCEL;
    const headers: Record<string, string | string[] | undefined> = {
      "x-forwarded-for": "203.0.113.9, 198.51.100.1",
      "x-real-ip": "198.51.100.9",
    };
    adoptPeerAddress(headers, " 10.0.0.5 ");
    expect(headers["x-forwarded-for"]).toBe("10.0.0.5");
    expect(headers["x-real-ip"]).toBeUndefined();
  });

  it("drops forwarding headers when the socket has no address", () => {
    const headers: Record<string, string | string[] | undefined> = {
      "x-forwarded-for": "203.0.113.9",
      "x-real-ip": "198.51.100.9",
    };
    adoptPeerAddress(headers, "  ");
    expect(headers["x-forwarded-for"]).toBeUndefined();
    expect(headers["x-real-ip"]).toBeUndefined();
  });

  it("keeps the platform header when Vercel already overwrote it", () => {
    process.env.VERCEL = "1";
    const headers: Record<string, string | string[] | undefined> = {
      "x-forwarded-for": "203.0.113.9",
      "x-real-ip": "203.0.113.9",
    };
    adoptPeerAddress(headers, "10.0.0.5");
    expect(headers["x-forwarded-for"]).toBe("203.0.113.9");
    expect(headers["x-real-ip"]).toBe("203.0.113.9");
  });
});

describe("installPeerAddress", () => {
  it("serves the socket address even when the client sends another X-Forwarded-For", async () => {
    delete process.env.VERCEL;
    installPeerAddress();
    const seen: string[] = [];
    const server = createServer((req, res) => {
      seen.push(String(req.headers["x-forwarded-for"] ?? ""));
      res.end(req.headers["x-real-ip"] ?? "");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    try {
      const port = (server.address() as AddressInfo).port;
      for (const spoof of ["203.0.113.8", "203.0.113.9"]) {
        const res = await fetch(`http://127.0.0.1:${port}/`, {
          headers: { "x-forwarded-for": spoof, "x-real-ip": spoof },
        });
        expect(await res.text()).toBe("");
      }
      const bare = await fetch(`http://127.0.0.1:${port}/`);
      expect(await bare.text()).toBe("");
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
    expect(seen).toEqual(["127.0.0.1", "127.0.0.1", "127.0.0.1"]);
  });
});
