import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: Pool | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and configure PostgreSQL.",
    );
  }

  let pool = globalForPrisma.pgPool;
  if (!pool) {
    pool = new Pool({ connectionString });
    pool.on("error", (err) => {
      console.error("Unexpected PostgreSQL pool error", err);
    });
    if (process.env.NODE_ENV !== "production") {
      globalForPrisma.pgPool = pool;
    }
  }

  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

let singleton = globalForPrisma.prisma;

function getPrismaClient(): PrismaClient {
  if (singleton) return singleton;
  singleton = createPrismaClient();
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = singleton;
  }
  return singleton;
}

/**
 * Shared Prisma client. The connection is opened on first use so `next build`
 * can load route modules without `DATABASE_URL`.
 * Import only from server code (actions / domain ports).
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    if (prop === "then") return undefined;
    const client = getPrismaClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
  has(_target, prop) {
    if (prop === "then") return false;
    return prop in getPrismaClient();
  },
});
