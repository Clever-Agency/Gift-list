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
