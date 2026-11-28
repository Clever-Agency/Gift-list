import path from "node:path";
import type { NextConfig } from "next";
import { LINK_PAGE_HEADERS } from "./src/lib/link-page-headers";
import { spaFallbackRewriteSources } from "./src/lib/spa-paths";

// Monorepo root (npm workspaces, AD-26): hoisted node_modules and packages/* live there.
const monorepoRoot = path.join(__dirname, "../..");

const nextConfig: NextConfig = {
  // Docker-ready server build must keep working (AD-16).
  output: "standalone",
  outputFileTracingRoot: monorepoRoot,
  turbopack: { root: monorepoRoot },
  // @gift-list/contracts and @gift-list/ui ship TypeScript sources without a build step.
  transpilePackages: ["@gift-list/contracts", "@gift-list/ui"],
  async headers() {
    return [
      {
        // Story 3.3: the link page depends on the session and the request
        // language; no shared cache may reuse it for another visitor.
        source: "/l/:path*",
        headers: [...LINK_PAGE_HEADERS],
      },
      {
        // Story 4.7: the invite preview has the same two inputs (session,
        // `Accept-Language`) as `/l`, so it gets the same private caching rules.
        source: "/i/:path*",
        headers: [...LINK_PAGE_HEADERS],
      },
      {
        // CLE-137 (Story 7.2): the unsubscribe page writes and its language comes
        // from `Accept-Language`; a shared cache must never replay one visitor's
        // document for another.
        source: "/unsubscribe/:path*",
        headers: [...LINK_PAGE_HEADERS],
      },
    ];
  },
  async rewrites() {
    return {
      fallback: spaFallbackRewriteSources().map((source) => ({
        source,
        destination: "/spa-index.html",
      })),
    };
  },
};

export default nextConfig;
