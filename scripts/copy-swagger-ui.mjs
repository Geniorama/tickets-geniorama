/**
 * Copia los archivos de Swagger UI a `public/swagger-ui/`.
 *
 * La referencia de la API no importa `swagger-ui-react` porque ese paquete
 * arrastra `@swagger-api/apidom-*`, y al pasar por Turbopack pierde
 * `OpenApi3_1Element.refract`: la pantalla carga, pero ninguna operación llega a
 * abrirse. El bundle de `swagger-ui-dist` ya viene compilado por el propio
 * proyecto de Swagger, así que no pasa por nuestro empaquetador y no puede
 * romperse por ahí.
 *
 * Se copia en vez de versionarse para no meter 1,5 MB de código de terceros en
 * el repositorio, y corre en `predev` y `prebuild` para que exista tanto en
 * local como en el runner de CI —que hace `npm ci` y `npm run build`— antes de
 * que el workflow meta `public/` en el bundle standalone.
 */

import { copyFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);

/** Lo mínimo que necesita la página: el motor y su hoja de estilos. */
const FILES = ["swagger-ui-bundle.js", "swagger-ui.css"];

const DEST = path.join(process.cwd(), "public", "swagger-ui");

async function main() {
  let source;
  try {
    source = path.dirname(require.resolve("swagger-ui-dist/package.json"));
  } catch {
    // Sin la dependencia instalada no se corta el build: la pantalla de
    // referencia avisa por su cuenta de que los archivos no están, y el resto
    // de la aplicación no depende de ellos.
    console.warn("[swagger-ui] `swagger-ui-dist` no está instalado; se omite la copia.");
    return;
  }

  await mkdir(DEST, { recursive: true });

  for (const file of FILES) {
    await copyFile(path.join(source, file), path.join(DEST, file));
  }

  console.log(`[swagger-ui] ${FILES.length} archivos copiados a public/swagger-ui/`);
}

main().catch((err) => {
  console.error("[swagger-ui] No se pudieron copiar los archivos:", err);
  process.exitCode = 1;
});
