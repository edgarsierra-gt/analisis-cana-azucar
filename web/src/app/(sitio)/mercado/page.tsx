import type { Metadata } from "next";
import Link from "next/link";
import { Cifra, FilaCifras } from "@/components/Cifra";
import { Evaluacion } from "@/components/Evaluacion";
import { Figura, ImagenNotebook } from "@/components/Figura";
import { IndiceLocal } from "@/components/IndiceLocal";
import { Desplegable, Nota } from "@/components/Nota";
import { Portada } from "@/components/Portada";
import { Seccion } from "@/components/Seccion";
import { Tabla } from "@/components/Tabla";
import calidad from "@/datos/serie3_calidad_paises.json";
import grupos from "@/datos/serie3_grupos_paises.json";
import panel from "@/datos/serie3_panel_oferta.json";
import precioDiario from "@/datos/serie3_precio_diario.json";
import pronostico from "@/datos/serie3_pronostico.json";
import pronosticosH1 from "@/datos/serie3_pronosticos_h1.json";
import pronosticosH3 from "@/datos/serie3_pronosticos_h3.json";
import p1 from "@/datos/serie3_resumen_p1.json";
import p2 from "@/datos/serie3_resumen_p2.json";
import p3 from "@/datos/serie3_resumen_p3.json";
import p4 from "@/datos/serie3_resumen_p4.json";
import { archivoRepo } from "@/lib/base";
import { conSigno, num } from "@/lib/formato";
import { cierreSemanal, cuantil, enLista, es, media, ordinal, redondeoPar, textoP } from "./_componentes/datos";
import { Descartes } from "./_componentes/Descartes";
import { partirEncabezados } from "./_componentes/encabezados";
import { GraficoBanda, type BandaMes } from "./_componentes/GraficoBanda";
import { GraficoErrores, type ErrorModelo } from "./_componentes/GraficoErrores";
import { GraficoGuatemala, type AnioGuatemala } from "./_componentes/GraficoGuatemala";
import { GraficoPaises, type PuntoPais } from "./_componentes/GraficoPaises";
import { GraficoPrecio } from "./_componentes/GraficoPrecio";
import { GraficoRezagos, type Rezago } from "./_componentes/GraficoRezagos";
import s from "./_componentes/Mercado.module.css";

export const metadata: Metadata = {
  title: "Mercado",
  description:
    "Producción mundial de caña y precio del azúcar No. 11: datos poco confiables de FAOSTAT, la trayectoria de Guatemala, regímenes de volatilidad, pronóstico a 1 y 3 meses con bandas y respuesta de la oferta al precio.",
};

// ─── 01 · Países ─────────────────────────────────────────────────────────────
const paises = grupos.map((g) => ({ pais: g.indice, crecArea: g.crec_area, rend: g.rend_2014_2023, grupo: g.grupo_nombre }));
const corteArea = cuantil(paises.map((p) => p.crecArea), 0.75);
const corteRend = cuantil(paises.map((p) => p.rend), 0.75);
const enCuadrante = paises.filter((p) => p.crecArea > corteArea && p.rend > corteRend).map((p) => p.pais);
const pares = p1.guatemala.pares;
const puntosPaises: PuntoPais[] = paises.map((p) => ({
  ...p,
  nombre: es(p.pais),
  papel: p.pais === "Guatemala" ? "guatemala" : pares.includes(p.pais) ? "par" : enCuadrante.includes(p.pais) ? "cuadrante" : "otro",
}));
const otrosCuadrante = enCuadrante.filter((p) => p !== "Guatemala").map(es);
const primeroRend = [...paises].sort((a, b) => b.rend - a.rend)[0];
const gt = p1.guatemala;

// Guatemala en FAOSTAT, del panel de la pregunta 4 (el mismo archivo depurado).
const filasGt = panel.filter((f) => f.pais === "Guatemala");
const anioGt = (desde: number, hasta: number, campo: "area" | "prod") =>
  media(filasGt.filter((f) => f.anio >= desde && f.anio <= hasta).map((f) => Number(f[campo])));
const veces = (campo: "area" | "prod") => anioGt(2019, 2023, campo) / anioGt(1961, 1965, campo);
const areaGt = (anio: number) => Number(filasGt.find((f) => f.anio === anio)!.area) / 1e3;
const serieGt: AnioGuatemala[] = filasGt.map((f) => ({
  anio: f.anio,
  area: Number(f.area) / 1e3,
  prod: Number(f.prod) / 1e6,
  banderaArea: f.f_area,
  banderaProd: f.f_prod,
}));

// Porcentaje de datos de producción oficiales por año en los 71 países (misma regla del notebook 10).
const conProduccion = panel.filter((f) => Number(f.prod) > 0);
const pctOficial = (anio: number) => {
  const delAnio = conProduccion.filter((f) => f.anio === anio);
  return (100 * delAnio.filter((f) => f.f_prod === "A").length) / delAnio.length;
};
const aniosPanel = [...new Set(conProduccion.map((f) => f.anio))];
const oficialAntes = media(aniosPanel.filter((a) => a <= 2009).map(pctOficial));
const oficial2023 = pctOficial(2023);

// Las cinco alertas del notebook 10 (celda 10): más de 50 % de producción no oficial, 5 años o más con el mismo
// rendimiento, 3 o más saltos de más de 50 %, variación del rendimiento menor a 1.5 % y rendimiento 2014-2023 menor a 30 t/ha.
type FilaCalidad = {
  pais: string; alertas: number; noOficialProd: number; noOficialArea: number; racha: number; saltos: number; variacion: number; rend: number;
};
const pocoConfiables: FilaCalidad[] = p1.poco_confiables.map((pais) => {
  const c = calidad.find((x) => x.indice === pais)!;
  // Sin dato cuenta como sin alerta, igual que una comparación con NaN en pandas.
  const variacion = c.variacion_rend ?? NaN;
  const rend = c.rend_2014_2023 ?? NaN;
  const alertas =
    Number(c.pct_no_oficial_prod > 50) + Number(c.racha_constante_rend >= 5) + Number(c.saltos_rend_50pct >= 3) +
    Number(variacion < 1.5) + Number(rend < 30);
  return {
    pais: es(pais),
    alertas,
    noOficialProd: c.pct_no_oficial_prod,
    noOficialArea: c.pct_no_oficial_area,
    racha: c.racha_constante_rend,
    saltos: c.saltos_rend_50pct,
    variacion,
    rend,
  };
});
const rachaLiberia = calidad.find((x) => x.indice === "Liberia")!.racha_constante_rend;
const rachaGhana = calidad.find((x) => x.indice === "Ghana")!.racha_constante_rend;

const ks = ["2", "3", "4", "5", "6"] as const;
const pGrupos = (["3", "4", "5"] as const).map((k) => p1.silueta[k].p);
type FilaSilueta = { k: string; silueta: number; nulo: number; nulo95: number; p: number; ari: number };
const filasSilueta: FilaSilueta[] = ks.map((k) => ({
  k,
  silueta: p1.silueta[k].silueta,
  nulo: p1.silueta[k]["nulo (media)"],
  nulo95: p1.silueta[k]["nulo p95"],
  p: p1.silueta[k].p,
  ari: p1.estabilidad[k]["ARI mediana"],
}));
const nGrupo = (g: keyof typeof p1.perfil) => p1.perfil[g]["países"];

// ─── 02 · Precio ─────────────────────────────────────────────────────────────
const aud = p2.auditoria;
const semanas = cierreSemanal(precioDiario);
const turbulento = p2.regimenes.Turbulencia;
const calma = p2.regimenes.Calma;
const unaCada = (x: number) => num(1 / x, 0);
const volMediana = cuantil(Object.values(p2.vol_anual), 0.5);
const colas4 = p2.colas["|z| > 4"];
const top25 = Object.values(p2.top25_por_tipo).reduce((a, b) => a + b, 0);
// Tramos de turbulencia de 4 semanas o más (probabilidad suavizada > 0.5), por mes.
// fuente: notebook 11, celda 14 (tabla de tramos). Se dibujan del primer día del mes de inicio al último del mes final.
const TURBULENCIA = [
  ["2000-03", "2000-11"], ["2002-01", "2002-07"], ["2004-01", "2004-05"], ["2006-01", "2006-02"], ["2006-07", "2006-11"],
  ["2008-02", "2009-02"], ["2009-06", "2011-10"], ["2016-01", "2016-04"], ["2020-02", "2020-07"],
];
const finDeMes = (ym: string) => {
  const [a, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(a, m, 1)).toISOString().slice(0, 10);
};
const tramosTurbulencia = TURBULENCIA.map(([desde, hasta]) => ({ desde: `${desde}-01`, hasta: finDeMes(hasta) }));
const anioUltimoTramoLargo = Number(TURBULENCIA[6][1].slice(0, 4));

type FilaTipoDia = { tipo: string; dias: number; crudo: number; brecha: number; intradia: number };
const filasTipoDia: FilaTipoDia[] = (["normal", "fin de mes sin vencimiento", "vencimiento", "cambio de contrato"] as const).map((t) => ({
  tipo: t[0].toUpperCase() + t.slice(1),
  dias: p2.por_tipo_de_dia[t]["días"],
  crudo: p2.por_tipo_de_dia[t].crudo,
  brecha: p2.por_tipo_de_dia[t].brecha,
  intradia: p2.por_tipo_de_dia[t].intradia,
}));
const cambio = p2.por_tipo_de_dia["cambio de contrato"];
const normal = p2.por_tipo_de_dia.normal;

type FilaColas = { umbral: string; observados: number; esperados: number; veces: number };
const filasColas: FilaColas[] = (["|z| > 3", "|z| > 4", "|z| > 5"] as const).map((k) => ({
  umbral: `Más de ${k.slice(-1)} desviaciones`,
  observados: p2.colas[k]["días (desviación estándar)"],
  esperados: p2.colas[k]["esperados si fuera normal"],
  veces: p2.colas[k]["veces más (desviación estándar)"],
}));

// ─── 03 · Pronóstico ─────────────────────────────────────────────────────────
const MODELOS = [
  ["Ingenuo: último cierre", "Último cierre"],
  ["Ingenuo: promedio del mes", "Promedio del mes"],
  ["ARIMA(1,1,0) sobre promedios", "ARIMA sobre promedios"],
  ["Regresión: momentum y reversión", "Regresión con momentum"],
] as const;
const errores = (h: "1" | "3"): ErrorModelo[] =>
  MODELOS.map(([clave, corto]) => ({
    modelo: corto,
    mae: p3.metricas[h][clave]["MAE (¢/lb)"],
    peor: -p3.metricas[h][clave]["mejora vs último cierre (%)"],
    ganador: clave === "Ingenuo: último cierre",
  }));
const ingenuo1 = p3.metricas["1"]["Ingenuo: último cierre"];
const ingenuo3 = p3.metricas["3"]["Ingenuo: último cierre"];
const arima1 = p3.metricas["1"]["ARIMA(1,1,0) sobre promedios"];
const regresion1 = p3.metricas["1"]["Regresión: momentum y reversión"];
const regresion3 = p3.metricas["3"]["Regresión: momentum y reversión"];
const pruebaRegresion1 = p3.pruebas.find((x) => x.h === 1 && x.modelo === "Regresión: momentum y reversión")!;

// Una tonelada métrica tiene 2,204.62 lb. fuente: notebook 12, celda 17 (conversión usada en el pronóstico).
const USD_T_POR_CENTAVO = 2204.62 / 100;

const vigJun = p3.vigente["junio 2024"];
const vigAgo = p3.vigente["agosto 2024"];
const rel = (x: number, c: number) => (100 * x) / c - 100;
const rango80 = (v: typeof vigJun) => `${conSigno(rel(v.p10, v.centro), 0)} % a ${conSigno(rel(v.p90, v.centro), 0)} %`;
const bandasVigentes: BandaMes[] = [
  { mes: "junio 2024", fecha: "2024-06-15", ...vigJun },
  { mes: "agosto 2024", fecha: "2024-08-15", ...vigAgo },
].map((b) => ({ mes: b.mes, fecha: b.fecha, centro: b.centro, p2_5: b["p2.5"], p10: b.p10, p90: b.p90, p97_5: b["p97.5"] }));
const realesRecientes = pronosticosH1.slice(-24).map((f) => ({ fecha: `${f.objetivo.slice(0, 8)}15`, valor: f.real }));
const fechaOrigen = pronostico.fecha_origen.split("-").reverse().join("/");
const distanciaAgosto = vigAgo.centro - vigAgo.p10;
const anchoBanda = (v: typeof vigJun) => v.p90 - v.p10;

type FilaVigente = { mes: string; centro: number; p2_5: number; p10: number; p90: number; p97_5: number; rango: string };
const filasVigentes: FilaVigente[] = bandasVigentes.map((b, i) => ({ ...b, rango: rango80(i === 0 ? vigJun : vigAgo) }));

type FilaBandas = { banda: string; cob80: number; cob95: number; ancho: number; winkler: number };
const filasBandas: FilaBandas[] = (["1|fija", "1|según volatilidad", "3|fija", "3|según volatilidad"] as const).map((k) => ({
  banda: `${k.startsWith("1") ? "1 mes" : "3 meses"} · ${k.endsWith("fija") ? "fija" : "según volatilidad"}`,
  cob80: p3.bandas[k]["80 %"]["cobertura (%)"],
  cob95: p3.bandas[k]["95 %"]["cobertura (%)"],
  ancho: p3.bandas[k]["80 %"]["ancho medio (% del centro)"],
  winkler: p3.bandas[k]["80 %"]["Winkler (¢/lb)"],
}));

type FilaPrueba = { prueba: string; dif: number; ic: string; pPeor: number; pDM: number };
const corto = Object.fromEntries(MODELOS) as Record<string, string>;
const filasPruebas: FilaPrueba[] = p3.pruebas.map((x) => ({
  prueba: `${x.h === 1 ? "1 mes" : "3 meses"} · ${corto[x.modelo] ?? x.modelo}`,
  dif: x["diferencia de MAE (¢/lb)"],
  ic: x["IC90 bootstrap"].replace(/-/g, "−"),
  pPeor: x["P(peor que el último cierre)"],
  pDM: x["p (DM)"],
}));

// ─── 04 · Oferta ─────────────────────────────────────────────────────────────
// Modelos ARDL con la inercia del área: perfil de −1 a 4 años (18 años de muestra) y de −1 a 3 (19 años).
type Ardl = { coef: Record<string, number>; p: Record<string, number>; anios: number };
const ardl: Record<string, Ardl> = p4.ardl;
const ardlConInercia = (hasta: string) => Object.entries(ardl).find(([k]) => k.startsWith("con inercia") && k.endsWith(`${hasta})`))![1];
const conInercia = ardlConInercia("4");
const conInercia3 = ardlConInercia("3");
const REZAGOS = [
  ["dlpm1", "Año siguiente (placebo)"],
  ["dlp0", "Mismo año (placebo)"],
  ["dlp1", "1 año antes"],
  ["dlp2", "2 años antes"],
  ["dlp3", "3 años antes"],
  ["dlp4", "4 años antes"],
] as const;
const filasRezagos: Rezago[] = REZAGOS.map(([k, etiqueta]) => ({
  etiqueta,
  coef: p4.perfil.dla.coef[k],
  p: textoP(p4.perfil.dla.p[k]),
  inercia: conInercia.coef[k],
  placebo: k === "dlpm1" || k === "dlp0",
  destaca: k === "dlp2" || k === "dlp3",
}));
const perm = p4.permutacion;
const permBase = perm["Área, 1-3 años"];
const permInercia = perm["Área, 1-3 años, con inercia"];
const permPonderada = perm["Área ponderada por tamaño, con inercia (exploratorio)"];
const elasticidad = p4.base.dla.suma;
const ponderadaArea = p4.robustez["Con inercia, ponderado por área (exploratorio)"].acumulada;

type FilaPerm = { especificacion: string; suma: number; una: number; dos: number; nulo95: number };
const filasPerm: FilaPerm[] = Object.entries(perm).map(([k, v]) => ({
  especificacion: k,
  suma: v.suma,
  una: v.p_una_cola,
  dos: v.p_dos_colas,
  nulo95: v.nulo_p95,
}));

type FilaRobustez = { modelo: string; a1: number; a2: number; a3: number; acumulada: number; error: number; n: number };
const filasRobustez: FilaRobustez[] = Object.entries(p4.robustez).map(([k, v]) => ({
  modelo: k,
  a1: v["1 año"],
  a2: v["2 años"],
  a3: v["3 años"],
  acumulada: v.acumulada,
  error: v.error,
  n: v.n,
}));

const nombresPares = pares.map(es);

export default function Mercado() {
  return (
    <div data-serie="mercado" className={s.pagina}>
      <Portada
        serie="mercado"
        etiqueta="Serie III · Mercado"
        titulo="El precio del azúcar no se puede adivinar, pero su rango sí"
        entrada={
          <p>
            Revisé la producción mundial de caña y el precio diario del azúcar No. 11. Guatemala creció como pocos
            países, pero FAOSTAT ya no la mide bien. A 1 y 3 meses, ningún modelo le gana al último cierre: lo útil es la
            banda. El área mundial se asocia con el precio de 2 o 3 años antes, poco y sin prueba causal firme.
          </p>
        }
        meta={[
          { clave: "Datos", valor: "FAOSTAT 1961-2023 · azúcar No. 11, 2000-2024" },
          { clave: "Panel", valor: `${p1.paises_panel} países · ${num(aud.filas)} días de precio` },
          { clave: "Validación", valor: `${pronosticosH1.length} pronósticos fuera de muestra a 1 mes` },
          { clave: "Notebooks", valor: "10 a 13" },
        ]}
      />
      <IndiceLocal
        serie="mercado"
        titulo="Serie III"
        items={[
          { id: "paises", etiqueta: "01 Países" },
          { id: "precio", etiqueta: "02 Precio" },
          { id: "pronostico", etiqueta: "03 Pronóstico" },
          { id: "oferta", etiqueta: "04 Oferta" },
        ]}
      />

      <div className={`contenedor ${s.contexto}`}>
        <Nota tipo="dato" titulo="Qué es el azúcar No. 11">
          <p>
            Es el contrato de futuros de azúcar crudo de la bolsa ICE, en centavos de dólar por libra (¢/lb). Es la
            referencia de las exportaciones de azúcar crudo, incluidas las de Centroamérica. Se negocia para entrega en marzo, mayo, julio y octubre, y
            cada contrato deja de negociarse el último día hábil del mes anterior. Cada ¢/lb equivale a{" "}
            US${num(USD_T_POR_CENTAVO, 0)} por tonelada. Brasil exporta cerca de la mitad del azúcar del mundo y mueve el
            precio de todos.
          </p>
        </Nota>
        <Nota tipo="metodo" titulo="Solo con los datos de la prueba">
          <p>
            FAOSTAT (caña de azúcar, 1961-2023, con la bandera de cada dato) y la serie diaria del No. 11. Las fuentes
            públicas que cito (ICE, Banco Mundial, FMI, USDA, prensa financiera) solo sirven para verificar; no entran a
            ningún cálculo.
          </p>
        </Nota>
      </div>

      {/* ── 01 ─────────────────────────────────────────────────────────── */}
      <Seccion
        id="paises"
        numero="01"
        etiqueta="Países productores · notebook 10"
        titulo="Guatemala creció como pocos, pero sus datos recientes no son medición"
        entrada={
          <p>
            Guatemala es uno de {enCuadrante.length} países de {paises.length} que están a la vez en el cuartil superior
            de crecimiento del área y en el de rendimiento 2014-2023. Sus pares por trayectoria son{" "}
            {enLista(nombresPares)}. En FAOSTAT, su producción de 2014-2016 está inflada y su área de 2019-2023 es
            imputada.
          </p>
        }
      >
        <FilaCifras columnas={4}>
          <Cifra
            serie="mercado"
            valor={`${enCuadrante.length} de ${paises.length}`}
            etiqueta="países en el cuartil superior de crecimiento del área y de rendimiento 2014-2023"
            detalle={`Guatemala, ${enLista(otrosCuadrante)}.`}
          />
          <Cifra
            serie="mercado"
            valor={num(gt.descriptores.crec_area, 2)}
            unidad="% anual"
            etiqueta="Crecimiento del área de Guatemala, 1961-2023"
            detalle={`${ordinal(gt.posicion.crec_area)} de ${paises.length}. Desde 1961-1965, el área creció ×${num(veces("area"), 1)} y la producción ×${num(veces("prod"), 1)}.`}
          />
          <Cifra
            serie="mercado"
            valor={num(gt.descriptores.rend_2014_2023, 2)}
            unidad="t/ha"
            etiqueta="Rendimiento de Guatemala, 2014-2023"
            detalle={`${ordinal(gt.posicion.rend_rel)} de ${paises.length}, solo detrás de ${es(primeroRend.pais)}.`}
          />
          <Cifra
            serie="mercado"
            valor={num(oficial2023, 0)}
            unidad="%"
            etiqueta="de los datos de producción son oficiales en 2023"
            detalle={`${num(oficialAntes, 0)} % en 1961-2009. Los años recientes son los menos confiables.`}
          />
        </FilaCifras>

        <Figura
          numero={1}
          titulo="Guatemala creció mucho en área y llegó a uno de los rendimientos más altos"
          nota={
            <>
              Cada punto es un país del panel. Las líneas punteadas marcan el cuartil superior de cada eje: arriba a la
              derecha solo quedan {enCuadrante.length}. En azul, Guatemala; en gris oscuro, sus {pares.length} pares por
              trayectoria; con borde, los otros países del cuartil superior. Al pasar el cursor por un punto se ve el país.
            </>
          }
          fuente="notebook 10 · outputs/tables/serie3_grupos_paises.csv"
        >
          <GraficoPaises
            puntos={puntosPaises}
            corteArea={corteArea}
            corteRend={corteRend}
            etiqueta={`Dispersión de ${paises.length} países: crecimiento del área de 1961 a 2023 contra rendimiento de 2014 a 2023. Guatemala queda arriba a la derecha, en el cuartil superior de los dos ejes junto con ${enLista(otrosCuadrante)}.`}
          />
        </Figura>

        <div className={s.bloque}>
          <h3>Los pares se buscan por trayectoria, no por tamaño</h3>
          <p>
            Usé dos métodos independientes: la cercanía en seis descriptores de la trayectoria y la distancia entre las
            curvas completas de área y rendimiento, por bloques de 5 años. Un país es par si queda entre los 10 más
            cercanos en los dos. Salen {enLista(nombresPares)}, y se mantienen al quitar los países con datos dudosos.
          </p>
          <p>
            El Salvador y Nicaragua son el par más directo: misma región, mismo modelo exportador y la misma
            trayectoria. Eswatini es el par de rendimiento alto con expansión. Brasil se parece en ritmo, no en escala ni
            en rendimiento. Egipto se parece en rendimiento alto con riego, pero su azúcar va a su mercado interno.
          </p>
        </div>

        <Figura
          numero={2}
          ancho="total"
          titulo="Los datos de Guatemala en FAOSTAT tienen tres tramos dudosos"
          nota={
            <>
              Puntos azules: dato no oficial (estimado o imputado por FAO, o tomado de otro organismo); puntos grises:
              dato oficial. 1977-1985: producción estimada en cifras
              redondas. 2014-2016 (franja ámbar): unos {num(anioGt(2014, 2016, "prod") / 1e6, 1)} millones de t con
              bandera oficial, que en 2017 vuelven a {num(anioGt(2017, 2017, "prod") / 1e6, 0)} millones; el USDA da unos
              28 millones para 2016/17. 2017-2023: área estimada y luego imputada; el USDA reporta
              12 % a 15 % más área en 2021-2022, así que la “caída” del área es un artefacto.
              {/* fuente: notebook 10, celdas 14 y 32 (contraste con USDA GAIN GT17003 y GT2022-0003) */}
            </>
          }
          fuente="notebook 10 · outputs/tables/serie3_panel_oferta.csv (FAOSTAT con banderas); USDA solo para verificar"
        >
          {/* tramo 2014-2016: fuente: notebook 10, celda 14 */}
          <GraficoGuatemala filas={serieGt} saltoDesde={2014} saltoHasta={2016} />
        </Figura>

        <Tabla
          titulo={`${pocoConfiables.length} países del panel tienen dos o más alertas de calidad`}
          compacta
          columnas={partirEncabezados<FilaCalidad>([
            { clave: "pais", titulo: "País" },
            { clave: "alertas", titulo: "Alertas (de 5)", tipo: "num" },
            { clave: "noOficialProd", titulo: "Producción no oficial (%)", tipo: "num", valor: (f) => num(f.noOficialProd, 1) },
            { clave: "noOficialArea", titulo: "Área no oficial (%)", tipo: "num", valor: (f) => num(f.noOficialArea, 1) },
            { clave: "racha", titulo: "Años seguidos con el mismo rendimiento", tipo: "num" },
            { clave: "saltos", titulo: "Saltos de más de 50 %", tipo: "num" },
            { clave: "variacion", titulo: "Variación del rendimiento (%)", tipo: "num", valor: (f) => num(f.variacion, 1) },
            { clave: "rend", titulo: "Rendimiento 2014-2023 (t/ha)", tipo: "num", valor: (f) => num(f.rend, 1) },
          ])}
          filas={pocoConfiables}
          nota={
            <>
              Las cinco alertas: más de 50 % de la producción no oficial, 5 años o más con el mismo rendimiento, 3 saltos o
              más de más de 50 % en un año, variación del rendimiento de año a año menor a 1.5 % y rendimiento reciente menor
              a 30 t/ha. Liberia repite el mismo rendimiento {rachaLiberia} años y Ghana {rachaGhana}: la caña cambia de
              rendimiento cada año por lluvia, variedad y edad de la plantación. Fuente: notebook 10 ·
              outputs/tables/serie3_calidad_paises.csv.
            </>
          }
        />

        <Descartes
          items={[
            {
              codigo: "H18",
              hipotesis: "Hay tipos de países productores bien separados.",
              motivo: (
                <>
                  No. Un agrupamiento siempre devuelve grupos, así que lo comparé contra datos simulados sin grupos. Con 3 a 5
                  grupos apenas los supera (p de {Math.min(...pGrupos)} a {Math.max(...pGrupos)}) y, al remuestrear países,
                  se reproducen a medias (ARI ~{num(p1.estabilidad["3"]["ARI mediana"], 1)}, donde 1 es la misma partición).
                  Uso tres grupos como tipología
                  para resumir: expansión ({nGrupo("Expansión")} países), madurez o estancamiento (
                  {nGrupo("Madurez o estancamiento")}) y rendimiento muy bajo o datos dudosos (
                  {nGrupo("Rendimiento muy bajo o datos dudosos")}).
                </>
              ),
            },
            {
              codigo: "H19",
              hipotesis: "Los pares de Guatemala son los productores de su tamaño, como Colombia o México.",
              motivo:
                "No. Se parecen en tamaño o en rendimiento, pero no en trayectoria. Colombia y Perú ya tenían su área en los 60, y México no tiene el rendimiento.",
            },
          ]}
        />

        <Desplegable titulo="Método: descriptores, grupos y pares">
          <p>
            Panel de {p1.paises_panel} países con producción desde 1976 o antes hasta 2023 y al menos 5,000 ha en
            2014-2023. Cada país se describe con seis números: crecimiento del área y del rendimiento (pendiente Theil-Sen
            del logaritmo: la mediana de las pendientes entre todos los pares de años, que un año suelto no mueve),
            rendimiento 2014-2023 frente a la mediana, cambio de ritmo después de 1991 en área y en rendimiento, e
            inestabilidad del rendimiento. Cada descriptor se escala con la mediana y el rango intercuartil, recortado a
            ±3, para que un país extremo no domine las distancias.
          </p>
          <p>
            Regla fijada antes de ver los grupos: el k más reproducible entre 3 y 6, sin grupos de menos del 5 %. Da k = 3.
            Un agrupamiento jerárquico (Ward) da una partición parecida (ARI {num(p1.ari_ward, 2)}). La silueta mide qué
            tan separados están los grupos; se compara con la de datos simulados con la misma correlación pero sin grupos.
          </p>
          <Tabla
            titulo="La silueta apenas supera a la de datos sin grupos"
            compacta
            columnas={partirEncabezados<FilaSilueta>([
              { clave: "k", titulo: "Grupos (k)" },
              { clave: "silueta", titulo: "Silueta", tipo: "num", valor: (f) => num(f.silueta, 3) },
              { clave: "nulo", titulo: "Sin grupos (media)", tipo: "num", valor: (f) => num(f.nulo, 3) },
              { clave: "nulo95", titulo: "Sin grupos (p95)", tipo: "num", valor: (f) => num(f.nulo95, 3) },
              { clave: "p", titulo: "p", tipo: "num", valor: (f) => num(f.p, 3) },
              { clave: "ari", titulo: "ARI al remuestrear", tipo: "num", valor: (f) => num(f.ari, 3) },
            ])}
            filas={filasSilueta}
            destacar={(f) => f.k === String(p1.k)}
          />
        </Desplegable>
        <Desplegable titulo="Figuras originales del notebook">
          <ImagenNotebook nombre="serie3_01_calidad_datos" alt="Origen del dato de producción por año y series de rendimiento constantes de Liberia y Ghana" />
          <ImagenNotebook nombre="serie3_02_guatemala_banderas" alt="Área y producción de Guatemala con la bandera de cada dato" />
          <ImagenNotebook nombre="serie3_03_grupos_prueba" alt="Silueta contra datos sin grupos y estabilidad al remuestrear" />
          <ImagenNotebook nombre="serie3_04_mapa_paises" alt="Mapa de países: crecimiento del área contra rendimiento reciente, por grupo" />
          <ImagenNotebook nombre="serie3_05_guatemala_pares" alt="Trayectorias de Guatemala y de sus pares" />
        </Desplegable>

        <Nota tipo="limite" titulo="FAOSTAT mide caña, no azúcar">
          <p>
            No captura la calidad de la caña (sacarosa), que es donde compite un ingenio. Además, una de cada tres cifras de
            producción del archivo no es oficial{/* fuente: notebook 10, celda 5 (65.6 % oficiales) */}: para países
            pequeños, la trayectoria puede ser la del imputador. Los grupos sirven para describir, no para predecir.
          </p>
        </Nota>

        <Evaluacion
          serie="mercado"
          significa={
            <p>
              Guatemala no es un productor grande cualquiera: es de los pocos que crecieron mucho en área y además llegaron a
              rendimientos de punta. Su competencia por trayectoria no es la India ni Tailandia, sino industrias
              exportadoras que hicieron un camino parecido. Como el área ya se frenó, el crecimiento futuro tiene que venir
              del rendimiento y de la calidad de la caña, donde Guatemala ya está arriba.
            </p>
          }
          decision={
            <>
              <p>
                Recomiendo usar a los pares como grupo de referencia para comparar rendimiento y costos: El Salvador y
                Nicaragua en la región, Eswatini para rendimiento alto con expansión, y Brasil y Egipto como referencias
                parciales.
              </p>
              <p>
                No usaría FAOSTAT para Guatemala en 2014-2023 sin contrastarlo con las cifras de la gremial y de su centro
                de investigación. Antes de cualquier comparación internacional, filtraría los países con datos no oficiales
                o constantes.
              </p>
            </>
          }
          impacto="Directo, ninguno: es diagnóstico de contexto. Indirecto: evita compararse con referentes equivocados y decidir sobre una caída de área que es un artefacto de la imputación."
          riesgo="Los grupos son débiles y no sirven para predecir cómo se comportará un país. Una de cada tres cifras de producción no es oficial: en países pequeños, la trayectoria puede ser la del imputador. FAOSTAT no ve la calidad de la caña."
          certeza={{
            nivel: "alta",
            texto:
              "Alta en los problemas de datos y en la posición de Guatemala: se ven directo en el archivo. Media en los pares: coinciden dos métodos y se mantienen sin los datos dudosos, pero la estructura de grupos es débil.",
          }}
        />
      </Seccion>

      {/* ── 02 ─────────────────────────────────────────────────────────── */}
      <Seccion
        id="precio"
        numero="02"
        etiqueta="Comportamiento del precio · notebook 11"
        titulo="La serie es real, pero pega contratos distintos"
        entrada={
          <p>
            Hay {p2.dias_cambio} saltos por cambio de contrato que nadie vivió en el mercado; los
            corregí. Con la serie ajustada, el precio alterna entre calma ({num(calma["volatilidad semanal (%)"], 1)} %
            semanal) y turbulencia ({num(turbulento["volatilidad semanal (%)"], 1)} %). Los días que se mueven más de 4
            veces lo típico son unas {num(colas4["veces más (desviación estándar)"], 0)} veces más frecuentes que en una
            distribución normal.
          </p>
        }
      >
        <FilaCifras columnas={4}>
          <Cifra
            serie="mercado"
            valor={p2.dias_cambio}
            unidad="días"
            etiqueta="saltos por cambio de contrato"
            detalle={`Son el ${num((100 * p2.dias_cambio) / aud.filas, 1)} % de los días, pero ${p2.top25_por_tipo["cambio de contrato"]} de los ${top25} movimientos más grandes.`}
          />
          <Cifra
            serie="mercado"
            valor={num(turbulento["volatilidad semanal (%)"], 1)}
            unidad="% semanal"
            etiqueta="volatilidad en turbulencia"
            detalle={`Calma: ${num(calma["volatilidad semanal (%)"], 1)} %. Turbulencia el ${num(turbulento["% de las semanas"], 0)} % de las semanas.`}
          />
          <Cifra
            serie="mercado"
            valor={`1 de ${unaCada(p2.prob_semana_10.Turbulencia)}`}
            unidad="semanas"
            etiqueta="con un movimiento de ±10 % o más, en turbulencia"
            detalle={`En calma, 1 de cada ${unaCada(p2.prob_semana_10.Calma)}.`}
          />
          <Cifra
            serie="mercado"
            valor={num(colas4["veces más (desviación estándar)"], 0)}
            unidad="veces"
            etiqueta="más días de más de 4 desviaciones estándar que en una normal"
            detalle={`${colas4["días (desviación estándar)"]} días observados contra ${num(colas4["esperados si fuera normal"], 2)} esperados.`}
          />
        </FilaCifras>

        <Figura
          numero={3}
          ancho="total"
          titulo={`La turbulencia se concentró de 2000 a ${anioUltimoTramoLargo}; después solo hubo dos tramos largos`}
          nota={
            <>
              Cierre semanal del contrato más próximo (precio crudo; el cierre diario va de {num(aud.rango_cierre[0], 2)} a{" "}
              {num(aud.rango_cierre[1], 2)} ¢/lb). Las franjas ámbar son los tramos de turbulencia de 4 semanas o más según
              un modelo de Markov sobre retornos semanales de la serie ajustada, dibujados por mes. El tamaño del movimiento
              se puede anticipar un poco porque la volatilidad se agrupa; la dirección, no.
            </>
          }
          fuente="notebook 11 · outputs/tables/serie3_precio_diario.csv; tramos de la tabla de regímenes del notebook"
        >
          <GraficoPrecio
            semanas={semanas}
            turbulencia={tramosTurbulencia}
            etiqueta={`Precio del azúcar No. 11, cierre semanal de 2000 a 2024, con ${tramosTurbulencia.length} tramos de turbulencia sombreados. La mayoría cae entre 2000 y ${anioUltimoTramoLargo}; después solo hay tramos en 2016 y 2020.`}
          />
        </Figura>

        <Tabla
          titulo="El día del cambio de contrato el precio se mueve tres veces más, casi todo en la apertura"
          columnas={partirEncabezados<FilaTipoDia>([
            { clave: "tipo", titulo: "Tipo de día" },
            { clave: "dias", titulo: "Días", tipo: "num", valor: (f) => num(f.dias) },
            { clave: "crudo", titulo: "Movimiento de cierre a cierre (%)", tipo: "num", valor: (f) => num(f.crudo, 2) },
            { clave: "brecha", titulo: "Brecha nocturna (%)", tipo: "num", valor: (f) => num(f.brecha, 2) },
            { clave: "intradia", titulo: "Movimiento dentro del día (%)", tipo: "num", valor: (f) => num(f.intradia, 2) },
          ])}
          filas={filasTipoDia}
          destacar={(f) => f.tipo === "Cambio de contrato"}
          nota={
            <>
              Promedio del movimiento absoluto. El contrato siguiente casi nunca vale lo mismo que el que vence: ese salto de{" "}
              {num(cambio.brecha, 1)} % en la apertura (contra {num(normal.brecha, 1)} % un día normal) no lo vivió nadie. Las{" "}
              {aud.ohlc_imposible} filas con datos imposibles (cierre fuera del rango del día) caen todas en días de
              vencimiento. Fuente: notebook 11 · outputs/tables/serie3_resumen_p2.json.
            </>
          }
        />

        <div className={s.bloque}>
          <h3>La serie coincide al centavo y al día con fuentes públicas</h3>
          {/* fuente: notebook 11, celdas 23 y 28 (extremos y promedios anuales contra fuentes públicas) */}
          <p>
            El precio más alto del día en el máximo de 2011 (36.08 ¢/lb el 2 de febrero), el más bajo en el mínimo del COVID
            (9.05 ¢/lb el 28 de abril de 2020) y el más alto en el máximo de 2023 (28.14 ¢/lb el 7 de noviembre) son las
            mismas cifras que reportaron AFP y Barchart. Los promedios anuales difieren entre −1.1 % y +3.2 % del FMI, y
            hasta +4.1 % del Banco Mundial (2011). La bolsa cerró la semana del 11 de septiembre de 2001 y el hueco está en
            la serie.
          </p>
          <p>
            La curtosis mide qué tan seguido aparecen días extremos (en una normal es 0). Con la corrección del cambio de
            contrato y sin los dos vencimientos con volumen cero de 2000, baja
            de {num(p2.crudo.curtosis, 1)} a {num(p2.ajustado.curtosis, 1)} y el retorno acumulado de 2000 a 2024 pasa de ×
            {num(p2.crudo.acumulado, 1)} a ×{num(p2.ajustado.acumulado, 1)}. Uso el precio crudo como referencia de nivel y
            la serie ajustada para medir riesgo.
          </p>
        </div>

        <Descartes
          items={[
            {
              codigo: "H20",
              hipotesis: "La serie de precio es una serie continua del mercado.",
              motivo: (
                <>
                  No: pega contratos. Solo corregir los cambios de contrato baja la curtosis de {num(p2.crudo.curtosis, 1)}{" "}
                  a 2.9{/* fuente: notebook 11, celda 6 */}: la mitad de las colas pesadas eran saltos de contrato.
                </>
              ),
            },
            {
              codigo: "H21",
              hipotesis: "El precio del azúcar tiene ciclos que se pueden anticipar.",
              motivo: `No. Conté ${p2.fases_20} giros de 20 % en 24 años; un precio que se mueve al azar con la misma volatilidad produce entre ${p2.fases_paseo[1]} y ${p2.fases_paseo[2]}. Hay fases con nombre (el auge de 2009-2011, el descenso hasta 2020), pero su forma es la de un paseo aleatorio.`,
            },
          ]}
        />

        <Desplegable titulo="Método: ajuste de la serie, regímenes y colas">
          <p>
            Ajuste: el día del cambio de contrato reemplacé el retorno de cierre a cierre por el movimiento de apertura a
            cierre del contrato nuevo. Excluí los dos vencimientos con volumen cero (28/04/2000 y 30/06/2000). La
            volatilidad anual baja de {num(100 * p2.crudo.vol, 1)} % a {num(100 * p2.ajustado.vol, 1)} %.
          </p>
          <p>
            Regímenes: modelo de Markov sobre retornos semanales. El BIC prefiere 2 estados ({num(p2.bic["2"], 0)}) a 1 (
            {num(p2.bic["1"], 0)}) y a 3 ({num(p2.bic["3"], 0)}). La calma dura en promedio{" "}
            {num(calma["duración esperada (semanas)"], 1)} semanas y la turbulencia {num(turbulento["duración esperada (semanas)"], 1)}.
          </p>
          <Tabla
            titulo="Los días extremos son mucho más frecuentes que en una normal"
            compacta
            columnas={partirEncabezados<FilaColas>([
              { clave: "umbral", titulo: "Movimiento diario" },
              { clave: "observados", titulo: "Días observados", tipo: "num" },
              { clave: "esperados", titulo: "Esperados si fuera normal", tipo: "num", valor: (f) => num(f.esperados, 2) },
              { clave: "veces", titulo: "Veces más", tipo: "num", valor: (f) => num(f.veces, 2) },
            ])}
            filas={filasColas}
            nota={`Serie ajustada, con la desviación estándar de la muestra. Una t de Student ajusta con ${num(p2.gl_t, 1)} grados de libertad.`}
          />
        </Desplegable>
        <Desplegable titulo="Figuras originales del notebook">
          <ImagenNotebook nombre="serie3_06_cambio_contrato" alt="Retornos por tipo de día y brecha en el cambio de contrato" />
          <ImagenNotebook nombre="serie3_07_regimenes_precio" alt="Precio del No. 11 con los regímenes de volatilidad" />
        </Desplegable>

        <Nota tipo="limite" titulo="Las fechas de los regímenes usan información posterior">
          <p>
            Son probabilidades suavizadas. En tiempo real, el cambio de régimen se detecta con algunas semanas de rezago.
            Además, la serie es un solo contrato de un proveedor gratuito, y 24 años traen pocos episodios de turbulencia
            larga.
          </p>
        </Nota>

        <Evaluacion
          serie="mercado"
          significa={
            <p>
              El azúcar se mueve cerca de 30 % al año (mediana anual de {num(volMediana, 1)} %). Una de cada cuatro semanas está en
              turbulencia, donde se mueve casi el doble. Un presupuesto o una medida de riesgo con supuesto normal subestima
              el riesgo. No hay un patrón de “sube cada tantos años” que sirva para elegir cuándo vender. Y la serie continua
              mezcla contratos: analizada cruda, exagera la volatilidad y las colas.
            </p>
          }
          decision={
            <>
              <p>Recomiendo gestionar el precio con fijaciones y coberturas escalonadas, no adivinando el mejor momento.</p>
              <p>
                Usaría el régimen de volatilidad como semáforo de riesgo comercial: en turbulencia, ampliar los márgenes del
                presupuesto y reducir lo que queda sin cubrir. En tiempo real se usa la probabilidad filtrada (solo con datos
                pasados), no la suavizada de este análisis. También seguiría la forma de la curva (contrato próximo contra el
                siguiente) como indicador de mercado apretado. Todo modelo interno con futuros debe ajustar los cambios de
                contrato.
              </p>
            </>
          }
          impacto="Directo, ninguno: es diagnóstico. Indirecto: evita subestimar el riesgo de precio y es la base de la banda del pronóstico (pregunta 3). El precio explica la mayor parte de la variación del ingreso por exportación."
          riesgo="Para uso comercial hace falta la curva completa de futuros de una fuente oficial. La duración típica de un episodio turbulento es incierta."
          certeza={{
            nivel: "alta",
            texto:
              "Alta en los artefactos del cambio de contrato, las colas pesadas, el agrupamiento de la volatilidad, la verificación contra fuentes públicas y en que los ciclos no se distinguen del azar. Media en las fechas exactas de cada régimen.",
          }}
        />
      </Seccion>

      {/* ── 03 ─────────────────────────────────────────────────────────── */}
      <Seccion
        id="pronostico"
        numero="03"
        etiqueta="Pronóstico a 1 y 3 meses · notebook 12"
        titulo="Nada le gana al precio de hoy; el valor está en la banda"
        entrada={
          <p>
            Pronostiqué el promedio del mes con validación hacia adelante desde diciembre de 2008. El último cierre se
            equivoca ~{num(ingenuo1["MAPE (%)"], 0)} % a 1 mes y ~{num(ingenuo3["MAPE (%)"], 0)} % a 3 meses, y ningún modelo
            probado le gana. Lo útil es la banda según la volatilidad, que cubre cerca de lo que promete.
          </p>
        }
      >
        <FilaCifras columnas={4}>
          <Cifra
            serie="mercado"
            valor={num(ingenuo1["MAE (¢/lb)"], 2)}
            unidad="¢/lb"
            etiqueta="error medio del último cierre a 1 mes"
            detalle={`~${num(ingenuo1["MAPE (%)"], 0)} % del precio, en ${pronosticosH1.length} meses fuera de muestra.`}
          />
          <Cifra
            serie="mercado"
            valor={num(ingenuo3["MAE (¢/lb)"], 1)}
            unidad="¢/lb"
            etiqueta="error medio del último cierre a 3 meses"
            detalle={`~${num(ingenuo3["MAPE (%)"], 0)} % del precio, en ${pronosticosH3.length} meses fuera de muestra.`}
          />
          <Cifra
            serie="mercado"
            valor={num(-arima1["mejora vs último cierre (%)"], 0)}
            unidad="% más error"
            etiqueta="del ARIMA contra el último cierre, a 1 mes"
            detalle="La diferencia no es suerte (bootstrap por bloques y Diebold-Mariano)."
          />
          <Cifra
            serie="mercado"
            valor={num(USD_T_POR_CENTAVO, 0)}
            unidad="US$/t"
            etiqueta="por cada ¢/lb que se mueve el precio"
            detalle="Precio No. 11 sin primas de calidad, flete ni tipo de cambio."
          />
        </FilaCifras>

        <Figura
          numero={4}
          titulo="El último cierre tiene el menor error en los dos horizontes"
          nota={
            <>
              Error absoluto medio de cada modelo en la validación hacia adelante. En cada mes desde diciembre de 2008 entrené
              solo con el pasado, pronostiqué y comparé con lo que pasó. El rótulo dice cuánto más se equivoca cada modelo que
              el último cierre. La regresión suma al último cierre el momentum (retorno de 1 y 12 meses), la reversión
              (distancia al promedio de 5 años) y la forma de la curva. Empata a 1 mes (
              {num(-regresion1["mejora vs último cierre (%)"], 0)} % peor, {textoP(pruebaRegresion1["p (DM)"])}) y pierde a 3
              meses ({num(-regresion3["mejora vs último cierre (%)"], 0)} % peor).
            </>
          }
          fuente="notebook 12 · outputs/tables/serie3_resumen_p3.json, serie3_pronosticos_h1.csv y serie3_pronosticos_h3.csv"
        >
          <GraficoErrores
            h1={errores("1")}
            h3={errores("3")}
            etiqueta="Error absoluto medio de cuatro modelos de pronóstico del azúcar. El último cierre tiene el menor error a 1 y a 3 meses."
          />
        </Figura>

        <div className={s.bloque}>
          <h3>La trampa del ingenuo equivocado</h3>
          <p>
            Hay dos pronósticos ingenuos: “el próximo mes valdrá el último cierre” y “valdrá el promedio de este mes”. El
            segundo llega medio mes atrasado. Además, promediar crea un patrón artificial: los cambios entre promedios
            mensuales se autocorrelacionan {num(p3.ac_promedios, 2)}, contra {num(p3.ac_cierres, 2)} en los cierres. Para un
            precio que se mueve al azar, la teoría da cerca de 0.25{/* fuente: notebook 12, celda 2 (Working, 1960) */}: el
            patrón de los promedios es casi todo artificial.
          </p>
          <p>
            A 1 mes, un ARIMA sobre promedios aprende ese patrón y le gana al ingenuo del promedio (
            {num(arima1["MAE (¢/lb)"], 2)} contra {num(p3.metricas["1"]["Ingenuo: promedio del mes"]["MAE (¢/lb)"], 2)} ¢/lb),
            pero pierde contra el último cierre ({num(ingenuo1["MAE (¢/lb)"], 2)}). Quien lo compare contra el ingenuo
            equivocado “encuentra” un modelo que no sirve.
          </p>
        </div>

        <Figura
          numero={5}
          titulo={`La banda vigente va de ${rango80(vigJun)} a 1 mes y de ${rango80(vigAgo)} a 3 meses`}
          nota={
            <>
              Línea gris: promedio mensual real. Desde el último cierre ({num(pronostico.ultimo_cierre, 2)} ¢/lb, {fechaOrigen}):
              raya gruesa, banda 80&nbsp;%; raya fina, banda 95&nbsp;%. El círculo vacío es el promedio real de junio hasta el día 24 (
              {num(p3.junio_real_parcial, 2)} ¢/lb): quedó dentro de la banda 80 %.
            </>
          }
          fuente="notebook 12 · outputs/models/serie3_pronostico.json y outputs/tables/serie3_resumen_p3.json"
        >
          <GraficoBanda
            reales={realesRecientes}
            bandas={bandasVigentes}
            origen={{ fecha: pronostico.fecha_origen, valor: pronostico.ultimo_cierre }}
            realParcial={{ fecha: "2024-06-15", valor: p3.junio_real_parcial }}
            etiqueta={`Promedios mensuales del azúcar No. 11 hasta mayo de 2024 y banda del pronóstico: junio de ${num(vigJun.p10, 2)} a ${num(vigJun.p90, 2)} ¢/lb y agosto de ${num(vigAgo.p10, 2)} a ${num(vigAgo.p90, 2)} ¢/lb con 80 % de probabilidad.`}
          />
        </Figura>

        <Tabla
          titulo={`A 3 meses, la banda 80 % es ${num(anchoBanda(vigAgo) / anchoBanda(vigJun), 1)} veces más ancha que a 1 mes`}
          compacta
          columnas={partirEncabezados<FilaVigente>([
            { clave: "mes", titulo: "Mes" },
            { clave: "centro", titulo: "Centro", tipo: "num", valor: (f) => num(f.centro, 2) },
            { clave: "p2_5", titulo: "p2.5", tipo: "num", valor: (f) => num(f.p2_5, 2) },
            { clave: "p10", titulo: "p10", tipo: "num", valor: (f) => num(f.p10, 2) },
            { clave: "p90", titulo: "p90", tipo: "num", valor: (f) => num(f.p90, 2) },
            { clave: "p97_5", titulo: "p97.5", tipo: "num", valor: (f) => num(f.p97_5, 2) },
            { clave: "rango", titulo: "Banda 80 % frente al centro", tipo: "num" },
          ])}
          filas={filasVigentes}
          nota={
            <>
              En ¢/lb; el centro es el último cierre. La consulta GET /mercado/pronostico de la{" "}
              <Link href="/api">API</Link> devuelve esta banda en ¢/lb, % y US$/t, y el rango de ingreso para un volumen sin
              fijar. Fuente: notebook 12 · outputs/tables/serie3_resumen_p3.json.
            </>
          }
        />

        <Tabla
          titulo="La banda según volatilidad cubre cerca de lo que promete y es más angosta"
          columnas={partirEncabezados<FilaBandas>([
            { clave: "banda", titulo: "Horizonte y banda" },
            { clave: "cob80", titulo: "Cobertura de la banda 80 % (%)", tipo: "num", valor: (f) => num(f.cob80, 1) },
            { clave: "cob95", titulo: "Cobertura de la banda 95 % (%)", tipo: "num", valor: (f) => num(f.cob95, 1) },
            { clave: "ancho", titulo: "Ancho de la banda 80 % (% del centro)", tipo: "num", valor: (f) => num(f.ancho, 1) },
            { clave: "winkler", titulo: "Winkler 80 % (¢/lb)", tipo: "num", valor: (f) => num(f.winkler, 1) },
          ])}
          filas={filasBandas}
          destacar={(f) => f.banda.endsWith("según volatilidad")}
          nota={
            <>
              Una banda es buena si cubre lo que promete y es lo más angosta posible; la puntuación de Winkler combina las dos
              cosas (menor es mejor). La banda fija cubre de más porque arrastra la turbulencia de 2009-2011 a todos los
              meses. La banda según volatilidad mide el error en unidades de la volatilidad de los últimos 3 meses: se
              ensancha cuando el mercado se agita. Fuente: notebook 12 · outputs/tables/serie3_resumen_p3.json.
            </>
          }
        />

        <div className={s.bloque}>
          <h3>Para planificar sirve la banda, no el punto central</h3>
          <p>El punto central es el precio de hoy: no dice cuándo vender. La banda sí sirve para tres decisiones:</p>
          <ul>
            <li>presupuestar en rangos, con escenarios p10, p50 y p90;</li>
            <li>
              medir el riesgo de dejar volumen sin fijar: en agosto, la distancia del centro al p10 es de{" "}
              {num(distanciaAgosto, 1)} ¢/lb, unos US${num(distanciaAgosto * USD_T_POR_CENTAVO, 0)} por tonelada;
            </li>
            <li>decidir cuánto cubrir: cuando la volatilidad sube, la banda se ensancha y conviene fijar más.</li>
          </ul>
        </div>

        <Descartes
          items={[
            {
              codigo: "H22",
              hipotesis: "Un ARIMA pronostica mejor que el ingenuo.",
              motivo: `Solo a 1 mes y contra el ingenuo equivocado (el promedio del mes); a 3 meses ni eso. Contra el último cierre es ${num(-arima1["mejora vs último cierre (%)"], 0)} % peor a 1 mes y ${num(-p3.metricas["3"]["ARIMA(1,1,0) sobre promedios"]["mejora vs último cierre (%)"], 0)} % peor a 3 meses.`,
            },
            {
              codigo: "H21",
              hipotesis: "El precio del azúcar tiene ciclos que se pueden anticipar.",
              motivo: `Tampoco a 1 y 3 meses. La regresión con momentum, reversión al promedio y forma de la curva no le gana al último cierre: con toda la muestra, ningún predictor es significativo al 5 % y juntos explican el ${num(100 * p3.regresion_full.r2, 0)} % de la variación.`,
            },
          ]}
        />

        <Desplegable titulo="Método: validación, pruebas y bandas">
          <p>
            Objetivo: el promedio mensual del contrato más próximo, a 1 y 3 meses, con datos hasta el cierre del mes
            anterior ({p3.meses} meses completos). Validación con origen rodante desde diciembre de 2008, entrenando solo con
            pares cuyo resultado ya se conocía. Un modelo se queda solo si le gana al último cierre con una diferencia que no
            sea suerte: bootstrap por bloques de 12 meses y prueba de Diebold-Mariano.
          </p>
          <Tabla
            titulo="Diferencia de error contra el último cierre (positiva = peor que el último cierre)"
            compacta
            columnas={partirEncabezados<FilaPrueba>([
              { clave: "prueba", titulo: "Horizonte y modelo" },
              { clave: "dif", titulo: "Diferencia de MAE (¢/lb)", tipo: "num", valor: (f) => conSigno(f.dif, 3) },
              { clave: "ic", titulo: "IC90 bootstrap", tipo: "num" },
              { clave: "pPeor", titulo: "P(peor)", tipo: "num", valor: (f) => num(redondeoPar(f.pPeor, 3), 3) },
              { clave: "pDM", titulo: "p (DM)", tipo: "num", valor: (f) => num(f.pDM, 3) },
            ])}
            filas={filasPruebas}
          />
          <p>
            Bandas: cuantiles de los errores pasados ya realizados, en unidades de la volatilidad de 3 meses × √h. Necesitan
            3 años de errores previos, así que se evalúan desde 2012; en ese período solo 8 de 149 meses son turbulentos
            {/* fuente: notebook 12, celda 13 */}, y la comparación por régimen es solo indicativa.
          </p>
          <p>
            Al cierre de febrero, abril, junio y septiembre, el último precio es del contrato que vence. En esos orígenes el
            error a 1 mes es algo mayor: 0.89 contra 0.82 ¢/lb{/* fuente: notebook 12, celda 20 */}.
          </p>
        </Desplegable>
        <Desplegable titulo="Figuras originales del notebook">
          <ImagenNotebook nombre="serie3_08_pronostico_errores" alt="Pronósticos contra el promedio real y error de cada modelo" />
          <ImagenNotebook nombre="serie3_09_pronostico_bandas" alt="Bandas fija y según volatilidad a 1 y 3 meses" />
        </Desplegable>

        <Nota tipo="limite" titulo="El modelo solo ve el precio">
          <p>
            No ve la zafra de Brasil, la política de exportación de la India, el real ni el petróleo. El mejor pronóstico
            público del precio de agosto es el contrato de octubre que ya cotiza hoy, y la serie de la prueba solo trae el
            contrato más próximo. Las bandas suponen que el pasado se repite: un evento sin precedentes puede quedar fuera.
          </p>
        </Nota>

        <Evaluacion
          serie="mercado"
          significa={
            <p>
              Ningún modelo basado solo en el historial del precio le gana al precio de hoy a 1 o 3 meses: el mercado ya
              incorpora lo que se sabe. Lo que sí se estima bien es el rango. Con la volatilidad de mayo de 2024, la banda 80 %
              va de {rango80(vigJun)} a 1 mes y de {rango80(vigAgo)} a 3 meses. El rango se ensancha cuando sube la
              volatilidad.
            </p>
          }
          decision={
            <>
              <p>
                Recomiendo usar el último cierre (o la curva de futuros) como precio central del presupuesto, con la banda
                según volatilidad para los escenarios p10, p50 y p90.
              </p>
              <p>
                Ligaría la política de fijación al ancho de la banda: cuando la volatilidad sube, aumentar el porcentaje
                fijado. Para mejorar el punto central no haría un modelo más complejo; agregaría fundamentos (zafra de Brasil,
                política de la India, real, petróleo) y la curva completa de futuros.
              </p>
            </>
          }
          impacto={`Evita decisiones de “cuándo vender” basadas en pronósticos sin valor. El presupuesto refleja un riesgo de US$${num(USD_T_POR_CENTAVO, 0)} por tonelada por cada ¢/lb de variación.`}
          riesgo="Eventos fuera de la muestra (cambios de política, guerras, pandemias) pueden romper la banda. La banda tarda unas semanas en reaccionar al inicio de un episodio turbulento."
          certeza={{
            nivel: "alta",
            texto: `Alta en que ninguno de los modelos probados mejora al último cierre (pruebas formales en ~${pronosticosH1.length} meses fuera de muestra) y en la calibración de la banda a 1 mes. Media en la banda a 3 meses. No haberlo superado no prueba que sea imposible con otros datos.`,
          }}
        />
      </Seccion>

      {/* ── 04 ─────────────────────────────────────────────────────────── */}
      <Seccion
        id="oferta"
        numero="04"
        etiqueta="Respuesta de la oferta · notebook 13"
        titulo="El área se asocia con el precio de dos o tres años antes, poco y sin prueba causal firme"
        entrada={
          <p>
            En {p4.paises} países ({p4.anios_precio[0]}-{p4.anios_precio[1]}), un precio 10 % más alto se asocia con ~
            {num(10 * elasticidad, 1)}&nbsp;% más área tres años después. Al barajar los años del precio, la evidencia queda en el
            borde, y la flecha también va al revés: más área hoy anticipa un precio más bajo. Es una asociación, no una
            causa demostrada.
          </p>
        }
      >
        <FilaCifras columnas={4}>
          <Cifra
            serie="mercado"
            valor={num(elasticidad, 2)}
            etiqueta="elasticidad acumulada del área, precio de 1 a 3 años antes"
            detalle={`Un precio 10 % más alto, ~${num(10 * elasticidad, 1)} % más área. Con la inercia del área y quitando un año a la vez, queda entre ${num(p4.jackknife[0], 2)} y ${num(p4.jackknife[1], 2)}.`}
          />
          <Cifra
            serie="mercado"
            valor={`${num(permBase.p_una_cola, 2)} a ${num(permInercia.p_una_cola, 2)}`}
            etiqueta="valor p de la permutación: qué tan seguido sale una respuesta así por azar (una cola)"
            detalle={`Sin y con la inercia del área. Con 4 rezagos, ${num(perm["Área, 1-4 años"].p_una_cola, 2)}.`}
          />
          <Cifra
            serie="mercado"
            valor={num(p4.corr_area_mundial_precio_2, 2)}
            etiqueta="correlación entre el crecimiento del área mundial y el precio de 2 años antes"
            detalle={<>Con 21 puntos{/* fuente: notebook 13, celda 4 */}: sugerente, todavía no es evidencia.</>}
          />
          <Cifra
            serie="mercado"
            valor={num(p4.primera_etapa_F, 1)}
            etiqueta="fuerza (F) de la cosecha de Brasil como experimento natural"
            detalle="Hace falta F > 10: con datos anuales el instrumento no sirve."
          />
        </FilaCifras>

        <div className={s.bloque}>
          <h3>Tres trampas para medir causalidad</h3>
          <ul>
            <li>
              El precio es el mismo para todos, así que solo hay unos 20 años de variación, aunque haya {p4.paises} países.
            </li>
            <li>Cuando se produce más, el precio baja: la flecha también va al revés.</li>
            <li>El precio que ve cada país no es el No. 11 en dólares: hay monedas, cuotas y etanol de por medio.</li>
          </ul>
        </div>

        <Figura
          numero={6}
          titulo="La asociación aparece con el precio de 2 y 3 años antes; el placebo del año siguiente sale negativo"
          nota={
            <>
              Barras: elasticidad del cambio anual del área contra el cambio del precio en cada rezago, con efectos fijos por
              país (cada país se compara contra sí mismo). 0.04 significa que un precio 10&nbsp;% más alto se asocia con 0.4&nbsp;% más área. Los dos primeros son placebos:
              precios que no existían cuando se decidió el área. El del año siguiente sale negativo: más área hoy, más azúcar
              después y un precio más bajo. La raya negra es el mismo modelo con la inercia del área (ARDL): la respuesta a 2
              y 3 años se mantiene. Los p usan errores agrupados por año, que con ~20 años prometen de más.
            </>
          }
          fuente="notebook 13 · outputs/tables/serie3_resumen_p4.json"
        >
          <GraficoRezagos
            filas={filasRezagos}
            etiqueta={`Elasticidad del área por rezago del precio. Los rezagos de 2 y 3 años son positivos (${num(p4.perfil.dla.coef.dlp2, 3)} y ${num(p4.perfil.dla.coef.dlp3, 3)}); el precio del año siguiente, un placebo, sale negativo (${num(p4.perfil.dla.coef.dlpm1, 3)}).`}
          />
        </Figura>

        <Tabla
          titulo="Al barajar los años del precio, la evidencia queda en el borde"
          columnas={partirEncabezados<FilaPerm>([
            { clave: "especificacion", titulo: "Especificación" },
            { clave: "suma", titulo: "Elasticidad acumulada", tipo: "num", valor: (f) => num(f.suma, 3) },
            { clave: "una", titulo: "p a una cola", tipo: "num", valor: (f) => num(redondeoPar(f.una, 3), 3) },
            { clave: "dos", titulo: "p a dos colas", tipo: "num", valor: (f) => num(redondeoPar(f.dos, 3), 3) },
            { clave: "nulo95", titulo: "Percentil 95 del azar", tipo: "num", valor: (f) => num(f.nulo95, 3) },
          ])}
          filas={filasPerm}
          destacar={(f) => f.especificacion === "Área, 1-3 años" || f.especificacion === "Área, 1-3 años, con inercia"}
          nota={
            <>
              Barajé el orden de los años del precio 2,000 veces{/* fuente: notebook 13, celda 10 */} y conté qué tan seguido
              sale una suma así por azar. Con los errores habituales la elasticidad parecía muy significativa (t ≈{" "}
              {num(p4.base.dla.suma / p4.base.dla.se, 1)}), pero con solo 20 años esos errores prometen de más. La versión
              ponderada por tamaño ({num(permPonderada.suma, 2)}, p = {num(permPonderada.p_una_cola, 2)}) es exploratoria:
              la miré después de ver el panel, y Brasil e India pesan más de la mitad. Fuente: notebook 13 ·
              outputs/tables/serie3_resumen_p4.json.
            </>
          }
        />

        <div className={s.bloque}>
          <h3>La respuesta de Guatemala sola no se puede medir con esta base</h3>
          <p>
            Con unos 20 años, una regresión de un solo país no tiene poder estadístico. Además, el área de Guatemala de 2017
            a 2023 es estimada o imputada (pregunta 1). Lo descriptivo: el área pasó de {num(areaGt(2004), 0)} mil ha en
            2004 a {num(areaGt(2015), 0)} mil en 2015, en el ciclo de precios altos de 2009-2016. Para el ingenio, la
            respuesta que importa es la del mundo: cómo reaccionan Brasil y los demás grandes cuando el precio sube.
            {/* fuente: notebook 13, celdas 18 a 20 */}
          </p>
        </div>

        <Descartes
          items={[
            {
              codigo: "H24",
              hipotesis: "El área no responde al precio.",
              motivo: `Sí hay una asociación con el precio de 2 y 3 años antes, pequeña (~${num(elasticidad, 2)}), que se mantiene al controlar la inercia, al quitar cualquier año y con solo datos oficiales. Pero la evidencia causal es débil: el placebo del año siguiente falla en algunas muestras. Con ${conInercia.anios} años sale negativo y significativo (${num(conInercia.coef.dlpm1, 2)}, p = ${num(conInercia.p.dlpm1, 3)}); con ${conInercia3.anios} años baja a ${num(conInercia3.coef.dlpm1, 3)} y deja de serlo (p = ${num(conInercia3.p.dlpm1, 2)}).`,
            },
            {
              codigo: "H23",
              hipotesis: "La cosecha de Brasil sirve como instrumento para probar la causalidad precio → oferta.",
              motivo: `No con datos anuales: el rendimiento de Brasil casi no predice el precio del año (F = ${num(p4.primera_etapa_F, 2)}). El año calendario no coincide con la zafra y el precio reacciona a las expectativas antes que al dato final.`,
            },
          ]}
        />

        <Desplegable titulo="Método y pruebas de sensibilidad">
          <p>
            Panel país-año de {p4.anios_precio[0]} a {p4.anios_precio[1]} en cambios anuales del logaritmo, con efectos
            fijos por país y el precio de años anteriores ({num(p4.base.dla.n)} observaciones). Placebos: el precio del
            mismo año y del siguiente. La versión ARDL agrega los dos rezagos del propio crecimiento del área. No se pueden
            usar efectos fijos por año porque absorberían el precio.
          </p>
          <Tabla
            titulo="La respuesta se repite con otros errores, solo con datos oficiales y sin los cuatro grandes"
            compacta
            columnas={partirEncabezados<FilaRobustez>([
              { clave: "modelo", titulo: "Modelo" },
              { clave: "a1", titulo: "1 año", tipo: "num", valor: (f) => num(f.a1, 3) },
              { clave: "a2", titulo: "2 años", tipo: "num", valor: (f) => num(f.a2, 3) },
              { clave: "a3", titulo: "3 años", tipo: "num", valor: (f) => num(f.a3, 3) },
              { clave: "acumulada", titulo: "Acumulada", tipo: "num", valor: (f) => num(f.acumulada, 3) },
              { clave: "error", titulo: "Error", tipo: "num", valor: (f) => num(f.error, 3) },
              { clave: "n", titulo: "n", tipo: "num", valor: (f) => num(f.n) },
            ])}
            filas={filasRobustez}
            nota="Ponderada por área y en la serie mundial, la respuesta es mayor y se concentra a los 2 años, pero descansa casi toda en Brasil y la India."
          />
        </Desplegable>
        <Desplegable titulo="Figuras originales del notebook">
          <ImagenNotebook nombre="serie3_10_oferta_agregada" alt="Crecimiento del área mundial contra el cambio del precio de dos años antes" />
          <ImagenNotebook nombre="serie3_11_oferta_rezagos" alt="Elasticidad del área y de la producción por rezago del precio" />
          <ImagenNotebook nombre="serie3_12_oferta_permutacion" alt="Distribución de la prueba de permutación de los años del precio" />
        </Desplegable>

        <Nota tipo="limite" titulo="Solo hay unos 20 años de precio">
          <p>
            La significancia depende de cuántos rezagos se usen. El precio es el No. 11 nominal en dólares, no el que recibe
            cada país: la respuesta real probablemente es mayor que la medida. Las causas comunes (petróleo, tipo de cambio,
            políticas) no se pueden separar con estos datos.
          </p>
        </Nota>

        <Evaluacion
          serie="mercado"
          significa={
            <p>
              La oferta mundial de caña parece reaccionar al precio, pero poco y tarde: un alza de 10 % se asocia con ~
              {num(10 * elasticidad, 1)} % más área tres años después. En los grandes productores es ~
              {num(10 * ponderadaArea, 0)} %, concentrado a los dos años, pero ese dato es exploratorio. La relación va en
              los dos sentidos. Esto no sirve para pronosticar el precio (las preguntas 2 y 3 no encuentran ciclos aprovechables); dice que la
              expansión de los competidores llega con 2 o 3 años de rezago.
            </p>
          }
          decision={
            <>
              <p>
                No recomiendo expandir área por un precio alto de hoy: una expansión tarda años en producir y es cara de
                revertir en un cultivo perenne. Evaluaría cada expansión con escenarios de precio conservadores, no con el
                pico.
              </p>
              <p>
                Vigilaría a Brasil (avance de zafra, mezcla de azúcar y etanol, real) como indicador adelantado de oferta. En
                períodos de precio alto, lo aprovecharía con fijaciones de mediano plazo, como gestión de riesgo y no como
                pronóstico de caída.
              </p>
            </>
          }
          impacto="Directo, ninguno. Indirecto: evita inversiones en área calibradas con un precio excepcional, que son las más caras de revertir."
          riesgo="La significancia está en el borde y el placebo falla en algunas muestras. El efecto mayor de los grandes productores es exploratorio."
          certeza={{
            nivel: "media",
            texto:
              "Media en el rezago de 2 a 3 años: se mantiene al controlar la inercia, al quitar cualquier año y con solo datos oficiales. Media-baja en que la relación sea causal y en su magnitud exacta. Alta en que la respuesta es pequeña.",
          }}
        />
      </Seccion>

      {/* ── Cierre ─────────────────────────────────────────────────────── */}
      <Seccion
        id="cierre"
        etiqueta="Cierre"
        titulo="Lo que haría con más datos"
        entrada={<p>El siguiente paso no es un modelo más complejo, sino mejores datos.</p>}
      >
        <ul className="texto">
          <li>
            <strong>Guatemala:</strong> reemplazar FAOSTAT 2014-2023 por las estadísticas de la gremial y de su centro de
            investigación, y compararse contra El Salvador, Nicaragua y Eswatini en rendimiento y costos.
          </li>
          <li>
            <strong>Pronóstico:</strong> la curva completa de futuros (todos los vencimientos) y fundamentos: avance de zafra
            en Brasil, política de la India, real y petróleo.
          </li>
          <li>
            <strong>Oferta:</strong> extender el precio a 1960-2023 con la serie anual del Banco Mundial (de unos 20 a unos 60
            años de variación) y convertirlo a moneda local y a términos reales.
          </li>
          <li>
            <strong>Causalidad:</strong> usar el avance mensual de la zafra brasileña o choques de clima en Brasil como
            instrumento.
          </li>
        </ul>
        <div className={s.bloque}>
          <h3>Notebooks y código</h3>
          <ul className={s.enlaces}>
            <li>
              <a href={archivoRepo("notebooks/10_mercado_paises.ipynb")}>10_mercado_paises.ipynb</a>{" "}
              <span>países y datos poco confiables</span>
            </li>
            <li>
              <a href={archivoRepo("notebooks/11_mercado_precio.ipynb")}>11_mercado_precio.ipynb</a>{" "}
              <span>volatilidad, regímenes y verificación</span>
            </li>
            <li>
              <a href={archivoRepo("notebooks/12_mercado_pronostico.ipynb")}>12_mercado_pronostico.ipynb</a>{" "}
              <span>pronóstico a 1 y 3 meses con bandas</span>
            </li>
            <li>
              <a href={archivoRepo("notebooks/13_mercado_oferta.ipynb")}>13_mercado_oferta.ipynb</a>{" "}
              <span>respuesta de la oferta al precio</span>
            </li>
            <li>
              <a href={archivoRepo("bitacora.md")}>bitacora.md</a> <span>decisiones D53 a D62 e hipótesis H18 a H24</span>
            </li>
          </ul>
        </div>
      </Seccion>
    </div>
  );
}
