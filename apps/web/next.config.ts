import path from "node:path";
import type { NextConfig } from "next";
import { spaFallbackRewriteSources } from "./src/lib/spa-paths";

// Monorepo root (npm workspaces, AD-26): hoisted node_modules and packages/* live there.
const monorepoRoot = path.join(__dirname, "../..");

const nextConfig: NextConfig = {
  // Docker-ready server build must keep working (AD-16).
  output: "standalone",
  outputFileTracingRoot: monorepoRoot,
  turbopack: { root: monorepoRoot },
  // @gift-list/contracts ships TypeScript sources without a build step.
  transpilePackages: ["@gift-list/contracts"],
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
