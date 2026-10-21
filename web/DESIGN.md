# Guía de diseño y redacción del sitio

Sitio: `edgarsierra.com/analisis-cana-azucar` (Next.js 16, App Router, `cacheComponents`, `basePath: "/analisis-cana-azucar"`).
Público: gerencia general, agrícola e industrial de un ingenio (no técnica) y evaluadores técnicos.
Objetivo: que cada hallazgo se entienda en 30 segundos y se pueda verificar en 3 minutos.

En local el sitio vive en `http://localhost:3000/analisis-cana-azucar`. La raíz (`http://localhost:3000/`) da 404 por el
`basePath`; es normal.

## 1. Carácter

Un **informe de datos en pantalla, vivo y claro**. Fondo blanco para leer, una tinta, un gris y **un color vivo por
página, el de su serie**: campo verde, caldera naranja óxido, mercado azul. La estructura sale del espacio, la escala,
el peso y un tono de superficie, no de líneas ni de rótulos. Cada pantalla tiene algo que manda: la cifra que responde,
su gráfica o la decisión.

Lo que pidió el autor después de ver el avance, y que manda sobre cualquier otra regla:

1. **Color con presencia.** La portada de cada página de caso va sobre un campo del color de su serie, con el texto en
   blanco. Las cifras clave y la serie principal de las gráficas van en el color de la serie; la banda de la Evaluación,
   en su tinte claro; el botón y la pestaña activa, en su color. El fondo de lectura sigue blanco. Un color por página
   manda, más la tinta: vivo, no chillón.
2. **Títulos más chicos.** h1 de 32 → 55 px, h2 de 26 → 34 px, h3 de 18 → 21 px, cifras de 32 → 40 px. La jerarquía la
   dan el peso, el color y el espacio, no solo el tamaño.
3. **La navegación interna se ve como navegación.** Barra fija bajo el encabezado, a todo el ancho, sobre el tinte de la
   serie, con el rótulo "En esta página" y pestañas con relleno. La activa, rellena del color de la serie y en blanco.
   Sin números en los rótulos.
4. **Cada columna se lee como unidad.** Tablas con cabecera sobre una banda de tono, cebra, relleno generoso y sin líneas
   de 1 px. Cifras, Evaluación, listas en columnas y comparaciones: cada columna con su barra de 4 px (o su panel), su
   título y 32-48 px de separación.
5. **La presentación (`/presentacion`) no es referencia de diseño.** Se rediseña al final. Fija sus propios tokens en
   su raíz (`Diapositivas.module.css`) para seguir funcionando; ninguna página la imita.

Prohibido (se ve "hecho por IA", de plantilla o de informe impreso de imitación):
- fondo crema o papel; degradados, vidrio, sombras en cosas quietas, tarjetas flotantes con esquinas redondeadas;
- rótulos sobre los títulos (eyebrows): "Serie I · Campo", "Pregunta 1 ·", "Figura 1" como rótulo aparte;
- mayúsculas espaciadas; monoespaciado fuera de `<pre>`/`<code>`;
- numeración decorativa: 00/01/02, "1 · Datos", "Paso 3", "H1" como rótulo;
- líneas de 1 px decorativas y cajas con contorno (la única línea de 1 px es el borde de los campos de formulario);
- más de un color de serie mandando en la misma pantalla; el ámbar como línea o texto;
- emojis, íconos decorativos, ilustraciones genéricas, imágenes de stock;
- texto corrido gris o de menos de 16 px; notas de menos de 14 px;
- títulos de más de dos renglones;
- frases de marketing ("descubre", "potencia", "revoluciona", "impulsa", "en el mundo actual", "de vanguardia",
  "solución integral", "toma decisiones basadas en datos", "insights", "robusto" como muletilla);
- signos de exclamación, preguntas retóricas en serie, listas de tres adjetivos;
- el guion largo (—) como pausa en el texto corrido: usar punto, coma o dos puntos;
- títulos que no dicen nada ("Resultados", "Análisis"): el título dice el hallazgo.

## 2. Voz y redacción

- Español de Guatemala, frases cortas, una idea por frase. Sin jerga si hay palabra simple; si hace falta un término
  técnico, se explica una vez en lenguaje llano.
- **Primera persona singular** para recomendaciones y decisiones ("Recomiendo ampliar…", "Descarté…"). El autor es
  Edgar Sierra. Nunca "nosotros" ni "el equipo".
- **Nunca nombrar a ningún ingenio.** Al cliente se le dice "el ingenio".
- Cada afirmación con número lleva el número y, cerca, su fuente (figura, tabla o "notebook 02").
- La incertidumbre se dice siempre: banda, intervalo, certeza alta/media/baja y por qué.
- Los datos son públicos y de otros lugares (Louisiana; una caldera a carbón en China; FAOSTAT y el No. 11). Se traslada
  **el método**, no las cifras. Decirlo donde corresponda, sin repetirlo en cada párrafo.
- Números: punto decimal y coma de miles (`1,143`, `0.30 %`, `US$526.3`) con `src/lib/formato.ts`. Signo menos
  tipográfico (−). Unidad después del número con espacio (`0.18 t/h`, `22 %`).
- Largos máximos: h1 38 caracteres; h2 45; entrada 25 palabras; título de figura 90 caracteres. El resto del hallazgo
  va en la entrada.

## 3. Color

Tokens en `src/app/globals.css`. Nunca escribir colores sueltos en CSS; usar variables. `PlotFigura.COLORES` es su espejo
para las gráficas. Contraste WCAG calculado (blanco #ffffff, tinta #16181b).

**Neutros**

| Token | Hex | Uso | Contraste |
|---|---|---|---|
| `--fondo` | #ffffff | fondo de lectura | — |
| `--superficie` | #f3f4f6 | Nota, Desplegable, paneles, botón secundario neutro | 1.10:1 contra blanco |
| `--superficie-2` | #e7eaee | hover de filas, código en línea, tinte neutro | 1.21:1 |
| `--cebra` | #f2f4f7 | filas alternas de tabla | 1.10:1 |
| `--tinta` | #16181b | todo el texto corrido, títulos | 17.8:1 sobre blanco; ≥ 12.5:1 sobre cualquier tinte |
| `--apagado` | #585e66 | fuentes, notas de figura, ejes, rótulos de meta | 6.6:1 sobre blanco; ≥ 4.6:1 sobre tintes medios |
| `--sobre-tinta` / `--sobre-tinta-2` | #ffffff / #c4c8ce | texto sobre campos de tinta | 17.8:1 / 10.6:1 |
| `--borde-control` | #80868e | borde de inputs y select | 3.7:1 sobre blanco, ≥ 3.0:1 sobre los tintes y superficies (WCAG 1.4.11) |

**Series** (cuatro pasos cada una)

| Serie | base `--x` | vivo `--x-vivo` | fondo `--x-fondo` | medio `--x-medio` |
|---|---|---|---|---|
| Campo | #137a3c · 5.42:1 · 4.74:1 sobre su fondo | #1c9b4c · 3.59:1 | #e3f4e8 | #c3e6cd |
| Caldera | #bb3e0b · 5.52:1 · 4.77:1 sobre su fondo | #f4570f · 3.38:1 | #fdebe3 | #f9d0bd |
| Mercado | #2160e0 · 5.51:1 · 4.77:1 sobre su fondo | #3b7cf5 · 3.90:1 | #e8effd | #c9dafa |

- **base**: texto en color, botones, pestaña activa, campo de la portada (blanco encima ≥ 5.4:1), cifras, barras de
  4 px, serie principal de las gráficas.
- **vivo**: solo rellenos grandes de gráficas (áreas, barras anchas). Nunca texto ni líneas finas.
- **fondo** (tinte claro): barra del índice, banda de la Evaluación, cabecera de tabla, panel de capítulo en inicio,
  panel de controles de las herramientas.
- **medio**: hover de pestañas, fila destacada de tabla, segmentos vacíos de Certeza, selección de texto.
- La caldera es naranja óxido encendido: saturación 0.89 y luminosidad 0.39 la dejan fuera de la familia "terracota"
  del inspector, y su tinte (tono 18°) fuera de "crema".

**Gráficas**: `--contexto` #878d95 (3.35:1, líneas de contexto), `--contexto-suave` #d3d7dc, `--rejilla` #e7e9ec,
`--resalte` #e3a92f (ámbar, solo relleno de franjas al 25-30 %, nunca línea ni texto).

**Estado**: `--certeza-media` #8a6410 (5.4:1), `--certeza-baja` / `--alerta` #a8380c (6.5:1), `--en-linea` = campo. El
medidor de Certeza usa el color de la página, no un semáforo.

### Cómo se fija el color de una página

Una vez, en el contenedor de la página:

```tsx
<div data-serie="campo">            {/* o "caldera" | "mercado" */}
  <Portada serie="campo" … />        {/* serie también aquí: elige el fondo "serie" de la portada */}
  <IndiceLocal … />
  <Seccion …>…</Seccion>
</div>
```

`[data-serie]` define `--serie`, `--serie-vivo`, `--serie-fondo`, `--serie-medio` y `--acento` para todo lo de adentro:
pestañas, botones (`.boton`), enlaces (subrayado), cifras, tablas, Evaluación, Certeza, Desplegable, listas y gráficas
(`PlotFigura` lee `--serie` del bloque donde vive). El encabezado del sitio toma el color de la ruta (/campo, /caldera,
/mercado) sin que la página haga nada. Sin `data-serie` la página es neutra: manda la tinta y los tintes son grises.
Un bloque puede llevar su propio `data-serie` (por ejemplo, cada herramienta en `/herramientas`), y la pestaña del índice
de esa sección toma ese color.

## 4. Tipografía

- **Newsreader 500** (`--fuente-titulo`): h1, h2, valores de Cifra y la marca. Sin itálica.
- **Public Sans 400/600** (`--fuente-texto`): todo lo demás, incluidos h3/h4, tablas, gráficas, navegación, botones y
  formularios. Cifras alineadas con `font-variant-numeric: tabular-nums lining-nums` (clases `.num` y `.dato`).
- **Monoespaciado del sistema** (`--fuente-codigo`) solo en `<pre>`, `<code>` y `<kbd>`. No se descarga ninguna fuente
  monoespaciada.

Escala (390 → 1440 px). Siete pasos; los que se ven en una pantalla normal son tres o cuatro:

| Token | Tamaño | Uso |
|---|---|---|
| `--t-pequeno` | 14 | fuentes, ejes, cabecera de tabla, meta, ayudas. Nunca párrafos |
| `--t-texto` | 16 → 17 | párrafos, celdas, controles, navegación, títulos de figura (600) |
| `--t-entrada` | 18 → 21 | entradas, h3, la decisión de la Evaluación, la marca |
| `--t-titulo` | 26 → 34 | h2 |
| `--t-cifra` | 32 → 40 | valores de Cifra |
| `--t-portada` | 32 → 55 | h1 |
| `--t-pieza` | 44 → 72 | la cifra que responde en la portada (`CifraPortada`): la pieza dominante de la página |

Interlineado: h1 1.08, h2 1.15, h3 1.3, cifras 1.05, entrada 1.45, texto 1.6, pequeño 1.45. `text-wrap: balance` en
títulos y `pretty` en párrafos. Medida: párrafos 64ch, entrada 46ch. Nunca `text-transform`, nunca tracking positivo.

Clases globales: `.entrada`, `.pequeno`, `.apagado`, `.en-serie`, `.num`/`.dato`, `.texto`, `.contenedor`,
`.contenedor-medio`, `.contenedor-texto`, `.rejilla`, `.lectura`, `.columnas`, `.paneles`, `.tinte`, `.pila`,
`.pila-grande`, `.boton`, `.boton-sec`, `.campo-form`, `.solo-lectores`. `.etiqueta` queda neutralizada (14 px, sin
mayúsculas) mientras se borra de las páginas.

## 5. Espaciado y ritmo

- Rejilla de 12 columnas. `--margen` de 16 px (390) a 40 px (1440), iguales a los dos lados; `--ancho-max` 90rem;
  medianil de 16 a 24 px. `--span-4…8` = N columnas del marco (bajo 900 px valen 100 %).
- Dos bordes izquierdos: columna 1 (todo el texto) y columna 7-9 (la pieza de la portada, las cifras al lado del
  encabezado, el margen de `.lectura`). La columna derecha se usa: pieza, meta, cifras o margen, nunca vacía.
- Escala base 4: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 160 (`--e-1` … `--e-11`).
- Entre secciones `--ritmo-seccion` (≈150 px escritorio, 80 teléfono). Dentro, entre bloques, `--ritmo-bloque` (≈64 /
  40 px). Arriba de un título, al menos el doble de espacio que abajo.
- Entre columnas que se leen por separado, `--sep-columnas` (32 → 48 px). Barra de columna `--barra` (4 px).
- Encabezado 64 px (56 en teléfono); índice 56 px (52). `scroll-padding-top` los descuenta.

## 6. Componentes (`src/components`)

| Componente | Props (las nuevas en **negrita**) | Qué hace |
|---|---|---|
| `Encabezado` | — | marca, 6 enlaces, "Presentar". Toma el color de la serie de la ruta |
| `Portada` | `titulo`, `entrada`, `serie`, `meta`, `acciones`, `children`, **`pieza`**, **`piezaPanel`**, **`fondo`** (`"serie"`, `"tinta"`, `"tinte"`, `"blanco"`); `etiqueta` se acepta y no se pinta | primer pantallazo. Por omisión, campo del color de la serie (con `serie`) o de tinta (sin ella), texto en blanco. Con `pieza`: pieza en las columnas 8-12 y meta bajo la entrada; sin pieza: meta en la columna derecha |
| `CifraPortada` | `valor`, `unidad`, `etiqueta`, `detalle` | la cifra que responde, a 44 → 72 px, para `pieza` (va sin panel; cualquier otra pieza va en panel blanco sobre el campo) |
| `IndiceLocal` | `items` (`id`, `etiqueta`), `serie`, `titulo` (etiqueta accesible) | barra fija de navegación con pestañas. Quita la numeración de las etiquetas. Cada pestaña toma el color de la serie de su sección. Si las pestañas no caben, la fila se desplaza de lado y asoma una flecha de 44 px (‹ ›) en el borde donde siguen; la activa se mantiene a la vista |
| `Seccion` | `id`, `titulo`, `entrada`, `cifras`, `ancho` (`texto`/`medio`/`total`), **`serie`**; `numero` y `etiqueta` se aceptan y no se pintan | h2 con el hallazgo, entrada y, desde 1100 px, `cifras` en las columnas 7-12 |
| `Cifra`, `FilaCifras` | `valor`, `unidad`, `etiqueta`, `detalle`, `serie`, `tono` (`"serie"`/`"tinta"`); `columnas` (2-4) | cada cifra es una columna: barra de 4 px, valor en el color de la serie, título en 600, detalle de 14 px |
| `Evaluacion` | `significa`, `decision`, `impacto`, `riesgo`, `certeza`, `serie`, `titulo`, `ancho` (`pantalla`/`marco`) | banda del tinte de la serie a todo el ancho. La decisión primero, en panel blanco; luego tres columnas con barra; al final la certeza |
| `Certeza` | `nivel`, `children` | "Certeza alta" y un medidor de 3 segmentos en el color de la página |
| `Figura` | `numero`, `titulo`, `nota`, `fuente`, `ancho` | "Figura 3. La conclusión" en una línea de 17 px 600; nota y fuente debajo |
| `ImagenNotebook` | `nombre`, `alt` | PNG de `outputs/figures`, sin marco |
| `Tabla` | `columnas` (`tipo: "num"` a la derecha), `filas`, `destacar`, `titulo`, `numero`, `nota`, `compacta`, `movil` (`"desplazar"`/`"apilar"`), `ancho` | cabecera en banda de tinte, cebra, sin líneas; fila destacada en tinte medio con barra de 4 px. En teléfono, `apilar` para tablas de texto y `desplazar` (primera columna fija) para las numéricas. Sin `movil` elige sola: `desplazar` si alguna columna es `num`, `apilar` si todas son de texto. Rótulos de la primera columna de 18 caracteres o menos no se parten |
| `Nota` | `tipo` (`limite`/`dato`/`metodo`), `titulo` | panel de superficie; el tipo entra al título ("Límite: …") |
| `Desplegable` | `titulo` | barra de superficie con +/− en el color de la página |
| `Pie` | — | campo de tinta con la frase de cierre, de qué trata el sitio y los enlaces |
| `Movimiento` | — | entrada discreta de los bloques con `data-entrada` (ver §10) |
| `graficos/PlotFigura` | `crear(ancho, tema)`, `alto`, `etiqueta`, `dependencias` | gráfica de Observable Plot. **`tema`** trae los colores del bloque (`tema.serie`, `serieVivo`, `serieFondo`…) |

Utilidades de maqueta para columnas: `.columnas` (cada hijo con barra de 4 px y su título, 32-48 px entre columnas) y
`.paneles` (cada hijo en panel de superficie). `.lectura` pone la narrativa en las columnas 1-7 y su margen en 9-12.
`.tinte` es un bloque sobre el tinte de la página.

Botones: `.boton` (relleno del color de la página, texto blanco) y `.boton-sec` (tinte de la página, texto en tinta). Un
panel que ya va sobre el tinte (`.tinte`, los controles de una herramienta, la Portada en modo `"tinte"`) define
`--boton-sec-fondo: var(--fondo)` y sus botones secundarios pasan a blanco; si no, se pierden contra el fondo.

Componentes propios de una página van en una carpeta privada junto a ella (`app/(sitio)/campo/_componentes/`).

## 7. Tablas y columnas

- Tabla: título arriba ("Tabla 3. …", 17 px 600). Cabecera en 14 px 600 tinta sobre `--serie-fondo`. Celdas de 17 px
  con relleno 13/16 px. Filas alternas en `--cebra`. Primera columna en 600. Números a la derecha, tabulares, con
  decimales fijos por métrica y signo menos tipográfico. Fila destacada en `--serie-medio` con barra de 4 px. Sin una
  sola línea de 1 px. Hover (escritorio) en `--superficie-2`.
- Bloques de 2-3 columnas: cada columna con barra de 4 px del color de la página (o panel de superficie), su propio
  título y 32-48 px de separación (`.columnas`, `.paneles`, `FilaCifras`, `Evaluacion`).

## 8. Gráficas

- Se dibujan con **Observable Plot** (`PlotFigura`) a partir de los JSON de `src/datos`. Texto de 14 px (los rótulos directos dentro de la gráfica, 13 px como mínimo; nunca 11), ejes y unidades
  en `apagado`, rejilla solo en el eje de valores.
- Un tono por gráfica: el color de la serie (`COLORES.campo`… o `tema.serie`) para lo que importa, en 2-2.5 px;
  contexto en `COLORES.contexto`, 1.5 px; testigo o referencia en tinta discontinua de 1 px. Bandas de incertidumbre en
  el color de la serie al 14 % o en `…Fondo`. Una segunda serie destacada va en el mismo color con trazo discontinuo,
  nunca en ámbar. Barras: la que responde en `…Vivo` o en la base, las demás en `contexto`.
- Rótulo directo al final de la línea en vez de leyenda. Si hace falta leyenda, una fila de 14 px arriba.
- Toda gráfica va dentro de `Figura` con `numero`, título que dice la conclusión, `nota` de cómo leerla y `fuente`.
  `PlotFigura` lleva `etiqueta` (texto alternativo con la conclusión).
- PNG de los notebooks (`ImagenNotebook`): dentro de "Figuras originales", en cuadrícula de 2 columnas; uno a la vista
  por página cuando es la mejor prueba.
- Las gráficas son componentes cliente que reciben datos ya filtrados desde la página (componente de servidor).

## 9. Datos: cada cifra sale del análisis

- `npm run dev`/`build` corren `scripts/sincronizar-datos.mjs`, que copia `../outputs` a `src/datos/*.json` y
  `public/figuras/*.png`. El catálogo está en `src/datos/_catalogo.json`.
- Importar así: `import resumen from "@/datos/serie1_resumen_q1.json"`. Calcular derivados en la página.
- **Si una cifra existe en un JSON, se lee del JSON; no se escribe a mano.** Si solo existe en la salida de un notebook
  o en el README, se escribe con un comentario al lado: `{/* fuente: notebook 05, celda 7 */}`.
- No inventar cifras, no redondear distinto de los notebooks, no mezclar unidades sin decirlo.

## 10. Movimiento

Movimiento de informe: mueve lo que ya está y nunca esconde contenido. Solo `transform` y `opacity`, una vez por
elemento, con la curva `--curva` (cubic-bezier(0.2, 0, 0, 1)).

- Entrada de bloques: los elementos con `data-entrada` (h2, entrada y cifras de cada Seccion; cada Cifra; decisión y
  columnas de la Evaluación) suben 12 px con opacidad en 300 ms, escalonados 60 ms, al asomar. `Movimiento` les pone la
  clase `.entrando`; la animación vive en `globals.css` y solo existe con `prefers-reduced-motion: no-preference`.
- Gráficas: las líneas se trazan en 600 ms, las barras crecen desde la base y los puntos aparecen, la primera vez que la
  gráfica entra en pantalla; al cambiar un supuesto, fundido de 200 ms.
- Controles: botones (fondo en 120 ms y 1 px al presionar), enlaces (subrayado de 1 a 2 px), pestañas (relleno en
  150 ms), enlaces del encabezado (barra que asoma), filas de tabla (hover), Desplegable (+ → −).
- Con `prefers-reduced-motion: reduce`: nada se traslada ni se traza; `scroll-behavior: auto`.

## 11. Estructura de una página de caso

1. `Portada` sobre el campo de la serie, con su `pieza` (la cifra que responde, la gráfica principal o la cosa viva).
2. `IndiceLocal` con las preguntas, sin numeración.
3. Por pregunta, una `Seccion`: h2 con el hallazgo corto, entrada y `cifras` al lado; evidencia (figuras y tablas con
   texto corto); qué descarté; `Nota tipo="limite"`; `Evaluacion`; "Para verificar" (desplegables y enlace al notebook,
   juntos al final, a 8 px uno de otro).
4. `Pie`.

## 12. Accesibilidad y respuesta

WCAG AA: todo texto a 4.5:1 o más (incluido el gris y el texto sobre los campos de color), foco visible (2 px en tinta,
o en blanco sobre los campos; también en lo que Chrome enfoca solo, como una tabla con desplazamiento lateral), `alt`/`etiqueta` en gráficas, tablas con encabezados, nada que dependa solo del color.
Texto corrido de 16 px o más, notas de 14 px o más. Objetivos táctiles de 44 px. En teléfono: ningún texto a menos de
16 px del borde, tablas de texto apiladas, pestañas del índice de 44 px que se desplazan de lado.

## 13. Presentación

`/presentacion` no sigue este sistema todavía (se rediseña al final). `Diapositivas.module.css` fija en su raíz los
valores viejos de los tokens (papel, tinta cálida, colores de serie de antes) para que siga funcionando igual, y
`PlotFigura` no anima ni retoca ejes dentro de `[data-presentacion]`.

## 14. Rutas

| Ruta | Archivo |
|---|---|
| `/` | `app/(sitio)/page.tsx` |
| `/campo`, `/caldera`, `/mercado` | `app/(sitio)/<caso>/page.tsx` |
| `/api` | `app/(sitio)/api/page.tsx` |
| `/herramientas` | `app/(sitio)/herramientas/page.tsx` |
| `/asistente` | `app/(sitio)/asistente/page.tsx` |
| `/presentacion` | `app/presentacion/page.tsx` (sin encabezado ni pie) |

`next/link` agrega la ruta base solo. Para `<img>`, descargas o archivos de `public/` usar `ruta()` o `figura()` de
`src/lib/base.ts`. La API se consume con `consultar()` de `src/lib/api.ts` (`NEXT_PUBLIC_API_URL`).
