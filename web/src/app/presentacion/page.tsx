import type { Metadata } from "next";
import Link from "next/link";
import { Diapositiva, Diapositivas } from "@/components/presentacion/Diapositivas";
import { REPO, archivoRepo } from "@/lib/base";
import { conSigno, num, pctFraccion, usd } from "@/lib/formato";

import s1q1 from "@/datos/serie1_resumen_q1.json";
import s1Recomendacion from "@/datos/serie1_recomendacion.json";
import s1Sensibilidad from "@/datos/serie1_sensibilidad_precio.json";
import s1Certeza from "@/datos/serie1_certeza.json";
import s1Limpieza from "@/datos/serie1_limpieza.json";
import s1p2 from "@/datos/serie1_resumen_p2.json";
import s1Modelo from "@/datos/serie1_modelo_p2.json";
import s1p3 from "@/datos/serie1_resumen_p3.json";
import s1p4 from "@/datos/serie1_resumen_p4.json";
import s2p1 from "@/datos/serie2_resumen_p1.json";
import s2p2 from "@/datos/serie2_resumen_p2.json";
import s2p3 from "@/datos/serie2_resumen_p3.json";
import s2p4 from "@/datos/serie2_resumen_p4.json";
import s2p5 from "@/datos/serie2_resumen_p5.json";
import s2Predicciones from "@/datos/serie2_predicciones_p3.json";
import s2MuestraModos from "@/datos/serie2_muestra_api_modos.json";
import s2CiclosLecho from "@/datos/serie2_ciclos_lecho.json";
import s3p1 from "@/datos/serie3_resumen_p1.json";
import s3p2 from "@/datos/serie3_resumen_p2.json";
import s3p3 from "@/datos/serie3_resumen_p3.json";
import s3p4 from "@/datos/serie3_resumen_p4.json";
import s3Pronostico from "@/datos/serie3_pronostico.json";
import s3MesAMes from "@/datos/serie3_pronosticos_h1.json";
import s3Grupos from "@/datos/serie3_grupos_paises.json";

import { EstadoApiD } from "./_diapositivas/EstadoApiD";
import { GraficoGanancia } from "./_diapositivas/GraficoGanancia";
import { GraficoPrecio } from "./_diapositivas/GraficoPrecio";
import { GraficoSensorVirtual } from "./_diapositivas/GraficoSensorVirtual";
import { GraficoZafras } from "./_diapositivas/GraficoZafras";
import { GraficoDistancia, GraficoPerfiles } from "./_diapositivas/GraficosCampo";
import { GraficoLecho, GraficoSerrucho, GraficoValidacion, GraficoVapor } from "./_diapositivas/GraficosCaldera";
import { GraficoPaises, GraficoRezagos, type PaisD, type RezagoD } from "./_diapositivas/GraficosMercado";
import { CertezaD, CifraD, EvaluacionD, GraficaD, Notas, Pie, Titulo } from "./_diapositivas/piezas";
import { Renovaciones } from "./_diapositivas/Renovaciones";
import s from "./_diapositivas/presentacion.module.css";

export const metadata: Metadata = { title: "Presentación ejecutiva" };

// ── Constantes escritas a mano (conversiones y cifras que no están en un JSON; cada una con su fuente) ─────────
const ACRES_POR_HA = 2.471054; // 1 ha = 2.471054 acres
const LB_POR_T = 2204.62; // 1 t métrica = 2,204.62 lb; 1 ¢/lb = US$22.05/t (docs/api.md)
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
// fuente: README, "En 1 minuto" y "Calidad y verificación"; outputs/tests/pytest_docker.txt
const NOTEBOOKS = 13;
const CONSULTAS_API = 14;
const PRUEBAS = 120;
const PRUEBAS_API = 115;
const PREDICCIONES_2022 = 509;
const DIFERENCIA_2022 = 0.7; // lb/acre
// fuente: bitacora.md, Resumen ("Uso de IA en números")
const DECISIONES = 85;
const HIPOTESIS = 24;
const ERRORES_IA = 34;
// fuente: README, tabla "Qué / Dónde"
const DOCS_API = "https://analisis-cana-api-36437889250.us-central1.run.app/docs";
// Nombres en español de los países que se nombran (FAOSTAT los trae en inglés)
const PAIS: Record<string, string> = {
  "Iran (Islamic Republic of)": "Irán", Sudan: "Sudán", Brazil: "Brasil", Egypt: "Egipto", Eswatini: "Eswatini",
};
const es = (p: string) => PAIS[p] ?? p;
/** Porcentaje con espacio duro: la cifra y el % no se separan al final del renglón */
const pctF = (x: number, decimales = 0) => pctFraccion(x, decimales).replace(" %", "\u00a0%");
/** Un código de variedad o una cifra con unidad no se parten al final del renglón */
const sinCorte = (x: string) => <span className={s.sinCorte}>{x}</span>;
const enLista = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);
const fechaCorta = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
const minutoUTC = (f: string) => Date.parse(`${f.replace(" ", "T")}Z`) / 60000;
/** Cuantil con interpolación lineal (el de numpy por omisión) */
function cuantil(xs: number[], q: number) {
  const o = [...xs].sort((a, b) => a - b);
  const pos = (o.length - 1) * q;
  const k = Math.floor(pos);
  return o[k] + (o[Math.min(k + 1, o.length - 1)] - o[k]) * (pos - k);
}

// ── Serie I · Campo ─────────────────────────────────────────────────────────────────────────────────────────
const variedades = [...s1Recomendacion].sort((a, b) => a.rank - b.rank);
const top3 = variedades.slice(0, 3);
const [v1, v2, v3] = top3;
const gananciaMin = Math.min(...top3.map((v) => v.ganancia_vs_testigos));
const gananciaMax = Math.max(...top3.map((v) => v.ganancia_vs_testigos));
const equilibrioMin = Math.min(...top3.map((v) => v.precio_equilibrio));
const equilibrioMax = Math.max(...top3.map((v) => v.precio_equilibrio));
const top3GanaSiempre = top3.every((v) => v.P_gana_a_testigos === 1);
const ciclo = s1q1.referencia.ciclo;
const cicloTop3 = top3.every((v) => v.ciclo_optimo === ciclo);
const preciosSensibilidad = s1Sensibilidad.map((f) => f.precio);
const mismoTop3 = s1Sensibilidad.every((f) => top3.every((v) => f.top3.split(", ").includes(v.CLONE)));
const filasGanancia = variedades.slice(0, 10).map((v) => ({
  variedad: v.CLONE, estimacion: v.ganancia_vs_testigos, p05: v.ganancia_p05, p95: v.ganancia_p95, destacada: v.rank <= 3,
}));
const certezaDe = (clon: string) => s1Certeza.find((c) => c.CLONE === clon);
const l14 = certezaDe("L14-267");
const l15 = certezaDe("L15-306");
const filasOriginales = s1Limpieza.find((f) => f.Regla === "filas_originales")?.Filas ?? 0;
const filasComa = s1Limpieza.find((f) => f.Regla.startsWith("T_SPACRE/TRS partidos por coma"))?.Filas ?? 0;

const e1 = s1p2.metricas_e1;
const errorModelo = e1.Ridge["MAPE_%"];
const errorHistorico = e1.Ingenuo["MAPE_%"];
const errorFincaNueva = s1p2.metricas_e2.Ridge["MAPE_%"];
const [bandaBaja, bandaAlta] = s1Modelo.escenario_1.banda80_log.map((x) => (Math.exp(x) - 1) * 100);
const coberturaBanda = s1p2.cobertura["Escenario 1"]["cobertura banda 80 %"];
const ordenLote = e1.Ridge.orden_spearman;
const ordenSocas = s1p2.por_corte["socas|Ridge"].orden_spearman;
const filasZafras = Object.entries(s1p2.error_por_zafra_pct).map(([zafra, sesgo]) => ({ zafra, sesgo, destacada: Math.abs(sesgo) >= 10 }));
const zafraPeor = filasZafras.reduce((a, b) => (b.sesgo < a.sesgo ? b : a));
const zafraMejor = filasZafras.reduce((a, b) => (b.sesgo > a.sesgo ? b : a));

const auditoria = s1p4.auditoria;
const casosRenovacion = Object.entries(auditoria.ejemplos).map(([nombre, cortes]) => ({
  nombre: `${nombre[0].toUpperCase()}${nombre.slice(1)}`,
  cortes: cortes as [number, number][],
}));
const tamanos6 = (interaccion: string) => s1p4.tamanos[`6 años de cosecha, interacción ×${interaccion}` as keyof typeof s1p4.tamanos];
const equilibrioDistancia = s1p4.distancia.equilibrio;
const distRecomendadas = top3.map((v) => equilibrioDistancia[v.CLONE as keyof typeof equilibrioDistancia]);
const filasDistancia = Object.entries(equilibrioDistancia).map(([variedad, equilibrio]) => ({
  variedad, equilibrio, destacada: variedad !== "Testigo promedio",
}));

const ari5 = s1p3.estabilidad.find((e) => e.k === s1p3.k)?.ARI_mediana ?? 0;
const perfiles = s1p3.perfil.map((p) => ({
  grupo: p.grupo,
  variedades: p.variedades,
  mediana: p["ganancia P1 US$/acre/año (mediana)"],
  destacado: p.grupo === s1p3.orden_grupos[0],
}));
const perfilTop = perfiles[0];

// ── Serie II · Caldera ──────────────────────────────────────────────────────────────────────────────────────
const metricasVapor = s2p3.metricas;
const vaporFinal = metricasVapor["Ridge completo"];
const NOMBRES_MODELOS: Record<string, string> = {
  "Ridge completo": "Lineal con todas las variables",
  "Gradient boosting": "Árboles (gradient boosting)",
  "Hidráulico √(ΔP·ρ)": "Solo la caída de presión",
  "Ridge de combustión": "Respaldo sin presiones",
  Media: "Promedio, sin modelo",
};
const filasVapor = Object.entries(metricasVapor)
  .map(([clave, m]) => ({ modelo: NOMBRES_MODELOS[clave] ?? clave, error: m["MAPE_%"], destacada: clave === "Ridge completo" }))
  .sort((a, b) => a.error - b.error);
const alAzar = s2p3.al_azar;
const filasValidacion = Object.entries(alAzar)
  .map(([clave, v]) => ({ modelo: NOMBRES_MODELOS[clave] ?? clave, azar: v["MAE al azar"], adelante: v["MAE hacia adelante"], optimismo: v["optimismo (%)"] }))
  .sort((a, b) => b.optimismo - a.optimismo);
const optimismoMin = Math.min(...filasValidacion.map((f) => f.optimismo));
const optimismoMax = Math.max(...filasValidacion.map((f) => f.optimismo));
const ridgeVsArboles = s2p3.comparaciones.find((c) => c["modelo B"] === "Gradient boosting" && c["modelo A"] === "Ridge completo");
// Mismo día que la página de la caldera: el tercer día con predicción fuera de muestra.
const diasConPrediccion = [...new Set(s2Predicciones.filter((r) => r["Ridge completo"] !== null).map((r) => r.date.slice(0, 10)))].sort();
const diaVapor = diasConPrediccion[2];
const puntosVapor = s2Predicciones
  .filter((r) => r.date.startsWith(diaVapor) && r["Ridge completo"] !== null)
  .map((r) => ({
    h: Number(r.date.slice(11, 13)) + Number(r.date.slice(14, 16)) / 60,
    med: Math.round(r.medido * 1000) / 1000,
    est: Math.round((r["Ridge completo"] as number) * 1000) / 1000,
  }));
// Rango de carga del sensor virtual: notebook 08, celda 25 (51.5-70.6 t/h)
const vaporMin = Math.min(...s2Predicciones.map((r) => r.medido));
const vaporMax = Math.max(...s2Predicciones.map((r) => r.medido));

const inyecciones = s2p4.inyecciones;
const aciertos = inyecciones.filter((i) => i.acierta === "True").length;
const nReglas = Object.keys(s2p4.reglas).length;
const nChequeos = Object.keys(s2p4.sensibilidad).length;
const alarmasReglas = Object.values(s2p4.reglas).reduce((a, r) => a + r["eventos por día"], 0);
const alarmasDia = alarmasReglas + s2p4.verificacion_episodios_dia + s2p4.monitor_episodios_dia;
const fallaVapor = s2p4.sensibilidad["Vapor medido − virtual"]["falla mínima detectable"];
const fallaGases = s2p4.sensibilidad["Gases izq. − der."]["falla mínima detectable"];
const filasFallas = inyecciones.map((x) => {
  const minutos = Number(x["minutos hasta la alarma"]);
  return {
    escenario: x.escenario,
    era: x.real === "sensor" ? "Sensor" : "Proceso",
    diagnostico: x["diagnóstico"].startsWith("sensor") ? "Sensor" : "Proceso",
    alarma: minutos === 0 ? "inmediata" : `${num(minutos, 0)} min`,
  };
});

const limpiezaBaja = s2p5.ensuciamiento_10C["0.3"];
const limpiezaAlta = s2p5.ensuciamiento_10C["0.7"];
const gases = s2p5.tendencias["Gases a la salida del economizador superior"];
const supuestos = s2p5.supuestos;
const excesoAire = s2p5.exceso_aire["total combustible"].puntos_eficiencia;
const llenadoH = s2p2.ciclos_lecho.llenado.minutos_mediana / 60;
const descargaH = s2p2.ciclos_lecho.descarga.minutos_mediana / 60;
const vaporMasFrio = s2p2.tercios["hogar y vapor calientes"].t_vapor - s2p2.tercios["más aire y atemperación"].t_vapor;
const puntosLecho = s2MuestraModos.map((r) => ({ m: minutoUTC(r.date), p: Math.round(r.lecho) }));
const descargas = s2CiclosLecho.filter((c) => c.fase === "descarga").map((c) => ({ a: minutoUTC(c.inicio), b: minutoUTC(c.fin) }));
const anioCaldera = Number(s2CiclosLecho[0].inicio.slice(0, 4));
const puntosGases = s2p5.gases_hora.t.map((t, k) => {
  const [dia, mes] = t.slice(0, 5).split("/").map(Number);
  const hora = Number(t.slice(6, 8));
  return { m: Date.UTC(anioCaldera, mes - 1, dia, hora) / 60000, v: s2p5.gases_hora.v[k] };
});

// ── Serie III · Mercado ─────────────────────────────────────────────────────────────────────────────────────
const metrica = (h: "1" | "3", modelo: keyof (typeof s3p3.metricas)["1"]) => s3p3.metricas[h][modelo];
const errorMes1 = metrica("1", "Ingenuo: último cierre")["MAPE (%)"];
const errorMes3 = metrica("3", "Ingenuo: último cierre")["MAPE (%)"];
const errorArima1 = metrica("1", "ARIMA(1,1,0) sobre promedios")["MAPE (%)"];
const errorRegresion1 = metrica("1", "Regresión: momentum y reversión")["MAPE (%)"];
const arimaPeor = -metrica("1", "ARIMA(1,1,0) sobre promedios")["mejora vs último cierre (%)"];
const vigente = Object.entries(s3p3.vigente).map(([clave, b]) => {
  const [nombre, anio] = clave.split(" ");
  const fin = new Date(Date.UTC(Number(anio), MESES.indexOf(nombre) + 1, 0)).toISOString().slice(0, 10);
  return { fecha: fin, mes: `${nombre[0].toUpperCase()}${nombre.slice(1)}`, centro: b.centro, p2_5: b["p2.5"], p10: b.p10, p90: b.p90, p97_5: b["p97.5"] };
});
const [bandaMes1, bandaMes3] = vigente;
const enPct = (x: number, centro: number) => (x / centro - 1) * 100;
const banda1 = `${conSigno(enPct(bandaMes1.p10, bandaMes1.centro), 0)}\u00a0% / ${conSigno(enPct(bandaMes1.p90, bandaMes1.centro), 0)}\u00a0%`;
const banda3 = `${conSigno(enPct(bandaMes3.p10, bandaMes3.centro), 0)}\u00a0% / ${conSigno(enPct(bandaMes3.p90, bandaMes3.centro), 0)}\u00a0%`;
const cobertura1 = s3p3.bandas["1|según volatilidad"]["80 %"]["cobertura (%)"];
const cobertura3 = s3p3.bandas["3|según volatilidad"]["80 %"]["cobertura (%)"];
const mesesPrueba = s3MesAMes.length;
const [anioInicio, mesInicio] = s3MesAMes[0].origen.split("-").map(Number);
const usdPorCentavo = LB_POR_T / 100;
const TONELADAS = 10000; // ejemplo de docs/api.md, GET /mercado/pronostico?h=3&toneladas=10000
const ingreso = (centavos: number) => (centavos * usdPorCentavo * TONELADAS) / 1e6;
const historiaPrecio = s3MesAMes.filter((f) => f.objetivo >= "2022-06-01").map((f) => ({ fecha: f.objetivo, valor: f.real }));
const cierre = { fecha: s3Pronostico.fecha_origen, valor: s3Pronostico.ultimo_cierre };
const realJunio = { fecha: bandaMes1.fecha, valor: s3p3.junio_real_parcial };
const juniodentro = realJunio.valor >= bandaMes1.p10 && realJunio.valor <= bandaMes1.p90;
const turbulencia = s3p2.regimenes.Turbulencia;
const calma = s3p2.regimenes.Calma;
const covid = s3p2.episodios["COVID (20 feb-27 abr 2020)"].Azúcar;
const rebote = s3p2.episodios["Rebote (27 abr-31 dic 2020)"].Azúcar;

const elasticidad = s3p4.base.dla.suma;
const pPermutacion = [s3p4.permutacion["Área, 1-3 años"].p_una_cola, s3p4.permutacion["Área, 1-3 años, con inercia"].p_una_cola];
const ponderado = s3p4.permutacion["Área ponderada por tamaño, con inercia (exploratorio)"];
const REZAGOS = [
  ["dlpm1", "Año siguiente (placebo)"],
  ["dlp0", "Mismo año (placebo)"],
  ["dlp1", "1 año antes"],
  ["dlp2", "2 años antes"],
  ["dlp3", "3 años antes"],
  ["dlp4", "4 años antes"],
] as const;
const filasRezagos: RezagoD[] = REZAGOS.map(([k, etiqueta]) => ({
  etiqueta,
  coef: s3p4.perfil.dla.coef[k],
  placebo: k === "dlpm1" || k === "dlp0",
  destaca: k === "dlp2" || k === "dlp3",
}));

const guatemala = s3p1.guatemala;
const pares = guatemala.pares.map(es);
const corteArea = cuantil(s3Grupos.map((g) => g.crec_area), 0.75);
const corteRend = cuantil(s3Grupos.map((g) => g.rend_2014_2023), 0.75);
// "4 de 71": notebook 10, celda 26 (el mismo cuadrante superior de los dos ejes)
const enCuadrante = s3Grupos.filter((g) => g.crec_area > corteArea && g.rend_2014_2023 > corteRend).map((g) => g.indice);
const puntosPaises: PaisD[] = s3Grupos.map((g) => ({
  nombre: es(g.indice),
  crecArea: g.crec_area,
  rend: g.rend_2014_2023,
  papel: g.indice === "Guatemala" ? "guatemala" : enCuadrante.includes(g.indice) ? "cuadrante" : "otro",
}));

export default function Presentacion() {
  return (
    <>
      {/* Solo en teléfonos en vertical: la diapositiva 16:9 queda muy chica */}
      <p className={`${s.girar} no-imprimir`}>Las diapositivas se leen mejor con el teléfono en horizontal.</p>
      <Diapositivas titulo="Presentación ejecutiva: caña de azúcar, campo, caldera y mercado">
        {/* ═══ 1 · Portada ═══ */}
        <Diapositiva
          capitulo="apertura"
          tipo="portada"
          tiempo="0:40"
          notas={
            <Notas
              decir={[
                "Buenos días. Soy Edgar Sierra. Me pidieron responder tres preguntas: qué sembrar, cómo vigilar la caldera y qué esperar del precio del azúcar.",
                "En los próximos 18 minutos les doy una recomendación por gerencia y les digo cuánto creerle a cada una. También les muestro en vivo que las respuestas ya se consultan desde cualquier sistema.",
                "Una aclaración desde el inicio: los datos son públicos y de otros lugares. Son ensayos de Louisiana, una caldera a carbón y el mercado mundial. Lo que se traslada al ingenio es el método, no las cifras. Al final les pido lo necesario para tener las cifras propias.",
              ]}
              bloques={[
                {
                  titulo: "Antes de empezar",
                  items: [
                    ["Despertar la API", "Abrir las herramientas y el asistente 5 minutos antes: la API no tiene instancias encendidas si nadie la usa."],
                    ["Demostración", "Dejar precargados los cuatro pasos de la diapositiva 14 en otra pestaña."],
                    ["Teclas", "Flechas para avanzar, N para estas notas, F para pantalla completa. Fin va a la diapositiva 16; el anexo se abre con su pestaña."],
                  ],
                },
                {
                  titulo: "Versión de 15 minutos",
                  items: [
                    ["Quitar la 11", "Decir la lección de la oferta en una frase en la 12."],
                    ["Quitar la 5", "Mencionar la auditoría de renovaciones en la 6."],
                    ["Demostración corta", "Tres pasos: quitar el de mercado, que ya está en la 12, y dejar el del asistente."],
                  ],
                },
              ]}
            />
          }
        >
          <div className={s.portada}>
            <div className={s.portadaTexto}>
              <h2 className={s.portadaTitulo}>Qué sembrar, cómo vigilar y qué esperar</h2>
              <p className={s.portadaEntrada}>
                Campo, caldera y mercado del azúcar. Tres análisis con datos públicos, puestos en producción, para la
                Gerencia General, Agrícola e Industrial.
              </p>
              <dl className={s.portadaMeta}>
                <div><dt>Autor</dt><dd>Edgar Sierra</dd></div>
                <div>
                  <dt>Evidencia</dt>
                  <dd>{NOTEBOOKS} notebooks, una API con {CONSULTAS_API} consultas y {PRUEBAS} pruebas</dd>
                </div>
                <div><dt>Duración</dt><dd>18 minutos y preguntas</dd></div>
              </dl>
            </div>
            <div className={s.franjas}>
              <p className={s.franja} data-serie="campo"><strong>Campo</strong><span>qué sembrar</span></p>
              <p className={s.franja} data-serie="caldera"><strong>Caldera</strong><span>cómo vigilar</span></p>
              <p className={s.franja} data-serie="mercado"><strong>Mercado</strong><span>qué esperar</span></p>
            </div>
          </div>
        </Diapositiva>

        {/* ═══ 2 · Las tres respuestas ═══ */}
        <Diapositiva
          capitulo="apertura"
          tiempo="1:00"
          notas={
            <Notas
              decir={[
                <>
                  Empiezo por las respuestas. Para la Gerencia Agrícola: tres variedades le ganan al testigo. La mejor deja{" "}
                  {num(v1.ganancia_vs_testigos, 0)} dólares más por acre al año si se renueva cada {ciclo} cortes.
                </>,
                <>
                  Para la Industrial: la caldera puede estimar su propio vapor con los sensores que ya tiene, con{" "}
                  {num(vaporFinal["MAPE_%"], 1)}&nbsp;% de error. Así se sabe cuándo el medidor se desvía.
                </>,
                "Para la General: ningún modelo le ganó al precio de hoy como pronóstico, pero el rango sí se mide bien.",
                "Cada respuesta trae su nivel de certeza, y las tres se pueden consultar en vivo. Ahora les muestro de dónde sale cada una.",
              ]}
            />
          }
        >
          <Titulo>Una decisión por gerencia, con su certeza</Titulo>
          <div className={s.respuestas}>
            <section className={s.respuesta} data-serie="campo">
              <h3>Gerencia Agrícola</h3>
              <p className={s.respuestaDecision}>Ampliar {sinCorte(v1.CLONE)} y renovar cada {ciclo} cortes</p>
              <p className={s.respuestaPorque}>
                Tres variedades le ganan al testigo{top3GanaSiempre ? " en todas las réplicas" : ""}; {sinCorte(v1.CLONE)} es la que
                deja más.
              </p>
              <CifraD
                valor={`+${usd(v1.ganancia_vs_testigos, 0)}`}
                titulo="por acre al año contra el testigo"
                detalle={<>Intervalo de 90&nbsp;%: {num(v1.ganancia_p05, 0)} a {num(v1.ganancia_p95, 0)}</>}
              />
              <CertezaD nivel="alta" />
            </section>
            <section className={s.respuesta} data-serie="caldera">
              <h3>Gerencia Industrial</h3>
              <p className={s.respuestaDecision}>Poner en línea el sensor virtual del vapor</p>
              <p className={s.respuestaPorque}>
                La caldera estima su vapor con los sensores que ya tiene. Si el medidor se desvía, la diferencia lo delata.
              </p>
              <CifraD
                valor={`${num(vaporFinal["MAPE_%"], 2)}\u00a0%`}
                titulo="de error, en días que el modelo no vio"
                detalle={<>{num(vaporFinal.MAE_t_h, 2)} t/h, con los sensores que ya tiene</>}
              />
              <CertezaD nivel="alta" />
            </section>
            <section className={s.respuesta} data-serie="mercado">
              <h3>Gerencia General</h3>
              <p className={s.respuestaDecision}>Presupuestar con el precio de hoy y una banda</p>
              <p className={s.respuestaPorque}>Ningún modelo le ganó al último cierre. El precio no se adivina; su rango sí se mide.</p>
              <CifraD
                valor={banda1}
                titulo="banda de 80&nbsp;% del precio a 1 mes"
                detalle={<>Vigente para {bandaMes1.mes.toLowerCase()} de 2024, con el cierre del {fechaCorta(cierre.fecha)}</>}
              />
              <CertezaD nivel="alta" />
            </section>
          </div>
          <p className={s.aclaracion}>
            Datos públicos de otros lugares: se traslada el método, no las cifras. Las tres respuestas se consultan en vivo
            (diapositiva 14).
          </p>
          <Pie
            fuente="notebooks 02, 08 y 12 · serie1_recomendacion.json, serie2_resumen_p3.json y serie3_resumen_p3.json"
            detalle="/#decisiones"
            tema="las decisiones de las tres series"
          />
        </Diapositiva>

        {/* ═══ 3 · Campo, variedades ═══ */}
        <Diapositiva
          capitulo="campo"
          tiempo="1:15"
          notas={
            <Notas
              decir={[
                "Comparé cada variedad contra cuatro testigos sembrados en el mismo ensayo y el mismo corte. Así se quita el efecto del lugar, del año y del suelo.",
                "Después lo llevé a dinero por acre al año: el azúcar que da, lo que pierde en cada soca y lo que cuesta renovar.",
                <>
                  Tres se separan. {sinCorte(v1.CLONE)} deja {num(v1.ganancia_vs_testigos, 0)} dólares más que el testigo promedio. Al
                  remuestrear los ensayos mil veces, el rango va de {num(v1.ganancia_p05, 0)} a {num(v1.ganancia_p95, 0)}.
                  {top3GanaSiempre ? " Las tres le ganan al testigo en todas las réplicas." : ""}
                </>,
                "Y un dato para presupuesto: el precio cambia cuánto se gana, no cuál elegir.",
              ]}
              preguntas={[
                ["Certeza", <>Bootstrap de {num(s1q1.bootstrap.replicas, 0)} réplicas que remuestrean ensayos completos, con intervalo de 90&nbsp;%.</>],
                ["Por hectárea", <>Unos {usd(v1.ganancia_vs_testigos * ACRES_POR_HA, 0)} por hectárea al año ({num(v1.ganancia_vs_testigos, 0)} × 2.471).</>],
                ["Cuántas variedades", <>{s1q1.n_variedades_etapa5} en etapa 5 y {s1q1.n_elegibles} con evidencia suficiente para recomendar.</>],
                ["Costo de corte", <>No cambia el ranking. La correlación entre el orden por azúcar y por margen es {/* fuente: bitácora H1 */}0.98.</>],
                ["Por qué no L14-267", <>Su intervalo ({num(l14?.ganancia_p05, 0)}-{num(l14?.ganancia_p95, 0)}) se traslapa con el de L15-306 ({num(l15?.ganancia_p05, 0)}-{num(l15?.ganancia_p95, 0)}). Es la alternativa si L15-306 no confirma en socas 3 y 4.</>],
              ]}
            />
          }
        >
          <Titulo
            bajada={
              mismoTop3 ? (
                <>
                  Al año, contra el testigo promedio. Las mismas tres encabezan con cualquier precio entre{" "}
                  {usd(Math.min(...preciosSensibilidad), 2)} y {num(Math.max(...preciosSensibilidad), 2)}/lb.
                </>
              ) : (
                "Al año, contra el testigo promedio."
              )
            }
          >
            Tres variedades dejan {usd(gananciaMin, 0)}-{num(gananciaMax, 0)} más por acre
          </Titulo>
          <div className={`${s.cuerpo} ${s.graficaYCifras}`}>
            <GraficaD
              titulo={<>Ganancia contra el testigo: las {filasGanancia.length} primeras de {variedades.length} variedades</>}
              nota="Punto: estimación. Línea: intervalo de 90&nbsp;% al remuestrear ensayos completos."
            >
              <GraficoGanancia filas={filasGanancia} />
            </GraficaD>
            <div className={s.cifrasColumna}>
              <CifraD
                valor={`+${num(v1.ganancia_vs_testigos, 0)}`}
                unidad="US$/acre/año"
                titulo={<>{sinCorte(v1.CLONE)} contra el testigo</>}
                detalle={<>Intervalo de 90&nbsp;%: {num(v1.ganancia_p05, 0)} a {num(v1.ganancia_p95, 0)}</>}
              />
              <CifraD
                valor={cicloTop3 ? ciclo : "—"}
                unidad="cortes"
                titulo={<>Cada cuánto renovar: plantía y {ciclo - 1} socas</>}
                detalle="El ciclo que deja más margen en las tres"
              />
              <CifraD
                valor={`${usd(equilibrioMin, 2)}-${num(equilibrioMax, 2)}`}
                unidad="/lb"
                titulo="Precio bajo el cual ninguna cubre costos"
                detalle="El precio cambia cuánto se gana, no cuál elegir"
              />
            </div>
          </div>
          <Pie fuente="notebook 02 · serie1_recomendacion.json y serie1_sensibilidad_precio.json" detalle="/campo#variedades" tema="variedades y renovación" />
        </Diapositiva>

        {/* ═══ 4 · Campo, pronóstico ═══ */}
        <Diapositiva
          capitulo="campo"
          tiempo="1:15"
          notas={
            <Notas
              decir={[
                "La segunda pregunta era cuánto azúcar esperar por finca. El modelo tiene dos piezas: el nivel de la finca, que sale de su historia, y la ventaja de la variedad, que sale de lo que acabo de mostrar.",
                <>
                  Lo validé como se usaría: entreno con las zafras pasadas y predigo la siguiente. Erra {num(errorModelo, 0)}&nbsp;%
                  por parcela, contra {num(errorHistorico, 0)}&nbsp;% del promedio histórico. Parece poco, pero el promedio le da el
                  mismo número a todas las variedades, y el modelo las ordena.
                </>,
                <>
                  La gráfica explica el resto: hay años en que todo el programa cae {num(Math.abs(zafraPeor.sesgo), 0)}&nbsp;%, como{" "}
                  {zafraPeor.zafra}. Eso es clima y manejo, y los datos no traen esas columnas. Por eso recomiendo presupuestar
                  con banda.
                </>,
              ]}
              preguntas={[
                ["Random Forest y XGBoost", <>Empatan en error total (MAE de {num(e1["Random Forest"].MAE, 0)} y {num(e1.XGBoost.MAE, 0)} contra {num(e1.Ridge.MAE, 0)} lb/acre). El Ridge ordena mejor (ρ {num(e1.Ridge.orden_spearman, 2)} contra {num(e1["Random Forest"].orden_spearman, 2)} y {num(e1.XGBoost.orden_spearman, 2)}) y se explica con 3 coeficientes.</>],
                ["Decisión difícil", <>Una regresión con todas las variables perdió contra una regla sin aprendizaje ({/* fuente: README, "Una decisión difícil" */}1,566 contra {num(e1["Regla P1"].MAE, 0)} lb/acre). La constante aprendía la suerte de 2011 y 2012.</>],
                ["Cobertura de la banda", <>Reporto el {pctF(coberturaBanda, 0)}, no el 80&nbsp;% nominal: las zafras recientes fueron más variables.</>],
                ["Fuga de información", "No uso nada medido en la misma cosecha (TCA, TRS, población)."],
                ["Finca sin historia", <>{num(errorFincaNueva, 0)}&nbsp;% de error. Se reemplaza en cuanto la finca tiene su primera cosecha.</>],
              ]}
            />
          }
        >
          <Titulo>El {pctF(s1p2.parte_error_nivel, 0)} del error es clima y manejo del año</Titulo>
          <div className={`${s.cuerpo} ${s.graficaYCifras}`}>
            <GraficaD
              titulo="Real contra lo planificado, promedio de cada zafra"
              nota={<>En color, los años con más de 10 % de diferencia: {zafraPeor.zafra} quedó en {conSigno(zafraPeor.sesgo, 0)}&nbsp;% y {zafraMejor.zafra} en {conSigno(zafraMejor.sesgo, 0)}&nbsp;%. Todas las variedades suben o bajan juntas.</>}
            >
              <GraficoZafras filas={filasZafras} />
            </GraficaD>
            <div className={s.cifrasColumna}>
              <CifraD
                valor={`${num(errorModelo, 0)}\u00a0%`}
                titulo="Error típico por parcela"
                detalle={<>El promedio histórico erra {num(errorHistorico, 0)}&nbsp;% y da la misma cifra a todas las variedades</>}
              />
              <CifraD
                valor={`${conSigno(bandaBaja, 0)}\u00a0% / ${conSigno(bandaAlta, 0)}\u00a0%`}
                titulo="Banda para presupuestar"
                detalle={<>Cubrió el {pctF(coberturaBanda, 0)} de los casos reales</>}
              />
              <CifraD
                valor={num(ordenLote, 2)}
                titulo="Qué tan bien ordena las variedades de un lote"
                detalle={<>{num(ordenSocas, 2)} en socas. 1 es el orden perfecto; 0, el azar.</>}
              />
            </div>
          </div>
          <Pie fuente="notebook 03 · serie1_resumen_p2.json y serie1_modelo_p2.json" detalle="/campo#pronostico" tema="pronóstico de azúcar por finca" />
        </Diapositiva>

        {/* ═══ 5 · Campo, datos propios ═══ */}
        <Diapositiva
          capitulo="campo"
          tiempo="1:00"
          notas={
            <Notas
              decir={[
                "¿Cómo se pasa de Louisiana al ingenio? No hay que esperar años de ensayos. Con los registros de cosecha que ya existen se puede auditar cada lote.",
                "La auditoría encuentra los cuatro casos que ven aquí: lotes que se renuevan a tiempo, antes de tiempo, tarde o nunca. Renovar antes paga una siembra que no se recupera. Renovar tarde sigue cortando socas que ya no pagan.",
                <>
                  Lo probé con {num(auditoria.lotes, 0)} lotes simulados y una base PostgreSQL: clasificó bien{" "}
                  {num(auditoria.cerrados_bien, 0)} de {num(auditoria.cerrados, 0)} ciclos. La condición es registrar el número
                  de corte; sin él, se pierde una de cada cuatro renovaciones. Para elegir variedad por zona sí hacen falta
                  ensayos.
                </>,
              ]}
              preguntas={[
                ["Fincas o repeticiones", <>Con las mismas parcelas extra, sumar fincas sube la potencia {/* fuente: README, Serie I */}2.6 veces más (+5.9 contra +2.3 puntos).</>],
                ["Qué ventaja detecta un ensayo", <>Una de 10&nbsp;% pide de {tamanos6("1")["ventaja 10%"]} a {tamanos6("2")["ventaja 10%"]} fincas con 6 años de cosecha. Una de 5&nbsp;% no se separa del ruido con ningún tamaño.</>],
                ["Distancia", <>El testigo deja de cubrir costos con unos {usd(equilibrioDistancia["Testigo promedio"], 1)}/t de cosecha y transporte; las recomendadas, entre {usd(Math.min(...distRecomendadas), 1)} y {num(Math.max(...distRecomendadas), 1)}/t.</>],
              ]}
            />
          }
        >
          <Titulo bajada="Cuatro lotes tipo en 12 zafras: cada casilla es el número de corte de ese año.">
            Auditar renovaciones desde la primera zafra
          </Titulo>
          <div className={s.cuerpo}>
            <Renovaciones casos={casosRenovacion} optimo={s1p4.optimo} />
          </div>
          <div className={s.cifrasFila}>
            <CifraD
              valor={`${num(auditoria.cerrados_bien, 0)} de ${num(auditoria.cerrados, 0)}`}
              titulo="ciclos bien clasificados"
              detalle={<>{num(auditoria.lotes, 0)} lotes simulados, leídos desde PostgreSQL</>}
            />
            <CifraD
              valor={pctF(auditoria.perdidas_sin_corte, 0)}
              titulo="de las renovaciones se pierden sin el número de corte"
            />
            <CifraD
              valor={/* fuente: notebook 05, celda 23 */ "20"}
              unidad="fincas"
              titulo="por cohorte de ensayos, 5 por estrato"
              detalle="Para elegir variedad por zona"
            />
          </div>
          <Pie fuente="notebook 05 · sql/esquema_campo.sql · serie1_resumen_p4.json" detalle="/campo#datos-propios" tema="decidir con datos propios" />
        </Diapositiva>

        {/* ═══ 6 · Campo, evaluación ═══ */}
        <Diapositiva
          capitulo="campo"
          tiempo="0:50"
          notas={
            <Notas
              decir={[
                <>
                  Resumo el campo. Recomiendo ampliar {sinCorte(v1.CLONE)} y llevar las otras dos a validación, porque solo tienen datos
                  hasta la segunda soca. Renovar cada {ciclo} cortes y presupuestar con banda.
                </>,
                <>
                  Para dimensionarlo: cada mil acres con {sinCorte(v1.CLONE)} en lugar del testigo valen unos{" "}
                  {num(v1.ganancia_vs_testigos, 0)} mil dólares al año. Pero es una cifra de Louisiana: para el ingenio, esto
                  es un protocolo, no una lista de compra.
                </>,
                "Mi certeza es alta en las dos primeras. Es media en la tercera y en la cifra de cada lote. Lo que se puede hacer ya, sin inversión, es la auditoría de renovaciones.",
              ]}
              preguntas={[
                ["Grupos de variedades (pregunta 3)", <>No hay grupos naturales. {s1p3.k} perfiles se reproducen al remuestrear (ARI {num(ari5, 2)}) y explican el {pctF(s1p3.eta2, 0)} de la ganancia. Las tres recomendadas están en «{perfilTop.grupo}» (anexo A1).</>],
                ["Variedad nueva (escenario 3)", "Quedó diseñada en el README, no desarrollada: misma estructura de dos piezas, con la ventaja de etapas 3-4 corregida por inflación y validada por cohortes."],
                ["Cuánto vale para el ingenio", "Todavía no lo sé con sus datos. La auditoría de renovaciones lo dice en la primera zafra, sin inversión."],
              ]}
            />
          }
        >
          <Titulo>Ampliar {sinCorte(v1.CLONE)} y renovar cada {ciclo} cortes</Titulo>
          <EvaluacionD
            decision={
              <p>
                Ampliar <strong>{sinCorte(v1.CLONE)}</strong> y validar {sinCorte(v2.CLONE)} y {sinCorte(v3.CLONE)} hasta la soca 4. Renovar cada {ciclo}{" "}
                cortes. Auditar renovaciones desde la primera zafra.
              </p>
            }
            impacto={
              <>
                <p>
                  {usd(v1.ganancia_vs_testigos, 0)} mil al año por cada 1,000 acres con {sinCorte(v1.CLONE)} (intervalo de 90&nbsp;%:{" "}
                  {num(v1.ganancia_p05, 0)} mil a {num(v1.ganancia_p95, 0)} mil).
                </p>
                <p>Es ilustrativo: son cifras de Louisiana.</p>
              </>
            }
            riesgos={
              <p>
                Datos de Louisiana. {sinCorte(v2.CLONE)} y {sinCorte(v3.CLONE)} solo tienen medición hasta la soca {Math.max(v2.ultimo_corte_medido, v3.ultimo_corte_medido)}.
                Un mal año deja el programa {num(Math.abs(zafraPeor.sesgo), 0)}&nbsp;% abajo.
              </p>
            }
            certeza={[
              { nivel: "alta", texto: <>{sinCorte(v1.CLONE)} y {sinCorte(v2.CLONE)}: entre las 3 primeras en ≥ {pctF(Math.floor(Math.min(v1.P_top3, v2.P_top3) * 100) / 100, 0)} de las réplicas</> },
              { nivel: "media", texto: <>{sinCorte(v3.CLONE)} ({pctF(v3.P_top3, 0)}) y la cifra de cada lote</> },
            ]}
          />
          <Pie fuente="notebooks 02 a 05, evaluación gerencial" detalle="/campo" tema="el caso del campo" />
        </Diapositiva>

        {/* ═══ 7 · Caldera, sensor virtual ═══ */}
        <Diapositiva
          capitulo="caldera"
          tiempo="1:15"
          notas={
            <Notas
              decir={[
                "Paso a la caldera. La pregunta era si se puede estimar el flujo de vapor con los demás sensores.",
                <>
                  Encontré que la caldera ya trae un segundo medidor sin saberlo: la caída de presión entre el domo y el
                  colector se comporta como una placa de orificio. Con esa sola variable, el error es de medio por ciento. Con
                  todas las variables baja a {num(vaporFinal["MAPE_%"], 2)}&nbsp;%, unas {num(vaporFinal.MAE_t_h, 2)} toneladas por
                  hora.
                </>,
                "La gráfica es un día que el modelo no vio. Un modelo de árboles quedó peor, así que me quedo con el lineal. ¿Para qué sirve? Si el medidor se desvía, la diferencia lo delata.",
              ]}
              preguntas={[
                ["Validación al azar", <>Al azar, el gradient boosting casi empataba ({num(alAzar["Gradient boosting"]["MAE al azar"], 2)} contra {num(alAzar["Ridge completo"]["MAE al azar"], 2)} t/h). Hacia adelante quedó en {num(metricasVapor["Gradient boosting"].MAE_t_h, 2)} contra {num(vaporFinal.MAE_t_h, 2)}.</>],
                ["Rango de validez", <>Carga de {num(vaporMin, 1)} a {num(vaporMax, 1)} t/h. Arranques y carga mínima no están en los datos.</>],
                ["Banda", <>La de 90 % cubrió el {num(s2p3.banda["Ridge completo"]["cobertura (meta 90 %)"], 0)}&nbsp;%.</>],
                ["Calderas de bagazo", "Primero hay que confirmar que existen las dos presiones."],
              ]}
            />
          }
        >
          <Titulo>La caldera ya tenía un segundo medidor</Titulo>
          <div className={`${s.cuerpo} ${s.graficaYCifras}`}>
            <GraficaD
              titulo={<>Vapor medido y estimado, minuto a minuto, el {fechaCorta(diaVapor)}</>}
              nota="Un día que el modelo no vio. El vapor crece con √(ΔP·ρ): la ecuación de un medidor de flujo."
            >
              <GraficoVapor puntos={puntosVapor} dia={fechaCorta(diaVapor)} />
            </GraficaD>
            <div className={s.cifrasColumna}>
              <CifraD
                valor={`${num(vaporFinal["MAPE_%"], 2)}\u00a0%`}
                titulo="Error del sensor virtual"
                detalle={<>{num(vaporFinal.MAE_t_h, 2)} t/h · R² {num(vaporFinal.R2, 2)} · validado día por día</>}
              />
              <CifraD
                valor={`${num(metricasVapor["Hidráulico √(ΔP·ρ)"]["MAPE_%"], 2)}\u00a0%`}
                titulo="Solo con la caída de presión domo-colector"
                detalle="Una variable, la física de un medidor de flujo"
              />
              <CifraD
                valor={`${num(metricasVapor["Ridge de combustión"]["MAPE_%"], 1)}\u00a0%`}
                titulo="Respaldo si fallan las presiones"
                detalle="Con aire, tiro y temperatura del hogar"
              />
            </div>
          </div>
          <Pie fuente="notebook 08 · serie2_resumen_p3.json y serie2_predicciones_p3.json" detalle="/caldera#vapor" tema="sensor virtual del vapor" />
        </Diapositiva>

        {/* ═══ 8 · Caldera, fallas y alarmas ═══ */}
        <Diapositiva
          capitulo="caldera"
          tiempo="1:00"
          notas={
            <Notas
              decir={[
                "La cuarta pregunta era cómo detectar fallas a tiempo. Propongo tres capas, y cada una le avisa a una persona distinta.",
                "Las reglas físicas, como oxígeno bajo o vapor frío, van a operación. La verificación compara cada sensor con sus pares redundantes y va a instrumentación. El monitor de proceso aprende lo normal del último día y va al jefe de calderas.",
                <>
                  El criterio es físico: un sensor dañado se separa de sus pares, mientras que una falla real mueve variables
                  acopladas y los pares siguen de acuerdo. Inyecté {inyecciones.length} fallas, y las {aciertos} quedaron bien
                  clasificadas. Son unas {num(alarmasDia, 0)} alarmas al día.
                </>,
              ]}
              preguntas={[
                ["Fallas reales", "No las hay. Son sintéticas porque en 5 días no hubo fallas, y los umbrales se calibraron con los mismos datos: las alarmas por día salen en parte por construcción."],
                ["Chequeo de gases", <>Solo ve derivas de ~{num(fallaGases, 0)} °C. Un modelo de la temperatura de gases lo afinaría.</>],
                ["Monitor en la API", "No está, porque necesita 24 h de historia y se reentrena cada hora. Iría como servicio programado que lee el historiador de la planta."],
              ]}
            />
          }
        >
          <Titulo>Cada alarma dice qué revisar: sensor o equipo</Titulo>
          <div className={`${s.cuerpo} ${s.dosColumnas}`}>
            <div className={s.columnaFlex}>
              <ul className={s.capas}>
                <li className={s.capa}>
                  <div>
                    <h3>Reglas físicas</h3>
                    <p>{nReglas} reglas: O₂ bajo o alto, vapor frío o caliente, lecho alto, hogar presurizado y tiro alto.</p>
                  </div>
                  <p className={s.capaAvisa}>Avisa a<strong>Operación</strong></p>
                </li>
                <li className={s.capa}>
                  <div>
                    <h3>Verificación de sensores</h3>
                    <p>{nChequeos} chequeos: cada sensor contra sus pares redundantes.</p>
                  </div>
                  <p className={s.capaAvisa}>Avisa a<strong>Instrumentación</strong></p>
                </li>
                <li className={s.capa}>
                  <div>
                    <h3>Monitor de proceso</h3>
                    <p>Aprende lo normal del último día y señala las variables que se salen.</p>
                  </div>
                  <p className={s.capaAvisa}>Avisa al<strong>Jefe de calderas</strong></p>
                </li>
              </ul>
              <p className={s.alarmas}>
                Unas <strong>{num(alarmasDia, 0)} alarmas por día</strong>: {num(alarmasReglas, 1)} de reglas,{" "}
                {num(s2p4.verificacion_episodios_dia, 0)} de verificación y {num(s2p4.monitor_episodios_dia, 1)} del monitor.
                El chequeo del vapor detecta un desvío desde <strong>{num(fallaVapor, 1)} t/h</strong>.
              </p>
            </div>
            <div className={s.columnaFlex}>
              <CifraD valor={`${aciertos} de ${inyecciones.length}`} titulo="fallas inyectadas bien clasificadas como sensor o proceso" />
              <table className={`${s.tabla} ${s.tablaGrande}`} style={{ marginTop: "1.6cqw" }}>
                <thead>
                  <tr>
                    <th scope="col">Falla inyectada</th>
                    <th scope="col">Era</th>
                    <th scope="col">Diagnóstico</th>
                    <th scope="col" className={s.der}>Alarma</th>
                  </tr>
                </thead>
                <tbody>
                  {filasFallas.map((f) => (
                    <tr key={f.escenario}>
                      <td>{f.escenario}</td>
                      <td>{f.era}</td>
                      <td>{f.diagnostico}</td>
                      <td className={s.der}>{f.alarma}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <Pie fuente="notebook 09, parte A · serie2_resumen_p4.json" detalle="/caldera#anomalias" tema="fallas y alarmas de la caldera" />
        </Diapositiva>

        {/* ═══ 9 · Caldera, evaluación ═══ */}
        <Diapositiva
          capitulo="caldera"
          tiempo="0:50"
          notas={
            <Notas
              decir={[
                "La caldera ya tiene lo necesario para vigilarse mejor; no hace falta comprar sensores para empezar. Recomiendo poner en línea el sensor virtual y activar las alarmas con confirmación del operador.",
                <>
                  La oportunidad de eficiencia más clara está en los tubos: la temperatura de gases sube unos{" "}
                  {num(gases["°C por día"], 0)} grados por día a igual operación, y eso es compatible con ensuciamiento. Si lo
                  es, limpiar a tiempo vale entre {num(limpiezaBaja.puntos_eficiencia, 1)} y{" "}
                  {num(limpiezaAlta.puntos_eficiencia, 1)} puntos de eficiencia, unos {num(limpiezaBaja.us_ano / 1000, 0)} a{" "}
                  {num(limpiezaAlta.us_ano / 1000, 0)} mil dólares al año.
                </>,
                "Esa cifra depende de supuestos, y por eso mi certeza ahí es baja. En el ingenio, lo primero es confirmar que existen las dos presiones.",
              ]}
              preguntas={[
                ["Datos (pregunta 1)", <>El segundo archivo inventa {s2p1.celdas_distintas_autoreg} valores. Un diferencial copia la presión del hogar (r {num(s2p1.r_sxltcyz_pt8313a, 2)}). {s2p1.sensores_cada_10s.length} sensores, incluido el vapor, se actualizan cada 10 s.</>],
                ["Modos (pregunta 2)", <>La carga manda. Hay {s2p2.k} zonas de carga y un ciclo del lecho, que se llena en ~{num(llenadoH, 1)} h y se descarga en ~{num(descargaH, 1)} h (anexo A3).</>],
                ["Supuestos del valor en dinero", <>PCI de {supuestos.pci_mj_kg} MJ/kg, eficiencia de {pctF(supuestos.eficiencia, 0)}, {usd(supuestos.precio_combustible_t, 0)}/t de combustible y {num(supuestos.horas_ano, 0)} h al año.</>],
                ["Exceso de aire", <>Ya está bajo; ahorra ~{num(excesoAire, 2)} puntos.</>],
              ]}
            />
          }
        >
          <Titulo>Sensor virtual en línea y limpiar por gases</Titulo>
          <EvaluacionD
            decision={
              <p>
                Poner en línea el <strong>sensor virtual</strong> y su chequeo contra el medidor. Activar reglas y verificación
                con confirmación del operador. Limpiar por temperatura de gases, no por calendario.
              </p>
            }
            impacto={
              <p>
                Si es ensuciamiento, limpiar a tiempo vale {num(limpiezaBaja.puntos_eficiencia, 1)}-
                {num(limpiezaAlta.puntos_eficiencia, 1)} puntos de eficiencia: unos US${num(limpiezaBaja.us_ano / 1000, 0)}-
                {num(limpiezaAlta.us_ano / 1000, 0)} mil al año, con supuestos declarados.
              </p>
            }
            riesgos={
              <p>
                Cinco días sin arranques ni paros. Fallas de prueba sintéticas. Caldera a carbón. Sin datos de combustible ni
                CO, la eficiencia solo se mide en relativo.
              </p>
            }
            certeza={[
              { nivel: "alta", texto: <>El sensor virtual y el criterio sensor o equipo ({aciertos} de {inyecciones.length})</> },
              { nivel: "baja", texto: "El valor en dinero: depende de supuestos" },
            ]}
          />
          <Pie fuente="notebooks 06 a 09, evaluación gerencial · serie2_resumen_p5.json" detalle="/caldera#cierre" tema="recomendaciones de la caldera" />
        </Diapositiva>

        {/* ═══ 10 · Mercado, precio y pronóstico ═══ */}
        <Diapositiva
          capitulo="mercado"
          tiempo="1:00"
          notas={
            <Notas
              decir={[
                <>
                  En el mercado, la pregunta era qué esperar del precio del azúcar. Es un precio muy movido, cerca de{" "}
                  {pctF(s3p2.ajustado.vol, 0)} al año. En 2020 cayó {num(Math.abs(covid), 0)}&nbsp;% en dos meses y en el
                  resto del año subió {num(rebote, 0)}&nbsp;%.
                </>,
                <>
                  Probé tres modelos para pronosticar a uno y tres meses, mes a mes desde {MESES[mesInicio - 1]} de {anioInicio}.
                  Ninguno le ganó a repetir el último cierre: el mercado ya incorpora lo que se sabe.
                </>,
                <>
                  Lo que sí se mide bien es el rango. Con la volatilidad de mayo de 2024, la banda de 80&nbsp;% iba de {banda1.replace(" / ", " a ")} a un mes
                  {juniodentro ? ", y junio cayó adentro" : ""}. Cada centavo por libra son unos {num(usdPorCentavo, 0)} dólares
                  por tonelada.
                </>,
              ]}
              preguntas={[
                ["Calidad de la serie", <>Es real, pero pega contratos: corregí {s3p2.dias_cambio} saltos de contrato. Los promedios anuales coinciden con el FMI {/* fuente: README, Serie III */}(−1&nbsp;% a +3&nbsp;%) y el Banco Mundial (0&nbsp;% a +4&nbsp;%).</>],
                ["Regímenes", <>El mercado pasa el {num(turbulencia["% de las semanas"], 0)}&nbsp;% de las semanas en turbulencia, con {num(turbulencia["volatilidad semanal (%)"], 1)}&nbsp;% semanal contra {num(calma["volatilidad semanal (%)"], 1)}&nbsp;% en calma.</>],
                ["Extremos", <>Los días de más de 4 desviaciones son {num(s3p2.colas["|z| > 4"]["veces más (desviación estándar)"], 0)} veces más frecuentes que en una normal.</>],
                ["Ciclos para elegir cuándo vender", <>El precio dio {s3p2.fases_20} giros de 20&nbsp;%; uno al azar da entre {s3p2.fases_paseo[1]} y {s3p2.fases_paseo[2]}. No hay patrón.</>],
              ]}
            />
          }
        >
          <Titulo>El precio no se adivina, pero su rango sí</Titulo>
          <div className={`${s.cuerpo} ${s.graficaYCifras}`}>
            <GraficaD
              titulo="Azúcar No. 11, promedio mensual en ¢/lb, y el pronóstico vigente"
              nota={<>Barra llena: banda de 80&nbsp;%; clara: 95&nbsp;%. Raya blanca: último cierre, el {fechaCorta(cierre.fecha)}. ×: promedio de junio hasta el {fechaCorta(s3p2.auditoria.hasta)}.</>}
            >
              <GraficoPrecio historia={historiaPrecio} cierre={cierre} bandas={vigente} realParcial={realJunio} />
            </GraficaD>
            <div className={s.cifrasColumna}>
              <CifraD
                valor={`~${num(errorMes1, 0)}\u00a0%`}
                titulo="Error a 1 mes con el último cierre"
                detalle={<>{num(errorMes3, 0)}&nbsp;% a 3 meses. El ARIMA erró {num(arimaPeor, 0)}&nbsp;% más.</>}
              />
              <CifraD valor={banda1} titulo="Banda de 80&nbsp;% a 1 mes" detalle={<>{banda3} a 3 meses</>} />
              <CifraD
                valor={`${num(cobertura1, 0)}\u00a0% y ${num(cobertura3, 0)}\u00a0%`}
                titulo="de los meses cayeron dentro de la banda"
                detalle={<>A 1 y a 3 meses, mes a mes desde {MESES[mesInicio - 1]} de {anioInicio}</>}
              />
            </div>
          </div>
          <Pie fuente="notebooks 11 y 12 · serie3_resumen_p3.json, serie3_pronostico.json y serie3_pronosticos_h1.json" detalle="/mercado#pronostico" tema="pronóstico del precio" />
        </Diapositiva>

        {/* ═══ 11 · Mercado, oferta ═══ */}
        <Diapositiva
          capitulo="mercado"
          tiempo="0:45"
          notas={
            <Notas
              decir={[
                <>
                  La última pregunta del mercado era si la oferta mundial responde al precio. Sí, pero poco y tarde. Con{" "}
                  {s3p4.paises} países, un alza de 10 % en el precio se asocia con cerca de {num(elasticidad * 10, 1)}&nbsp;% más
                  área dos o tres años después.
                </>,
                "La relación se sostiene al controlar la inercia, al quitar cualquier año y al usar solo datos oficiales. Pero hay unos 20 años de precio, y al barajarlos la evidencia queda en el borde.",
                "La lección no es un pronóstico: cuando la caña sembrada por un precio alto se cosecha, la respuesta de los competidores ya llegó. Por eso no recomiendo expandir área por un pico.",
              ]}
              preguntas={[
                ["Versión ponderada por tamaño", <>Da ~{num(ponderado.suma, 2)} con p = {num(ponderado.p_una_cola, 2)}, pero es exploratoria y depende casi toda de Brasil y la India.</>],
                ["Instrumento", <>El rendimiento anual es débil (F = {num(s3p4.primera_etapa_F, 1)}).</>],
                ["Sentido de la relación", "Va en los dos sentidos: más producción baja el precio."],
              ]}
            />
          }
        >
          <Titulo bajada="No expandir área por un precio alto de hoy.">La oferta mundial responde poco y tarde</Titulo>
          <div className={`${s.cuerpo} ${s.graficaYCifras}`}>
            <GraficaD
              titulo={<>Respuesta del área de {s3p4.paises} países al precio, según cuántos años antes cambió</>}
              nota="En azul, los rezagos de 2 y 3 años. En gris claro, los placebos: el precio de después no puede mover el área de antes."
            >
              <GraficoRezagos
                filas={filasRezagos}
                etiqueta={`Elasticidad del área por rezago del precio. Los rezagos de 2 y 3 años son positivos (${num(s3p4.perfil.dla.coef.dlp2, 3)} y ${num(s3p4.perfil.dla.coef.dlp3, 3)}); el precio del año siguiente, un placebo, sale negativo.`}
              />
            </GraficaD>
            <div className={s.cifrasColumna}>
              <CifraD
                valor={num(elasticidad, 2)}
                titulo="Elasticidad acumulada del área"
                detalle={<>Un alza de 10 % en el precio, ~{num(elasticidad * 10, 1)}&nbsp;% más área</>}
              />
              <CifraD valor={/* fuente: README, Serie III, pregunta 4 */ "2-3"} unidad="años" titulo="de rezago entre el precio y el área" />
              <CifraD
                valor={`p = ${num(Math.min(...pPermutacion), 2)}-${num(Math.max(...pPermutacion), 2)}`}
                titulo="al barajar los años del precio"
                detalle="Evidencia causal débil"
              />
            </div>
          </div>
          <Pie fuente="notebook 13 · serie3_resumen_p4.json" detalle="/mercado#oferta" tema="respuesta de la oferta" />
        </Diapositiva>

        {/* ═══ 12 · Mercado, evaluación ═══ */}
        <Diapositiva
          capitulo="mercado"
          tiempo="0:50"
          notas={
            <Notas
              decir={[
                "Mi recomendación para el mercado es gestionar el riesgo, no adivinar el precio. Presupuesten con el precio de hoy y una banda que se ajusta a la volatilidad, y fijen más volumen cuando la banda se ensancha.",
                <>
                  Para dimensionarlo: {num(TONELADAS, 0)} toneladas a tres meses valen entre {num(ingreso(bandaMes3.p10), 1)} y{" "}
                  {num(ingreso(bandaMes3.p90), 1)} millones de dólares, con 80&nbsp;% de probabilidad. Esa diferencia de{" "}
                  {num(ingreso(bandaMes3.p90) - ingreso(bandaMes3.p10), 1)} millones es el riesgo que hay que cubrir.
                </>,
                <>
                  Sobre Guatemala: es uno de {enCuadrante.length} países de {s3p1.paises_panel} que crecieron a la vez en área y
                  en rendimiento. Sus datos recientes en FAOSTAT son imputados; recomiendo usar los de la gremial.
                </>,
              ]}
              preguntas={[
                ["Pares de Guatemala", <>{enLista(pares)} (anexo A5).</>],
                ["Datos de FAOSTAT", <>La producción de 2014-2016 está inflada y el área de 2019-2023 es imputada. El USDA reporta {/* fuente: notebook 10, evaluación gerencial */}12-15&nbsp;% más área.</>],
                ["Vigencia del pronóstico", <>Usa el cierre del {fechaCorta(s3Pronostico.fecha_origen)}. Para actualizarlo hay que volver a correr el notebook 12.</>],
              ]}
            />
          }
        >
          <Titulo>Presupuestar con rango, no con un número</Titulo>
          <EvaluacionD
            decision={
              <p>
                Presupuestar con el <strong>último cierre y una banda</strong> según la volatilidad. Fijar más volumen cuando
                la banda se ensancha. No expandir área por un pico. Vigilar la zafra de Brasil.
              </p>
            }
            impacto={
              <p>
                {num(TONELADAS, 0)} t a 3 meses, banda de 80&nbsp;%: de {usd(ingreso(bandaMes3.p10), 2)} a{" "}
                {num(ingreso(bandaMes3.p90), 2)} millones. Esa diferencia es el riesgo que hay que cubrir.
              </p>
            }
            riesgos={
              <p>
                Eventos fuera de la muestra. Pocos años de precio para medir la oferta. FAOSTAT de Guatemala con años inflados
                e imputados.
              </p>
            }
            certeza={[
              { nivel: "alta", texto: <>Nada le gana al último cierre ({mesesPrueba} meses)</> },
              { nivel: "media", texto: "La banda a 3 meses" },
              { nivel: "baja", etiqueta: "Certeza media-baja", texto: "Que el precio cause la respuesta de la oferta" },
            ]}
          />
          <Pie fuente="notebooks 10 a 13, evaluación gerencial · docs/api.md, GET /mercado/pronostico" detalle="/mercado#cierre" tema="recomendaciones del mercado" />
        </Diapositiva>

        {/* ═══ 13 · Del notebook a la consulta ═══ */}
        <Diapositiva
          capitulo="produccion"
          tiempo="1:00"
          notas={
            <Notas
              decir={[
                "Hasta aquí, el análisis. Pero un análisis que vive en un notebook depende de que yo lo corra, y por eso lo llevé a producción.",
                <>
                  Cada notebook guarda su modelo en un archivo que se lee en cualquier editor. Una API lo publica en Google
                  Cloud con {CONSULTAS_API} consultas que cualquier sistema puede llamar, desde una hoja de cálculo hasta el
                  sistema de planta.
                </>,
                <>
                  Antes de publicar, {PRUEBAS} pruebas comprueban que responde lo mismo que los notebooks; por ejemplo, repite
                  las {PREDICCIONES_2022} predicciones de 2022. No cuesta si nadie la usa. Y esta presentación lee los mismos
                  archivos: casi todas sus cifras salen de ahí.
                </>,
              ]}
              preguntas={[
                ["Cómo se actualiza", "Se vuelve a correr el notebook, que guarda el JSON nuevo. Las pruebas verifican antes de desplegar."],
                ["Costo", "Escala a cero, con un tope de 2 instancias. El sitio está en el plan gratuito de Vercel; el asistente cobra por pregunta y la cuota lo acota."],
                ["Seguridad, MLflow y pendientes", "Ver el anexo A7."],
              ]}
            />
          }
        >
          <Titulo>Las cifras se consultan sin abrir un notebook</Titulo>
          <ol className={`${s.cuerpo} ${s.flujo}`} aria-label="Del dato a la consulta, en cinco pasos">
            <li className={s.paso}>
              <p className={s.pasoNombre}>Datos públicos</p>
              <p className={s.pasoGerencia}>Auditados: cada archivo traía una trampa.</p>
              <p className={s.pasoTecnica}>No se versionan ni entran a la API.</p>
            </li>
            <li className={s.paso}>
              <p className={s.pasoNombre}>{NOTEBOOKS} notebooks</p>
              <p className={s.pasoGerencia}>Cada pregunta, validada como se usaría.</p>
              <p className={s.pasoTecnica}>Python, pandas, scikit-learn, statsmodels y PostgreSQL 16.</p>
            </li>
            <li className={s.paso}>
              <p className={s.pasoNombre}>Modelos en archivos</p>
              <p className={s.pasoGerencia}>Se leen en cualquier editor: sin cajas negras.</p>
              <p className={s.pasoTecnica}>JSON, sin pickles.</p>
            </li>
            <li className={s.paso}>
              <p className={s.pasoNombre}>API, {CONSULTAS_API} consultas</p>
              <p className={s.pasoGerencia}>{PRUEBAS} pruebas comprueban que repite las cifras.</p>
              <p className={s.pasoTecnica}>FastAPI, Docker y Google Cloud Run.</p>
            </li>
            <li className={s.paso}>
              <p className={s.pasoNombre}>Quién la usa</p>
              <p className={s.pasoGerencia}>Herramientas, asistente, una hoja de cálculo o el sistema de planta.</p>
              {/* fuente: README, Lenguaje natural ("9 herramientas") */}
              <p className={s.pasoTecnica}>Next.js en Vercel; Gemini en Vertex AI con 9 herramientas de la API.</p>
            </li>
          </ol>
          <div className={s.produccionPie}>
            <EstadoApiD />
            <CifraD
              tono="tinta"
              grande
              valor={num(PREDICCIONES_2022, 0)}
              titulo="predicciones de 2022 que la API repite"
              detalle={<>con diferencia ≤ {num(DIFERENCIA_2022, 1)} lb/acre contra el notebook 03</>}
            />
          </div>
          <Pie fuente="README, Calidad y verificación · outputs/tests/pytest_docker.txt" detalle="/api#como-funciona" tema="cómo funciona la API" />
        </Diapositiva>

        {/* ═══ 14 · Demostración ═══ */}
        <Diapositiva
          capitulo="produccion"
          tiempo="3:45"
          notas={
            <Notas
              decir={[
                "Ahora lo muestro en vivo, en la página de herramientas, que llama a la misma API. Son cuatro preguntas.",
                "Primera, de la Gerencia Agrícola: ¿qué pasa si el azúcar baja a 15 centavos? La API recalcula: HOCP14-885 sigue conviniendo con 4 cortes y deja 331 dólares por acre al año.",
                "Segunda, de la Industrial: simulo un medidor de vapor que marca 3 toneladas de más durante 6 minutos, y la respuesta es que falla el sensor, no la caldera.",
                "Tercera, de la General: el rango de ingreso de 10 mil toneladas a tres meses.",
                "Cuarta: le hago al asistente la primera pregunta, en palabras. Debe dar la misma cifra y decir de dónde sale.",
              ]}
              bloques={[
                {
                  titulo: "Plan B",
                  items: [
                    ["Si cae la red", "docker compose up en local y localhost:8000/docs. Las respuestas esperadas ya están en esta diapositiva."],
                    ["Si Vertex se satura", "Entra el modelo de respaldo. Si aun así falla, saltar el paso del asistente."],
                  ],
                },
              ]}
            />
          }
        >
          <Titulo>Cambio un supuesto y la API responde</Titulo>
          <div className={s.demo}>
            <section className={s.demoPaso} data-serie="campo">
              <p className={s.demoGerencia}>Gerencia Agrícola</p>
              <p className={s.demoPregunta}>¿Y si el azúcar baja a US$0.15/lb?</p>
              <p className={s.demoRespuesta}>
                {/* fuente: docs/api.md, POST /campo/ciclo con {"variedad": "HOCP14-885", "precio": 0.15} */}
                {sinCorte(v1.CLONE)} sigue en 4 cortes y deja US$331 por acre al año, +190 contra el testigo. El testigo pasa a 5
                cortes.
              </p>
              <p className={s.demoFuente}>Herramientas, ciclo de renovación · <code>POST /campo/ciclo</code></p>
            </section>
            <section className={s.demoPaso} data-serie="caldera">
              <p className={s.demoGerencia}>Gerencia Industrial</p>
              <p className={s.demoPregunta}>El medidor de vapor marca 3 t/h de más por 6 minutos.</p>
              <p className={s.demoRespuesta}>
                {/* fuente: docs/api.md, POST /caldera/verificar */}
                La API responde: falla el sensor, no la caldera (z de 11.8 contra un umbral de 5).
              </p>
              <p className={s.demoFuente}>Herramientas, caldera · <code>POST /caldera/verificar</code></p>
            </section>
            <section className={s.demoPaso} data-serie="mercado">
              <p className={s.demoGerencia}>Gerencia General</p>
              <p className={s.demoPregunta}>¿Cuánto valen {num(TONELADAS, 0)} t a 3 meses?</p>
              <p className={s.demoRespuesta}>
                Centro: {usd(ingreso(bandaMes3.centro), 2)} millones. Banda de 80&nbsp;%: de {usd(ingreso(bandaMes3.p10), 2)} a{" "}
                {num(ingreso(bandaMes3.p90), 2)} millones.
              </p>
              <p className={s.demoFuente}>Herramientas, precio · <code>GET /mercado/pronostico</code></p>
            </section>
            <section className={s.demoPaso}>
              <p className={s.demoGerencia}>Asistente</p>
              <p className={s.demoPregunta}>¿Qué variedad conviene si el azúcar baja a US$0.15/lb?</p>
              <p className={s.demoRespuesta}>
                Debe dar la cifra del primer paso y citar el notebook 02, sin mezclar la certeza calculada al precio base.
              </p>
              <p className={s.demoFuente}>Gemini en Vertex AI · <code>POST /asistente</code></p>
            </section>
          </div>
          <div className={s.demoExtra}>
            <p>
              {/* verificado contra la API local: POST /campo/auditoria/csv responde 422 "Faltan columnas: variedad, tch." */}
              Si sobra tiempo: un CSV de cosechas sin variedad ni TCH. La API responde «Faltan columnas: variedad, tch.»
            </p>
            <div className={s.acciones}>
              <Link href="/herramientas" className={s.accion}>Abrir las herramientas</Link>
              <Link href="/asistente#preguntar" className={`${s.accion} ${s.accionSec}`}>Abrir el asistente</Link>
            </div>
          </div>
          <Pie fuente="docs/api.md, respuestas verificadas contra la API" detalle="/herramientas" tema="las herramientas de la demostración" />
        </Diapositiva>

        {/* ═══ 15 · Criterio ═══ */}
        <Diapositiva
          capitulo="criterio"
          tiempo="1:00"
          notas={
            <Notas
              decir={[
                "¿Por qué creerle a estas cifras? Porque antes de recomendarlas intenté tumbarlas. Apliqué cuatro reglas en las tres series.",
                <>
                  Primero, auditar los datos: cada archivo traía una trampa. Segundo, probar contra el azar antes de hablar de
                  grupos o ciclos. Tercero, validar como se usaría: la gráfica muestra que validar al azar prometía hasta{" "}
                  {num(optimismoMax, 0)}&nbsp;% menos error del real. Cuarto, si un modelo complejo no gana con claridad, me quedo
                  con el que se explica.
                </>,
                <>
                  Usé IA para escribir código y revisar cifras, pero las decisiones son mías. Corregí {ERRORES_IA} errores de
                  fondo suyos, y todo está en la bitácora.
                </>,
              ]}
              preguntas={[
                ["Por qué validar hacia adelante", <>Porque al azar se prometía entre {num(optimismoMin, 0)}&nbsp;% y {num(optimismoMax, 0)}&nbsp;% menos error del real (notebook 08).</>],
                ["Por qué no modelos más complejos", "Probé Random Forest, XGBoost, gradient boosting y ARIMA, y ninguno ganó con significancia (anexo A6)."],
                ["Qué hizo la IA", "Escribió código y borradores. Las preguntas, los métodos y las decisiones son míos. Un agente aparte revisó las cifras contra las salidas de los notebooks."],
              ]}
            />
          }
        >
          <Titulo>Descarté {HIPOTESIS} hipótesis antes de recomendar</Titulo>
          <div className={`${s.cuerpo} ${s.criterio}`}>
            <GraficaD
              serie="caldera"
              titulo={<>Validar al azar promete hasta {num(optimismoMax, 0)}&nbsp;% menos error del real</>}
              nota="Sensor virtual de la caldera. Anillo: error con pliegues al azar. Punto: error hacia adelante, en días que el modelo no vio."
            >
              <GraficoValidacion filas={filasValidacion} />
            </GraficaD>
            <ul className={s.reglas}>
              <li className={s.regla}>
                <h3>Auditar los datos</h3>
                <p>
                  <span className={s.enSerie} data-serie="campo">{pctF(filasComa / filasOriginales, 1)} de las filas con coma decimal y el azúcar en libras</span>;{" "}
                  <span className={s.enSerie} data-serie="caldera">{s2p1.celdas_distintas_autoreg} valores inventados en la caldera</span>;{" "}
                  <span className={s.enSerie} data-serie="mercado">{s3p2.dias_cambio} saltos de contrato en el precio</span>.
                </p>
              </li>
              <li className={s.regla}>
                <h3>Probar contra el azar</h3>
                <p>En ninguna serie hay grupos naturales: los uso como perfiles, no como hechos.</p>
              </li>
              <li className={s.regla}>
                <h3>Validar como se usaría</h3>
                <p>Siempre hacia adelante en el tiempo, sin datos del futuro.</p>
              </li>
              <li className={s.regla}>
                <h3>Simple antes que complejo</h3>
                <p>El lineal o el ingenuo empató o ganó en las tres series.</p>
              </li>
            </ul>
          </div>
          <div className={`${s.cifrasFila} ${s.criterioCifras}`}>
            <CifraD tono="tinta" valor={DECISIONES} titulo="decisiones registradas" />
            <CifraD tono="tinta" valor={HIPOTESIS} titulo="hipótesis descartadas" />
            <CifraD tono="tinta" valor={ERRORES_IA} titulo="errores de fondo de la IA, corregidos" />
          </div>
          <Pie fuente="bitacora.md, Resumen · notebook 08 · serie1_limpieza.json" detalle="/#metodo" tema="el método" />
        </Diapositiva>

        {/* ═══ 16 · Cierre con pedido ═══ */}
        <Diapositiva
          capitulo="decision"
          tiempo="1:00"
          notas={
            <Notas
              decir={[
                "Cierro con lo que les pido. Hay tres decisiones que no requieren inversión: auditar las renovaciones en la próxima zafra, poner en línea el sensor virtual en una caldera con confirmación del operador y presupuestar la zafra en rangos de precio.",
                "Para pasar del método a cifras propias necesito tres cosas: los registros de cosecha por lote con el número de corte, dos o tres meses del historiador de una caldera y las cifras de la gremial. La auditoría ya acepta ese archivo de cosechas en la API.",
                "Con esos datos, la próxima vez les traigo números del ingenio, no de Louisiana. Quedo atento a sus preguntas.",
              ]}
              bloques={[
                {
                  titulo: "Preguntas de la gerencia",
                  items: [
                    ["¿Cuánto vale esto para el ingenio?", "Todavía no lo sé con sus datos. Las cifras son de Louisiana. La auditoría de renovaciones lo dice en la primera zafra, sin inversión."],
                    ["¿Por qué confiar en datos de otro lugar?", "No les pido confiar en las cifras, sino en el método. La API ya acepta su archivo de cosechas."],
                    ["¿Sirve el pronóstico para decidir cuándo vender?", <>No. Nada le ganó al último cierre en {mesesPrueba} meses. Sirve para medir el riesgo y decidir cuánto fijar.</>],
                    ["¿Y si el sensor virtual se equivoca?", <>Erra {num(vaporFinal.MAE_t_h, 2)} t/h. Se compara contra el medidor, y si discrepan, alarma. Se probó con cargas de {num(vaporMin, 1)} a {num(vaporMax, 1)} t/h.</>],
                    ["¿Qué tan seguro está?", "Alta certeza en las dos primeras variedades, el sensor virtual y el último cierre. Media en L15-306, la cifra por lote y la banda a 3 meses. Baja en el valor en dinero de la limpieza y en la causalidad de la oferta."],
                    ["¿Cuánto cuesta operarlo?", "La API escala a cero, con tope de 2 instancias. El sitio está en el plan gratuito de Vercel. El asistente cobra por pregunta y la cuota lo acota."],
                  ],
                },
                {
                  titulo: "Preguntas de método",
                  items: [
                    ["¿Por qué no modelos más complejos?", "Probé Random Forest, XGBoost, gradient boosting y ARIMA, y ninguno ganó con significancia (anexo A6)."],
                    ["¿Por qué validar hacia adelante?", <>Porque al azar se prometía entre {num(optimismoMin, 0)}&nbsp;% y {num(optimismoMax, 0)}&nbsp;% menos error del real.</>],
                    ["¿Hubo fuga de información?", "No. Solo uso variables que existen antes de la zafra."],
                    ["¿Por qué la banda cubrió 74\u00a0% y no 80\u00a0%?", "Las zafras recientes fueron más variables. Reporto el 74\u00a0%."],
                  ],
                },
                {
                  titulo: "Preguntas de producción e IA",
                  items: [
                    ["¿Cómo se versiona y se monitorea sin MLflow?", "El JSON y el commit son la versión. Las pruebas corren antes de desplegar, y cada despliegue de Cloud Run queda como una revisión a la que se puede volver. Cada zafra comparo lo real contra la banda. MLflow entra cuando haya reentrenamientos periódicos."],
                    ["¿Es segura?", "No hay secretos en el repositorio: entra a Vertex con la cuenta de servicio. Tiene CORS, cuota por IP y validación de rangos, con errores 422 en español."],
                    /* fuente: README, Lenguaje natural (9 herramientas; seis preguntas con el modelo real) */
                    ["¿El asistente inventa?", "No calcula. Tiene 9 herramientas que son las funciones de la API y cita la fuente. Lo probé con 6 preguntas reales, incluido un intento de sacarle sus instrucciones. No hay evaluación automática con el modelo real."],
                    ["¿Por qué no Telegram, n8n y un modelo local, o un servidor MCP?", "El asistente web se usa sin instalar nada, no tiene llaves y es un solo endpoint más. Para MCP, las 9 herramientas ya tienen esquema: exponerlas es envolverlas."],
                    ["¿Qué hizo la IA y qué hizo usted?", <>La IA escribió código y borradores. Las preguntas, los métodos y las decisiones son míos. Corregí {ERRORES_IA} errores de fondo, y un agente aparte revisó las cifras.</>],
                    ["¿Qué falta para producción real?", "Integración continua, un límite compartido (Redis), la actualización diaria del precio y el monitor de la caldera como servicio programado."],
                  ],
                },
              ]}
            />
          }
        >
          <Titulo>Empezar por lo que no requiere inversión</Titulo>
          <div className={s.pedido}>
            <section className={s.pedidoCol} data-serie="campo">
              <h3>Gerencia Agrícola</h3>
              <h4>Decidir ahora</h4>
              <p>Auditar renovaciones en la próxima zafra y tomar {sinCorte(v1.CLONE)} como protocolo de validación.</p>
              <h4>Necesito</h4>
              <p>
                Los registros de cosecha por lote: zafra, finca, lote, variedad, corte, TCH y rendimiento. La API ya acepta
                ese archivo.
              </p>
            </section>
            <section className={s.pedidoCol} data-serie="caldera">
              <h3>Gerencia Industrial</h3>
              <h4>Decidir ahora</h4>
              <p>Sensor virtual y verificación en una caldera, con confirmación del operador.</p>
              <h4>Necesito</h4>
              <p>Confirmar que existen las presiones del domo y del colector, y 2-3 meses del historiador.</p>
            </section>
            <section className={s.pedidoCol} data-serie="mercado">
              <h3>Gerencia General</h3>
              <h4>Decidir ahora</h4>
              <p>Presupuesto de la zafra en rangos de precio, y fijar más si la banda se ensancha.</p>
              <h4>Necesito</h4>
              <p>Las cifras de la gremial para Guatemala y la curva completa de futuros.</p>
            </section>
          </div>
          <p className={s.cierreFrase}>Con esos datos, la próxima vez traigo cifras del ingenio, no de Louisiana.</p>
          <p className={s.enlacesCierre}>
            <Link href="/">edgarsierra.com/analisis-cana-azucar</Link>
            <a href={DOCS_API}>Documentación de la API</a>
            <a href={REPO}>{REPO.replace("https://", "")}</a>
            <a href={archivoRepo("bitacora.md")}>Bitácora</a>
          </p>
        </Diapositiva>

        {/* ═══ A1 · Perfiles de variedad ═══ */}
        <Diapositiva
          capitulo="anexo"
          serie="campo"
          notas={
            <Notas
              decir={[
                "Los perfiles sirven para dar un rol a cada variedad, no para predecir.",
                <>Las tres recomendadas están en «{perfilTop.grupo}».</>,
              ]}
            />
          }
        >
          <Titulo>Cinco perfiles de variedad, no grupos</Titulo>
          <div className={`${s.cuerpo} ${s.graficaYCifras}`}>
            <GraficaD
              titulo="Ganancia mediana contra el testigo en cada perfil"
              nota="Perfiles por 4 indicadores contra los testigos: caña, calidad, longevidad y estabilidad."
            >
              <GraficoPerfiles filas={perfiles} />
            </GraficaD>
            <div className={s.cifrasColumna}>
              <CifraD valor={num(ari5, 2)} titulo="Estabilidad al remuestrear (ARI)" detalle="Se reproducen, aunque no hay grupos naturales" />
              <CifraD valor={pctF(s1p3.eta2, 0)} titulo="de la diferencia de ganancia la explican los perfiles" />
              <CifraD
                valor={`${num(s1p3.correlaciones.productividad.calidad, 2)} y ${num(s1p3.correlaciones.calidad.longevidad, 2)}`}
                titulo="Calidad contra tonelaje; calidad con longevidad"
                detalle={<>Correlaciones entre indicadores. «Completas»: {perfilTop.variedades} variedades, mediana de {conSigno(perfilTop.mediana, 0)}.</>}
              />
            </div>
          </div>
          <Pie fuente="notebook 04 · serie1_segmentos.json y serie1_resumen_p3.json" detalle="/campo#perfiles" tema="perfiles de variedad" />
        </Diapositiva>

        {/* ═══ A2 · Tamaño de ensayos y distancia ═══ */}
        <Diapositiva
          capitulo="anexo"
          serie="campo"
          notas={
            <Notas
              decir={[
                "El ruido grande está entre fincas, no entre repeticiones: por eso conviene sumar fincas.",
                "En fincas lejanas, la variedad correcta separa un lote rentable de uno con pérdida.",
              ]}
            />
          }
        >
          <Titulo>Sumar fincas rinde más que sumar repeticiones</Titulo>
          <div className={`${s.cuerpo} ${s.dosColumnas}`} style={{ gridTemplateColumns: "minmax(0, 1.25fr) minmax(0, 1fr)" }}>
            <div className={s.columnaFlex}>
              <p className={s.graficaTitulo}>Fincas por cohorte para detectar una ventaja, con 6 años de cosecha</p>
              <table className={`${s.tabla} ${s.tablaAmplia}`} style={{ marginTop: "0.9cqw" }}>
                <thead>
                  <tr>
                    <th scope="col">Ventaja a detectar</th>
                    <th scope="col" className={s.der}>Interacción ×1</th>
                    <th scope="col" className={s.der}>×1.5</th>
                    <th scope="col" className={s.der}>×2</th>
                  </tr>
                </thead>
                <tbody>
                  {(["ventaja 15%", "ventaja 10%", "ventaja 7.5%", "ventaja 5%"] as const).map((v) => (
                    <tr key={v} className={v === "ventaja 10%" ? s.destacada : undefined}>
                      <td>{v.replace("ventaja ", "").replace("%", " %")}</td>
                      {["1", "1.5", "2"].map((k) => {
                        const n = tamanos6(k)[v];
                        return <td key={k} className={s.der}>{n === null ? "ninguno" : `${n} fincas`}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className={s.graficaNota}>
                Interacción: cuánto cambia la ventaja de finca a finca (×1 es la medida en Louisiana). Potencia de 80&nbsp;%.
              </p>
              {/* La cifra va con la tabla de ensayos (su tema); la columna derecha queda para la distancia */}
              <div className={s.alPie}>
                <CifraD
                  valor={/* fuente: README, Serie I */ "2.6"}
                  unidad="veces"
                  titulo="más potencia al sumar fincas que repeticiones"
                  detalle="+5.9 contra +2.3 puntos con las mismas parcelas extra"
                />
              </div>
            </div>
            <div className={s.columnaFlex}>
              <GraficaD
                titulo="Costo de cosecha y transporte con el que cada una deja de cubrir costos"
                nota={<>En fincas lejanas, las recomendadas aguantan entre {usd(Math.min(...distRecomendadas), 1)} y {num(Math.max(...distRecomendadas), 1)}/t.</>}
              >
                <GraficoDistancia filas={filasDistancia} />
              </GraficaD>
            </div>
          </div>
          <Pie fuente="notebook 05 · serie1_resumen_p4.json" detalle="/campo#datos-propios" tema="ensayos y distancia" />
        </Diapositiva>

        {/* ═══ A3 · Modos de la caldera ═══ */}
        <Diapositiva
          capitulo="anexo"
          serie="caldera"
          notas={
            <Notas
              decir={[
                "No hay estados separados: la carga manda, y las zonas son cortes de un continuo.",
                "La descarga del lecho no afecta la producción de vapor.",
              ]}
            />
          }
        >
          <Titulo>No hay modos separados: la carga manda</Titulo>
          <div className={`${s.cuerpo} ${s.graficaYCifras}`}>
            <GraficaD
              titulo="Diferencial del lecho en cinco días; en naranja, las descargas de ceniza"
              nota={<>Datos: el segundo archivo inventa {s2p1.celdas_distintas_autoreg} valores; {s2p1.sensores_cada_10s.length} sensores, incluido el vapor, se actualizan cada 10 s.</>}
            >
              <GraficoLecho puntos={puntosLecho} descargas={descargas} />
            </GraficaD>
            <div className={s.cifrasColumna}>
              <CifraD valor={s2p2.k} unidad="zonas de carga" titulo="Cortes de un continuo, no estados" />
              <CifraD
                valor={`${num(llenadoH, 1)} h y ${num(descargaH, 1)} h`}
                titulo="El lecho se llena y se descarga"
                detalle={<>{s2p2.ciclos_lecho.llenado.ciclos} ciclos en cinco días, sin mover el vapor</>}
              />
              <CifraD valor={`~${num(vaporMasFrio, 0)} °C`} titulo="más frío el vapor con más aire y atemperación" />
            </div>
          </div>
          <Pie fuente="notebooks 06 y 07 · serie2_resumen_p1.json y serie2_resumen_p2.json" detalle="/caldera#modos" tema="modos de operación" />
        </Diapositiva>

        {/* ═══ A4 · Gases y ensuciamiento ═══ */}
        <Diapositiva
          capitulo="anexo"
          serie="caldera"
          notas={
            <Notas
              decir={[
                "Sin un registro de soplados no se distingue del ciclo del lecho.",
                "El valor en dinero usa supuestos declarados; la fracción del calor que va a la chimenea lo mueve ±40\u00a0%.",
              ]}
            />
          }
        >
          <Titulo>Los gases suben {num(gases["°C por día"], 0)} °C por día a igual carga</Titulo>
          <div className={`${s.cuerpo} ${s.graficaYCifras}`}>
            <GraficaD
              titulo="Gases a la salida del economizador, a igual carga y O₂, por hora"
              nota="°C sobre lo esperado. Línea de tinta: tendencia de los cinco días."
            >
              <GraficoSerrucho puntos={puntosGases} pendiente={s2p5.serrucho.pendiente_c_dia} />
            </GraficaD>
            <div className={s.cifrasColumna}>
              <CifraD
                valor={`+${num(gases["°C por día"], 1)}`}
                unidad="°C/día"
                titulo="Tendencia de los gases"
                detalle={<>Intervalo de 90&nbsp;%: {num(gases["IC90 bajo"], 1)} a {num(gases["IC90 alto"], 1)} °C por día</>}
              />
              <CifraD
                valor={`${num(s2p5.serrucho.periodo_h, 1)} h`}
                titulo="Periodo del serrucho"
                detalle={<>{s2p5.serrucho.picos} picos en cinco días</>}
              />
              <CifraD
                valor={`US$${num(limpiezaBaja.us_ano / 1000, 0)}-${num(limpiezaAlta.us_ano / 1000, 0)} mil`}
                titulo="al año si es ensuciamiento"
                detalle={<>PCI {supuestos.pci_mj_kg} MJ/kg, eficiencia {pctF(supuestos.eficiencia, 0)}, {usd(supuestos.precio_combustible_t, 0)}/t y {num(supuestos.horas_ano, 0)} h</>}
              />
            </div>
          </div>
          <Pie fuente="notebook 09, parte B · serie2_resumen_p5.json" detalle="/caldera#eficiencia" tema="eficiencia de la caldera" />
        </Diapositiva>

        {/* ═══ A5 · Guatemala ═══ */}
        <Diapositiva
          capitulo="anexo"
          serie="mercado"
          notas={
            <Notas
              decir={[
                <>Sus pares por trayectoria son {enLista(pares)}, no la India ni Tailandia.</>,
                "Recomiendo reemplazar FAOSTAT 2014-2023 por las cifras de la gremial.",
              ]}
            />
          }
        >
          <Titulo>Guatemala creció en área y en rendimiento</Titulo>
          <div className={`${s.cuerpo} ${s.graficaYCifras}`}>
            <GraficaD
              titulo={<>{s3p1.paises_panel} países: crecimiento del área contra rendimiento de 2014 a 2023</>}
              nota={<>Líneas: cuartil superior de cada eje. Arriba a la derecha, {enCuadrante.length} países: {enLista(enCuadrante.map(es))}.</>}
            >
              <GraficoPaises
                puntos={puntosPaises}
                corteArea={corteArea}
                corteRend={corteRend}
                etiqueta={`Dispersión de ${s3p1.paises_panel} países: crecimiento del área contra rendimiento reciente. Guatemala queda arriba a la derecha, en el cuartil superior de los dos ejes.`}
              />
            </GraficaD>
            <div className={s.cifrasColumna}>
              <CifraD valor={num(guatemala.descriptores.rend_2014_2023, 0)} unidad="t/ha" titulo="Rendimiento de Guatemala, 2014-2023" />
              <CifraD
                valor={`${enCuadrante.length} de ${s3p1.paises_panel}`}
                titulo="países en el cuartil superior de los dos ejes"
                detalle={<>Pares por trayectoria: {enLista(pares)}</>}
              />
              <CifraD
                valor={/* fuente: notebook 10, calidad de datos ("tres tramos dudosos"); README, Serie III */ "3 tramos"}
                titulo="dudosos de FAOSTAT para Guatemala"
                detalle={<>Producción de 2014-2016 inflada; área de 2019-2023 imputada; el USDA reporta {/* fuente: notebook 10, evaluación gerencial */}12-15&nbsp;% más área</>}
              />
            </div>
          </div>
          <Pie fuente="notebook 10 · serie3_resumen_p1.json y serie3_grupos_paises.json" detalle="/mercado#paises" tema="Guatemala entre los países productores" />
        </Diapositiva>

        {/* ═══ A6 · Ganó el modelo simple ═══ */}
        <Diapositiva
          capitulo="anexo"
          notas={
            <Notas
              decir={[
                "En ninguna serie un modelo complejo ganó con significancia. Me quedo con el que se explica en una línea.",
              ]}
            />
          }
        >
          <Titulo>En las tres series ganó el modelo simple</Titulo>
          <div className={`${s.cuerpo} ${s.columnaFlex}`}>
            <table className={`${s.tabla} ${s.tablaGrande} ${s.tablaFija}`}>
              <colgroup>
                <col style={{ width: "19%" }} />
                <col style={{ width: "16%" }} />
                <col style={{ width: "29%" }} />
                <col style={{ width: "36%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">Serie y error</th>
                  <th scope="col">Simple</th>
                  <th scope="col">Complejo</th>
                  <th scope="col">Resultado</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Campo, lb/acre</td>
                  <td>Ridge {num(e1.Ridge.MAE, 0)}</td>
                  <td>Random Forest {num(e1["Random Forest"].MAE, 0)}; XGBoost {num(e1.XGBoost.MAE, 0)}</td>
                  <td>Empate sin diferencia significativa; el Ridge ordena mejor</td>
                </tr>
                <tr>
                  <td>Caldera, t/h</td>
                  <td>Ridge {num(vaporFinal.MAE_t_h, 2)}</td>
                  <td>Gradient boosting {num(metricasVapor["Gradient boosting"].MAE_t_h, 2)}</td>
                  <td>Gana el simple: diferencia de {ridgeVsArboles?.IC90.replace(/-/g, "−")} t/h (IC90)</td>
                </tr>
                <tr>
                  <td>Mercado, % a 1 mes</td>
                  <td>Último cierre {num(errorMes1, 1)}&nbsp;%</td>
                  <td>ARIMA {num(errorArima1, 1)}&nbsp;%; regresión {num(errorRegresion1, 1)}&nbsp;%</td>
                  <td>Nada le gana al último cierre</td>
                </tr>
              </tbody>
            </table>
            <GraficaD serie="caldera" titulo="Caldera: error de cada forma de estimar el vapor, en días que el modelo no vio">
              <GraficoSensorVirtual filas={filasVapor} />
            </GraficaD>
          </div>
          <Pie fuente="notebooks 03, 08 y 12 · serie1_resumen_p2.json, serie2_resumen_p3.json y serie3_resumen_p3.json" detalle="/#metodo" tema="el método" />
        </Diapositiva>

        {/* ═══ A7 · Puesta en producción ═══ */}
        <Diapositiva
          capitulo="anexo"
          notas={
            <Notas
              decir={[
                <>{PRUEBAS} pruebas: {PRUEBAS_API} de la API y {PRUEBAS - PRUEBAS_API} del esquema en PostgreSQL 16, dentro de Docker.</>,
                /* fuente: README, Lenguaje natural; bitácora D80 */
                "El asistente usa Gemini 3.5 Flash con Flash Lite de respaldo; las seis preguntas reales respondieron en 2 a 7 s.",
              ]}
            />
          }
        >
          <Titulo>Así está construida la puesta en producción</Titulo>
          <p className={s.cadena}>
            <span>Python 3.12, pandas, scikit-learn, statsmodels</span>
            <span>PostgreSQL 16</span>
            <span>JSON en outputs/models</span>
            <span>FastAPI y pydantic</span>
            <span>Docker Compose</span>
            <span>pytest: {PRUEBAS} pruebas</span>
            <span>Cloud Run</span>
            <span>Next.js en Vercel</span>
            <span>Gemini en Vertex AI</span>
          </p>
          <div className={s.cuerpo} style={{ marginTop: "1.8cqw" }}>
            {/* fuente: README, "Por qué elegí estas herramientas" y "Seguridad y límite de uso"; bitácora D63-D83 */}
            <table className={s.tabla}>
              <thead>
                <tr>
                  <th scope="col">Elegí</th>
                  <th scope="col">En lugar de</th>
                  <th scope="col">Por qué</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Modelos en JSON legibles</td>
                  <td>Pickles</td>
                  <td>Se auditan en cualquier editor y no dependen de la versión de la librería.</td>
                </tr>
                <tr>
                  <td>Cloud Run: de 0 a 2 instancias, 1 GB</td>
                  <td>Un servidor propio</td>
                  <td>Escala a cero cuando nadie la usa y el tope acota el costo.</td>
                </tr>
                <tr>
                  <td>Límite en memoria: 40 por minuto, 300 por día y 5,000 diarias en total</td>
                  <td>Redis o Cloud Armor</td>
                  <td>Basta con 2 instancias: el tope real es a lo sumo el doble.</td>
                </tr>
                <tr>
                  <td>Herramientas que llaman a la API</td>
                  <td>RAG sobre documentos</td>
                  <td>El asistente no calcula: pide la cifra y cita la fuente.</td>
                </tr>
                <tr>
                  <td>Asistente web con Vertex AI</td>
                  <td>Telegram, n8n y Ollama</td>
                  <td>Sin instalar nada, sin llaves y un solo endpoint más.</td>
                </tr>
                <tr>
                  <td>Git y pruebas, sin MLflow por ahora</td>
                  <td>MLflow</td>
                  <td>Un entrenamiento por notebook. Entra cuando haya reentrenamientos periódicos.</td>
                </tr>
              </tbody>
            </table>
          </div>
          <Pie fuente="README, Por qué elegí estas herramientas · bitácora D63-D83" detalle="/api#decisiones" tema="decisiones de la API" />
        </Diapositiva>

        {/* ═══ A8 · Límites ═══ */}
        <Diapositiva
          capitulo="anexo"
          notas={<Notas decir={["Cada límite tiene un camino concreto; el detalle está en el README, Pendientes."]} />}
        >
          <Titulo>Lo que estos datos no permiten afirmar</Titulo>
          <div className={s.cuerpo}>
            {/* fuente: README, "Pendientes y cómo los abordaría" */}
            <table className={`${s.tabla} ${s.tablaAmplia}`}>
              <thead>
                <tr>
                  <th scope="col">Serie</th>
                  <th scope="col">Límite</th>
                  <th scope="col">Cómo lo resolvería</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={s.enSerie} data-serie="campo">Campo</td>
                  <td>Ensayos de Louisiana. Sin clima ni manejo. El escenario 3 quedó diseñado, no desarrollado.</td>
                  <td>Registros del ingenio por lote con número de corte, clima y costos. Calibrar la ventaja de etapas 3-4 contra la etapa 5.</td>
                </tr>
                <tr>
                  <td className={s.enSerie} data-serie="caldera">Caldera</td>
                  <td>Cinco días. Fallas sintéticas. Caldera a carbón. Eficiencia solo en relativo.</td>
                  <td>2-3 meses del historiador, eventos confirmados, y combustible, chimenea y CO para el balance de energía.</td>
                </tr>
                <tr>
                  <td className={s.enSerie} data-serie="mercado">Mercado</td>
                  <td>Unos 20 años de precio. Precio en dólares. FAOSTAT con años dudosos.</td>
                  <td>Precio desde 1960 (Banco Mundial), en moneda local y deflactado. Cifras de la gremial para Guatemala.</td>
                </tr>
                <tr>
                  <td>Producción</td>
                  <td>Sin integración continua. Límite por instancia. Precio fijo al {fechaCorta(s3Pronostico.fecha_origen)}.</td>
                  <td>Pruebas y despliegue en cada push. Límite compartido en Redis. Actualización diaria del precio.</td>
                </tr>
              </tbody>
            </table>
          </div>
          <Pie fuente="README, Pendientes y cómo los abordaría" detalle="/api#fuera" tema="lo que no está en la API" />
        </Diapositiva>
      </Diapositivas>
    </>
  );
}
