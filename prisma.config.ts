import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Carga `.env.local` (dev) y `.env` (prod/servidor). dotenv no sobrescribe
// variables ya definidas, así que el primero de la lista tiene prioridad.
config({ path: [".env.local", ".env"] });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
