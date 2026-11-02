import { Server as HttpServer, type IncomingHttpHeaders, type IncomingMessage } from "node:http";
import { Server as HttpsServer } from "node:https";

const PATCHED = Symbol.for("gift-list.peer-address");

type Emit = (this: unknown, event: string | symbol, ...args: unknown[]) => boolean;

/**
 * On a direct Node connection Next keeps a client-supplied `X-Forwarded-For`
 * (`??=` fills the header only when it is absent), so the first hop is spoofable
 * and a missing header becomes the shared key `unknown` only when the socket
 * address never lands in the header. Replace both forwarding headers with the
 * TCP peer. Vercel overwrites `X-Forwarded-For` itself; leave that value in place.
 * `VERCEL` is a platform flag, not app config, and is read here so instrumentation
 * does not call `getEnv()` (that parse requires `DATABASE_URL`).
 */
export function adoptPeerAddress(
  headers: IncomingHttpHeaders,
  remoteAddress: string | undefined,
): void {
  if (process.env.VERCEL === "1") return;
  delete headers["x-forwarded-for"];
  delete headers["x-real-ip"];
  const peer = remoteAddress?.trim();
  if (peer) headers["x-forwarded-for"] = peer;
}

function patch(proto: { emit: Emit }): void {
  const current = proto.emit as Emit & { [PATCHED]?: boolean };
  if (current[PATCHED]) return;
  function wrapped(this: unknown, event: string | symbol, ...args: unknown[]): boolean {
    if (event === "request") {
      const req = args[0] as IncomingMessage | undefined;
      if (req?.headers) adoptPeerAddress(req.headers, req.socket?.remoteAddress);
    }
    return current.call(this, event, ...args);
  }
  (wrapped as Emit & { [PATCHED]?: boolean })[PATCHED] = true;
  proto.emit = wrapped;
}

/** Rewrites forwarding headers on every Node HTTP(S) request before Next reads them. */
export function installPeerAddress(): void {
  patch(HttpServer.prototype as unknown as { emit: Emit });
  patch(HttpsServer.prototype as unknown as { emit: Emit });
}
