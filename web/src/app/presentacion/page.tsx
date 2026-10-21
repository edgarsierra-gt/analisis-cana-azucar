import type { Metadata } from "next";
import Link from "next/link";
import { Diapositiva, Diapositivas } from "@/components/presentacion/Diapositivas";
import { REPO, archivoRepo } from "@/lib/base";
import { conSigno, num, pctFraccion, usd } from "@/lib/formato";

import s1q1 from "@/datos/serie1_resumen_q1.json";
import s1Recomendacion from "@/datos/serie1_recomendacion.json";
import s1Sensibilidad from "@/datos/serie1_sensibilidad_precio.json";
import s1p2 from "@/datos/serie1_resumen_p2.json";
import s1Modelo from "@/datos/serie1_modelo_p2.json";
import s1p3 from "@/datos/serie1_resumen_p3.json";
import s1p4 from "@/datos/serie1_resumen_p4.json";
import s2Auditoria from "@/datos/serie2_auditoria_sensores.json";
import s2Modos from "@/datos/serie2_modos.json";
import s2p1 from "@/datos/serie2_resumen_p1.json";
import s2p2 from "@/datos/serie2_resumen_p2.json";
import s2p3 from "@/datos/serie2_resumen_p3.json";
import s2p4 from "@/datos/serie2_resumen_p4.json";
import s2p5 from "@/datos/serie2_resumen_p5.json";
import s3p1 from "@/datos/serie3_resumen_p1.json";
import s3p2 from "@/datos/serie3_resumen_p2.json";
import s3p3 from "@/datos/serie3_resumen_p3.json";
import s3p4 from "@/datos/serie3_resumen_p4.json";
import s3Pronostico from "@/datos/serie3_pronostico.json";
import s3MesAMes from "@/datos/serie3_pronosticos_h1.json";

import { GraficoGanancia } from "./_diapositivas/GraficoGanancia";
import { GraficoPrecio } from "./_diapositivas/GraficoPrecio";
import { GraficoSensorVirtual } from "./_diapositivas/GraficoSensorVirtual";
import { GraficoZafras } from "./_diapositivas/GraficoZafras";
import { CifraD, Encabezado, EvaluacionD, Notas, Pie } from "./_diapositivas/piezas";
import s from "./_diapositivas/presentacion.module.css";

export const metadata: Metadata = { title: "Presentación ejecutiva" };

// ── Constantes de conversión (escritas a mano, no son resultados) ─────────────────────────────────────────
const ACRES_POR_HA = 2.471054; // 1 ha = 2.471054 acres
const LB_POR_T = 2204.62; // 1 t métrica = 2,204.62 lb; 1 ¢/lb = US$22.05/t (docs/api.md)
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// ── Serie I · Campo ───────────────────────────────────────────────────────────────────────────────────────
const variedades = [...s1Recomendacion].sort((a, b) => a.rank - b.rank);
const top3 = variedades.slice(0, 3);
const v1 = top3[0];
const gananciaMin = Math.min(...top3.map((v) => v.ganancia_vs_testigos));
const gananciaMax = Math.max(...top3.map((v) => v.ganancia_vs_testigos));
const equilibrioMin = Math.min(...top3.map((v) => v.precio_equilibrio));
const equilibrioMax = Math.max(...top3.map((v) => v.precio_equilibrio));
const top3GanaSiempre = top3.every((v) => v.P_gana_a_testigos === 1);
const cicloTop3 = top3.every((v) => v.ciclo_optimo === s1q1.referencia.ciclo) ? s1q1.referencia.ciclo : null;
const preciosSensibilidad = s1Sensibilidad.map((f) => f.precio);
const mismoTop3 = s1Sensibilidad.every((f) => top3.every((v) => f.top3.split(", ").includes(v.CLONE)));
const filasGanancia = variedades.slice(0, 10).map((v) => ({
  variedad: v.CLONE, estimacion: v.ganancia_vs_testigos, p05: v.ganancia_p05, p95: v.ganancia_p95, destacada: v.rank <= 3,
}));

const errorModelo = s1p2.metricas_e1.Ridge["MAPE_%"];
const errorHistorico = s1p2.metricas_e1.Ingenuo["MAPE_%"];
const errorFincaNueva = s1p2.metricas_e2.Ridge["MAPE_%"];
const [bandaBaja, bandaAlta] = s1Modelo.escenario_1.banda80_log.map((x) => (Math.exp(x) - 1) * 100);
const coberturaBanda = s1p2.cobertura["Escenario 1"]["cobertura banda 80 %"];
const ordenLote = s1p2.metricas_e1.Ridge.orden_spearman;
const ordenSocas = s1p2.por_corte["socas|Ridge"].orden_spearman;
// Diferencia de error contra el promedio histórico (bootstrap de fincas-año). El notebook 03 la reporta en su evaluación.
const mejoraHistorico = s1p2.comparaciones["Regla P1 − Ingenuo"];
const filasZafras = Object.entries(s1p2.error_por_zafra_pct).map(([zafra, sesgo]) => ({ zafra, sesgo, destacada: Math.abs(sesgo) >= 10 }));
const zafraPeor = filasZafras.reduce((a, b) => (b.sesgo < a.sesgo ? b : a));
const zafraMejor = filasZafras.reduce((a, b) => (b.sesgo > a.sesgo ? b : a));

const auditoria = s1p4.auditoria;
const tamano6 = s1p4.tamanos["6 años de cosecha, interacción ×1"]["ventaja 10%"];
const tamano6doble = s1p4.tamanos["6 años de cosecha, interacción ×2"]["ventaja 10%"];
const cincoPorCientoImposible = Object.values(s1p4.tamanos).every((t) => t["ventaja 5%"] === null);
const equilibrioDistancia = s1p4.distancia.equilibrio;

// ── Serie II · Caldera ────────────────────────────────────────────────────────────────────────────────────
const metricasVapor = s2p3.metricas;
const NOMBRES_MODELOS: [keyof typeof metricasVapor, string][] = [
  ["Ridge completo", "Lineal con todas las variables"],
  ["Gradient boosting", "Árboles (gradient boosting)"],
  ["Hidráulico √(ΔP·ρ)", "Solo la caída de presión"],
  ["Ridge de combustión", "Respaldo sin presiones"],
  ["Media", "Promedio, sin modelo"],
];
const filasVapor = NOMBRES_MODELOS
  .map(([clave, modelo]) => ({ modelo, error: metricasVapor[clave]["MAPE_%"], destacada: clave === "Ridge completo" }))
  .sort((a, b) => a.error - b.error);
const vaporFinal = metricasVapor["Ridge completo"];
const optimismos = Object.values(s2p3.al_azar).map((m) => m["optimismo (%)"]);

const inyecciones = s2p4.inyecciones;
const aciertos = inyecciones.filter((i) => i.acierta === "True").length;
const fallasSensor = inyecciones.filter((i) => i.real === "sensor").length;
const alarmasReglas = Object.values(s2p4.reglas).reduce((a, r) => a + r["eventos por día"], 0);
const alarmasDia = alarmasReglas + s2p4.verificacion_episodios_dia + s2p4.monitor_episodios_dia;
const nReglas = Object.keys(s2p4.reglas).length;
const nChequeos = Object.keys(s2p4.sensibilidad).length;
const fallaVapor = s2p4.sensibilidad["Vapor medido − virtual"]["falla mínima detectable"];
const fallaVaporPct = (fallaVapor / s2Modos.media.vapor) * 100;
const fallaGases = s2p4.sensibilidad["Gases izq. − der."]["falla mínima detectable"];
const derivaVapor = inyecciones.find((i) => i.escenario === "Medidor de vapor con deriva");
const horasDeriva = Number(derivaVapor?.["minutos hasta la alarma"]) / 60;

const limpiezaBaja = s2p5.ensuciamiento_10C["0.3"];
const limpiezaAlta = s2p5.ensuciamiento_10C["0.7"];
const derivaGases = s2p5.tendencias["Gases a la salida del economizador superior"]["°C por día"];
const excesoAire = s2p5.exceso_aire["total combustible"].puntos_eficiencia;
const llenadoH = s2p2.ciclos_lecho.llenado.minutos_mediana / 60;
const descargaH = s2p2.ciclos_lecho.descarga.minutos_mediana / 60;
const vaporMasFrio = s2p2.tercios["hogar y vapor calientes"].t_vapor - s2p2.tercios["más aire y atemperación"].t_vapor;

// ── Serie III · Mercado ───────────────────────────────────────────────────────────────────────────────────
const errorMes1 = s3p3.metricas["1"]["Ingenuo: último cierre"]["MAPE (%)"];
const errorMes3 = s3p3.metricas["3"]["Ingenuo: último cierre"]["MAPE (%)"];
const arimaPeor = -s3p3.metricas["1"]["ARIMA(1,1,0) sobre promedios"]["mejora vs último cierre (%)"];
const vigente = Object.entries(s3p3.vigente).map(([clave, b]) => {
  const [nombre, anio] = clave.split(" ");
  const fin = new Date(Date.UTC(Number(anio), MESES.indexOf(nombre) + 1, 0)).toISOString().slice(0, 10);
  return {
    fecha: fin, mes: `${nombre[0].toUpperCase()}${nombre.slice(1)}`,
    centro: b.centro, p2_5: b["p2.5"], p10: b.p10, p90: b.p90, p97_5: b["p97.5"],
  };
});
const [bandaMes1, bandaMes3] = vigente;
const enPct = (x: number, centro: number) => (x / centro - 1) * 100;
const turbulencia = s3p2.regimenes.Turbulencia;
const calma = s3p2.regimenes.Calma;
const colas = s3p2.colas["|z| > 4"]["veces más (desviación estándar)"];
const usdPorCentavo = LB_POR_T / 100;
const historiaPrecio = s3MesAMes.filter((f) => f.objetivo >= "2022-06-01").map((f) => ({ fecha: f.objetivo, valor: f.real }));
const cierre = { fecha: s3Pronostico.fecha_origen, valor: s3Pronostico.ultimo_cierre };
const realJunio = { fecha: bandaMes1.fecha, valor: s3p3.junio_real_parcial };
const juniodentro = realJunio.valor >= bandaMes1.p10 && realJunio.valor <= bandaMes1.p90;

const elasticidad = s3p4.base.dla.suma;
const pPermutacion = [s3p4.permutacion["Área, 1-3 años"].p_una_cola, s3p4.permutacion["Área, 1-3 años, con inercia"].p_una_cola];
const ponderado = s3p4.permutacion["Área ponderada por tamaño, con inercia (exploratorio)"];
const guatemala = s3p1.guatemala;

// Fuente y enlace de cada diapositiva
const fechaCorta = (iso: string) => iso.split("-").reverse().join("/");

export default function Presentacion() {
  return (
    <>
      {/* Solo en teléfonos en vertical: la diapositiva 16:9 queda muy chica */}
      <p className={`${s.girar} no-imprimir`}>Las diapositivas se leen mejor con el teléfono en horizontal.</p>
      <Diapositivas titulo="Presentación ejecutiva: caña de azúcar, campo, caldera y mercado">
        {/* 1 · Portada */}
        <Diapositiva
          tipo="portada"
          notas={
            <Notas
              decir={[
                "Buenos días. En los próximos 15 a 20 minutos presento tres análisis: el campo, la caldera y el mercado del azúcar.",
                "De cada uno digo qué encontré, qué decisión recomiendo, cuánto vale y qué tan seguro estoy. Cierro con una demostración de la API y abro a preguntas técnicas.",
                "Teclas: flechas para avanzar, N para estas notas, F para pantalla completa.",
              ]}
            />
          }
        >
          <p className={`d-etiqueta ${s.arriba}`}>Presentación ejecutiva · Gerencia General, Agrícola e Industrial</p>
          <h2 className="d-titulo-grande">Caña de azúcar: qué sembrar, cómo vigilar la caldera y qué esperar del precio</h2>
          <p className="d-sub">
            Tres análisis con datos públicos. Para cada uno: el hallazgo, la decisión que recomiendo, su impacto, sus riesgos y mi
            nivel de certeza.
          </p>
          <dl className={s.meta}>
            <div><dt>Autor</dt><dd>Edgar Sierra</dd></div>
            {/* fuente: README.md, estado de las series (13 notebooks) */}
            <div><dt>Evidencia</dt><dd>13 notebooks, una API y su bitácora de decisiones</dd></div>
            <div><dt>Datos</dt><dd>Públicos y de otros lugares: se traslada el método</dd></div>
          </dl>
        </Diapositiva>

        {/* 2 · Qué me pidieron y cómo lo resolví */}
        <Diapositiva
          notas={
            <Notas
              decir={[
                "Me pidieron responder una pregunta por gerencia. Campo: qué variedades sembrar, cada cuánto renovar y cuánto azúcar esperar. Caldera: si se puede confiar en los sensores, estimar el vapor y detectar fallas. Mercado: dónde está Guatemala, cuánto se mueve el precio y qué esperar de él.",
                <>
                  En las tres apliqué las mismas cuatro reglas. La primera pesó en las tres: en el campo, la columna de azúcar
                  estaba en libras y no en toneladas, y el {/* fuente: bitácora D1, notebook 01 */}35.5 % de las filas traía coma
                  decimal; en la caldera, un segundo archivo inventaba {s2p1.celdas_distintas_autoreg} valores; en el precio, la serie
                  pegaba contratos distintos con {s3p2.dias_cambio} saltos falsos.
                </>,
                "Todos los datos son públicos y de otros lugares. Lo que se traslada al ingenio es el método, no las cifras.",
              ]}
              preguntas={[
                ["por qué no usé modelos más complejos", "Los probé: Random Forest, XGBoost, gradient boosting y ARIMA. Ninguno ganó con significancia. Si el complejo no gana, me quedo con el que se explica en una línea."],
                ["por qué validar hacia adelante", <>Porque así se usa el modelo. Con pliegues al azar, el error se ve entre {num(Math.min(...optimismos), 0)} % y {num(Math.max(...optimismos), 0)} % menor de lo que es en realidad (notebook 08).</>],
              ]}
            />
          }
        >
          <Encabezado etiqueta="El encargo y el método" titulo="Tres preguntas del ingenio, un mismo método" />
          <div className={`d-cuerpo ${s.encargo}`}>
            <div>
              <p className={s.subtitulo}>Lo que me pidieron</p>
              <div className={s.pregunta} data-serie="campo">
                <div>
                  <p className={s.preguntaSerie}>Campo · Gerencia Agrícola</p>
                  <p className={s.preguntaTexto}>Qué variedades sembrar, cada cuánto renovar y cuánto azúcar esperar.</p>
                </div>
              </div>
              <div className={s.pregunta} data-serie="caldera">
                <div>
                  <p className={s.preguntaSerie}>Caldera · Gerencia Industrial</p>
                  <p className={s.preguntaTexto}>Si se puede confiar en los sensores, estimar el vapor y detectar fallas a tiempo.</p>
                </div>
              </div>
              <div className={s.pregunta} data-serie="mercado">
                <div>
                  <p className={s.preguntaSerie}>Mercado · Gerencia General</p>
                  <p className={s.preguntaTexto}>Dónde está Guatemala, cuánto se mueve el precio del azúcar y qué esperar de él.</p>
                </div>
              </div>
            </div>
            <div>
              <p className={s.subtitulo}>Cómo lo resolví: cuatro reglas</p>
              <ol className={s.lista}>
                <li>
                  <span>
                    <strong>Auditar los datos antes de modelar.</strong>
                    <span className={s.apagado}>
                      Azúcar en libras y no en toneladas, {s2p1.celdas_distintas_autoreg} valores inventados, {s3p2.dias_cambio} saltos de contrato.
                    </span>
                  </span>
                </li>
                <li>
                  <span>
                    <strong>Probar contra el azar.</strong>
                    <span className={s.apagado}>Ninguna serie tiene grupos naturales: los uso como perfiles, no como hechos.</span>
                  </span>
                </li>
                <li>
                  <span>
                    <strong>Validar como se usaría.</strong>
                    <span className={s.apagado}>Siempre hacia adelante en el tiempo, sin datos del futuro.</span>
                  </span>
                </li>
                <li>
                  <span>
                    <strong>Simple antes que complejo.</strong>
                    <span className={s.apagado}>El lineal o el ingenuo empató o ganó a los árboles y al ARIMA.</span>
                  </span>
                </li>
              </ol>
            </div>
          </div>
          <Pie fuente="bitácora de decisiones, resumen · notebooks 01, 06 y 11" detalle="/#metodo" tema="el método" />
        </Diapositiva>

        {/* 3 · Separador Campo */}
        <Diapositiva
          tipo="separador"
          serie="campo"
          notas={<Notas decir={["Empiezo por el campo: es donde una decisión se repite en miles de acres durante varios años."]} />}
        >
          <p className={`d-etiqueta ${s.sobreColor}`}>Serie I · Campo</p>
          <h2 className="d-titulo-grande">Qué variedades sembrar y cada cuánto renovar</h2>
          <p className={`d-sub ${s.sobreColor}`}>Para la Gerencia Agrícola.</p>
          <p className={s.contexto}>
            {/* fuente: serie1_curvas.json, "etapa 5 Louisiana 2010-2021" */}
            Ensayos públicos de Louisiana, 2010-2021: {s1q1.n_variedades_etapa5} variedades en la última etapa de selección,{" "}
            {s1q1.n_elegibles} con evidencia suficiente para recomendar. Se traslada el método, no las variedades.
          </p>
        </Diapositiva>

        {/* 4 · Campo P1 */}
        <Diapositiva
          serie="campo"
          notas={
            <Notas
              decir={[
                "Comparé cada variedad contra cuatro testigos fijos en el mismo ensayo y el mismo corte. Así se quita el efecto del lugar, del año y del suelo. Después llevé todo a dinero por acre al año: la caída en cada soca, el costo de cosecha y el de renovar.",
                <>
                  Tres variedades se separan: {top3.map((v) => v.CLONE).join(", ")}. Dejan entre {usd(gananciaMin, 0)} y{" "}
                  {usd(gananciaMax, 0)} más por acre al año que el testigo promedio
                  {top3GanaSiempre ? ", y le ganan al testigo en el 100 % de las réplicas" : ""}. Las tres dejan más margen si se
                  renuevan cada {cicloTop3} cortes: plantía y {cicloTop3 ? cicloTop3 - 1 : ""} socas.
                </>,
                <>
                  El precio cambia cuánto se gana, no cuál elegir:{" "}
                  {mismoTop3
                    ? `las mismas tres encabezan entre US$${num(Math.min(...preciosSensibilidad), 2)} y ${num(Math.max(...preciosSensibilidad), 2)} por libra.`
                    : "el orden cambia en algunos precios."}{" "}
                  Por debajo de {usd(equilibrioMin, 3)}-{num(equilibrioMax, 3)} por libra ninguna cubre costos.
                </>,
              ]}
              preguntas={[
                ["cómo calculé la certeza", <>Bootstrap de {num(s1q1.bootstrap.replicas, 0)} réplicas que remuestrean ensayos completos, porque las parcelas de un mismo ensayo no son independientes. El intervalo es de 90 %.</>],
                ["por la pregunta 3, los grupos de variedades", <>No hay grupos naturales, pero {s1p3.k} perfiles se reproducen al remuestrear y explican el {pctFraccion(s1p3.eta2, 0)} de la diferencia de ganancia. Las tres recomendadas están en el perfil de caña, calidad y longevidad.</>],
                ["por el costo de corte", <>No cambia el ranking: la correlación entre el ranking por azúcar y por margen es {/* fuente: bitácora H1 */}0.98.</>],
                ["por qué no L14-267", "Su intervalo se traslapa con el de L15-306. Es la alternativa natural si L15-306 no confirma en socas 3 y 4."],
              ]}
            />
          }
        >
          <Encabezado
            etiqueta="Campo · Pregunta 1 · Variedades y renovación"
            titulo={<>Tres variedades dejan {usd(gananciaMin, 0)}-{num(gananciaMax, 0)} más por acre al año que el testigo</>}
          />
          <div className={`d-cuerpo ${s.dos}`}>
            <div className={`${s.cifras} ${s.compactas}`}>
              <CifraD
                valor={conSigno(v1.ganancia_vs_testigos, 0)}
                unidad="US$/acre/año"
                texto={<>{v1.CLONE} contra el testigo promedio</>}
                detalle={<>Intervalo de 90 %: {num(v1.ganancia_p05, 0)} a {num(v1.ganancia_p95, 0)} · ≈ {usd(v1.ganancia_vs_testigos * ACRES_POR_HA, 0)} por hectárea</>}
              />
              <CifraD
                valor={cicloTop3 ?? "—"}
                unidad="cortes"
                texto={<>Cada cuánto renovar: plantía y {cicloTop3 ? cicloTop3 - 1 : "—"} socas</>}
                detalle={<>{/* fuente: notebook 02, celda 37 */}El óptimo es plano entre 4 y 5 cortes</>}
              />
              <CifraD
                valor={`${num(equilibrioMin, 3)}-${num(equilibrioMax, 3)}`}
                unidad="US$/lb"
                texto="Precio del azúcar bajo el cual ninguna cubre costos"
                detalle="El precio cambia cuánto se gana, no cuál elegir"
              />
            </div>
            <div className={s.columnaGrafica}>
              <p className={s.leyenda}>Ganancia contra el testigo · {filasGanancia.length} primeras de {variedades.length} variedades</p>
              <div className={s.celdaGrafica}>
                <GraficoGanancia filas={filasGanancia} />
              </div>
              <p className={s.leyendaPie}>Punto: estimación. Línea: intervalo de 90 % al remuestrear ensayos completos.</p>
            </div>
          </div>
          <Pie fuente="notebook 02 · outputs/tables/serie1_recomendacion.csv" detalle="/campo#variedades" tema="variedades y renovación" />
        </Diapositiva>

        {/* 5 · Campo P2 */}
        <Diapositiva
          serie="campo"
          notas={
            <Notas
              decir={[
                "El modelo tiene dos piezas: el nivel de la finca, que sale de su historia, y la ventaja de la variedad contra los testigos, que sale de la pregunta 1. Son tres coeficientes. Lo validé como se usaría: entrenando con las zafras anteriores y prediciendo la siguiente.",
                <>
                  El error típico por parcela es {num(errorModelo, 0)} %, contra {num(errorHistorico, 0)} % del promedio histórico.
                  Parece poco, pero el valor no está en adivinar la zafra: está en ordenar variedades dentro de cada lote, y ahí el
                  promedio histórico no sirve porque da el mismo número para todas.
                </>,
                <>
                  La gráfica muestra por qué el error no baja más: hay años en que todo el programa queda{" "}
                  {num(Math.abs(zafraPeor.sesgo), 0)} % abajo, como {zafraPeor.zafra}, o {num(zafraMejor.sesgo, 0)} % arriba, como{" "}
                  {zafraMejor.zafra}. Eso es clima y manejo, y los datos no traen ni una columna de clima ni de manejo. Por eso
                  recomiendo presupuestar con la banda, no con el punto.
                </>,
              ]}
              preguntas={[
                ["por la ganancia contra el promedio histórico", <>El error por parcela baja {num(-mejoraHistorico["Δ MAE lb/acre"], 0)} lb/acre (intervalo de 90 %: {num(-mejoraHistorico["IC90 alto"], 0)} a {num(-mejoraHistorico["IC90 bajo"], 0)}). Lo más valioso es que el modelo distingue variedades; el promedio histórico da el mismo número para todas.</>],
                ["por qué la banda de 80 % cubrió menos", <>Cubrió {pctFraccion(coberturaBanda, 0)}: las zafras recientes fueron más variables. La leo como una banda de 75 % o la amplío.</>],
                ["por la fuga de información", "No uso nada medido en la misma cosecha (TCA, TRS, población). Todas las variables existen antes de la zafra."],
                ["por una finca sin historia", <>El modelo de finca nueva tiene {num(errorFincaNueva, 0)} % de error y una banda algo más ancha. Se reemplaza en cuanto la finca tiene su primera cosecha.</>],
                ["por Random Forest y XGBoost", "Sus diferencias de error contra el Ridge tienen intervalos que cruzan cero. No ganan con significancia."],
              ]}
            />
          }
        >
          <Encabezado
            etiqueta="Campo · Pregunta 2 · Cuánto azúcar esperar"
            titulo={<>El pronóstico erra {num(errorModelo, 0)} % por parcela: {pctFraccion(s1p2.parte_error_nivel, 0)} del error es clima y manejo</>}
          />
          <div className={`d-cuerpo ${s.dos}`}>
            <div className={`${s.cifras} ${s.compactas}`}>
              <CifraD
                valor={`${num(errorModelo, 0)} %`}
                texto="Error típico por parcela, validado zafra por zafra"
                detalle={<>Promedio histórico: {num(errorHistorico, 0)} %. Modelo de 3 coeficientes.</>}
              />
              <CifraD
                valor={`${conSigno(bandaBaja, 0)} / ${conSigno(bandaAlta, 0)} %`}
                texto="Banda para presupuestar"
                detalle={<>Cubrió el {pctFraccion(coberturaBanda, 0)} de los casos reales</>}
              />
              <CifraD
                valor={num(ordenLote, 2)}
                texto="Qué tan bien ordena las variedades dentro de un lote"
                detalle={<>Correlación de rangos: 1 es el orden perfecto, 0 es azar · {num(ordenSocas, 2)} en socas</>}
              />
            </div>
            <div className={s.columnaGrafica}>
              <p className={s.leyenda}>Real contra lo planificado, promedio por zafra</p>
              <div className={s.celdaGrafica}>
                <GraficoZafras filas={filasZafras} />
              </div>
              <p className={s.leyendaPie}>En color, los años con más de 10 % de diferencia. Todas las variedades del lote suben o bajan juntas.</p>
            </div>
          </div>
          <Pie fuente="notebook 03 · outputs/models/serie1_resumen_p2.json" detalle="/campo#pronostico" tema="pronóstico de azúcar por acre" />
        </Diapositiva>

        {/* 6 · Campo P4 */}
        <Diapositiva
          serie="campo"
          notas={
            <Notas
              decir={[
                "La cuarta pregunta es cómo pasar de Louisiana a los datos del ingenio. No hay que esperar ensayos para empezar: con los registros de cosecha que ya existen se puede auditar cada lote. Cuáles se renuevan antes de tiempo, y pagan una renovación que no recuperan, y cuáles siguen cosechando socas vencidas.",
                <>
                  Lo probé con datos simulados y con el esquema en PostgreSQL: clasificó bien {num(auditoria.cerrados_bien, 0)} de{" "}
                  {num(auditoria.cerrados, 0)} ciclos cerrados. La condición es registrar el número de corte: sin él se pierde el{" "}
                  {pctFraccion(auditoria.perdidas_sin_corte, 0)} de las renovaciones.
                </>,
                "Para elegir variedad por ambiente sí hacen falta ensayos, porque en los datos comerciales la variedad se confunde con el lugar donde se sembró.",
              ]}
              preguntas={[
                ["por qué fincas y no repeticiones", <>Con el mismo número de parcelas, sumar fincas da {/* fuente: notebook 05, celda 18 */}2.6 veces más poder para detectar diferencias que sumar repeticiones: el ruido grande está entre fincas.</>],
                ["qué ventaja se puede detectar", <>Una ventaja de 10 % con 80 % de probabilidad necesita {tamano6} a {tamano6doble} fincas con cohortes anuales y 6 años de cosecha.{cincoPorCientoImposible ? " Una de 5 % no se separa del ruido con ningún tamaño razonable." : ""}</>],
                ["por la distancia al ingenio", <>El testigo deja de cubrir costos con un costo de cosecha y transporte de ~{usd(equilibrioDistancia["Testigo promedio"], 1)}/t; las tres recomendadas, entre {usd(Math.min(equilibrioDistancia["HOCP14-885"], equilibrioDistancia["HOL15-508"], equilibrioDistancia["L15-306"]), 1)} y {usd(Math.max(equilibrioDistancia["HOCP14-885"], equilibrioDistancia["HOL15-508"], equilibrioDistancia["L15-306"]), 1)}/t. En fincas lejanas, la variedad correcta separa un lote rentable de uno con pérdida.</>],
              ]}
            />
          }
        >
          <Encabezado etiqueta="Campo · Pregunta 4 · Decidir con datos propios" titulo="El ingenio puede auditar sus renovaciones desde la primera zafra" />
          <div className={`d-cuerpo ${s.filaYResto}`}>
            <div className={`${s.filaCifras} ${s.medianas}`}>
              <CifraD
                valor={num(auditoria.cerrados_bien, 0)}
                unidad={`de ${num(auditoria.cerrados, 0)} ciclos`}
                texto="bien clasificados por la auditoría, con datos simulados"
              />
              <CifraD
                valor={pctFraccion(auditoria.perdidas_sin_corte, 0)}
                texto="de las renovaciones no se ven si no se registra el número de corte"
              />
              <CifraD
                valor={/* fuente: notebook 05, celda 23 */ "20"}
                unidad="fincas"
                texto="por cohorte anual de ensayos, 5 por estrato, con testigos estables"
              />
            </div>
            <div>
              <p className={s.subtitulo}>Lo que recomiendo, en orden</p>
              <ol className={s.lista}>
                <li><span><strong>Registrar por lote</strong> el número de corte, la siembra, el suelo, la distancia, los costos y el clima.</span></li>
                <li><span><strong>Correr la auditoría</strong> y la regla de reemplazo en la primera zafra. No requiere inversión nueva.</span></li>
                <li><span><strong>Iniciar ensayos</strong> en 20 fincas por cohorte, seguidos hasta la soca 3 o 4.</span></li>
              </ol>
            </div>
          </div>
          <Pie fuente="notebook 05 · sql/esquema_campo.sql · outputs/models/serie1_resumen_p4.json" detalle="/campo#datos-propios" tema="decidir con datos propios" />
        </Diapositiva>

        {/* 7 · Evaluación Campo */}
        <Diapositiva
          serie="campo"
          notas={
            <Notas
              decir={[
                <>
                  Resumo el campo en tres decisiones: ampliar {v1.CLONE} y validar las otras dos hasta la soca 4, renovar cada{" "}
                  {cicloTop3} cortes y presupuestar con banda. Y una cuarta que se puede hacer ya: auditar las renovaciones con los
                  registros que existen.
                </>,
                <>
                  La cifra de impacto es ilustrativa: {usd(v1.ganancia_vs_testigos * 1000, 0)} al año por cada 1,000 acres con{" "}
                  {v1.CLONE} en lugar del testigo. Son variedades y números de Louisiana. Para el ingenio, esto es un protocolo, no una
                  lista de compra.
                </>,
              ]}
              preguntas={[
                ["cuánto vale para el ingenio", "Todavía no lo sé con sus datos. Lo que vale de inmediato es la auditoría de renovaciones, que no requiere inversión y ataca dos pérdidas directas."],
                ["por la variedad nueva con solo etapas 3-4 (escenario 3)", "No lo desarrollé; está diseñado en el README: misma estructura de dos piezas, con la ventaja temprana corregida por inflación y validada por cohortes."],
              ]}
            />
          }
        >
          <Encabezado
            etiqueta="Campo · Evaluación gerencial"
            titulo={<>Ampliar {v1.CLONE}, renovar cada {cicloTop3} cortes y presupuestar con banda</>}
          />
          <EvaluacionD
            significa={
              <p>
                Comparar contra testigos en el mismo campo y año separa a las ganadoras del ruido. La ventaja viene del azúcar y de
                que no se pierde en las socas.
              </p>
            }
            decision={
              <>
                <p>Ampliar {v1.CLONE}. Validar {top3[1].CLONE} y {top3[2].CLONE} hasta la soca 4 antes de escalar.</p>
                <p>Renovar cada {cicloTop3} cortes. Presupuestar con banda. Auditar renovaciones desde la primera zafra.</p>
              </>
            }
            impacto={
              <p>
                {usd(v1.ganancia_vs_testigos * 1000, 0)} al año por 1,000 acres con {v1.CLONE} (intervalo de 90 %:{" "}
                {num(v1.ganancia_p05 * 1000, 0)} a {num(v1.ganancia_p95 * 1000, 0)}). Ilustrativo.
              </p>
            }
            riesgos={
              <p>
                Datos de Louisiana. Dos de las tres sin soca 3 medida. Un mal año deja el programa{" "}
                {num(Math.abs(zafraPeor.sesgo), 0)} % abajo.
              </p>
            }
            certeza={[
              { nivel: "alta", texto: <>{top3[0].CLONE} y {top3[1].CLONE}: top 3 en ≥ {pctFraccion(Math.min(top3[0].P_top3, top3[1].P_top3), 0)} de las réplicas</> },
              { nivel: "media", texto: <>{top3[2].CLONE} ({pctFraccion(top3[2].P_top3, 0)}) y la cifra de cada lote</> },
            ]}
          />
          <Pie fuente="notebooks 02 a 05, evaluación gerencial" detalle="/campo" tema="el caso del campo" />
        </Diapositiva>

        {/* 8 · Separador Caldera */}
        <Diapositiva
          tipo="separador"
          serie="caldera"
          notas={<Notas decir={["Paso a la fábrica. La pregunta de fondo es si se puede confiar en los sensores de una caldera y qué se gana con ellos."]} />}
        >
          <p className={`d-etiqueta ${s.sobreColor}`}>Serie II · Caldera</p>
          <h2 className="d-titulo-grande">Cómo vigilar una caldera de cogeneración con los sensores que ya tiene</h2>
          <p className={`d-sub ${s.sobreColor}`}>Para la Gerencia Industrial.</p>
          <p className={s.contexto}>
            {/* fuente: README, Serie II (≈60 t/h, cada 5 s, 5 días) */}
            Una caldera de lecho fluidizado a carbón de ≈60 t/h: {s2Auditoria.length} sensores cada 5 s durante 5 días. Las del
            ingenio son de bagazo: se traslada el método, no los valores.
          </p>
        </Diapositiva>

        {/* 9 · Caldera P3 */}
        <Diapositiva
          serie="caldera"
          notas={
            <Notas
              decir={[
                "La pregunta era si se puede estimar el flujo de vapor con los demás sensores. Encontré que la caldera ya trae un segundo medidor sin saberlo: la caída de presión entre el domo y el colector se comporta como una placa de orificio.",
                <>
                  Con esa sola variable el error es de {num(metricasVapor["Hidráulico √(ΔP·ρ)"]["MAPE_%"], 2)} %. Un modelo lineal con
                  todas las variables y sus rezagos llega a {num(vaporFinal["MAPE_%"], 2)} %, unas {num(vaporFinal.MAE_t_h, 2)} t/h.
                  Lo validé entrenando con los días anteriores y prediciendo un día que el modelo no vio. Los árboles quedaron peor:
                  me quedo con el lineal.
                </>,
                "El uso práctico: si el medidor falla o deriva, la diferencia entre medido y estimado lo delata. La caldera responde en 1 a 2 minutos.",
              ]}
              preguntas={[
                ["por la validación al azar", <>Con pliegues al azar, el gradient boosting casi empataba con el lineal ({num(s2p3.al_azar["Gradient boosting"]["MAE al azar"], 2)} contra {num(s2p3.al_azar["Ridge completo"]["MAE al azar"], 2)} t/h). Hacia adelante, como se usaría, quedó en {num(metricasVapor["Gradient boosting"].MAE_t_h, 2)} contra {num(vaporFinal.MAE_t_h, 2)} t/h. Al azar, cada minuto de prueba tiene a sus vecinos casi iguales en el entrenamiento.</>],
                ["por el rango de validez", <>Se probó con carga entre {/* fuente: notebook 08, celda 25 */}51.5 y 70.6 t/h. Arranques y carga mínima no están en estos datos.</>],
                ["por el vapor medido", "Ya es un cálculo compensado del instrumento. El modelo aprende ese cálculo; por eso conviene verificarlo contra la física."],
                ["si fallan las dos presiones juntas", "El modelo completo y el hidráulico caen a la vez; queda el respaldo de combustión, con más error."],
              ]}
            />
          }
        >
          <Encabezado etiqueta="Caldera · Pregunta 3 · Sensor virtual del vapor" titulo="La caldera ya traía un segundo medidor de vapor" />
          <div className={`d-cuerpo ${s.dos}`}>
            <div className={`${s.cifras} ${s.compactas}`}>
              <CifraD
                valor={`${num(vaporFinal["MAPE_%"], 2)} %`}
                texto="Error del sensor virtual elegido"
                detalle={<>{num(vaporFinal.MAE_t_h, 2)} t/h · R² {num(vaporFinal.R2, 2)} · validado día por día</>}
              />
              <CifraD
                valor={`${num(metricasVapor["Hidráulico √(ΔP·ρ)"]["MAPE_%"], 2)} %`}
                texto="Solo con la caída de presión domo-colector"
                detalle="Q ∝ √(ΔP·ρ), la ecuación de un medidor de flujo"
              />
              <CifraD
                valor={`${num(metricasVapor["Ridge de combustión"]["MAPE_%"], 2)} %`}
                texto="Respaldo si fallan las presiones"
                detalle="Con aire, tiro y temperatura del hogar"
              />
            </div>
            <div className={s.columnaGrafica}>
              <p className={s.leyenda}>Error de cada forma de estimar el vapor</p>
              <div className={s.celdaGrafica}>
                <GraficoSensorVirtual filas={filasVapor} />
              </div>
              <p className={s.leyendaPie}>{num(vaporFinal.filas, 0)} minutos de prueba hacia adelante, en días que los modelos no vieron.</p>
            </div>
          </div>
          <Pie fuente="notebook 08 · outputs/tables/serie2_resumen_p3.json" detalle="/caldera#vapor" tema="sensor virtual del vapor" />
        </Diapositiva>

        {/* 10 · Caldera P4 */}
        <Diapositiva
          serie="caldera"
          notas={
            <Notas
              decir={[
                <>
                  Propongo vigilar la caldera en tres capas. Primero, {nReglas} reglas físicas con umbrales simples, para actuar.
                  Segundo, la verificación de sensores: la caldera tiene sensores redundantes, y cada uno se compara con sus pares en{" "}
                  {nChequeos} chequeos. Tercero, un monitor de proceso que aprende lo normal del último día.
                </>,
                "El criterio para separar sensor de equipo es físico: un sensor dañado se separa de sus pares; una falla del equipo mueve variables acopladas y los pares siguen coincidiendo.",
                <>
                  Lo probé con {inyecciones.length} fallas inyectadas, {fallasSensor} de sensor y {inyecciones.length - fallasSensor} de
                  proceso: {aciertos === inyecciones.length ? "todas" : aciertos} quedaron bien clasificadas. La deriva del medidor de
                  vapor se detectó a las {num(horasDeriva, 1)} h. La carga es manejable: unas {num(alarmasDia, 0)} alarmas al día entre
                  las tres capas.
                </>,
              ]}
              preguntas={[
                ["si las fallas eran reales", "No: son sintéticas, porque en 5 días no hubo fallas reales. Las tasas de alarma se midieron en 3 a 5 días, y los umbrales de las reglas se calibraron con estos mismos datos: esa cifra sale en parte por construcción."],
                ["qué tan fino es el chequeo", <>El par de temperaturas de gases solo ve derivas de ~{num(fallaGases, 0)} °C. Un modelo físico de la temperatura de gases lo afinaría.</>],
                ["por qué el monitor no está en la API", "Necesita 24 h de historia y se reentrena cada hora: iría como un servicio programado que lee el historiador de la planta."],
              ]}
            />
          }
        >
          <Encabezado etiqueta="Caldera · Pregunta 4 · Fallas y alarmas" titulo="Tres capas de alarmas separan un sensor dañado de una falla real" />
          <div className={`d-cuerpo ${s.filaYResto}`}>
            <div className={`${s.filaCifras} ${s.medianas}`}>
              <CifraD
                valor={`${aciertos} de ${inyecciones.length}`}
                texto="fallas inyectadas bien clasificadas como sensor o proceso"
              />
              <CifraD valor={num(alarmasDia, 0)} unidad="por día" texto="alarmas entre las tres capas, todas con diagnóstico" />
              <CifraD
                valor={num(fallaVapor, 1)}
                unidad="t/h"
                texto={<>desvío mínimo del medidor de vapor que se detecta (~{num(fallaVaporPct, 0)} %)</>}
              />
            </div>
            <div>
              <div className={s.tres}>
                <div className={s.bloque}>
                  <p className={s.bloqueTitulo}>1 · Reglas físicas</p>
                  <p className={s.bloqueTexto}>
                    {nReglas} reglas: O₂ bajo o alto, vapor caliente o frío, lecho alto, hogar presurizado y corriente del tiro alta.
                  </p>
                  <p className={s.bloqueAccion}>Operación: actuar.</p>
                </div>
                <div className={s.bloque}>
                  <p className={s.bloqueTitulo}>2 · Verificación de sensores</p>
                  <p className={s.bloqueTexto}>{nChequeos} chequeos: cada sensor contra sus pares redundantes.</p>
                  <p className={s.bloqueAccion}>Instrumentación: revisar el sensor, no corregir la operación.</p>
                </div>
                <div className={s.bloque}>
                  <p className={s.bloqueTitulo}>3 · Monitor de proceso</p>
                  <p className={s.bloqueTexto}>Aprende lo normal del último día y señala las variables que se salen.</p>
                  <p className={s.bloqueAccion}>Jefe de calderas: revisar la operación.</p>
                </div>
              </div>
            </div>
          </div>
          <Pie fuente="notebook 09, parte A · outputs/tables/serie2_resumen_p4.json" detalle="/caldera#anomalias" tema="fallas y alarmas de la caldera" />
        </Diapositiva>

        {/* 11 · Evaluación Caldera */}
        <Diapositiva
          serie="caldera"
          notas={
            <Notas
              decir={[
                "La redundancia, que parecía un detalle de instrumentación, es lo que permite distinguir un sensor dañado de un problema real. Con un solo sensor por variable esa distinción no existe.",
                <>
                  La oportunidad de eficiencia más clara está en los tubos: la temperatura de gases sube ~{num(derivaGases, 0)} °C por
                  día a igual operación y hace un serrucho de ~{num(s2p5.serrucho.periodo_h, 0)} h, compatible con ensuciamiento y
                  soplado. Si es ensuciamiento, limpiar a tiempo vale {num(limpiezaBaja.puntos_eficiencia, 1)}-
                  {num(limpiezaAlta.puntos_eficiencia, 1)} puntos de eficiencia. El exceso de aire ya está bajo: da unos{" "}
                  {num(excesoAire, 2)} puntos.
                </>,
              ]}
              preguntas={[
                ["por los datos de la caldera (pregunta 1)", <>El segundo archivo inventa {s2p1.celdas_distintas_autoreg} valores y lo descarté. Un diferencial de presión copia la presión del hogar (r = {num(s2p1.r_sxltcyz_pt8313a, 2)}): queda fuera de los modelos. {s2p1.sensores_cada_10s.length} sensores, incluido el vapor, se actualizan cada 10 s.</>],
                ["por los modos de operación (pregunta 2)", <>No hay estados separados: la carga manda. Hay {s2p2.k} zonas de carga y un ciclo del lecho, que se llena ~{num(llenadoH, 1)} h y se descarga ~{num(descargaH, 1)} h sin afectar la producción. Los minutos con más aire y atemperación tienen el vapor ~{num(vaporMasFrio, 0)} °C más frío.</>],
                ["por el valor en dinero", "Depende de supuestos declarados (poder calorífico, eficiencia, precio del combustible). La fracción de calor que va a la chimenea lo mueve ±40 %. Por eso su certeza es baja."],
              ]}
            />
          }
        >
          <Encabezado etiqueta="Caldera · Evaluación gerencial" titulo="Poner en línea el sensor virtual y limpiar por temperatura de gases" />
          <EvaluacionD
            significa={
              <p>
                Con los sensores que ya tiene, la caldera puede estimar su vapor y vigilarse en tres capas. La redundancia distingue
                un sensor dañado de un problema real.
              </p>
            }
            decision={
              <>
                <p>Poner en línea el sensor virtual y su chequeo contra el medidor.</p>
                <p>Activar reglas y verificación con confirmación del operador. Limpiar por temperatura de gases, no por calendario.</p>
              </>
            }
            impacto={
              <p>
                Limpiar a tiempo: {num(limpiezaBaja.puntos_eficiencia, 1)}-{num(limpiezaAlta.puntos_eficiencia, 1)} puntos de
                eficiencia, unos US${num(limpiezaBaja.us_ano / 1000, 0)}-{num(limpiezaAlta.us_ano / 1000, 0)} mil al año, con
                supuestos declarados.
              </p>
            }
            riesgos={
              <p>
                Cinco días sin arranques ni paros. Fallas de prueba sintéticas. Sin combustible ni CO, la eficiencia solo se mide en
                relativo.
              </p>
            }
            certeza={[
              { nivel: "alta", texto: <>Sensor virtual y criterio sensor o equipo ({aciertos} de {inyecciones.length})</> },
              { nivel: "baja", texto: "El valor en dinero: depende de supuestos" },
            ]}
          />
          <Pie fuente="notebooks 06 a 09, evaluación gerencial · outputs/tables/serie2_resumen_p5.json" detalle="/caldera#cierre" tema="recomendaciones de la caldera" />
        </Diapositiva>

        {/* 12 · Separador Mercado */}
        <Diapositiva
          tipo="separador"
          serie="mercado"
          notas={<Notas decir={["Termino con el mercado: qué se puede saber del precio del azúcar y qué no, y cómo responde la oferta del resto del mundo."]} />}
        >
          <p className={`d-etiqueta ${s.sobreColor}`}>Serie III · Mercado</p>
          <h2 className="d-titulo-grande">Qué esperar del precio del azúcar y de la oferta mundial</h2>
          <p className={`d-sub ${s.sobreColor}`}>Para la Gerencia General y Comercial.</p>
          <p className={s.contexto}>
            FAOSTAT con {s3p1.paises_panel} países productores de caña y el contrato No. 11 de azúcar de{" "}
            {s3p2.auditoria.desde.slice(0, 4)} a {s3p2.auditoria.hasta.slice(0, 4)}. Son datos mundiales: sirven al ingenio como
            contexto y como método.
          </p>
        </Diapositiva>

        {/* 13 · Mercado P2-P3 */}
        <Diapositiva
          serie="mercado"
          notas={
            <Notas
              decir={[
                <>
                  El precio del azúcar se mueve {/* fuente: notebook 11, evaluación gerencial */}cerca de 30 % al año y tiene dos
                  regímenes. Una de cada cuatro semanas está en turbulencia, donde se mueve casi el doble. Los días extremos son unas{" "}
                  {num(colas, 0)} veces más frecuentes que en una distribución normal.
                </>,
                <>
                  Probé tres modelos para pronosticar a 1 y 3 meses. Ninguno le ganó al último cierre: el mercado ya incorpora lo que
                  se sabe. Lo que sí se estima bien es el rango. Con la volatilidad de mayo de 2024, la banda de 80 % va de{" "}
                  {conSigno(enPct(bandaMes1.p10, bandaMes1.centro), 0)} % a {conSigno(enPct(bandaMes1.p90, bandaMes1.centro), 0)} % a un
                  mes.{juniodentro ? ` El promedio parcial de junio, ${num(realJunio.valor, 2)} ¢/lb, cayó dentro de la banda.` : ""}
                </>,
                <>Para dimensionarlo: cada centavo por libra equivale a unos {usd(usdPorCentavo, 0)} por tonelada.</>,
              ]}
              preguntas={[
                ["por el ARIMA", <>Le gana al promedio del mes, pero es {num(arimaPeor, 0)} % peor que el último cierre a 1 mes. Compararlo contra el ingenuo equivocado lo hace parecer bueno.</>],
                ["si la serie es confiable", <>Es real, pero pega contratos distintos: corregí {s3p2.dias_cambio} saltos por cambio de contrato. Los extremos coinciden al centavo con fuentes públicas.</>],
                ["por los ciclos del precio", "Los ciclos de nivel no se distinguen de un paseo aleatorio. No hay un patrón que sirva para elegir el momento de vender."],
              ]}
            />
          }
        >
          <Encabezado etiqueta="Mercado · Preguntas 2 y 3 · Precio y pronóstico" titulo="Nada le gana al precio de hoy; el valor está en la banda" />
          <div className={`d-cuerpo ${s.dos}`}>
            <div className={`${s.cifras} ${s.compactas}`}>
              <CifraD
                valor={`${num(errorMes1, 0)} %`}
                texto="Error típico a 1 mes con el último cierre"
                detalle={<>{num(errorMes3, 0)} % a 3 meses. ARIMA y regresión no lo superaron.</>}
              />
              <CifraD
                valor={`${conSigno(enPct(bandaMes1.p10, bandaMes1.centro), 0)} a ${conSigno(enPct(bandaMes1.p90, bandaMes1.centro), 0)} %`}
                texto="Banda de 80 % a 1 mes"
                detalle={<>{conSigno(enPct(bandaMes3.p10, bandaMes3.centro), 0)} % a {conSigno(enPct(bandaMes3.p90, bandaMes3.centro), 0)} % a 3 meses. Se ensancha con la volatilidad.</>}
              />
              <CifraD
                valor={`${num(turbulencia["% de las semanas"], 0)} %`}
                texto="de las semanas en turbulencia"
                detalle={<>{num(turbulencia["volatilidad semanal (%)"], 1)} % por semana, contra {num(calma["volatilidad semanal (%)"], 1)} % en calma</>}
              />
            </div>
            <div className={s.columnaGrafica} data-serie="mercado">
              <p className={s.leyenda}>Azúcar No. 11, promedio mensual (¢/lb) y pronóstico</p>
              <div className={s.celdaGrafica}>
                <GraficoPrecio historia={historiaPrecio} cierre={cierre} bandas={vigente} realParcial={realJunio} />
              </div>
              <p className={s.leyendaPie}>
                <span className={s.muestra} aria-hidden="true" />Banda de 80 %: junio {num(bandaMes1.p10, 1)}-{num(bandaMes1.p90, 1)},
                agosto {num(bandaMes3.p10, 1)}-{num(bandaMes3.p90, 1)} ¢/lb.{" "}
                <span className={`${s.muestra} ${s.muestraClara}`} aria-hidden="true" />95 %. Raya: cierre del{" "}
                {fechaCorta(cierre.fecha)}. ×: promedio de junio hasta el {fechaCorta(s3p2.auditoria.hasta)}.
              </p>
            </div>
          </div>
          <Pie fuente="notebooks 11 y 12 · outputs/models/serie3_pronostico.json · outputs/tables/serie3_resumen_p3.json y serie3_pronosticos_h1.csv" detalle="/mercado#pronostico" tema="pronóstico del precio" />
        </Diapositiva>

        {/* 14 · Mercado P4 */}
        <Diapositiva
          serie="mercado"
          notas={
            <Notas
              decir={[
                <>
                  La oferta mundial sí responde al precio, pero poco y tarde. Con {s3p4.paises} países, un alza de 10 % en el precio
                  se asocia con cerca de {num(elasticidad * 10, 1)} % más área dos a tres años después.
                </>,
                <>
                  La asociación se sostiene al controlar la inercia, al quitar cualquier año y al usar solo datos oficiales. Pero la
                  evidencia causal es débil: con {/* fuente: notebook 13, evaluación gerencial */}unos 20 años de precio, la prueba de
                  permutación da entre {num(Math.min(...pPermutacion), 2)} y {num(Math.max(...pPermutacion), 2)}.
                </>,
                "La lección para el ingenio no es un pronóstico: es que la expansión de los competidores llega con dos o tres años de rezago. Por eso no recomiendo expandir área por un precio alto de hoy.",
              ]}
              preguntas={[
                ["por la versión ponderada por tamaño", <>Da ~{num(ponderado.suma, 2)} con p = {num(ponderado.p_una_cola, 2)}, pero es exploratoria y descansa casi toda en Brasil y la India.</>],
                ["por qué no un instrumento", <>El rendimiento anual es un instrumento débil (F = {num(s3p4.primera_etapa_F, 1)}). Con el avance mensual de la zafra brasileña se podría intentar.</>],
                ["si la relación va en un solo sentido", "No: más producción se asocia con precios más bajos el mismo año y el siguiente. La oferta también mueve el precio."],
              ]}
            />
          }
        >
          <Encabezado etiqueta="Mercado · Pregunta 4 · Respuesta de la oferta" titulo="La oferta mundial responde al precio, pero poco y tarde" />
          <div className={`d-cuerpo ${s.filaYResto}`}>
            <div className={`${s.filaCifras} ${s.medianas}`}>
              <CifraD
                valor={num(elasticidad, 2)}
                texto="elasticidad acumulada del área al precio"
                detalle={<>Un alza de 10 % se asocia con ~{num(elasticidad * 10, 1)} % más área</>}
              />
              <CifraD
                valor={/* fuente: README, Serie III, pregunta 4 */ "2-3"}
                unidad="años"
                texto="de rezago entre el precio y el área sembrada"
              />
              <CifraD
                valor={`${num(Math.min(...pPermutacion), 2)}-${num(Math.max(...pPermutacion), 2)}`}
                texto="probabilidad de ver esa asociación por azar, al permutar los años del precio"
                detalle="Evidencia causal débil"
              />
            </div>
            <div>
              <p className={s.subtitulo}>Qué significa para el ingenio</p>
              <ol className={`${s.lista} ${s.listaSinNumero}`}>
                <li><span><strong>No expandir área por un precio alto de hoy.</strong> Cuando esa caña se coseche, la respuesta de los competidores ya habrá llegado.</span></li>
                <li><span><strong>Vigilar a Brasil</strong> (avance de zafra, mezcla azúcar-etanol, real) como indicador adelantado de oferta.</span></li>
              </ol>
            </div>
          </div>
          <Pie fuente="notebook 13 · outputs/tables/serie3_resumen_p4.json" detalle="/mercado#oferta" tema="respuesta de la oferta" />
        </Diapositiva>

        {/* 15 · Evaluación Mercado */}
        <Diapositiva
          serie="mercado"
          notas={
            <Notas
              decir={[
                "En el mercado, mi recomendación es gestionar el riesgo, no adivinar el precio: presupuestar con el último cierre y bandas según volatilidad, fijar más cuando la volatilidad sube y no tomar decisiones de área con un precio excepcional.",
                <>
                  Sobre Guatemala: es uno de solo {/* fuente: notebook 10, celda 26 */}4 de {s3p1.paises_panel} países en el cuartil
                  superior de crecimiento de área y de rendimiento, con {num(guatemala.descriptores.rend_2014_2023, 0)} t/ha en
                  2014-2023. Sus pares por trayectoria son {/* fuente: serie3_resumen_p1.json, guatemala.pares */}El Salvador,
                  Eswatini, Brasil, Nicaragua y Egipto, no la India ni Tailandia.
                </>,
              ]}
              preguntas={[
                ["por los datos de Guatemala en FAOSTAT", <>La producción de 2014-2016 está inflada y el área de 2019-2023 es imputada; el USDA reporta {/* fuente: notebook 10, evaluación gerencial */}12-15 % más área en 2021-2022. Recomiendo reemplazarlos por las cifras de la gremial.</>],
                ["por los grupos de países", <>Son débiles: apenas superan al nulo. Uso una tipología de {s3p1.k} (expansión, madurez y datos dudosos) para describir, no para predecir.</>],
              ]}
            />
          }
        >
          <Encabezado etiqueta="Mercado · Evaluación gerencial" titulo="Presupuestar en rangos y no expandir área por un precio alto" />
          <EvaluacionD
            significa={
              <p>
                El precio no se adivina con su historia, pero su riesgo sí se mide. Guatemala creció en área y en rendimiento: sus
                pares son {/* fuente: notebook 10, evaluación gerencial */}El Salvador, Nicaragua y Eswatini.
              </p>
            }
            decision={
              <>
                <p>Presupuestar con el último cierre y bandas según volatilidad; fijar más cuando sube.</p>
                <p>No expandir área por un precio alto de hoy. Vigilar la zafra de Brasil.</p>
              </>
            }
            impacto={
              <p>
                Evita fijar o vender según pronósticos sin valor y expandir con un precio pico. Cada ¢/lb son{" "}
                {usd(usdPorCentavo, 0)}/t.
              </p>
            }
            riesgos={
              <p>
                Eventos fuera de la muestra rompen la banda. Pocos años de precio para la oferta. FAOSTAT de Guatemala trae años
                inflados e imputados.
              </p>
            }
            certeza={[
              { nivel: "alta", texto: "Nada le gana al último cierre" },
              { nivel: "baja", etiqueta: "Certeza media-baja", texto: "Que el precio cause la respuesta" },
            ]}
          />
          <Pie fuente="notebooks 10 a 13, evaluación gerencial" detalle="/mercado#cierre" tema="recomendaciones del mercado" />
        </Diapositiva>

        {/* 16 · API y demostración */}
        <Diapositiva
          notas={
            <Notas
              decir={[
                "La API deja consultar los modelos de las tres series desde cualquier sistema: una hoja de cálculo, una aplicación o el asistente del sitio, que redacta en español con estas mismas consultas. No reentrena ni lee los datos: carga los JSON que dejan los notebooks y usa el mismo código. Por eso sus respuestas coinciden con las cifras que acabo de mostrar, y las pruebas automáticas lo comprueban.",
                "Ahora la demostración en la página de herramientas (el enlace del pie la abre). Son cuatro consultas, unos 4 minutos. Para la cuarta, subo en la auditoría de lotes un CSV al que le quité las columnas de variedad y TCH.",
              ]}
              preguntas={[
                ["cómo se actualiza un modelo", "Se vuelve a correr el notebook, que guarda el JSON nuevo; las pruebas verifican que la API reproduce sus cifras antes de publicar."],
                ["por la seguridad", "No hay secretos en el repositorio: Cloud Run entra a Vertex AI con su cuenta de servicio. La API valida cada campo con rangos físicos y económicos (una presión del domo en kPa se rechaza), CORS_ORIGINS limita qué sitios la consultan y cada IP tiene 300 consultas al día; el asistente, 30 preguntas."],
                ["si el asistente inventa", "No calcula: pide cada cifra a las mismas funciones de la API y debe citar el notebook. Con otro precio, la herramienta no le entrega la certeza del precio base para que no la mezcle."],
                ["qué no está en la API", "El monitor de proceso (necesita 24 h de historia), el sensor congelado (necesita muestras de 5 s) y la actualización diaria del precio."],
                ["si falla la red en la demo", "La documentación interactiva en localhost:8000/docs, o las cifras de esta diapositiva."],
              ]}
            />
          }
        >
          <Encabezado etiqueta="Serie IV · API y herramientas" titulo="Una API responde con las mismas cifras de los notebooks" />
          <div className={`d-cuerpo ${s.dosIguales}`}>
            <div>
              <p className={s.subtitulo}>Qué responde</p>
              <div className={s.pregunta} data-serie="campo">
                <div>
                  <p className={s.preguntaSerie}>Campo</p>
                  <p className={s.preguntaTexto}>Ranking, ciclo, azúcar esperado, grupo y auditoría.</p>
                </div>
              </div>
              <div className={s.pregunta} data-serie="caldera">
                <div>
                  <p className={s.preguntaSerie}>Caldera</p>
                  <p className={s.preguntaTexto}>Sensores, zona de carga, vapor virtual y verificación.</p>
                </div>
              </div>
              <div className={s.pregunta} data-serie="mercado">
                <div>
                  <p className={s.preguntaSerie}>Mercado</p>
                  <p className={s.preguntaTexto}>Rango del precio a 1 y 3 meses, en ¢/lb y US$/t.</p>
                </div>
              </div>
              <div className={`${s.cifras} ${s.compactas}`} style={{ marginTop: "0.8cqw" }}>
                <CifraD
                  valor={/* fuente: outputs/tests/pytest_docker.txt */ "120"}
                  unidad="pruebas aprobadas"
                  texto="en Docker con PostgreSQL 16, con las cifras de los notebooks"
                />
              </div>
            </div>
            <div>
              <p className={s.subtitulo}>Guion de la demostración · herramientas</p>
              <ol className={s.lista}>
                <li>
                  <span>
                    {/* fuente: docs/api.md, POST /campo/ciclo (verificado contra la API local) */}
                    <strong>Campo:</strong> {v1.CLONE} a US$0.15/lb sigue en 4 cortes; deja de cubrir costos bajo{" "}
                    {usd(v1.precio_equilibrio, 3)}/lb.
                  </span>
                </li>
                <li>
                  <span>
                    {/* fuente: docs/api.md, POST /caldera/verificar */}
                    <strong>Caldera:</strong> 6 minutos con el medidor de vapor 3 t/h arriba. La API responde: falla el sensor, no la
                    caldera.
                  </span>
                </li>
                <li>
                  <span>
                    <strong>Mercado:</strong> 10,000 t a 3 meses. Centro {usd(bandaMes3.centro * usdPorCentavo, 0)}/t; banda de 80 %
                    de {usd(bandaMes3.p10 * usdPorCentavo, 0)} a {num(bandaMes3.p90 * usdPorCentavo, 0)}/t.
                  </span>
                </li>
                <li>
                  <span>
                    {/* verificado contra la API local: POST /campo/auditoria/csv responde 422 "Faltan columnas: variedad, tch." */}
                    <strong>Entrada inválida:</strong> un CSV de cosechas sin las columnas de variedad y TCH. La API dice
                    cuáles faltan.
                  </span>
                </li>
              </ol>
            </div>
          </div>
          <Pie fuente="docs/api.md · tests/test_api*.py · outputs/tests/pytest_docker.txt" detalle="/herramientas" tema="las herramientas de la demostración" />
        </Diapositiva>

        {/* 17 · Decisiones y próximos pasos */}
        <Diapositiva
          notas={
            <Notas
              decir={[
                "Cierro con lo que recomiendo decidir y lo que hace falta medir. Lo que no requiere inversión va primero: la auditoría de renovaciones, el sensor virtual y el presupuesto en rangos.",
                "Lo que hace falta medir es lo que hoy limita la certeza: clima y costos por lote en el campo, combustible y chimenea en la caldera, y la curva completa de futuros en el mercado.",
              ]}
              preguntas={[
                ["por dónde empezar", "Por la auditoría de renovaciones y el sensor virtual: usan registros y sensores que ya existen."],
                ["qué quedó pendiente", "El escenario 3 de la pregunta 2 del campo (variedad nueva con solo etapas 3-4) está diseñado en el README, no desarrollado."],
              ]}
            />
          }
        >
          <Encabezado etiqueta="Decisiones y próximos pasos" titulo="Lo que recomiendo decidir ahora y lo que hace falta medir" />
          <div className={`d-cuerpo ${s.decisiones}`}>
            <section className={`d-caja ${s.caja}`} data-serie="campo">
              <h3>Campo · Agrícola</h3>
              <p className={s.rotulo}>Recomiendo</p>
              <ul className={s.puntos}>
                <li>Ampliar {v1.CLONE}.</li>
                <li>Validar {top3[1].CLONE} y {top3[2].CLONE} a soca 4.</li>
                <li>Renovar cada {cicloTop3} cortes.</li>
                <li>Auditar renovaciones en la 1.ª zafra.</li>
              </ul>
              <p className={s.rotulo}>Próximo paso</p>
              <ul className={`${s.puntos} ${s.puntosSec}`}>
                <li>Corte, costos y clima por lote.</li>
                <li>Ensayos en 20 fincas por cohorte.</li>
              </ul>
            </section>
            <section className={`d-caja ${s.caja}`} data-serie="caldera">
              <h3>Caldera · Industrial</h3>
              <p className={s.rotulo}>Recomiendo</p>
              <ul className={s.puntos}>
                <li>Sensor virtual del vapor en línea.</li>
                <li>Reglas y verificación de sensores.</li>
                <li>Limpiar por temperatura de gases.</li>
              </ul>
              <p className={s.rotulo}>Próximo paso</p>
              <ul className={`${s.puntos} ${s.puntosSec}`}>
                <li>Medir combustible, chimenea y CO.</li>
                <li>2-3 meses de historia para umbrales.</li>
              </ul>
            </section>
            <section className={`d-caja ${s.caja}`} data-serie="mercado">
              <h3>Mercado · General</h3>
              <p className={s.rotulo}>Recomiendo</p>
              <ul className={s.puntos}>
                <li>Presupuestar en rangos de precio.</li>
                <li>Fijar más si sube la volatilidad.</li>
                <li>No expandir área por un pico.</li>
              </ul>
              <p className={s.rotulo}>Próximo paso</p>
              <ul className={`${s.puntos} ${s.puntosSec}`}>
                <li>Curva de futuros y zafra de Brasil.</li>
                <li>Cifras de la gremial para Guatemala.</li>
              </ul>
            </section>
          </div>
          <Pie fuente="evaluaciones gerenciales de los notebooks 02 a 13 · README, pendientes" detalle="/#decisiones" tema="las decisiones de las tres series" />
        </Diapositiva>

        {/* 18 · Cierre */}
        <Diapositiva
          tipo="portada"
          notas={
            <Notas
              decir={[
                "Gracias. Quedo atento a sus preguntas.",
                "Para preguntas técnicas, cada diapositiva tiene su fuente y un enlace a la sección del caso. La bitácora registra cada decisión, cada hipótesis descartada y cada error de la IA que corregí.",
              ]}
            />
          }
        >
          <p className={`d-etiqueta ${s.arriba}`}>Preguntas</p>
          <h2 className="d-titulo-grande">Gracias. Quedo atento a sus preguntas.</h2>
          <p className="d-sub">
            La metodología, la evidencia, los supuestos y los límites de cada análisis están en el sitio y en los notebooks.
          </p>
          <dl className={s.enlaces}>
            <div>
              <dt>Sitio</dt>
              <dd>
                <Link href="/">edgarsierra.com/analisis-cana-azucar</Link>
                <span className={s.apagado}>Campo, caldera, mercado, API y herramientas</span>
              </dd>
            </div>
            <div>
              <dt>Repositorio</dt>
              <dd>
                <a href={REPO}>{REPO.replace("https://", "")}</a>
                <span className={s.apagado}>Notebooks, código, pruebas y API</span>
              </dd>
            </div>
            <div>
              <dt>Bitácora</dt>
              <dd>
                <a href={archivoRepo("bitacora.md")}>bitacora.md</a>
                {/* fuente: bitacora.md, "Uso de IA en números" */}
                <span className={s.apagado}>84 decisiones y 24 hipótesis descartadas</span>
              </dd>
            </div>
          </dl>
        </Diapositiva>
      </Diapositivas>
    </>
  );
}
