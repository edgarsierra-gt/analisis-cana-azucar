# Guía de diseño y redacción del sitio

Sitio: `edgarsierra.com/analisis-cana-azucar` (Next.js 16, App Router, `basePath: "/analisis-cana-azucar"`).
Público: gerencia general, agrícola e industrial de un ingenio (no técnica) y evaluadores técnicos.
Objetivo: que cada hallazgo se entienda en 30 segundos y se pueda verificar en 3 minutos.

## 1. Carácter

Un **informe técnico bien impreso**, no una página de producto. Papel, tinta, líneas finas, cifras grandes
en serif, etiquetas en mayúsculas pequeñas monoespaciadas, figuras numeradas con su fuente.

Prohibido (se ve "hecho por IA" o de plantilla):
- degradados, efectos de vidrio, sombras grandes, tarjetas flotantes con esquinas muy redondeadas;
- emojis, íconos decorativos, ilustraciones genéricas, "hero" con imagen de stock;
- frases de marketing: "descubre", "potencia", "revoluciona", "impulsa", "en el mundo actual", "de vanguardia",
  "solución integral", "toma decisiones basadas en datos", "insights", "robusto" como muletilla;
- signos de exclamación, preguntas retóricas en serie, listas de tres adjetivos;
- el guion largo (—) como pausa en el texto corrido: usar punto, coma o dos puntos;
- títulos que no dicen nada ("Resultados", "Análisis"): el título dice el hallazgo ("Tres variedades ganan al testigo").

## 2. Voz y redacción

- Español de Guatemala, frases cortas, una idea por frase. Sin jerga si hay palabra simple; si hace falta un
  término técnico, se explica una vez en lenguaje llano.
- **Primera persona singular para recomendaciones y decisiones** ("Recomiendo ampliar…", "Descarté…"). El autor es
  Edgar Sierra. Nunca "nosotros" ni "el equipo".
- **Nunca nombrar a un ingenio específico.** Al cliente se le dice "el ingenio".
- Cada afirmación con número lleva el número y, cerca, su fuente (figura, tabla o "notebook 02").
- La incertidumbre se dice siempre: banda, intervalo, certeza alta/media/baja y por qué.
- Los datos son públicos y de otros lugares (Louisiana; una caldera a carbón en China; FAOSTAT y el No. 11).
  Se traslada **el método**, no las cifras. Decirlo donde corresponda, sin repetirlo en cada párrafo.
- Formato de números: punto decimal y coma de miles (`1,143`, `0.30 %`, `US$526.3`). Usar `src/lib/formato.ts`.
  Signo menos tipográfico (−). Unidades después del número con espacio (`0.18 t/h`, `22 %`).

## 3. Color

Tokens en `src/app/globals.css`. Nunca escribir colores sueltos en CSS; usar variables.

| Uso | Token |
|---|---|
| Fondo | `--papel` (#f4f1e8); superficies `--hoja` |
| Texto | `--tinta`, `--tinta-2` (secundario), `--tinta-3` (apagado) |
| Líneas | `--linea`, `--linea-suave` |
| Serie I · Campo | `--campo` (verde caña) |
| Serie II · Caldera | `--caldera` (óxido) |
| Serie III · Mercado | `--mercado` (azul tinta) |
| Énfasis en gráficas | `--resalte` (ámbar), con moderación |

`data-serie="campo|caldera|mercado"` en un contenedor fija `--serie` y `--serie-fondo` para todo lo de adentro.
El color nunca es la única señal: siempre hay texto o forma que diga lo mismo.

## 4. Tipografía

- Titulares y cifras grandes: **Newsreader** (`--fuente-titulo`).
- Texto y controles: **Public Sans** (`--fuente-texto`), 17 px.
- Etiquetas, fuentes, cifras de tablas: **JetBrains Mono** (`--fuente-dato`), con `tabular-nums`.
- Clases globales: `.etiqueta`, `.entrada`, `.apagado`, `.dato`, `.num`, `.texto` (columna de lectura),
  `.contenedor`, `.contenedor-medio`, `.contenedor-texto`, `.pila`, `.pila-grande`, `.boton`, `.boton-sec`,
  `.campo-form`.

## 5. Componentes (en `src/components`)

| Componente | Para qué |
|---|---|
| `Portada` | encabezado de página: etiqueta, título (el hallazgo), entrada, línea `meta` de datos |
| `Seccion` | sección numerada (`numero="01"`), con `etiqueta`, `titulo`, `entrada`; `ancho` texto/medio/total |
| `Cifra`, `FilaCifras` | cifras clave con unidad, qué son y detalle (intervalo, fuente) |
| `Evaluacion` | ficha gerencial: qué significa, decisión, impacto, riesgos, certeza (alta/media/baja + motivo) |
| `Figura` | figura numerada con título, `nota` de lectura y `fuente` (notebook y archivo de `outputs/`) |
| `ImagenNotebook` | PNG de `outputs/figures` (solo como figura original, ver §6) |
| `Tabla` | tabla con columnas tipadas (`tipo: "num"` alinea a la derecha), filas destacadas |
| `Nota` | recuadro `limite` / `dato` / `metodo` |
| `Desplegable` | detalle técnico plegado (método, supuestos, figura original del notebook) |
| `Certeza` | etiqueta de certeza (también la usa `Evaluacion`) |
| `IndiceLocal` | índice fijo de una página larga con la sección visible marcada |
| `graficos/PlotFigura` | gráfica de Observable Plot que se adapta al ancho (componente cliente) |
| `presentacion/Diapositivas`, `Diapositiva` | presentación 16:9 con teclado, notas (N) y PDF |

Componentes propios de una página van en una carpeta privada junto a ella (`app/(sitio)/campo/_componentes/`).

## 6. Gráficas

- Las gráficas principales se dibujan con **Observable Plot** (`PlotFigura`) a partir de los JSON de
  `src/datos`, con la paleta del sitio (`COLORES`, `CATEGORICOS`). Así todas se ven del mismo sistema.
- Regla de color: **un color para lo que importa, gris (`COLORES.contexto`) para el resto.**
- Ejes con unidades, títulos de eje cortos, sin leyendas si se puede rotular directo la línea o el punto
  (`Plot.text` al final de la serie). Rejilla suave (`grid: true`) solo en el eje de valores.
- Toda gráfica va dentro de `Figura` con `numero`, `titulo` que dice la conclusión, `nota` de cómo leerla y
  `fuente`. `PlotFigura` lleva `etiqueta` (texto alternativo con la conclusión).
- Las figuras PNG de los notebooks (`ImagenNotebook`) se usan solo dentro de un `Desplegable` "Figura original del
  notebook", o cuando redibujar no aporta (diagramas complejos). Nunca como gráfica principal.
- Las gráficas son componentes cliente (`"use client"`) que reciben datos ya filtrados como props desde la página
  (componente de servidor). No mandar al cliente tablas enteras de miles de filas: filtrar o resumir antes.

## 7. Datos: cada cifra sale del análisis

- `npm run dev`/`build` corren `scripts/sincronizar-datos.mjs`, que copia `../outputs` a `src/datos/*.json`
  (tablas CSV como listas de filas) y `public/figuras/*.png`. El catálogo con columnas y filas está en
  `src/datos/_catalogo.json`.
- Importar así: `import resumen from "@/datos/serie1_resumen_q1.json"`. Calcular derivados en la página.
- **Si una cifra existe en un JSON, se lee del JSON; no se escribe a mano.** Si solo existe en la salida de un
  notebook o en el README, se puede escribir, con un comentario al lado: `{/* fuente: notebook 05, celda 7 */}`.
- No inventar cifras, no redondear distinto de los notebooks, no mezclar unidades (acre/ha, lb/kg) sin decirlo.

## 8. Estructura de una página de caso

1. `Portada` con el hallazgo principal de la serie y una línea `meta` (datos, período, notebooks).
2. `IndiceLocal` con las preguntas.
3. Por cada pregunta, una `Seccion` numerada:
   - la respuesta en una o dos frases (`entrada`);
   - `FilaCifras` con 2-4 cifras clave;
   - 1-3 `Figura` con gráficas de Plot y/o una `Tabla`;
   - qué se descartó y por qué (hipótesis descartadas), en texto corto;
   - `Desplegable` con el método y la figura original del notebook;
   - `Nota tipo="limite"` con el límite principal;
   - `Evaluacion` (ficha gerencial) al cierre.
4. Enlaces al notebook en GitHub (`archivoRepo("notebooks/02_campo_recomendacion.ipynb")`).

## 9. Accesibilidad y respuesta

WCAG AA: contraste, foco visible, `alt`/`etiqueta` en gráficas, tablas con encabezados, nada que dependa solo del
color. Se ve bien a 375 px de ancho: tablas con scroll horizontal, gráficas que se redibujan al ancho.

## 10. Rutas

| Ruta | Archivo |
|---|---|
| `/` | `app/(sitio)/page.tsx` |
| `/campo`, `/caldera`, `/mercado` | `app/(sitio)/<caso>/page.tsx` |
| `/api` | `app/(sitio)/api/page.tsx` |
| `/herramientas` | `app/(sitio)/herramientas/page.tsx` |
| `/presentacion` | `app/presentacion/page.tsx` (sin encabezado ni pie) |

`next/link` agrega la ruta base solo. Para `<img>`, descargas o archivos de `public/` usar `ruta()` o `figura()` de
`src/lib/base.ts`. La API se consume con `consultar()` de `src/lib/api.ts` (`NEXT_PUBLIC_API_URL`).
