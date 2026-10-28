import path from "node:path";
import type { NextConfig } from "next";

// Monorepo root (npm workspaces, AD-26): hoisted node_modules and packages/* live there.
const monorepoRoot = path.join(__dirname, "../..");

const nextConfig: NextConfig = {
  // Docker-ready server build must keep working (AD-16).
  output: "standalone",
  outputFileTracingRoot: monorepoRoot,
  turbopack: { root: monorepoRoot },
  // @gift-list/contracts ships TypeScript sources without a build step.
  transpilePackages: ["@gift-list/contracts"],
};

export default nextConfig;
