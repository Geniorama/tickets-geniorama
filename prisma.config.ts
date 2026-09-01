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
    // Base de usar y tirar donde Prisma reproduce el historial para compararlo
    // con el esquema. Solo la usan `migrate diff` y `migrate dev`; en el
    // servidor no está definida y no hace falta.
    shadowDatabaseUrl: process.env["SHADOW_DATABASE_URL"],
  },
});
