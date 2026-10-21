# Sitio web · Caña de azúcar: campo, fábrica y mercado

Sitio en Next.js 16 que presenta los resultados de las Series I a III, la API de la Serie IV y la presentación
ejecutiva de la Serie V. Se publica en `edgarsierra.com/analisis-cana-azucar` (`basePath` en `next.config.ts`).

## Cómo correrlo

```bash
cd web
npm install
npm run dev        # http://localhost:3000/analisis-cana-azucar
```

`npm run dev` y `npm run build` corren antes `scripts/sincronizar-datos.mjs`, que copia las salidas de los notebooks
(`../outputs/models`, `../outputs/tables`, `../outputs/figures`) a `src/datos/*.json` y `public/figuras/`. Así cada
cifra del sitio sale del análisis: si se vuelve a correr un notebook, el sitio se actualiza en el siguiente build.

Las herramientas y el asistente consumen la API: en desarrollo `http://localhost:8000` (levantarla con
`docker compose up` desde la raíz) y en producción la de Cloud Run (`src/lib/api.ts`). `NEXT_PUBLIC_API_URL` cambia
la dirección sin tocar el código. En Docker local el asistente responde 503 porque no tiene acceso a Vertex AI; para
probarlo en local, apuntar `NEXT_PUBLIC_API_URL` a Cloud Run (CORS ya acepta `http://localhost:3000`).

**Publicación en Vercel:** proyecto aparte con *Root Directory* `web`. El build necesita `../outputs`, así que debe
quedar activa la opción de incluir los archivos fuera del *Root Directory* (viene activa por defecto).

## Estructura

| Ruta | Archivo | Contenido |
|---|---|---|
| `/` | `src/app/(sitio)/page.tsx` | inicio: las tres series, el método y cómo verificarlo |
| `/campo`, `/caldera`, `/mercado` | `src/app/(sitio)/<caso>/` | cada caso con sus preguntas, evidencia y evaluación gerencial |
| `/api` | `src/app/(sitio)/api/` | cómo funciona la API y cómo se probó |
| `/herramientas` | `src/app/(sitio)/herramientas/` | calculadoras que llaman a la API en vivo |
| `/asistente` | `src/app/(sitio)/asistente/` | chat con el asistente (Vertex AI) y diagrama de cómo funciona |
| `/presentacion` | `src/app/presentacion/` | presentación ejecutiva 16:9 (flechas para avanzar, N para notas, PDF) |

El sistema de diseño y las reglas de redacción están en [`DESIGN.md`](DESIGN.md).
