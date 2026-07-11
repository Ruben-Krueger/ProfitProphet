import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  // The Prisma CLI (migrate/db push/studio) needs a direct, non-pooled
  // connection — Supabase's pgbouncer pooler doesn't support the commands
  // migrations issue. The app itself connects via DATABASE_URL (pooled)
  // through the driver adapter in api/_shared/prisma.ts.
  datasource: {
    url: env("DIRECT_URL"),
  },
});
