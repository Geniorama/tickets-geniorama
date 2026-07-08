import type { NextConfig } from "next";
import path from "node:path";
import { version } from "./package.json";

const nextConfig: NextConfig = {
  // Genera un servidor mínimo y autocontenido en `.next/standalone`.
  // El build se hace en CI (GitHub Actions) y solo se sube este bundle al
  // servidor — el servidor ya no ejecuta `npm install` ni `next build`.
  output: "standalone",
  // Fijar la raíz del trazado al directorio del proyecto. Sin esto, Next
  // infiere una raíz más arriba (por lockfiles en la carpeta de usuario) y
  // anida el `server.js` en subcarpetas dentro de `.next/standalone`.
  outputFileTracingRoot: path.join(__dirname),
  // El cliente de Prisma vive en una ruta custom (`src/generated/prisma`).
  // El output tracing de Next no siempre arrastra el query engine desde ahí,
  // así que lo forzamos para que el binario llegue al bundle standalone.
  outputFileTracingIncludes: {
    "*": ["./src/generated/prisma/**/*"],
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
  experimental: {
    serverActions: {
      // Debe cubrir el archivo más grande que permite validateFile (video 100 MB)
      // más el overhead del multipart y los campos del formulario.
      bodySizeLimit: "110mb",
    },
    // El request de /tickets/new pasa por el middleware de NextAuth. Sin esto,
    // el middleware trunca el body a 10 MB (default) antes de que llegue al
    // Server Action, rompiendo el multipart ("Unexpected end of form").
    middlewareClientMaxBodySize: "110mb",
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "media.geniorama.co",
      },
      {
        protocol: "https",
        hostname: "i.imgur.com",
      },
      // Logos migrados desde Supabase — se puede eliminar una vez re-subidos a R2
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
};

export default nextConfig;
