// Copia las salidas de los notebooks (../outputs) al sitio, para que cada cifra salga del análisis y no de un texto.
//   outputs/models/*.json, outputs/tables/*.json  -> src/datos/<nombre>.json
//   outputs/tables/*.csv                          -> src/datos/<nombre>.json  (lista de filas; números como números)
//   outputs/figures/*.png                         -> public/figuras/<nombre>.png
// También escribe src/datos/_catalogo.json con columnas y número de filas de cada tabla.
// Se corre solo antes de `npm run dev` y `npm run build`. Si ../outputs no existe, deja lo que ya hay.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const WEB = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(WEB, "..", "outputs");
const DATOS = join(WEB, "src", "datos");
const FIGURAS = join(WEB, "public", "figuras");

if (!existsSync(OUT)) {
  console.log("sincronizar-datos: no encontré ../outputs; uso los datos ya copiados.");
  process.exit(0);
}
mkdirSync(DATOS, { recursive: true });
mkdirSync(FIGURAS, { recursive: true });

// CSV con comillas, comas dentro de comillas y saltos de línea Windows.
function leerCSV(texto) {
  const filas = [];
  let campo = "", fila = [], enComillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (enComillas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') enComillas = false;
      else campo += c;
    } else if (c === '"') enComillas = true;
    else if (c === ",") { fila.push(campo); campo = ""; }
    else if (c === "\n") { fila.push(campo.replace(/\r$/, "")); filas.push(fila); fila = []; campo = ""; }
    else campo += c;
  }
  if (campo !== "" || fila.length) { fila.push(campo.replace(/\r$/, "")); filas.push(fila); }
  const [encabezado, ...resto] = filas.filter((f) => f.length > 1 || f[0] !== "");
  const columnas = encabezado.map((c, i) => (c === "" ? (i === 0 ? "indice" : `col${i}`) : c));
  return resto.map((f) => Object.fromEntries(columnas.map((c, i) => [c, convertir(f[i])])));
}

function convertir(v) {
  if (v === undefined || v === "") return null;
  if (/^-?\d+(\.\d+)?(e-?\d+)?$/i.test(v)) return Number(v);
  if (v === "True" || v === "False") return v === "True";
  if (v === "nan" || v === "NaN") return null;
  return v;
}

const catalogo = {};
for (const carpeta of ["models", "tables"]) {
  for (const archivo of readdirSync(join(OUT, carpeta))) {
    const origen = join(OUT, carpeta, archivo);
    const nombre = basename(archivo, extname(archivo));
    if (extname(archivo) === ".json") {
      // Python escribe NaN en algunos JSON; JSON estándar no lo acepta.
      const texto = readFileSync(origen, "utf8").replace(/\bNaN\b/g, "null").replace(/-?\bInfinity\b/g, "null");
      writeFileSync(join(DATOS, `${nombre}.json`), JSON.stringify(JSON.parse(texto)));
      catalogo[nombre] = { origen: `outputs/${carpeta}/${archivo}`, tipo: "json" };
    } else if (extname(archivo) === ".csv") {
      const filas = leerCSV(readFileSync(origen, "utf8"));
      writeFileSync(join(DATOS, `${nombre}.json`), JSON.stringify(filas));
      catalogo[nombre] = { origen: `outputs/${carpeta}/${archivo}`, tipo: "tabla", filas: filas.length, columnas: Object.keys(filas[0] ?? {}) };
    }
  }
}
writeFileSync(join(DATOS, "_catalogo.json"), JSON.stringify(catalogo, null, 1));

let figuras = 0;
for (const archivo of readdirSync(join(OUT, "figures"))) {
  if (extname(archivo) === ".png") { copyFileSync(join(OUT, "figures", archivo), join(FIGURAS, archivo)); figuras++; }
}
console.log(`sincronizar-datos: ${Object.keys(catalogo).length} archivos de datos y ${figuras} figuras copiados.`);
