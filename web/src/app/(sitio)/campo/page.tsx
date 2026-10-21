import type { Metadata } from "next";
import Link from "next/link";
import { Cifra, FilaCifras } from "@/components/Cifra";
import { Evaluacion } from "@/components/Evaluacion";
import { Figura, ImagenNotebook } from "@/components/Figura";
import { IndiceLocal } from "@/components/IndiceLocal";
import { Nota } from "@/components/Nota";
import { CifraPortada, Portada } from "@/components/Portada";
import { Seccion } from "@/components/Seccion";
import { Tabla } from "@/components/Tabla";
import ambientes from "@/datos/serie1_ambientes_top.json";
import caidaSocas from "@/datos/serie1_caida_socas.json";
import certeza from "@/datos/serie1_certeza.json";
import limpieza from "@/datos/serie1_limpieza.json";
import longevidad from "@/datos/serie1_longevidad.json";
import modeloP2 from "@/datos/serie1_modelo_p2.json";
import comparacionesP2 from "@/datos/serie1_p2_comparaciones.json";
import metricasP2 from "@/datos/serie1_p2_metricas.json";
import plantia2022 from "@/datos/serie1_pronostico_2022_plantia.json";
import recomendacion from "@/datos/serie1_recomendacion.json";
import resumenP2 from "@/datos/serie1_resumen_p2.json";
import resumenP3 from "@/datos/serie1_resumen_p3.json";
import resumenP4 from "@/datos/serie1_resumen_p4.json";
import resumenQ1 from "@/datos/serie1_resumen_q1.json";
import segmentos from "@/datos/serie1_segmentos.json";
import sensibilidad from "@/datos/serie1_sensibilidad_precio.json";
import tamanoEnsayos from "@/datos/serie1_tamano_ensayos.json";
import { archivoRepo, figura, REPO } from "@/lib/base";
import { conSigno, num, pct, pctFraccion, usd } from "@/lib/formato";
import s from "./_componentes/campo.module.css";
import { curva, curvaDe, margenPromedio, mejorCiclo, precioEquilibrio, SUPUESTOS, TESTIGOS_NUCLEO } from "./_componentes/economia";
import { GraficoCaidaSocas } from "./_componentes/GraficoCaidaSocas";
import { GraficoDistancia, GraficoFincas } from "./_componentes/GraficosEnsayos";
import { GraficoComparaciones, GraficoModelos, GraficoZafras } from "./_componentes/GraficosModelo";
import { GraficoReproducibilidad, GraficoSilueta, MapaGrupos } from "./_componentes/GraficosSegmentos";
import { GraficoAmbientes, GraficoCiclo, GraficoCicloPrecio, GraficoGanancia, GraficoPrecio } from "./_componentes/GraficosVariedades";
import { Clave, conCortes, Descartadas, DetalleTecnico, FigurasNotebook, Salidas, Verificar } from "./_componentes/Piezas";

export const metadata: Metadata = {
  title: "Campo: variedades y renovación de lotes",
  description:
    "Qué variedades de caña ampliar, cada cuántos cortes renovar, cuánto azúcar esperar, qué rol darle a cada variedad y cómo decidir con datos propios. Ensayos públicos de Louisiana, 2010-2021.",
};

// 1 ha = 2.471054 acres. Solo para leer en hectáreas una cifra calculada por acre; se dice siempre la unidad.
const ACRES_POR_HA = 2.471054;
const TESTIGO = "Testigo núcleo promedio";
const pctEntero = (fraccion: number) => pctFraccion(fraccion, 0);
const masUsd = (x: number, d = 0) => `${x >= 0 ? "+" : "−"}US$${num(Math.abs(x), d)}`;

/* ── Los datos: auditoría del archivo (notebook 01) ────────────────────────── */
const regla = (inicio: string) => limpieza.find((r) => r.Regla.startsWith(inicio))!.Filas;
const filasOriginales = regla("filas_originales");
const filasFinales = regla("filas_finales");
const filasComa = regla("T_SPACRE/TRS partidos");
const doblesCapturas = regla("Filas idénticas");
const sinObjetivo = regla("Filas sin variable objetivo");
const filasLimpieza = limpieza.map((r) => ({
  regla: r.Regla === "filas_originales" ? "Filas originales del archivo" : r.Regla === "filas_finales" ? "Filas después de la limpieza" : r.Regla,
  filas: r.Filas,
  total: r.Regla.startsWith("filas_"),
}));
const socas = caidaSocas.map((r) => ({
  corte: r.corte, cruda: r.cruda, ajustada: r.ajustada, inf: r.ajustada_ic95_inf, sup: r.ajustada_ic95_sup, parcelas: r.parcelas,
}));
const ultimaSoca = socas[socas.length - 1];
const menosLongeva = longevidad.reduce((a, b) => (b.retencion_por_corte < a.retencion_por_corte ? b : a));
const masLongeva = longevidad.reduce((a, b) => (b.retencion_por_corte > a.retencion_por_corte ? b : a));

/* ── Variedades y renovación (notebook 02) ────────────────────────────────── */
const porRango = [...recomendacion].sort((a, b) => a.rank - b.rank);
const top3 = porRango.filter((r) => r.rank <= 3);
const [v1, v2, v3] = top3;
const tres = top3.map((r) => r.CLONE);
const alternativas = porRango.filter((r) => r.rank === 4 || r.rank === 5).map((r) => r.CLONE);
const ganadoras = recomendacion.filter((r) => r.ganancia_p05 > 0).length;
const ganaSiempre = Math.min(...top3.map((r) => r.P_gana_a_testigos));
const certezaDe = new Map(certeza.map((c) => [c.CLONE, c]));
const referencia = resumenQ1.referencia;
const replicas = resumenQ1.bootstrap.replicas;
const filasGanancia = porRango.map((r) => ({
  variedad: r.CLONE,
  punto: r.ganancia_vs_testigos,
  p05: certezaDe.get(r.CLONE)!.ganancia_p05,
  p95: certezaDe.get(r.CLONE)!.ganancia_p95,
  top3: r.rank <= 3,
  testigo: r.testigo,
}));
const supuestosTexto = `US$${num(SUPUESTOS.precio, 2)}/lb, US$${SUPUESTOS.corte}/t de caña, US$${SUPUESTOS.mantenimiento}/acre/año y US$${num(SUPUESTOS.renovacion)}/acre al renovar`;

// Margen promedio anual por número de cortes (mismas fórmulas del notebook 02)
const margenTestigo = margenPromedio(curva());
const margenV1 = margenPromedio(curvaDe(v1.CLONE));
const puntosCiclo = [
  ...margenV1.map((m, i) => ({ serie: v1.CLONE, cortes: i + 1, margen: m, destacada: true, optimo: i + 1 === v1.ciclo_optimo })),
  ...margenTestigo.map((m, i) => ({ serie: TESTIGO, cortes: i + 1, margen: m, destacada: false, optimo: i + 1 === referencia.ciclo })),
];

// Sensibilidad al precio: las tres recomendadas salen de la tabla del notebook; el testigo se recalcula con sus curvas
const campoSens = (f: (typeof sensibilidad)[number], clave: string) => (f as unknown as Record<string, number>)[clave];
const testigoAPrecio = (precio: number) => mejorCiclo(curva(), { ...SUPUESTOS, precio });
const puntosPrecio = sensibilidad.flatMap((f) => [
  ...tres.map((v) => ({ serie: v, precio: f.precio, margen: campoSens(f, `margen_${v}`), recomendada: true })),
  { serie: TESTIGO, precio: f.precio, margen: testigoAPrecio(f.precio).margen, recomendada: false },
]);
const equilibrioTestigo = precioEquilibrio(curva());
const equilibrios = [
  ...top3.map((r) => ({ serie: r.CLONE, precio: r.precio_equilibrio, recomendada: true })),
  { serie: TESTIGO, precio: equilibrioTestigo, recomendada: false },
];
const celdasCiclo = sensibilidad.flatMap((f) => [
  { serie: TESTIGO, precio: f.precio, ciclo: f.ciclo_referencia, pierde: testigoAPrecio(f.precio).margen < 0 },
  ...tres.map((v) => ({ serie: v, precio: f.precio, ciclo: campoSens(f, `ciclo_${v}`), pierde: campoSens(f, `margen_${v}`) < 0 })),
]);
const mismoTop3 = sensibilidad.every((f) => tres.every((v) => f.top3.split(", ").includes(v)));
const precios = sensibilidad.map((f) => f.precio);
const precioRenovarAntes = Math.min(...sensibilidad.filter((f) => tres.some((v) => campoSens(f, `ciclo_${v}`) === 3)).map((f) => f.precio));
const precioEstirar = Math.max(...sensibilidad.filter((f) => tres.some((v) => campoSens(f, `ciclo_${v}`) === 5)).map((f) => f.precio));
const eqTres = top3.map((r) => r.precio_equilibrio);
const conBarbecho5 = recomendacion.filter((r) => r.ciclo_con_barbecho === 5).length;
const extrapoladas = top3.filter((r) => r.ciclo_extrapolado);
const subeExtrapolando = extrapoladas.map((r) => r.margen_si_extrapola - r.margen_anual);

// Ventaja según el potencial de la finca
const ordenPotencial = ["bajo", "medio", "alto"];
const ventajaEn = (fila: (typeof ambientes)[number], p: string) => ((fila as unknown as Record<string, number>)[`mean_${p}`] - 1) * 100;
const puntosAmbiente = ambientes.flatMap((a) =>
  ordenPotencial.map((p) => ({
    variedad: a.CLONE,
    potencial: p,
    ventaja: ventajaEn(a, p),
    papel: (tres.includes(a.CLONE) ? (a.pendiente > 0 ? "mantiene" : "pierde") : "contexto") as "mantiene" | "pierde" | "contexto",
  })),
);
const ambienteDe = (v: string) => ambientes.find((a) => a.CLONE === v)!;
const pierdenEnRicas = ambientes.filter((a) => tres.includes(a.CLONE) && a.pendiente < 0);

/* ── Cuánto azúcar esperar (notebook 03) ──────────────────────────────────── */
const MODELOS = ["Ingenuo", "Agrónomo", "Regla P1", "Ridge", "Random Forest", "XGBoost"];
const ESCENARIOS: Record<string, string> = { escenario_1: "Escenario 1 · finca conocida", escenario_2: "Escenario 2 · finca nueva" };
const metrica = (esc: string, modelo: string) => metricasP2.find((m) => m.indice === esc && m.col1 === modelo)!;
const ridge1 = metrica("escenario_1", "Ridge");
const ridge2 = metrica("escenario_2", "Ridge");
const ingenuo1 = metrica("escenario_1", "Ingenuo");
const agronomo1 = metrica("escenario_1", "Agrónomo");
const filasModelos = metricasP2.map((m) => ({ escenario: ESCENARIOS[m.indice], modelo: m.col1, mae: m.MAE, mape: m["MAPE_%"], elegido: m.col1 === "Ridge" }));
const filasComparaciones = comparacionesP2.map((c) => ({
  comparacion: c["comparación"], d: c["Δ MAE lb/acre"], bajo: c["IC90 bajo"], alto: c["IC90 alto"], real: c["IC90 alto"] < 0 || c["IC90 bajo"] > 0,
}));
const comparacion = (nombre: string) => comparacionesP2.find((c) => c["comparación"] === nombre)!;
const reglaVsIngenuo = comparacion("Regla P1 − Ingenuo");
const ridgeGanaVentaja = comparacionesP2.filter((c) => c["comparación"].startsWith("Ridge −")).every((c) => (c["IC90 alto (pp)"] ?? 0) < 0);
const porCorte = resumenP2.por_corte as Record<string, { MAE: number; R2: number; orden_spearman: number | null; R2_ventaja: number | null }>;
const rhoSocas = porCorte["socas|Ridge"].orden_spearman!;
const r2VentajaSocas = porCorte["socas|Ridge"].R2_ventaja!;
const r2VentajaPlantiaMax = Math.max(...MODELOS.map((m) => porCorte[`plantía|${m}`]?.R2_ventaja ?? -1));
const cobertura1 = resumenP2.cobertura["Escenario 1"];
const cobertura2 = resumenP2.cobertura["Escenario 2"];
const banda = (texto: string) => texto.replace(/-/g, "−").replace(/%/g, " %").replace(" / ", " a ");
const errorZafra = Object.entries(resumenP2.error_por_zafra_pct).map(([zafra, sesgo]) => ({
  zafra,
  sesgo,
  cobertura: (resumenP2.cobertura_por_zafra as Record<string, number>)[zafra] ?? null,
  destacada: sesgo <= -10,
}));
const zafrasMalas = errorZafra.filter((z) => z.destacada);
const sesgoMin = num(Math.min(...zafrasMalas.map((z) => Math.abs(z.sesgo))));
const sesgoMax = num(Math.max(...zafrasMalas.map((z) => Math.abs(z.sesgo))));
const coef1 = modeloP2.escenario_1.coef;
const importancia = resumenP2.importancia_rf_pp;
const finca = resumenP2.costo_finca_ic90;

/* ── Rol de cada variedad (notebook 04) ───────────────────────────────────── */
const testigoDe = new Map(recomendacion.map((r) => [r.CLONE, r.testigo]));
const puntosSegmentos = segmentos.map((v) => ({
  variedad: v.indice, cana: v["caña vs testigos %"], trs: v["TRS vs testigos %"], grupo: v.grupo, certeza: v.certeza, testigo: testigoDe.get(v.indice) ?? false,
}));
const jaccard = resumenP3.jaccard as Record<string, number>;
const perfilDe = (g: string) => resumenP3.perfil.find((p) => p.grupo === g)!;
const grupos = resumenP3.orden_grupos.map((g) => ({ nombre: g, n: perfilDe(g).variedades, jaccard: jaccard[g] }));
const miembros = (g: string) => segmentos.filter((v) => v.grupo === g).map((v) => `${v.indice}${testigoDe.get(v.indice) ? " (T)" : ""}`);
const kElegido = resumenP3.estabilidad.find((e) => e.k === resumenP3.k)!;
const pMinSilueta = Math.min(...resumenP3.silueta.map((x) => x.p));
const dudosas = segmentos.filter((v) => v.certeza < 0.6).map((v) => v.indice);
const sinFibra = segmentos.filter((v) => v.fibra_parcelas === 0).length;
const corr = resumenP3.correlaciones;
const [completas, calidadSinCana, muchaCana, inestables, sinVentaja] = resumenP3.orden_grupos.map(perfilDe);
// "Completas: caña, calidad y longevidad" → "Completas (caña, calidad y longevidad)", para no encadenar dos puntos
const nombreGrupo = (g: string) => (g.includes(": ") ? `${g.split(": ")[0]} (${g.split(": ")[1]})` : g);
const filasGrupos = resumenP3.perfil.map((p) => ({
  grupo: p.grupo,
  variedades: miembros(p.grupo).join(", "),
  cana: p["caña %"],
  trs: p["TRS %"],
  azucar: p["azúcar plantía %"],
  porCorte: p["caña por corte %"],
  sigma: p["σ interacción %"],
  ganancia: p["ganancia P1 US$/acre/año (mediana)"],
  jaccard: jaccard[p.grupo],
}));

/* ── Datos propios (notebook 05) ──────────────────────────────────────────── */
const auditoria = resumenP4.auditoria;
const distancia = resumenP4.distancia;
const equilibrioDistancia = distancia.equilibrio as Record<string, number>;
const filasDistancia = [
  { serie: "Testigo promedio", equilibrio: equilibrioDistancia["Testigo promedio"], destacada: false },
  ...tres.map((v) => ({ serie: v, equilibrio: equilibrioDistancia[v], destacada: true })),
];
const eqDistTres = tres.map((v) => equilibrioDistancia[v]);
const pierdePorDolar = Object.values(distancia.pierde_por_dolar);
const metricos = resumenP4.supuestos_metricos;
const potencia20 = resumenP4.potencia_20_fincas_6_anios as Record<string, number>;
const desvio = (varianza: number) => Math.sqrt(varianza) * 100;
const comp = resumenP4.componentes;
const leerIndice = (indice: string) => {
  const [anios, inter] = indice.split(", ");
  return { anios: anios.replace(" de cosecha", ""), interaccion: inter.replace("interacción ", "") };
};
const filasFincas = tamanoEnsayos.map((t) => ({ ...leerIndice(t.indice), fincas: t["ventaja 10%"], destacada: t.indice.startsWith("6") }));
const ordenInteraccion = [...new Set(filasFincas.map((f) => f.interaccion))];
const ordenAnios = [...new Set(filasFincas.map((f) => f.anios))];
const fincasRecomendadas = 20; // fuente: notebook 05, celda 19 (diseño recomendado: 20 fincas por cohorte, 5 por estrato)
const filasTamanos = tamanoEnsayos.map((t) => ({
  escenario: t.indice,
  v5: t["ventaja 5%"] as number | null,
  v75: t["ventaja 7.5%"] as number | null,
  v10: t["ventaja 10%"] as number | null,
  v15: t["ventaja 15%"] as number | null,
}));
const fincasOno = (x: number | null) => (x === null ? "no se alcanza" : num(x));

// Tablas escritas a mano: solo existen en el texto del notebook 05 (sección 2 y sección 7)
const tablasCaptura = [
  { tabla: "finca", fila: "finca", campos: "altitud, estrato, distancia al ingenio, coordenadas", uso: "zonificar y costear" },
  { tabla: "lote", fila: "lote", campos: "área, grupo de suelo, drenaje, riego, polígono", uso: "zonificar" },
  { tabla: "siembra", fila: "renovación", campos: "fecha de siembra, variedad", uso: "reconstruir ciclos sin adivinar" },
  { tabla: "cosecha", fila: "lote × corte", campos: "zafra, fecha, número de corte, toneladas, área, rendimiento, fibra, edad, tercio de zafra, tipo de cosecha", uso: "todo lo demás" },
  { tabla: "estacion, lote_estacion, clima_diario", fila: "estación × día", campos: "lluvia, temperatura, radiación, viento", uso: "explicar el error de nivel (pregunta 2)" },
  { tabla: "manejo", fila: "aplicación", campos: "fertilización, riego, madurante", uso: "separar variedad de manejo" },
  { tabla: "costo_lote", fila: "lote × zafra × concepto", campos: "corte, alce, transporte, renovación", uso: "economía por lote" },
  { tabla: "ensayo, parcela_ensayo", fila: "parcela × corte", campos: "variedad, testigo, repetición, TCH, rendimiento, roya", uso: "ensayos propios" },
];
const hojaDeRuta = [
  { cuando: "Zafra 1, primeros 3 meses", que: "Ordenar los registros históricos en el modelo de datos", resultado: "base única, con reglas de calidad" },
  { cuando: "Zafra 1", que: "Auditoría de renovaciones y regla de reemplazo por lote", resultado: "lista de lotes vencidos y de renovaciones adelantadas" },
  { cuando: "Zafra 1", que: "Costos por lote y distancia", resultado: "política de renovación por zona de costo" },
  { cuando: "Zafras 1-2", que: "Zonificación con estrato, suelo, lluvia, viento y drenaje", resultado: "zonas de manejo y variedad por zona (hipótesis)" },
  { cuando: "Desde la zafra 1", que: "Ensayos propios: una cohorte por año en 20 fincas", resultado: "ventaja de cada candidata por zona, con certeza" },
  { cuando: "Zafras 3-4", que: "Repetir las preguntas 1 a 3 con datos propios", resultado: "recomendación de variedades y renovación del ingenio" },
];

// La respuesta va primero (variedades); los datos, después, como "por qué creerle a las cifras".
const INDICE = [
  { id: "variedades", etiqueta: "Variedades" },
  { id: "datos", etiqueta: "Los datos" },
  { id: "pronostico", etiqueta: "Pronóstico" },
  { id: "perfiles", etiqueta: "Roles" },
  { id: "datos-propios", etiqueta: "Datos propios" },
  { id: "codigo", etiqueta: "Código" },
];

const NOTEBOOKS = {
  eda: { numero: "01", archivo: "01_campo_eda.ipynb" },
  recomendacion: { numero: "02", archivo: "02_campo_recomendacion.ipynb" },
  modelo: { numero: "03", archivo: "03_campo_modelo.ipynb" },
  segmentos: { numero: "04", archivo: "04_campo_segmentos.ipynb" },
  propios: { numero: "05", archivo: "05_campo_datos_propios.ipynb" },
};

export default function PaginaCampo() {
  return (
    <div data-serie="campo">
      <Portada
        serie="campo"
        titulo="Tres variedades le ganan al testigo"
        entrada={
          <p>
            Recomiendo ampliar {v1.CLONE}, validar {v2.CLONE} y {v3.CLONE} y renovar cada {v1.ciclo_optimo} cortes. Son
            ensayos públicos de Louisiana: se traslada el método, no las variedades.
          </p>
        }
        acciones={
          <>
            <Link className="boton" href="/herramientas#ciclo">Calcular el ciclo con mis costos</Link>
            <Link href="/api#grupo-campo">Ver las consultas de campo en la API</Link>
          </>
        }
        // La cifra que responde y, debajo, de dónde sale: así la columna derecha no queda vacía y en el teléfono la cifra
        // aparece antes que el contexto.
        piezaPanel={false}
        pieza={
          <div className={s.piezaPortada}>
            <CifraPortada
              valor={masUsd(v1.ganancia_vs_testigos)}
              unidad="por acre al año"
              etiqueta={`Lo que deja ${v1.CLONE} sobre el testigo, renovando cada ${v1.ciclo_optimo} cortes`}
              detalle={`Rango de 90 %: US$${num(v1.ganancia_p05)} a US$${num(v1.ganancia_p95)}. ${v2.CLONE}: ${masUsd(v2.ganancia_vs_testigos)}; ${v3.CLONE}: ${masUsd(v3.ganancia_vs_testigos)}. Las tres le ganan al testigo en el ${pctEntero(ganaSiempre)} de las réplicas.`}
            />
            <dl className={s.metaPortada}>
              <div>
                <dt>Datos</dt>
                <dd>Ensayos de caña de Louisiana, 2010-2021{/* fuente: notebook 01, celda 0 */}</dd>
              </div>
              <div>
                <dt>Filas útiles</dt>
                <dd>{num(filasFinales)} de {num(filasOriginales)}</dd>
              </div>
              <div>
                <dt>Variedades con evidencia</dt>
                <dd>{resumenQ1.n_elegibles} de {resumenQ1.n_variedades_etapa5}</dd>
              </div>
              <div>
                <dt>Análisis</dt>
                <dd><a href={`${REPO}/tree/main/notebooks`}>Cinco notebooks en GitHub</a></dd>
              </div>
            </dl>
          </div>
        }
      />
      <IndiceLocal items={INDICE} serie="campo" titulo="Secciones de la página de campo" />

      {/* ── Variedades y renovación ────────────────────────────────────────── */}
      <Seccion
        id="variedades"
        titulo={`Renovar cada ${v1.ciclo_optimo} cortes, con tres variedades`}
        entrada={
          <p>
            Recomiendo ampliar {v1.CLONE} y validar {v2.CLONE} y {v3.CLONE}. Dejan entre {usd(v3.ganancia_vs_testigos)} y{" "}
            {usd(v1.ganancia_vs_testigos)} más por acre al año que el testigo, la variedad de referencia.
          </p>
        }
        cifras={
          <FilaCifras columnas={2}>
            <Cifra valor={v1.ciclo_optimo} unidad="cortes" etiqueta="Ciclo óptimo de las tres" detalle={`Plantía y ${v1.ciclo_optimo - 1} socas. Con un corte más, el margen baja poco.`} />
            <Cifra valor={pctEntero(ganaSiempre)} etiqueta="Réplicas en que las tres le ganan al testigo" detalle={`De ${num(replicas)} que remuestrean ensayos completos.`} />
          </FilaCifras>
        }
      >
        <Figura
          numero={1}
          ancho="total"
          titulo={`${v1.CLONE}, ${v2.CLONE} y ${v3.CLONE} encabezan; ${alternativas.join(" y ")} se traslapan con la tercera`}
          nota={
            <>
              Cada punto es la ganancia de la variedad contra el testigo núcleo promedio, con su mejor ciclo; la línea es el
              rango donde cae el 90 % de las réplicas. {ganadoras} de las {recomendacion.length} variedades tienen todo el
              rango arriba de cero. {alternativas.join(" y ")} se traslapan con {v3.CLONE}: son la alternativa si esta no
              confirma en las socas 3 y 4.
              <Clave items={[{ tipo: "lleno", texto: "Recomendada" }, { tipo: "contexto", texto: "Candidata" }, { tipo: "huecoContexto", texto: "Testigo (variedad comercial de referencia)" }]} />
            </>
          }
          fuente={conCortes("notebook 02 · outputs/tables/serie1_recomendacion.csv y serie1_certeza.csv")}
        >
          <GraficoGanancia filas={filasGanancia} />
        </Figura>

        <div className={s.dosFiguras}>
          <Figura
            numero={2}
            titulo={`El margen anual llega a su máximo con ${v1.ciclo_optimo} cortes y con ${v1.ciclo_optimo + 1} baja poco`}
            nota={`La plantía carga el costo de renovar; las socas, los cortes que siguen, lo pagan. El promedio sube mientras cada soca nueva deja más que el promedio acumulado. ${v2.CLONE} y ${v3.CLONE} también tienen su óptimo en ${v2.ciclo_optimo} cortes. Con los supuestos del caso (${supuestosTexto}), el testigo deja ${usd(referencia.margen, 1)} por acre al año.`}
            fuente={conCortes("notebook 02 · recalculado con outputs/models/serie1_curvas.json y las fórmulas de src/campo_economia.py")}
          >
            <GraficoCiclo puntos={puntosCiclo} />
          </Figura>
          <Figura
            numero={3}
            titulo={mismoTop3 ? `Las mismas tres encabezan con cualquier precio de US$${num(Math.min(...precios), 2)} a US$${num(Math.max(...precios), 2)}/lb` : "El precio cambia el orden de las variedades"}
            nota={`Las tres líneas verdes van casi juntas y siempre arriba del testigo. Los círculos sobre el cero marcan el precio de equilibrio: US$${num(Math.min(...eqTres), 3)}-${num(Math.max(...eqTres), 3)}/lb para las tres y US$${num(equilibrioTestigo, 3)} para el testigo. Con US$${num(precioRenovarAntes, 2)} o más conviene renovar antes; con US$${num(precioEstirar, 2)} o menos, estirar a 5 cortes.`}
            fuente={conCortes("notebook 02 · outputs/tables/serie1_sensibilidad_precio.csv; el testigo se recalcula con serie1_curvas.json")}
          >
            <GraficoPrecio puntos={puntosPrecio} equilibrios={equilibrios} precioCaso={SUPUESTOS.precio} />
          </Figura>
        </div>

        <div className={s.piezaYMargen}>
          <Figura
            numero={4}
            titulo={`${tres.filter((v) => ambienteDe(v).pendiente > 0).join(", ")} mantiene su ventaja en las fincas de más potencial; ${pierdenEnRicas.map((a) => a.CLONE).join(" y ")} la reducen`}
            nota={`El potencial se mide con los propios datos: cuánto rinden las demás parcelas en esa finca y año, sin los testigos núcleo ni la variedad evaluada. Los ambientes se parten en tercios. En los de potencial alto, la ventaja de ${pierdenEnRicas
              .map((a) => `${a.CLONE} baja de ${conSigno(ventajaEn(a, "bajo"), 1)} % a ${conSigno(ventajaEn(a, "alto"), 1)} %`)
              .join(" y la de ")}.`}
            fuente={conCortes("notebook 02 · outputs/tables/serie1_ambientes_top.csv")}
          >
            <GraficoAmbientes puntos={puntosAmbiente} orden={ordenPotencial} />
          </Figura>
          <div className={s.lectura}>
            <h3>Qué puede mover la recomendación</h3>
            <p>
              {pierdenEnRicas.map((a) => a.CLONE).join(" y ")} pierden ventaja en las fincas de más potencial: conviene
              probarlas primero en fincas de potencial bajo o medio.
            </p>
            <p>
              {extrapoladas.map((r) => r.CLONE).join(" y ")} solo tienen datos hasta la soca{" "}
              {extrapoladas[0]?.ultimo_corte_medido ?? 2} y su ventaja crece en cada corte. Por defecto congelé esa ventaja en
              el último corte medido. Si se extrapola en línea recta, su ciclo óptimo pasa a{" "}
              {extrapoladas[0]?.ciclo_si_extrapola} cortes y su margen sube entre {usd(Math.min(...subeExtrapolando))} y{" "}
              {usd(Math.max(...subeExtrapolando))} por acre al año.
            </p>
            <p>
              Con un año de barbecho antes de resembrar, el óptimo es de 5 cortes para {conBarbecho5} de las{" "}
              {recomendacion.length} variedades; {v1.CLONE} se queda en {v1.ciclo_con_barbecho}.
            </p>
          </div>
        </div>

        <div className={s.piezaYMargen}>
          <div className={s.lectura}>
            <h3>Cómo lo sé</h3>
            <p>
              Dividí cada parcela entre el promedio de los testigos núcleo en su mismo ensayo y corte: así comparo en el mismo
              campo y año. Por variedad ajusté una recta de dos parámetros: cuánto rinde en plantía contra los testigos y cuánto
              gana o pierde en cada corte. Con esa curva calculé el margen de cada ciclo posible y elegí el de mejor margen
              promedio anual.
            </p>
            <p>
              La certeza sale de {num(replicas)} réplicas que remuestrean ensayos completos. Descarté, en su mayor parte, que
              las mejores variedades rindan relativamente mejor en ambientes pobres: salía de medir el ambiente con los mismos
              testigos del denominador.
            </p>
          </div>
          <Verificar
            herramienta={{ href: "/herramientas#ciclo", texto: "Calcular el ciclo con mis costos" }}
            consultas={["GET /campo/variedades", "POST /campo/ciclo"]}
            notebook={NOTEBOOKS.recomendacion}
            extra={[{ href: archivoRepo("src/campo_economia.py"), texto: "Economía del ciclo en src/campo_economia.py" }]}
          />
        </div>

        <DetalleTecnico titulo={`método, las ${recomendacion.length} variedades y figuras del notebook 02`}>
          <div>
            <h4>Método y supuestos</h4>
            <p>
              Testigos núcleo: {TESTIGOS_NUCLEO.join(", ")}, presentes en etapa 5 los 12 años. Los 459 grupos ensayo × corte
              tienen al menos uno y 451 tienen dos o más. Para un testigo núcleo, su referencia excluye su propia parcela. {/* fuente: notebook 02, celda 4 */}
            </p>
            <p>
              Modelo por variedad: log(rendimiento / testigos) = a + b × corte. La curva absoluta es la de los testigos núcleo
              multiplicada por esa ventaja; las toneladas salen de azúcar / TRS. Ciclo óptimo: número de cortes, de 1 a 5, con
              mayor margen promedio anual. Precio de equilibrio: precio mínimo con el que el mejor ciclo cubre todos sus costos.
            </p>
            <p>
              Bootstrap: {num(replicas)} réplicas por ensayos completos, semilla {resumenQ1.bootstrap.semilla}. El IC90 es el
              rango donde cae el 90 % de las réplicas. En {resumenQ1.bootstrap.sin_soca4} réplicas (
              {pct((resumenQ1.bootstrap.sin_soca4 / replicas) * 100, 1)}) no hay soca 4 de los testigos; en ellas el ciclo de 5
              cortes no se evalúa. La localidad explica {pct(resumenQ1.ambiente_pct["C(LOC)"], 0)} del potencial de la finca y el
              año otro {pct(resumenQ1.ambiente_pct["C(YEAR)"], 0)}: el potencial es útil, pero no es una etiqueta fija.
              Decisiones D14 a D21.
            </p>
          </div>

          <Figura
            titulo={`Con precios de US$${num(precioRenovarAntes, 2)} o más conviene renovar antes; con US$${num(precioEstirar, 2)} o menos, estirar a 5 cortes`}
            nota="Cada celda es el ciclo óptimo en cortes; más oscuro, más cortes. La columna con borde es el precio del caso. Con asterisco y sin relleno: con ese precio ni el mejor ciclo cubre costos."
            fuente={conCortes("notebook 02 · outputs/tables/serie1_sensibilidad_precio.csv; el testigo, de serie1_curvas.json")}
          >
            <GraficoCicloPrecio celdas={celdasCiclo} series={[TESTIGO, ...tres]} precioCaso={SUPUESTOS.precio} />
          </Figura>

          <Tabla
            titulo={`Las ${recomendacion.length} variedades con evidencia suficiente, ordenadas por margen`}
            compacta
            ancho="total"
            columnas={[
              { clave: "CLONE", titulo: "Variedad", valor: (r) => `${r.CLONE}${r.testigo ? " (T)" : ""}` },
              { clave: "ciclo_optimo", titulo: "Ciclo (cortes)", tipo: "num" },
              { clave: "margen_anual", titulo: "Margen US$/acre/año", tipo: "num", valor: (r) => num(r.margen_anual as number, 1) },
              { clave: "ganancia_vs_testigos", titulo: "Contra el testigo", tipo: "num", valor: (r) => conSigno(r.ganancia_vs_testigos as number, 1) },
              { clave: "ic", titulo: "IC90", tipo: "num", valor: (r) => `${conSigno(r.ganancia_p05 as number)} a ${conSigno(r.ganancia_p95 as number)}` },
              { clave: "P_top3", titulo: "En el top 3", tipo: "num", valor: (r) => pctFraccion(r.P_top3 as number, 1) },
              { clave: "precio_equilibrio", titulo: "Equilibrio US$/lb", tipo: "num", valor: (r) => num(r.precio_equilibrio as number, 3) },
              { clave: "nivel_certeza_top3", titulo: "Certeza top 3" },
            ]}
            filas={porRango}
            destacar={(r) => (r.rank as number) <= 3}
            nota={conCortes(`(T) = testigo. "En el top 3" es la proporción de réplicas del bootstrap en que la variedad queda entre las tres primeras. Fuente: notebook 02 · outputs/tables/serie1_recomendacion.csv.`)}
          />

          <Descartadas
            items={[
              {
                id: "H3",
                hipotesis: "Las mejores variedades rinden relativamente mejor en ambientes pobres.",
                motivo: `Descartada en su mayor parte. La primera versión medía el ambiente con los mismos testigos del denominador, y ${pctEntero(resumenQ1.trampa.neg_con_trampa)} de las pendientes salían negativas por regresión a la media. Con un índice independiente bajan a ${pctEntero(resumenQ1.trampa.neg_corregida)} y la mediana pasa de ${num(resumenQ1.trampa.mediana_con_trampa, 3)} a ${num(resumenQ1.trampa.mediana_corregida, 3)}. Lo que queda en pie es la figura 4.`,
              },
            ]}
          />

          <FigurasNotebook
            notebook="02"
            figuras={[
              { nombre: "serie1_09_nivel_longevidad", alt: "Nivel en plantía contra longevidad de cada variedad frente a los testigos" },
              { nombre: "serie1_10_ciclo_optimo", alt: "Margen anual según el número de cortes para las variedades evaluadas" },
              { nombre: "serie1_11_certeza", alt: "Ganancia contra el testigo con intervalos del bootstrap" },
              { nombre: "serie1_12_precio", alt: "Ciclo óptimo y margen según el precio del azúcar" },
              { nombre: "serie1_13_ambientes", alt: "Ventaja de las mejores variedades según el potencial de la finca" },
            ]}
          />
          <Salidas archivos={["outputs/tables/serie1_recomendacion.csv", "serie1_certeza.csv", "serie1_sensibilidad_precio.csv", "outputs/models/serie1_curvas.json"]} />
        </DetalleTecnico>

        <Evaluacion
          serie="campo"
          significa={
            <p>
              Comparadas en el mismo campo y año, hay variedades que dejan entre {usd(v3.ganancia_vs_testigos)} y{" "}
              {usd(v1.ganancia_vs_testigos)} más por acre al año que el testigo promedio. La diferencia viene del azúcar por
              acre y, en las tres mejores, de que su ventaja no se pierde en las socas.
            </p>
          }
          decision={
            <>
              <p>
                Recomiendo ampliar {v1.CLONE}, la de mayor evidencia ({v1.anios} años, hasta la soca {v1.ultimo_corte_medido}), y
                en escala de validación {v2.CLONE} y {v3.CLONE}, medidas hasta la soca {v2.ultimo_corte_medido}.
              </p>
              <p>
                Renovar cada {v1.ciclo_optimo} cortes. Si un lote llega a la soca {v1.ciclo_optimo} con buen rendimiento,
                mantenerlo no destruye valor. Antes de escalar {v2.CLONE} y {v3.CLONE}, medirlas hasta la soca 4.
              </p>
            </>
          }
          impacto={
            <p>
              {masUsd(v1.ganancia_vs_testigos)} por acre al año con {v1.CLONE} (rango de 90 %: {num(v1.ganancia_p05)} a{" "}
              {num(v1.ganancia_p95)}), unos {usd(v1.ganancia_vs_testigos * ACRES_POR_HA)} por hectárea al año. Ilustrativo: en
              1,000 acres ({num(1000 / ACRES_POR_HA)} ha), {usd(v1.ganancia_vs_testigos * 1000)} al año (rango de{" "}
              {num(v1.ganancia_p05 * 1000)} a {num(v1.ganancia_p95 * 1000)}).
            </p>
          }
          riesgo={
            <ul>
              <li>
                Validez externa: datos de Louisiana. Para el ingenio es un protocolo, no una lista de compra: las variedades no
                se trasladan; el método sí. Las réplicas miden la incertidumbre estadística, no el riesgo de llevar resultados de
                Louisiana a Guatemala.
              </li>
              <li>Extrapolación: {v2.CLONE} y {v3.CLONE} se midieron solo hasta la soca {v2.ultimo_corte_medido}; no tienen soca 3 medida.</li>
              <li>
                Precio: bajo US${num(Math.min(...eqTres), 3)}-{num(Math.max(...eqTres), 3)}/lb ninguna cubre costos. Con
                US${num(precioRenovarAntes, 2)} o más conviene renovar antes; con US${num(precioEstirar, 2)} o menos, estirar a
                5 cortes.
              </li>
              <li>Barbecho: con un año sin caña, el óptimo sube a 5 cortes para {conBarbecho5} de las {recomendacion.length} variedades.</li>
            </ul>
          }
          certeza={{
            nivel: "alta",
            texto: (
              <p>
                Alta para {v1.CLONE} y {v2.CLONE} (en el top 3 en {pctFraccion(v1.P_top3, 1)} y {pctFraccion(v2.P_top3, 1)} de
                las réplicas). Media para {v3.CLONE} ({pctFraccion(v3.P_top3, 1)}). Las tres le ganan al testigo en el{" "}
                {pctEntero(ganaSiempre)} de las réplicas.
              </p>
            ),
          }}
        />
      </Seccion>

      {/* ── Los datos: por qué creerle a las cifras ────────────────────────── */}
      <Seccion
        id="datos"
        titulo="El azúcar venía en libras, no en toneladas"
        entrada={
          <p>
            Leí el archivo como texto antes de confiar en él: una coma decimal partía columnas, una unidad venía mal
            documentada y había dobles capturas.
          </p>
        }
        cifras={
          <FilaCifras columnas={2}>
            {/* fuente: notebook 01, celdas 8 y 9 (T_SPACRE en libras; tomarlo como toneladas inflaría el ingreso ×2,000) */}
            <Cifra valor="×2,000" etiqueta="Error que habría tenido el ingreso" detalle="El archivo dice toneladas de azúcar por acre; caña × TRS prueba que son libras." />
            <Cifra valor={pct((filasComa / filasOriginales) * 100, 1)} etiqueta="Filas partidas por una coma decimal" detalle={`${num(filasComa)} filas, todas de 2010-2019. Las reparé y validé con caña × TRS.`} />
          </FilaCifras>
        }
      >
        <div className={s.piezaYMargen}>
          <Figura
            numero={5}
            titulo={`Ajustada por lugar y año, la soca ${ultimaSoca.corte} rinde ${pctEntero(ultimaSoca.ajustada)} de la plantía; el promedio crudo dice ${pctEntero(ultimaSoca.cruda)}`}
            nota={`A la soca ${ultimaSoca.corte} llegaron ${ultimaSoca.parcelas} parcelas de ensayos buenos. La curva ajustada compara cortes del mismo lugar y año; la banda es su intervalo de 95 %.`}
            fuente={conCortes("notebook 01 · outputs/tables/serie1_caida_socas.csv")}
          >
            <GraficoCaidaSocas filas={socas} />
          </Figura>
          <div className={s.lectura}>
            <h3>Las socas parecen mejores de lo que son</h3>
            <p>
              Solo los clones buenos siguen midiéndose en socas: en etapas 3 y 4, los que siguen ya rendían 12-13 % más en
              plantía que los descartados. Por eso el promedio crudo se aplana. Para la economía uso la caída ajustada. {/* fuente: notebook 01, celda 30 */}
            </p>
            <Nota tipo="limite" titulo="Datos de otro lugar">
              <p>
                Son ensayos de Louisiana, con heladas y ciclos cortos. La soca {ultimaSoca.corte} tiene solo{" "}
                {ultimaSoca.parcelas} parcelas, así que no evalúo ciclos de más de {curva().length} cortes.
              </p>
            </Nota>
          </div>
        </div>

        <Tabla
          titulo="Lo que encontré en los datos y qué decidí por eso"
          ancho="total"
          columnas={[
            { clave: "hallazgo", titulo: "Hallazgo" },
            { clave: "decision", titulo: "Decisión" },
          ]}
          filas={[
            {
              hallazgo: "Las mismas variedades rinden más en etapas tempranas: comparando el mismo clon el mismo año, la etapa 2 da 1.58 veces la caña de la etapa 5 (mediana de 33 pares).", /* fuente: notebook 01, celda 21 */
              decision: "La economía se calcula solo con etapa 5, la última del programa, con ensayos en campos comerciales. Las etapas 2-4 se usan solo en relación con los testigos.",
            },
            {
              hallazgo: "En etapa 5, localidad × año explica 40.1 % de la variación del azúcar por acre; la variedad, 9.4 %.", /* fuente: notebook 01, celda 24 */
              decision: `Toda comparación se hace dentro del mismo ensayo y corte, contra ${TESTIGOS_NUCLEO.length} testigos núcleo presentes los 12 años: ${TESTIGOS_NUCLEO.join(", ")}.`, /* fuente: notebook 02, celda 3 */
            },
            {
              hallazgo: "En etapas 3 y 4, los clones que se siguen midiendo en socas ya rendían 12-13 % más en plantía que los descartados.", /* fuente: notebook 01, celda 30 */
              decision: "La caída de socas se mide dentro del mismo clon y ensayo, en etapa 5, donde no hay descarte dentro del ensayo.",
            },
            {
              hallazgo: `La longevidad cambia entre variedades: ${masLongeva.CLONE} conserva ${pctEntero(masLongeva.retencion_por_corte)} de su rendimiento en cada corte y ${menosLongeva.CLONE}, ${pctEntero(menosLongeva.retencion_por_corte)}.`,
              decision: "El ranking combina productividad y longevidad, y la longevidad define cada cuántos cortes renovar cada variedad.",
            },
            {
              hallazgo: "Dos repeticiones del mismo clon en el mismo ensayo apenas se parecen (correlación cercana a 0.4), y los primeros del ranking crudo solo tienen plantía de un año.", /* fuente: notebook 01, celdas 40 y 46 */
              decision: `Solo recomiendo variedades con al menos 2 años en etapa 5 y socas medidas hasta la soca 2: quedan ${resumenQ1.n_elegibles} de ${resumenQ1.n_variedades_etapa5}.`,
            },
          ]}
          nota="Fuente: notebook 01 (secciones 4 y 5) y notebook 02 (sección 2) · bitácora D7 a D15."
        />

        <div className={s.piezaYMargen}>
          <div className={s.lectura}>
            <h3>Cómo lo sé</h3>
            <p>
              En 2010-2019 el azúcar por acre se guardó con coma decimal. Como el archivo separa columnas con comas, el número
              se partió: la parte entera quedó en su columna y los decimales se pegaron al TRS (azúcar recuperable por tonelada
              de caña). Leído sin revisar, esas filas pierden el TRS sin dar ningún error. Reconstruí ambos valores y la
              identidad azúcar = caña × TRS se cumple con error menor a 0.3 % en casi todas las filas, también en las
              reparadas: solo 8 de {num(filasFinales)} se alejan más de 2 %. {/* fuente: notebook 01, celdas 8 y 9 */}
            </p>
            <p>
              La misma identidad prueba que la columna de azúcar por acre (T_SPACRE) está en libras, no en toneladas como dicen
              la descripción del caso y una nota dentro del propio archivo. El archivo además une dos exportaciones: en
              2020-2021 la población de tallos cambia de unidad y la fibra se mide en 98 % de las filas, contra cerca de 32 %
              antes. {/* fuente: notebook 01, celdas 8, 9 y 49 */}
            </p>
          </div>
          <Verificar
            titulo="Para revisarlo"
            notebook={NOTEBOOKS.eda}
            extra={[{ href: archivoRepo("src/campo_data.py"), texto: "Reglas de limpieza en src/campo_data.py, las mismas que usa la API" }]}
          />
        </div>

        <DetalleTecnico titulo="reglas de limpieza, hipótesis y figuras del notebook 01">
          <Tabla
            titulo="Reglas de limpieza y filas afectadas"
            compacta
            columnas={[
              { clave: "regla", titulo: "Regla" },
              { clave: "filas", titulo: "Filas", tipo: "num", valor: (f) => num(f.filas as number), ancho: "7rem" },
            ]}
            filas={filasLimpieza}
            destacar={(f) => f.total as boolean}
            nota={conCortes(`Solo dos reglas quitan filas: ${num(doblesCapturas)} dobles capturas y ${num(sinObjetivo)} sin variable objetivo. Las demás reparan valores o los marcan como faltantes. Fuente: notebook 01 · outputs/tables/serie1_limpieza.csv · reglas en src/campo_data.py.`)}
          />
          <div>
            <h4>Cómo audité el archivo</h4>
            <p>
              Leí el CSV como texto, sin dejar que pandas adivine tipos. Revisé dos identidades fila por fila: azúcar = caña ×
              TRS (lb/acre = t/acre × lb/t) y caña = tallos × peso del tallo / 2,000. Cada regla de limpieza vive en{" "}
              <code>src/campo_data.py</code> con su conteo de filas, y la misma función la usa la API.
            </p>
            <p>
              Un ensayo es etapa × localidad × año de siembra; un testigo es un clon sembrado en etapas 2-3 en al menos 4
              cohortes (12 clones). Excluyo de cualquier modelo las columnas que se miden en la misma cosecha que el azúcar
              (caña, TRS, tallos, peso y fibra): usarlas sería fuga de información. Decisiones D1 a D13b de la bitácora. {/* fuente: notebook 01, celda 18; bitácora D7 */}
            </p>
          </div>
          <Descartadas
            items={[
              {
                id: "H1",
                hipotesis: "El costo de corte por tonelada cambia el ranking de variedades.",
                motivo: "El ranking por azúcar y el ranking por margen coinciden (Spearman 0.98). Una tonelada de caña con TRS típico deja unos US$56 de azúcar contra US$14 de corte; el corte solo deja de pagarse con TRS menor a 70 lb/t y el mínimo observado es 142.", /* fuente: notebook 01, celdas 43 y 44 */
              },
              {
                id: "H2",
                hipotesis: "La fibra puede ser criterio de selección por su valor para cogeneración.",
                motivo: "Solo se midió en 19 % de las filas de etapa 5. Queda como dato a capturar en los ensayos propios.", /* fuente: notebook 01, celda 49 */
              },
            ]}
          />
          <FigurasNotebook
            notebook="01"
            figuras={[
              { nombre: "serie1_02_inflacion_etapa", alt: "Rendimiento de las mismas variedades testigo según la etapa del ensayo" },
              { nombre: "serie1_03_varianza", alt: "Parte de la variación del azúcar por acre que explica cada factor en etapa 5" },
              { nombre: "serie1_05_supervivencia", alt: "Rendimiento en plantía de los clones que siguen en socas contra los que se dejan de medir" },
              { nombre: "serie1_06_caida_socas", alt: "Caída de socas medida de tres formas: cruda, dentro del ensayo y ajustada" },
              { nombre: "serie1_07_longevidad", alt: "Retención por corte de las 23 variedades con su intervalo de 95 %" },
              { nombre: "serie1_08_evidencia", alt: "Ventaja en azúcar contra cantidad de evidencia por variedad" },
            ]}
          />
          <Salidas archivos={["outputs/tables/serie1_limpieza.csv", "serie1_caida_socas.csv", "serie1_longevidad.csv"]} />
        </DetalleTecnico>
      </Seccion>

      {/* ── Cuánto azúcar esperar ──────────────────────────────────────────── */}
      <Seccion
        id="pronostico"
        titulo="Presupuestar con banda, no con un punto"
        entrada={
          <p>
            Recomiendo presupuestar con la banda. El modelo ordena bien las variedades dentro del lote, pero el clima de cada
            zafra mueve todo el lote.
          </p>
        }
        cifras={
          <FilaCifras columnas={2}>
            <Cifra
              valor={pct(ridge1["MAPE_%"], 0)}
              etiqueta="Error típico por parcela, finca conocida"
              detalle={`${num(ridge1.MAE)} lb/acre en promedio. Promedio histórico: ${pct(ingenuo1["MAPE_%"], 0)}; finca nueva: ${pct(ridge2["MAPE_%"], 0)}.`}
            />
            <Cifra
              valor={pctEntero(resumenP2.parte_error_nivel)}
              etiqueta="Del error es del lote y el año"
              detalle="Clima, suelo y manejo del lote. Ningún algoritmo lo arregla con estos datos."
            />
          </FilaCifras>
        }
      >
        <div className={s.piezaYMargen}>
          <Figura
            numero={6}
            titulo={`En ${zafrasMalas.map((z) => z.zafra).join(" y ")} todo el programa quedó entre ${sesgoMin} % y ${sesgoMax} % abajo de lo predicho`}
            nota={`Mediana de real contra predicho en cada zafra (escenario 1). Del error, ${pctEntero(resumenP2.parte_error_nivel)} lo comparten las parcelas del mismo lote y año; ${pctEntero(resumenP2.parte_error_finca)} del total lo comparte toda la finca ese año.`}
            fuente={conCortes("notebook 03 · outputs/models/serie1_resumen_p2.json")}
          >
            <GraficoZafras filas={errorZafra} />
          </Figura>
          <div className={s.lectura}>
            <h3>Por qué con banda</h3>
            <p>
              Cada zafra trae su clima y el clima no está en los datos: mueve juntas a todas las parcelas del lote. Por eso el
              modelo sirve para comparar variedades y presupuestar con banda, no para prometer una cifra.
            </p>
            <p>
              Para 2022 la banda va de {banda(cobertura1["banda 2022"])} con finca conocida y de{" "}
              {banda(cobertura2["banda 2022"])} con finca nueva. Prometía 80 % y cubrió el{" "}
              {pctEntero(cobertura1["cobertura banda 80 %"])} de los casos en la validación: conviene leerla como banda de
              cerca de 75 %.
            </p>
          </div>
        </div>

        {/* La única figura original del notebook a la vista (DESIGN §8): es la mejor prueba de la sección, con datos reales
            parcela por parcela, y no está redibujada en ninguna otra gráfica. Las cifras de cada panel vienen en el PNG. */}
        <Figura
          numero={7}
          ancho="total"
          titulo="En tres lotes reales, el clima mueve juntas a todas las variedades"
          nota={
            <>
              Gráfica original del notebook 03. Cada fila es una variedad en un lote real de la validación; el círculo es lo
              que predijo el modelo y el punto, lo que dio la cosecha. En el primer lote todo quedó abajo de lo predicho y en
              el tercero todo arriba: eso es el clima del año, el error que comparte el lote. Dentro de cada lote el orden de
              las variedades se parece al predicho. <a href={figura("serie1_16_tres_lotes")}>Abrir la figura en tamaño completo</a>
            </>
          }
          fuente={conCortes("notebook 03 · outputs/figures/serie1_16_tres_lotes.png")}
        >
          {/* En el teléfono el PNG queda chico: tocarlo lo abre en tamaño completo */}
          <a className={s.original} href={figura("serie1_16_tres_lotes")}>
            <ImagenNotebook
              nombre="serie1_16_tres_lotes"
              alt="Tres lotes reales, predicho contra real por variedad: en un lote todas quedan abajo de lo predicho, en otro casi iguales y en el tercero todas arriba; el orden entre variedades se parece al predicho."
            />
          </a>
        </Figura>

        <div className={s.textoYPieza}>
          <div className={s.lectura}>
            <h3>Cómo lo sé</h3>
            <p>
              {/* fuente: notebook 03, celda 3 (nueve pruebas, 2013 a 2021) */}
              Lo valido como se usaría, en diciembre y con lo que ya pasó: para predecir una zafra entreno solo con las
              anteriores y pruebo con la siguiente, nueve veces (2013 a 2021). En el escenario 1 la finca y la variedad son
              conocidas ({num(ridge1.filas)} predicciones). En el escenario 2 la finca es nueva: la borro de toda la historia (
              {num(ridge2.filas)} predicciones). Un k-fold al azar mezclaría años y daría un error que nunca se repetiría en la
              práctica.
            </p>
            <p>
              Elegí una regresión lineal (Ridge) en dos piezas: el nivel de la finca sale de su historia y solo se aprende la
              ventaja de la variedad. Random Forest y XGBoost no la superan. Dentro de un lote ordena bien las variedades:
              correlación de orden de {num(ridge1.orden_spearman, 2)} (1 sería acertar el orden completo) y de{" "}
              {num(rhoSocas, 2)} en socas. El promedio histórico da el mismo número a todas: no ordena nada.
            </p>
          </div>
          <Figura
            numero={8}
            titulo="La regresión lineal empata o gana a los árboles; la cosecha del año pasado es la peor referencia"
            nota="Cada punto es el error absoluto medio por parcela; el rótulo agrega el error relativo. El agrónomo (cosecha del lote el año pasado × caída típica) solo aplica cuando hay cosecha del año pasado; si no la hay, usa la regla de la pregunta 1. No existe para una finca nueva. Con una finca nueva, Ridge se reduce a esa regla y empatan."
            fuente={conCortes("notebook 03 · outputs/tables/serie1_p2_metricas.csv")}
          >
            <GraficoModelos filas={filasModelos} modelos={MODELOS} escenarios={Object.values(ESCENARIOS)} />
          </Figura>
        </div>

        <div className={s.piezaYMargen}>
          <div className={s.lectura}>
            <h3>El modelo cabe en una línea</h3>
            <p>No uso nada que se mida el día de la cosecha (caña, TRS, tallos, peso del tallo, fibra).</p>
            <p className={s.formula}>
              ventaja = {num(coef1.var_rel, 2)} × historia de la variedad + {num(coef1.lote_ant_rel, 2)} × su ventaja en el
              mismo lote el año pasado
            </p>
            <p>
              Si la historia dice que una variedad rinde 10 % más que los testigos, se espera cerca de{" "}
              {conSigno((Math.exp(coef1.var_rel * Math.log(1.1)) - 1) * 100, 1)} %: se le cree {pctEntero(coef1.var_rel)} a la
              historia. Si además el año pasado, en ese mismo lote, rindió 10 % más que sus testigos, se suma cerca de{" "}
              {conSigno((Math.exp(coef1.lote_ant_rel * Math.log(1.1)) - 1) * 100, 1)} %. El tercer coeficiente, de{" "}
              {num(coef1.tiene_lote_ant, 3)}, es un ajuste pequeño cuando hay cosecha del año pasado. Lo que dio el lote
              completo el año pasado no entra: el clima no se repite.
            </p>
            <p>
              El escenario 3, una variedad nueva con historia de etapas 3-4, quedó pendiente. Dejo su diseño en el detalle
              técnico.
            </p>
          </div>
          <Verificar
            herramienta={{ href: "/herramientas#pronostico", texto: "Pronosticar una variedad en una finca" }}
            consultas={["POST /campo/pronostico"]}
            notebook={NOTEBOOKS.modelo}
          />
        </div>

        <DetalleTecnico titulo="validación completa, escenario 3 y figuras del notebook 03">
          {/* fuente: src/campo_modelo.py, bootstrap_pareado (n = 2000 réplicas por finca-año) */}
          <Figura
            titulo="Entre Ridge, la regla de la pregunta 1 y los árboles, las diferencias de error total son empates"
            nota={`Bootstrap pareado por finca-año, 2,000 réplicas. Si el intervalo de 90 % cruza el cero, es empate. ${
              ridgeGanaVentaja ? "En el error de la ventaja, que es lo que decide qué sembrar, Ridge sí gana a los tres (intervalos sin cruzar cero)." : ""
            }`}
            fuente={conCortes("notebook 03 · outputs/tables/serie1_p2_comparaciones.csv")}
          >
            <GraficoComparaciones filas={filasComparaciones} />
          </Figura>
          <div>
            <h4>Lo que sí anticipa: la ventaja de una variedad sobre otra</h4>
            <p>
              El R² mide qué parte de esa ventaja explica el modelo (1 sería todo). En plantía nadie la predice bien (R² de la
              ventaja menor a {num(Math.ceil(r2VentajaPlantiaMax * 10) / 10, 1)} en todos los modelos). Desde la primera soca,
              lo que la variedad hizo en ese mismo lote la predice mucho mejor (R² {num(r2VentajaSocas, 2)}). No conocer la
              finca cuesta {num(resumenP2.costo_finca_nueva_lb)} lb/acre de error medio (IC90 {num(finca[0])} a {num(finca[1])}).
            </p>
          </div>
          <Nota tipo="metodo" titulo="Pendiente: variedad nueva con historia de etapas 3-4 (escenario 3)">
            <p>
              No lo desarrollé: prioricé los escenarios 1 y 2. Usaría la misma estructura de dos piezas y tomaría la ventaja de
              la variedad de sus ensayos de etapas 3-4, contra los testigos del mismo ensayo. Calibraría cuánto de esa ventaja
              se cumple en etapa 5 con las 39 de 40 variedades que tienen ambas historias, y validaría dejando fuera variedades
              completas en orden de cohorte. El riesgo principal es el sesgo de supervivencia: el intervalo debe ser bastante
              más ancho que en los escenarios 1 y 2. {/* fuente: README, "Pendientes y cómo los abordaría" */}
            </p>
          </Nota>
          <Descartadas
            items={[
              {
                id: "H4",
                hipotesis: "Una regresión directa con todas las variables basta.",
                motivo: `Pierde contra la regla de la pregunta 1, que no aprende nada (MAE ${num(resumenP2.diagnostico_directo.mae_directo)} contra ${num(resumenP2.diagnostico_directo.mae_regla)}). Con pocos años aprende la suerte de los años de entrenamiento y le cree poco a la historia de la variedad. Por eso partí el modelo en dos piezas.`,
              },
              {
                id: "H5",
                hipotesis: "La cosecha del lote el año pasado es el mejor predictor.",
                motivo: `Es la peor referencia, peor que el promedio histórico (MAE ${num(agronomo1.MAE)} contra ${num(ingenuo1.MAE)}). Trae el clima de ese año y el efecto del año no se repite (correlación con el siguiente ${num(resumenP2.efecto_anio_autocorr, 2)}).`,
              },
              {
                id: "H6",
                hipotesis: "Los árboles encontrarán interacciones variedad × finca.",
                motivo: `No superan a Ridge. Si en Random Forest desordeno cada variable, el error de la ventaja sube ${num(importancia.var_rel, 2)} puntos porcentuales con la historia de la variedad y ${num(importancia.lote_ant_rel, 2)} con el lote anterior; con la finca, apenas ${num(importancia.loc_rel, 2)}. No hay interacciones que aprender.`,
              },
              {
                id: "H7",
                hipotesis: "Contar la evidencia de una variedad en años y no en parcelas.",
                motivo: `Mejora marginal (R² de la ventaja de ${num(ridge1.R2_ventaja, 3)} a 0.365), probada después de ver la validación. No la adopto: elegirla sobre los mismos años sería ajustar la validación.`, /* fuente: bitácora H7 (0.365) */
              },
            ]}
          />
          <Tabla
            titulo={`Todas las métricas de validación (${ESCENARIOS.escenario_1.toLowerCase()} y ${ESCENARIOS.escenario_2.toLowerCase()})`}
            compacta
            columnas={[
              { clave: "modelo", titulo: "Modelo" },
              { clave: "escenario", titulo: "Escenario" },
              { clave: "MAE", titulo: "MAE lb/acre", tipo: "num", valor: (m) => num(m.MAE as number) },
              { clave: "MAPE", titulo: "Error relativo", tipo: "num", valor: (m) => pct(m.MAPE as number, 1) },
              { clave: "R2", titulo: "R²", tipo: "num", valor: (m) => num(m.R2 as number, 3) },
              { clave: "rho", titulo: "ρ en el lote", tipo: "num", valor: (m) => (m.rho === null ? "no aplica" : num(m.rho as number, 2)) },
              { clave: "R2v", titulo: "R² de la ventaja", tipo: "num", valor: (m) => (m.R2v === null ? "no aplica" : num(m.R2v as number, 3)) },
            ]}
            filas={metricasP2.map((m) => ({
              modelo: m.col1, escenario: m.indice === "escenario_1" ? "1" : "2", MAE: m.MAE, MAPE: m["MAPE_%"], R2: m.R2, rho: m.orden_spearman, R2v: m.R2_ventaja,
            }))}
            destacar={(m) => m.modelo === "Ridge"}
            nota={conCortes("Fuente: notebook 03 · outputs/tables/serie1_p2_metricas.csv. Hiperparámetros fijados antes de validar: Ridge α = 1; Random Forest 300 árboles, hojas ≥ 20; XGBoost 300 árboles de profundidad 3, tasa 0.03.")}
          />
          <Tabla
            titulo="Plantía esperada en 2022 de las tres recomendadas, por finca"
            compacta
            columnas={[
              { clave: "LOC", titulo: "Finca" },
              ...[...tres, "testigo promedio"].map((v) => ({ clave: v, titulo: v, tipo: "num" as const, valor: (f: Record<string, unknown>) => num(f[v] as number) })),
            ]}
            filas={plantia2022}
            nota={conCortes(`Libras de azúcar por acre. Banda para cada valor: ${banda(cobertura1["banda 2022"])}. Con finca nueva, la banda es ${banda(cobertura2["banda 2022"])}. Fuente: notebook 03 · outputs/tables/serie1_pronostico_2022_plantia.csv.`)}
          />
          <div>
            <h4>Método</h4>
            <p>
              Variables con fecha de corte: cada fila, también las de entrenamiento, se describe solo con años anteriores. La
              ventaja histórica de la variedad se encoge hacia los testigos como si hubiera {modeloP2.encogimiento.lambda_a}{" "}
              parcelas neutras para el nivel y {modeloP2.encogimiento.lambda_b} para la caída por corte; la finca, como si
              hubiera {modeloP2.encogimiento.lambda_loc} año neutro. Fijé esos valores antes de validar.
            </p>
            <p>
              La banda de error toma los percentiles 10 y 90 de los errores de zafras anteriores, no los residuos de
              entrenamiento. Prometía 80 % y cubrió {pctEntero(cobertura1["cobertura banda 80 %"])} (escenario 1) y{" "}
              {pctEntero(cobertura2["cobertura banda 80 %"])} (escenario 2). Si se supiera antes de la zafra cómo le irá a cada
              lote, el R² pasaría de {num(ridge1.R2, 2)} a 0.81: ese es el techo sin datos de clima y manejo. Decisiones D22 a
              D28. {/* fuente: notebook 03, celda 24 (oráculo R² 0.81) */}
            </p>
          </div>
          <FigurasNotebook
            notebook="03"
            figuras={[
              { nombre: "serie1_14_validacion", alt: "Esquema de validación por zafra en los dos escenarios" },
              { nombre: "serie1_15_comparacion_modelos", alt: "Error de los seis modelos en los dos escenarios" },
              { nombre: "serie1_17_error_por_zafra", alt: "Real contra predicho por zafra" },
              { nombre: "serie1_18_ventaja", alt: "Ventaja predicha contra ventaja real de cada variedad dentro del lote" },
            ]}
          />
          <Salidas archivos={["outputs/tables/serie1_p2_metricas.csv", "serie1_p2_comparaciones.csv", "serie1_pronostico_2022_plantia.csv", "outputs/models/serie1_modelo_p2.json"]} />
        </DetalleTecnico>

        <Evaluacion
          serie="campo"
          significa={
            <p>
              Se puede estimar el azúcar por acre de una variedad en una finca con un error típico de{" "}
              {pct(ridge1["MAPE_%"], 0)} por parcela, y ordenar bien las variedades dentro de un lote. Tres cuartas partes del
              error son lo que le pasa a todo el lote ese año. Comparar contra testigos en el mismo lote es casi todo el poder
              predictivo: bastan tres coeficientes.
            </p>
          }
          decision={
            <>
              <p>
                Recomiendo usar la regresión en dos piezas (Ridge) para planificar y presupuestar con la banda (
                {banda(cobertura1["banda 2022"])}), no con el punto. Para fincas sin historia, usar el modelo de finca nueva y
                cambiarlo en cuanto exista la primera cosecha.
              </p>
              <p>No invertir en modelos más complejos con estos datos: la siguiente mejora vendrá de clima y manejo por lote.</p>
            </>
          }
          impacto={
            <p>
              Frente al promedio histórico, el error por parcela baja de {pct(ingenuo1["MAPE_%"], 0)} a {pct(ridge1["MAPE_%"], 0)};
              la regla de la pregunta 1 sola ya lo baja {num(Math.abs(reglaVsIngenuo["Δ MAE lb/acre"]))} lb/acre (rango de 90 %:{" "}
              {num(Math.abs(reglaVsIngenuo["IC90 alto"]))} a {num(Math.abs(reglaVsIngenuo["IC90 bajo"]))}). Sobre todo, el modelo
              distingue variedades: correlación de orden de {num(ridge1.orden_spearman, 2)} dentro del lote ({num(rhoSocas, 2)} en
              socas). El valor está en decidir qué variedad va en qué finca, no en adivinar la zafra total.
            </p>
          }
          riesgo={
            <ul>
              <li>
                Clima: no está en los datos. En {zafrasMalas.map((z) => z.zafra).join(" y ")} el programa quedó {sesgoMin} % a{" "}
                {sesgoMax} % abajo de lo planificado y el modelo no lo anticipa.
              </li>
              <li>
                Validez externa: entrenado en Louisiana. Para el ingenio se traslada la estructura (nivel + ventaja contra
                testigos), no los números; hay que recalibrar con 2-3 zafras propias.
              </li>
              <li>Variedades con poca historia: el encogimiento las acerca a los testigos; su predicción es prudente por diseño.</li>
            </ul>
          }
          certeza={{
            nivel: "media",
            texto: (
              <p>
                Alta en que el método supera al promedio histórico y en que los modelos complejos no agregan: las diferencias
                tienen intervalo por bootstrap de fincas-año. Media en la cifra de cada lote: por eso va con banda.
              </p>
            ),
          }}
        />
      </Seccion>

      {/* ── Rol de cada variedad ───────────────────────────────────────────── */}
      <Seccion
        id="perfiles"
        titulo={`No hay tipos naturales, pero sí ${resumenP3.k} roles`}
        entrada={
          <p>
            Recomiendo ampliar las completas y retirar las inestables. Los grupos no usan la ganancia y aun así separan el{" "}
            {pctEntero(resumenP3.eta2)} de su variación.
          </p>
        }
        cifras={
          <FilaCifras columnas={2}>
            {/* fuente: notebook 04, celdas 8 y 12 (200 tablas barajadas, 300 réplicas) */}
            <Cifra valor={resumenP3.k} unidad="grupos" etiqueta="Perfiles reproducibles" detalle={`Al remuestrear, la partición se parece a la original en ${num(kElegido.ARI_mediana, 2)} (1 es idéntica).`} />
            <Cifra valor={pctEntero(resumenP3.eta2)} etiqueta="De la variación de la ganancia que separan" detalle="Prueba de permutación, p < 0.0001. La ganancia no se usó para agrupar." />
          </FilaCifras>
        }
      >
        <Figura
          numero={9}
          ancho="total"
          titulo="En caña contra calidad, las completas tienen más TRS y las de mucha caña, menos"
          nota={
            <>
              Cada panel resalta un grupo sobre las {segmentos.length} variedades. Las líneas finas marcan el testigo (0 %). (T) =
              testigo. Asignación dudosa (cae con su grupo en menos de 60 % de las réplicas): {dudosas.join(", ")}. Para ellas
              manda la pregunta 1, no la etiqueta.
              <Clave items={[{ tipo: "lleno", texto: "Miembro firme del grupo" }, { tipo: "hueco", texto: "Asignación dudosa" }, { tipo: "gris", texto: "Otras variedades" }]} />
            </>
          }
          fuente={conCortes("notebook 04 · outputs/tables/serie1_segmentos.csv y outputs/models/serie1_resumen_p3.json")}
        >
          <MapaGrupos puntos={puntosSegmentos} grupos={grupos} />
        </Figura>

        <div className={s.textoYPieza}>
          <div className={s.lectura}>
            <h3>Cómo lo sé</h3>
            <p>
              Medí cuatro indicadores de cada variedad, todos contra los testigos del mismo ensayo y corte. No hay variedad que
              gane en todo: la correlación entre caña y calidad es de {num(corr.productividad.calidad, 2)}.
            </p>
            <p>
              Las {segmentos.length} variedades forman un continuo. Los {resumenP3.k} grupos son una forma útil de partirlo:
              otro método, Ward, da una partición parecida ({num(kElegido.ward_vs_kmeans, 2)}). Antes de medir la estabilidad
              resté el ruido de parcela, que en mediana es el {pctEntero(resumenP3.ruido_mediana)} de la variación bruta.
            </p>
            <Verificar consultas={["POST /campo/segmento"]} notebook={NOTEBOOKS.segmentos} />
          </div>
          <Tabla
            titulo="Los cuatro indicadores, todos contra los testigos del mismo ensayo y corte"
            compacta
            ancho="total"
            columnas={[
              { clave: "indicador", titulo: "Indicador" },
              { clave: "como", titulo: "Cómo se mide" },
              { clave: "ingenio", titulo: "En el ingenio se diría" },
            ]}
            filas={[
              { indicador: "Productividad", como: "caña por acre en plantía", ingenio: "TCH" },
              { indicador: "Calidad", como: "azúcar recuperable por tonelada (TRS), promedio de todos los cortes", ingenio: "rendimiento (kg/t)" },
              { indicador: "Longevidad", como: "cuánto gana o pierde en caña por cada corte", ingenio: "persistencia de la cepa" },
              { indicador: "Estabilidad", como: "variación de su ventaja entre fincas y años que no explica la calidad de la finca, sin el ruido de parcela", ingenio: "qué tan predecible es" },
            ]}
            nota="Separé caña y calidad, no azúcar y calidad: azúcar = caña × calidad, y la calidad contaría dos veces. Fuente: notebook 04, sección 1."
          />
        </div>

        <DetalleTecnico titulo="perfil de cada grupo, número de grupos y figuras del notebook 04">
          <Tabla
            titulo="Perfil de cada grupo frente a los testigos núcleo"
            compacta
            columnas={[
              { clave: "grupo", titulo: "Grupo" },
              { clave: "variedades", titulo: "Variedades" },
              { clave: "cana", titulo: "Caña %", tipo: "num", valor: (g) => conSigno(g.cana as number, 1) },
              { clave: "trs", titulo: "TRS %", tipo: "num", valor: (g) => conSigno(g.trs as number, 1) },
              { clave: "azucar", titulo: "Azúcar plantía %", tipo: "num", valor: (g) => conSigno(g.azucar as number, 1) },
              { clave: "porCorte", titulo: "Por corte %", tipo: "num", valor: (g) => conSigno(g.porCorte as number, 1) },
              { clave: "sigma", titulo: "Inestabilidad %", tipo: "num", valor: (g) => num(g.sigma as number, 1) },
              { clave: "ganancia", titulo: "Ganancia P1 US$/acre/año", tipo: "num", valor: (g) => conSigno(g.ganancia as number) },
              { clave: "jaccard", titulo: "Jaccard", tipo: "num", valor: (g) => num(g.jaccard as number, 2) },
            ]}
            filas={filasGrupos}
            destacar={(g) => g.grupo === completas.grupo}
            nota="Valores medios del grupo contra los testigos. Inestabilidad: desvío de la interacción variedad × ambiente sin ruido de parcela. Ganancia: mediana del grupo en la pregunta 1. Jaccard: cuánto se conserva el grupo al remuestrear; ≥ 0.75 es grupo firme y 0.6-0.75, patrón real con bordes difusos. Fuente: notebook 04 · outputs/models/serie1_resumen_p3.json."
          />
          <div className={s.dosFiguras}>
            <Figura
              titulo="Ningún número de grupos separa mejor que tablas barajadas"
              nota={`Punto: silueta de k-means, que mide qué tan separados quedan los grupos. Barra gris: de la mediana al percentil 95 (línea) de 200 tablas con cada indicador barajado por separado. Arriba, el valor p: la proporción de tablas barajadas que separan igual o mejor. El menor es ${num(pMinSilueta, 3)}.`}
              fuente={conCortes("notebook 04 · outputs/models/serie1_resumen_p3.json")}
            >
              <GraficoSilueta filas={resumenP3.silueta.map((x) => ({ k: x.k, silueta: x.silueta, p50: x.nulo_p50, p95: x.nulo_p95, p: x.p }))} />
            </Figura>
            <Figura
              titulo={`Con ${resumenP3.k} grupos la partición es la más reproducible sin grupos de una sola variedad`}
              nota={`ARI mediano y rango 10-90 % al remuestrear ensayos 300 veces (ARI: 1 es idéntica, 0 es azar). Con 2 grupos es más estable, pero solo separa tonelaje de calidad y no sirve para decidir.`}
              fuente={conCortes("notebook 04 · outputs/models/serie1_resumen_p3.json")}
            >
              <GraficoReproducibilidad
                filas={resumenP3.estabilidad.map((e) => ({ k: e.k, ari: e.ARI_mediana, p10: e.ARI_p10, p90: e.ARI_p90, elegido: e.k === resumenP3.k }))}
              />
            </Figura>
          </div>
          <Descartadas
            items={[
              {
                id: "H8",
                hipotesis: "Hay tipos naturales de variedades.",
                motivo: `La silueta no supera a la de tablas barajadas para ningún k de 2 a 7 (p ≥ ${num(pMinSilueta, 3)}). Dos ejes resumen ${pct(resumenP3.pca[0] + resumenP3.pca[1], 0)} de la variación: calidad, longevidad y estabilidad contra tonelaje.`,
              },
              {
                id: "H9",
                hipotesis: "El desvío de la ventaja entre ambientes mide la estabilidad.",
                motivo: `No tal cual: en mediana, ${pctEntero(resumenP3.ruido_mediana)} de esa varianza es ruido de parcela. Sin restarlo, la estabilidad mediría cuántas repeticiones tuvo cada variedad.`,
              },
            ]}
          />
          <div>
            <h4>Método</h4>
            <p>
              Estabilidad a la Eberhart y Russell con dos correcciones: primero quito la parte que explica la calidad de la
              finca, medida con un índice independiente (la trampa de la hipótesis H3), y después resto el ruido de parcela
              medido con las repeticiones. Agrupo con k-means sobre los indicadores estandarizados y uso Ward como contraste.
            </p>
            <p>
              Elegí k con una regla fijada después de explorar: entre 3 y 7, el más reproducible que no deje grupos de una sola
              variedad. Los nombres salen de reglas fijas sobre los centros. Una variedad nueva se asigna al centro más cercano
              con sus 4 indicadores; el JSON reproduce el 100 % de las asignaciones. Decisiones D29 a D35.
            </p>
          </div>
          <FigurasNotebook
            notebook="04"
            figuras={[
              { nombre: "serie1_19_cuantos_grupos", alt: "Silueta contra el azar y reproducibilidad según el número de grupos" },
              { nombre: "serie1_20_mapa_variedades", alt: "Mapa de variedades: caña contra calidad, coloreado por grupo" },
              { nombre: "serie1_21_perfiles", alt: "Perfil de cada grupo en los cuatro indicadores" },
              { nombre: "serie1_22_certeza_grupos", alt: "Certeza de asignación de cada variedad a su grupo" },
            ]}
          />
          <Salidas archivos={["outputs/tables/serie1_segmentos.csv", "outputs/models/serie1_resumen_p3.json", "serie1_segmentos.json"]} />
        </DetalleTecnico>

        <Evaluacion
          serie="campo"
          significa={
            <p>
              Las variedades no se dividen en tipos naturales: hay un compromiso entre tonelaje y calidad, la calidad viene con
              longevidad (r = {num(corr.calidad.longevidad, 2)}) y la longevidad con estabilidad (r ={" "}
              {num(corr.longevidad.estabilidad, 2)}). Los grupos son perfiles útiles para manejar el portafolio y separan bien
              el dinero, aunque se formaron sin mirarlo.
            </p>
          }
          decision={
            <ul>
              <li>
                {nombreGrupo(completas.grupo)}: núcleo de la expansión. TRS {conSigno(completas["TRS %"], 1)} % y{" "}
                {conSigno(completas["caña por corte %"], 1)} % por corte frente a los testigos.
              </li>
              <li>{nombreGrupo(calidadSinCana.grupo)}: no ampliar. Su valor depende de si el pago de la caña premia la calidad.</li>
              <li>
                {nombreGrupo(muchaCana.grupo)}: no son base de expansión; pierden {num(Math.abs(muchaCana["caña por corte %"]), 1)} % por corte.
                HO12-615 es la excepción (casi no pierde). Si su fibra alta se confirma, sirven para lotes donde importe el bagazo
                para cogenerar; hoy solo HO12-615 tiene fibra comparable contra los testigos. {/* fuente: notebook 04, celda 28 */}
              </li>
              <li>
                {nombreGrupo(inestables.grupo)}: retirar de la expansión y evaluar reemplazar a HOCP96-540 como testigo, porque un
                testigo inestable vuelve ruidosa toda comparación. {/* fuente: notebook 04, celda 28 */}
              </li>
              <li>{nombreGrupo(sinVentaja.grupo)}: no ampliar.</li>
            </ul>
          }
          impacto={
            <p>
              La ganancia mediana va de {masUsd(completas["ganancia P1 US$/acre/año (mediana)"])} por acre al año en las
              completas a {masUsd(inestables["ganancia P1 US$/acre/año (mediana)"])} en las inestables. El valor es una regla para
              clasificar cada variedad nueva con 4 números y saber qué rol darle antes de que acumule 3-4 años de margen.
            </p>
          }
          riesgo={
            <ul>
              {/* fuente: notebook 04, celda 28 (variedades del borde; estabilidad de las nuevas medida con 2-4 años) */}
              <li>
                Continuo, no tipos: las variedades del borde, entre ellas {v1.CLONE} y {v2.CLONE}, cambian de grupo al
                remuestrear. Para ellas, decidir con la pregunta 1 y no con la etiqueta.
              </li>
              <li>Estabilidad de las nuevas medida con 2-4 años: puede estar sobreestimada.</li>
              <li>Fibra sin datos para {sinFibra} de las {segmentos.length}: el rol de caña para cogenerar necesita medirla.</li>
              <li>Validez externa: se traslada el método (4 indicadores y grupos reproducibles), no las variedades.</li>
            </ul>
          }
          certeza={{
            nivel: "media",
            texto: (
              <p>
                Alta en el compromiso caña-calidad y en que los grupos separan la ganancia. Media en las fronteras: el número de
                grupos se eligió por reproducibilidad y {dudosas.length} variedades tienen asignación dudosa.
              </p>
            ),
          }}
        />
      </Seccion>

      {/* ── Datos propios ──────────────────────────────────────────────────── */}
      <Seccion
        id="datos-propios"
        titulo={`Auditar ya; ensayar en ${fincasRecomendadas} fincas por cohorte`}
        entrada={
          <p>
            Con los registros de corte que ya existen se auditan las renovaciones desde la primera zafra. Qué variedad va en
            cada zona pide ensayos propios.
          </p>
        }
        cifras={
          <FilaCifras columnas={2}>
            <Cifra
              valor={num(auditoria.cerrados_bien)}
              unidad={`de ${num(auditoria.cerrados)}`}
              etiqueta="Ciclos cerrados bien clasificados"
              detalle={`${num(auditoria.lotes)} lotes simulados. Sin número de corte se pierde el ${pctEntero(auditoria.perdidas_sin_corte)} de las renovaciones.`}
            />
            <Cifra
              valor={fincasRecomendadas}
              unidad="fincas"
              etiqueta="Por cohorte de ensayos, 5 por estrato"
              detalle={`Detectan una ventaja de 10 % en 6 años con ${pctEntero(potencia20["1.5"])} de potencia si la interacción es 1.5 veces la de Louisiana.`}
            />
          </FilaCifras>
        }
      >
        <div className={s.textoYPieza}>
          <div className={s.lectura}>
            <h3>Auditar renovaciones con lo que ya existe</h3>
            <p>
              Con una fila por lote y corte se reconstruye la historia de cada lote: plantía, socas, renovación. Cada ciclo
              cerrado se compara con el óptimo de la pregunta 1 ({resumenP4.optimo} cortes, con tolerancia de un corte porque el
              óptimo es plano). Para cada lote en pie, una regla propia: mantener la soca mientras el próximo corte deje más que
              el promedio anual de un ciclo nuevo en ese lote. En un portafolio simulado de {num(auditoria.lotes)} lotes y{" "}
              {num(auditoria.cortes)} cortes clasificó bien los {num(auditoria.cerrados)} ciclos cerrados. Sin número de corte se
              pierde el {pctEntero(auditoria.perdidas_sin_corte)} de las renovaciones: las que vuelven a sembrar la misma
              variedad.
            </p>
            <p>
              Las demostraciones usan datos simulados y fuentes públicas de Guatemala; no describen a ningún ingenio.
            </p>
            <Verificar
              herramienta={{ href: "/herramientas#auditoria", texto: "Auditar lotes con un CSV" }}
              consultas={["POST /campo/auditoria", "POST /campo/auditoria/csv"]}
              notebook={NOTEBOOKS.propios}
            />
          </div>
          {/* La figura y su lectura van juntas en la columna derecha: así las dos columnas quedan parejas a 1440 px */}
          <div className={s.pila}>
            <Figura
              numero={10}
              titulo="Lejos del ingenio, la variedad decide si el lote gana o pierde"
              nota={`Costo de corte, alce y transporte con el que el mejor ciclo deja de cubrir costos: el testigo, a US$${num(equilibrioDistancia["Testigo promedio"], 1)}/t; las tres, a US$${num(Math.min(...eqDistTres), 1)}-${num(Math.max(...eqDistTres), 1)}/t. Cada US$1/t adicional cuesta entre US$${num(Math.min(...pierdePorDolar))} y US$${num(Math.max(...pierdePorDolar))} por hectárea al año. Ese costo casi no cambia cuándo renovar: el testigo pasa a 5 cortes desde US$${distancia.pasa_a_5}/t, cuando ya no cubre costos.`}
              fuente={conCortes("notebook 05 · outputs/models/serie1_resumen_p4.json")}
            >
              <GraficoDistancia filas={filasDistancia} supuesto={metricos.corte_t} />
            </Figura>
            <div className={s.lectura}>
              <h3>Lo que sí mueve el ciclo: el costo de renovar</h3>
              <p>
                Con US$1,500/ha conviene renovar cada 3 cortes, y desde US$3,250-4,250/ha, según el costo por tonelada,
                conviene estirar a 5. Si en las fincas lejanas renovar sale más caro, su ciclo óptimo es más largo. Por eso
                propongo registrar el costo real y la distancia por lote, y calcular el ciclo por zona de costo.{" "}
                {/* fuente: notebook 05, celdas 11 y 13 */}
              </p>
            </div>
          </div>
        </div>

        <div className={s.textoYPieza}>
          <div className={s.lectura}>
            <h3>Ensayos propios: más fincas, no más repeticiones</h3>
            <p>
              Con los ensayos de Louisiana medí cuánto cambia la diferencia entre dos variedades por cada fuente: variedad ×
              finca {pct(desvio(comp.GL), 1)}, variedad × año {pct(desvio(comp.GY), 1)}, variedad × lote-año{" "}
              {pct(desvio(comp.GLY), 1)} y error de parcela {pct(desvio(comp.e), 1)} por repetición. Más repeticiones solo
              reducen el error de parcela, que ya se promedia entre fincas y años; la interacción con la finca y el año no baja
              con ellas. Y la interacción con el año pone un piso que no baja con más fincas: una ventaja de 5 % no se separa del
              ruido con ningún tamaño razonable.
            </p>
            {/* Diseño visible (antes solo en el detalle técnico): es lo que la gerencia aprueba; las varianzas quedan en el detalle */}
            <h3>Diseño de ensayos que recomiendo</h3>
            <ul>
              <li>{fincasRecomendadas} fincas por cohorte, 5 por estrato de CENGICAÑA y en los grupos de suelo más extensos, para medir la ventaja dentro de cada estrato.</li>
              <li>Una cohorte nueva cada año, seguida hasta la soca 3-4: separa el año de la edad y mide la longevidad.</li>
              <li>Testigos fijos y estables todos los años: CP72-2086, CG02-163 y la comercial principal del ingenio.</li>
              <li>Bloques completos al azar con 3 repeticiones; alfa-látice si se prueban muchas variedades. Franjas comerciales para las candidatas avanzadas.</li>
              <li>Medir en cada corte TCH, rendimiento, fibra, población, peso de tallo, floración y roya naranja, con clima diario de la estación más cercana.</li>
              <li>Analizar con el método de esta serie y recalcular el tamaño con la varianza propia al cerrar la primera cohorte.</li>
            </ul>
          </div>
          {/* fuente: notebook 05, celda 18 (3 repeticiones, potencia de 80 %; 4 estratos y 1,500 a 4,100 mm de lluvia en la celda 2) */}
          <Figura
            numero={11}
            titulo={`Con 6 años, ${fincasRecomendadas} fincas detectan una ventaja de 10 % salvo que la interacción se duplique`}
            nota={`Fincas necesarias con 3 repeticiones y 80 % de potencia. Cada panel es la interacción variedad × ambiente como múltiplo de la medida en Louisiana (×1). 4 años de cosecha = una sola cohorte seguida hasta la soca 3; 6 años = cohortes anuales acumuladas. Guatemala, con 4 estratos y de 1,500 a 4,100 mm de lluvia, probablemente tenga más interacción que Louisiana. Con ${fincasRecomendadas} fincas y 6 años de cosecha, la potencia es ${pctEntero(potencia20["1"])}, ${pctEntero(potencia20["1.5"])} y ${pctEntero(potencia20["2"])} con interacción ×1, ×1.5 y ×2.`}
            fuente={conCortes("notebook 05 · outputs/tables/serie1_tamano_ensayos.csv y outputs/models/serie1_componentes_varianza.json")}
          >
            <GraficoFincas filas={filasFincas} recomendacion={fincasRecomendadas} ordenInteraccion={ordenInteraccion} ordenAnios={ordenAnios} />
          </Figura>
        </div>

        {/* Texto con su margen y la tabla a todo el ancho: con la tabla en media columna, el texto dejaba 500 px vacíos */}
        <div className={s.piezaYMargen}>
          <div className={s.lectura}>
            <h3>Qué capturar: un modelo de datos mínimo</h3>
            <p>
              Definí 11 tablas y una vista en PostgreSQL (<code>sql/esquema_campo.sql</code>). Cada regla responde a un error
              real del archivo de Louisiana: coma decimal, unidades, doble captura, valores imposibles y nombres escritos de dos
              formas. Lo probé con PostgreSQL 16: rechaza una doble captura, un rendimiento imposible, un número con coma
              decimal y un estrato inexistente, y la vista reproduce la auditoría de pandas. {/* fuente: notebook 05, celdas 4 y 5 */}
            </p>
          </div>
          <Nota tipo="dato" titulo="Los tres campos que más se pierden y más valen">
            <ul>
              <li>El número de corte: sin él se pierde el {pctEntero(auditoria.perdidas_sin_corte)} de las renovaciones.</li>
              <li>El grupo de suelo del lote: sin él no se zonifica.</li>
              <li>El clima diario: es lo que falta para explicar el error que comparte todo el lote.</li>
            </ul>
          </Nota>
        </div>
        <Tabla
          titulo="Qué registrar y para qué"
          compacta
          ancho="total"
          columnas={[
            { clave: "tabla", titulo: "Tabla" },
            { clave: "fila", titulo: "Una fila por" },
            { clave: "campos", titulo: "Campos clave" },
            { clave: "uso", titulo: "Para qué" },
          ]}
          filas={tablasCaptura}
          nota={conCortes("Fuente: notebook 05, sección 2 · sql/esquema_campo.sql · prueba en outputs/tests/pytest_postgres.txt.")}
        />

        <div className={s.textoYPieza}>
          <div className={s.lectura}>
            <h3>Zonificar por ambiente, no por nombre de finca</h3>
            <p>
              La costa sur no es Louisiana: va del litoral arenoso a laderas volcánicas, con 1,500 a 4,100 mm de lluvia al año
              según CENGICAÑA. Propongo agrupar los lotes por parecido de ambiente (altitud, lluvia, viento, grupo de suelo y
              drenaje), con la distancia de Gower, que mezcla números y categorías. Con lotes simulados a partir de los
              promedios públicos por estrato, el método recuperó {resumenP4.zonas.k} zonas con ARI{" "}
              {num(resumenP4.zonas.ari, 2)} contra los perfiles simulados. La distancia al ingenio no entra: define costos, no
              adaptación. {/* fuente: notebook 05, celdas 2 y 15 */}
            </p>
          </div>
          <Tabla
            titulo="Contexto de la costa sur según fuentes públicas"
            compacta
            ancho="total"
            columnas={[
              { clave: "estrato", titulo: "Estrato" },
              { clave: "altitud", titulo: "Altitud (msnm)", tipo: "num" },
              { clave: "lluvia", titulo: "Lluvia media (mm/año)", tipo: "num" },
              { clave: "viento", titulo: "Viento medio (km/h)", tipo: "num" },
            ]}
            filas={[
              /* fuente: notebook 05, celda 2 (Melgar et al., 2012, CENGICAÑA, cap. II) */
              { estrato: "Litoral", altitud: "< 40", lluvia: "1,500", viento: "8.7" },
              { estrato: "Bajo", altitud: "40-100", lluvia: "1,900", viento: "6.2" },
              { estrato: "Medio", altitud: "100-300", lluvia: "3,700", viento: "6.8" },
              { estrato: "Alto", altitud: "> 300", lluvia: "4,100", viento: "5.2" },
            ]}
            nota="Fuentes: Melgar, M. et al. (eds.) (2012), El cultivo de la caña de azúcar en Guatemala, cap. II, CENGICAÑA; Ralda, R. (2015), Zamorano; censos varietales de CENGICAÑA publicados por Prensa Libre (2016) y ASAZGUA (2021)."
          />
        </div>

        <Tabla
          titulo="Hoja de ruta: seis pasos en cuatro zafras"
          compacta
          ancho="total"
          columnas={[
            { clave: "cuando", titulo: "Cuándo" },
            { clave: "que", titulo: "Qué" },
            { clave: "resultado", titulo: "Resultado" },
          ]}
          filas={hojaDeRuta}
          nota="Fuente: notebook 05, sección 7."
        />

        <DetalleTecnico titulo="tamaño de los ensayos, varianzas, censos y figuras del notebook 05">
          <div>
            <h4>La economía en unidades métricas reproduce la de la pregunta 1</h4>
            <p>
              US${num(metricos.precio_kg, 3)}/kg de azúcar, US${num(metricos.corte_t, 2)}/t de caña,
              US${num(metricos.mantenimiento_ha)}/ha/año y US${num(metricos.renovacion_ha)}/ha al renovar dan{" "}
              {usd(referencia.margen * ACRES_POR_HA)}/ha/año para el testigo, igual a {usd(referencia.margen, 1)}/acre/año.
            </p>
          </div>
          <Tabla
            titulo="Fincas por cohorte para detectar cada ventaja con 80 % de potencia"
            compacta
            columnas={[
              { clave: "escenario", titulo: "Años de cosecha e interacción" },
              { clave: "v5", titulo: "5 %", tipo: "num", valor: (f) => fincasOno(f.v5 as number | null) },
              { clave: "v75", titulo: "7.5 %", tipo: "num", valor: (f) => fincasOno(f.v75 as number | null) },
              { clave: "v10", titulo: "10 %", tipo: "num", valor: (f) => fincasOno(f.v10 as number | null) },
              { clave: "v15", titulo: "15 %", tipo: "num", valor: (f) => fincasOno(f.v15 as number | null) },
            ]}
            filas={filasTamanos}
            nota={conCortes(`"No se alcanza" = hacen falta más de 200 fincas. Interacción ×1 es la medida en Louisiana. Fuente: notebook 05 · outputs/tables/serie1_tamano_ensayos.csv.`)}
          />
          <div>
            <h4>Cómo estimé las varianzas</h4>
            <p>
              Varianzas estimadas con efectos fijos de lote-año, variedad y caída propia por variedad, y REML sobre el residuo
              ({num(comp.parcelas)} parcelas, {num(comp.r_media, 1)} repeticiones en promedio). Decisiones D36 a D41. {/* fuente: bitácora D41 */}
            </p>
          </div>
          <div>
            <h4>Zonas agroecológicas y censos varietales</h4>
            <p>
              CENGICAÑA cruza 13 grupos de suelo con el balance hídrico y obtiene 44 zonas agroecológicas. Con datos
              comerciales, las variedades difieren en 9 de 12 combinaciones de estrato y suelo, y la mejor cambia según el
              estrato. CP72-2086 fue la más sembrada durante años (33.4 % del área en 2015-16) y la guatemalteca CG02-163 la
              superó en 2020-21 (25.4 % contra 23.1 %). {/* fuente: notebook 05, celda 2 */}
            </p>
          </div>
          <Descartadas
            items={[
              {
                id: "H10",
                hipotesis: "Más repeticiones dan ensayos más precisos.",
                motivo: "Ayudan poco. Con las mismas parcelas extra (+33 %, desde 15 fincas × 3 repeticiones), sumar 5 fincas da +5.9 puntos de potencia y sumar una repetición, +2.3: las fincas rinden 2.6 veces más.", /* fuente: notebook 05, celda 18 */
              },
              {
                id: "H11",
                hipotesis: "La distancia al ingenio cambia cuándo renovar.",
                motivo: "Casi no, por el costo por tonelada. Lo cambia el costo de renovar, que también puede subir con la distancia.",
              },
            ]}
          />
          <FigurasNotebook
            notebook="05"
            figuras={[
              { nombre: "serie1_23_tamano_ensayos", alt: "Potencia de los ensayos según fincas, años y repeticiones" },
              { nombre: "serie1_24_distancia", alt: "Margen según el costo por tonelada y ciclo óptimo según el costo de renovar" },
              { nombre: "serie1_25_auditoria_ciclos", alt: "Historia simulada de cuatro lotes con distintas políticas de renovación" },
            ]}
          />
          <Salidas archivos={["outputs/models/serie1_resumen_p4.json", "outputs/tables/serie1_tamano_ensayos.csv", "sql/esquema_campo.sql"]} />
        </DetalleTecnico>

        <Evaluacion
          serie="campo"
          significa={
            <p>
              El ingenio no necesita esperar a tener ensayos para decidir con datos propios. Con los registros de cosecha que ya
              tiene puede auditar desde la primera zafra qué lotes están vencidos, cuáles se renuevan de más y cuánto cuesta cada
              uno según su distancia. Qué variedad sembrar en cada ambiente sí necesita ensayos: en los datos comerciales la
              variedad se mezcla con el lugar donde se sembró.
            </p>
          }
          decision={
            <ul>
              <li>Adoptar el modelo de datos mínimo: número de corte, siembra, grupo de suelo, drenaje, distancia, costos y clima.</li>
              <li>Correr la auditoría de renovaciones y la regla de reemplazo por lote en la primera zafra.</li>
              <li>Zonificar los lotes con la clasificación de CENGICAÑA y los suelos y el clima propios.</li>
              <li>Iniciar una cohorte anual de ensayos en {fincasRecomendadas} fincas (5 por estrato), con testigos estables, seguida hasta la soca 3-4.</li>
            </ul>
          }
          impacto={
            <p>
              La auditoría no requiere inversión nueva y ataca dos pérdidas directas: renovar antes de tiempo y cosechar socas
              vencidas. Su tamaño depende de cuántos lotes caigan en cada caso, y eso solo lo dicen los registros del ingenio. En
              fincas lejanas, la variedad separa un lote rentable de uno con pérdida: el testigo deja de cubrir costos a US$
              {num(equilibrioDistancia["Testigo promedio"], 1)}/t y las recomendadas aguantan hasta US$
              {num(Math.min(...eqDistTres), 1)}-{num(Math.max(...eqDistTres), 1)}/t.
            </p>
          }
          riesgo={
            <ul>
              <li>Registros incompletos: sin número de corte o fecha de siembra no se reconstruyen bien los ciclos.</li>
              <li>Variedad confundida con lugar: una variedad buena puede estar solo en fincas buenas. Los datos comerciales generan hipótesis; los ensayos deciden.</li>
              {/* fuente: notebook 05, celda 23 (4-5 años por cohorte) */}
              <li>Tiempo: una cohorte tarda 4-5 años en medir longevidad. Mientras tanto, usar la evidencia de CENGICAÑA y la auditoría.</li>
              <li>
                Tamaños calculados con la variabilidad de Louisiana: en la costa sur la interacción variedad × ambiente
                probablemente sea mayor, así que son un mínimo. La primera cohorte permite recalcularlos. La auditoría y la
                zonificación se probaron con datos simulados.
              </li>
            </ul>
          }
          certeza={{
            nivel: "media",
            texto: (
              <p>
                Alta en el método (validado con datos simulados y con el esquema en PostgreSQL) y en que la finca pesa más que la
                repetición. Media en el número de fincas: depende de cuánto mayor sea la interacción variedad × ambiente en la
                costa sur.
              </p>
            ),
          }}
        />
      </Seccion>

      {/* ── Código ─────────────────────────────────────────────────────────── */}
      <Seccion
        id="codigo"
        titulo="Cada cifra se reproduce con el código"
        entrada={
          <p>
            Los notebooks guardan sus resultados en JSON. Este sitio y la API leen esos mismos archivos: ninguna cifra se copia
            a mano.
          </p>
        }
        cifras={
          <FilaCifras columnas={2}>
            {/* fuente: tests/test_api.py, test_openapi_documenta_los_endpoints (seis rutas de /campo) */}
            <Cifra
              valor={6}
              unidad="consultas"
              etiqueta="De campo en la API, con OpenAPI"
              detalle="Variedades, ciclo, pronóstico, segmento y auditoría en JSON o CSV, con la misma lógica de los notebooks."
            />
            {/* fuente: outputs/tests/pytest_docker.txt (tests/test_api.py: 47; tests/test_esquema_postgres.py: 5); las 509
                predicciones, en tests/test_api.py, test_p2_reproduce_las_509_predicciones_2022 */}
            <Cifra
              valor={47 + 5}
              unidad="pruebas"
              etiqueta="De esta serie, que pasan en Docker"
              detalle={`Reproducen el margen de ${usd(referencia.margen, 1)}, las 509 predicciones de 2022 y los ${num(auditoria.cerrados)} ciclos; la auditoría da lo mismo desde PostgreSQL.`}
            />
          </FilaCifras>
        }
      >
        <ul className={s.lista}>
          <li><a href={archivoRepo("notebooks/01_campo_eda.ipynb")}>Auditoría y análisis exploratorio</a><span>notebooks/01_campo_eda.ipynb</span></li>
          <li><a href={archivoRepo("notebooks/02_campo_recomendacion.ipynb")}>Variedades, ciclo de renovación y certeza</a><span>notebooks/02_campo_recomendacion.ipynb</span></li>
          <li><a href={archivoRepo("notebooks/03_campo_modelo.ipynb")}>Modelo para planificar la zafra</a><span>notebooks/03_campo_modelo.ipynb</span></li>
          <li><a href={archivoRepo("notebooks/04_campo_segmentos.ipynb")}>Perfiles de variedades</a><span>notebooks/04_campo_segmentos.ipynb</span></li>
          <li><a href={archivoRepo("notebooks/05_campo_datos_propios.ipynb")}>Datos propios, auditoría y ensayos</a><span>notebooks/05_campo_datos_propios.ipynb</span></li>
          <li><a href={archivoRepo("src/campo_economia.py")}>Economía del ciclo y precio de equilibrio</a><span>src/campo_economia.py</span></li>
          <li><a href={archivoRepo("sql/esquema_campo.sql")}>Modelo de datos de campo</a><span>sql/esquema_campo.sql</span></li>
          <li><a href={archivoRepo("bitacora.md")}>Bitácora: decisiones e hipótesis descartadas</a><span>D1 a D41 y H1 a H11</span></li>
          <li><a href={`${REPO}/tree/main/tests`}>Pruebas de la API y del esquema SQL</a><span>tests/ · corrida en outputs/tests/pytest_docker.txt</span></li>
          <li><Link href="/api#grupo-campo">Consultas de campo en la API</Link><span>Las que sirven estos modelos, con su documentación OpenAPI</span></li>
          <li><Link href="/herramientas#ciclo">Herramientas de campo</Link><span>Ciclo y precio, azúcar por acre y auditoría de lotes</span></li>
        </ul>
      </Seccion>
    </div>
  );
}
