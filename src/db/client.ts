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

/**
 * Shared Prisma client. Import only from server code (actions / domain ports).
 * Do not import from Client Components.
 */
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
