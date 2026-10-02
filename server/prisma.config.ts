import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "node prisma/seed-admin-cred.js",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
