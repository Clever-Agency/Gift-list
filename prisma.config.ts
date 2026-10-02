import "dotenv/config";
import { defineConfig } from "prisma/config";

const databaseUrl = process.env.DATABASE_URL?.trim();
const offlineCommands = new Set(["format", "generate", "validate"]);
const prismaCommand = process.argv[2] ?? "";

function resolveDatabaseUrl(): string {
  if (databaseUrl) {
    return databaseUrl;
  }

  // These commands parse the schema but never connect to PostgreSQL.
  if (offlineCommands.has(prismaCommand)) {
    return "postgresql://placeholder:placeholder@localhost:5432/placeholder";
  }

  throw new Error(
    "DATABASE_URL is required for Prisma database commands. Copy .env.example to .env and configure PostgreSQL.",
  );
}

export default defineConfig({
  schema: "src/db/schema.prisma",
  migrations: {
    path: "src/db/migrations",
  },
  datasource: {
    url: resolveDatabaseUrl(),
  },
});
