import type { Metadata } from "next";
import Link from "next/link";
import { Cifra, FilaCifras } from "@/components/Cifra";
import { Evaluacion } from "@/components/Evaluacion";
import { Figura, ImagenNotebook } from "@/components/Figura";
import { IndiceLocal } from "@/components/IndiceLocal";
import { Desplegable, Nota } from "@/components/Nota";
import { CifraPortada, Portada } from "@/components/Portada";
import { Seccion } from "@/components/Seccion";
import { Tabla } from "@/components/Tabla";
import auditoria from "@/datos/serie2_auditoria_sensores.json";
import ciclosLecho from "@/datos/serie2_ciclos_lecho.json";
import inyeccionesSeries from "@/datos/serie2_inyecciones_series.json";
import muestraModos from "@/datos/serie2_muestra_api_modos.json";
import muestraVapor from "@/datos/serie2_muestra_api_vapor.json";
import predicciones from "@/datos/serie2_predicciones_p3.json";
import p1 from "@/datos/serie2_resumen_p1.json";
import p2 from "@/datos/serie2_resumen_p2.json";
import p3 from "@/datos/serie2_resumen_p3.json";
import p4 from "@/datos/serie2_resumen_p4.json";
import p5 from "@/datos/serie2_resumen_p5.json";
import modos from "@/datos/serie2_modos.json";
import sensorVirtual from "@/datos/serie2_sensor_virtual.json";
import sensores from "@/datos/serie2_sensores.json";
import tratamiento from "@/datos/serie2_tratamiento_sensores.json";
import { archivoRepo } from "@/lib/base";
import { conSigno, num, pct, pctFraccion, usd } from "@/lib/formato";
import { Formula } from "./_componentes/Formula";
import {
  GraficoHidraulico, GraficoLecho, GraficoMedidoEstimado, GraficoModelos, GraficoOportunidades, GraficoRezago,
  GraficoSerrucho, GraficoZonas,
} from "./_componentes/Graficos";
import { MapaSensores, type GrupoSensores } from "./_componentes/MapaSensores";
import { legible, minutoDiaMes, minutoUTC, NOMBRE_CORTO, redondear } from "./_componentes/nombres";
import { Recorrido, SENSORES_EN_RECORRIDO } from "./_componentes/Recorrido";
import { SimuladorFallas, type EscenarioFalla } from "./_componentes/SimuladorFallas";
import { TrazoPortada } from "./_componentes/TrazoPortada";
import s from "./caldera.module.css";

export const metadata: Metadata = {
  title: "Caldera de cogeneración",
  description:
    "Serie II: qué tan confiables son los 30 sensores de una caldera, si opera en modos distintos, cómo estimar el vapor sin medidor, cómo separar una falla del sensor de una del equipo y dónde hay eficiencia por ganar.",
};

const NOTEBOOKS = {
  datos: "notebooks/06_fabrica_datos.ipynb",
  modos: "notebooks/07_fabrica_regimenes.ipynb",
  vapor: "notebooks/08_fabrica_sensor_virtual.ipynb",
  anomalias: "notebooks/09_fabrica_anomalias_eficiencia.ipynb",
};

// Certeza de cada pregunta: la misma en su Evaluación y en la lista del cierre.
const CERTEZA = { datos: "alta", modos: "alta", vapor: "alta", anomalias: "media", eficiencia: "media" } as const;

/**
 * Lectura con margen: el argumento a la izquierda (columnas 1-7) y, al margen (9-12), qué descarté y dónde corre en la
 * API. Así la columna derecha trabaja y el criterio de cada decisión queda a la vista. En el teléfono el margen va debajo.
 */
function Par({ children, margen }: { children: React.ReactNode; margen: React.ReactNode }) {
  return (
    <div className={s.par}>
      <div className={s.principal}>{children}</div>
      <div className={s.margen}>{margen}</div>
    </div>
  );
}

/** Dónde corre el análisis en producción: la consulta de la API (FastAPI en Cloud Run) y la herramienta que la usa. */
function EnLaApi({ ruta, children, herramienta = false }: { ruta: string; children: React.ReactNode; herramienta?: boolean }) {
  return (
    <div className={s.produccion}>
      <h3>Ya corre en la API</h3>
      <p><code>{ruta}</code></p>
      <p>{children}</p>
      <p className={s.enlaces}>
        {herramienta && <><Link href="/herramientas#caldera">Probarla en Herramientas</Link>{" · "}</>}
        <Link href="/api#grupo-caldera">Ver la consulta</Link>
      </p>
    </div>
  );
}

const nombre = (tag: string) => NOMBRE_CORTO[tag] ?? tag;
const decimalesPara = (x: number) => (Math.abs(x) >= 100 ? 0 : Math.abs(x) >= 10 ? 1 : 2);
const fechaCorta = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}`;
/** "Presión de hogar C, Presión de hogar C congelado" a "Presión de hogar C (también congelada)". */
const sinRepetir = (t: string) => t.replace(/(^|: )([^,;]+), \2 congelado/, "$1$2 (también congelada)");

export default function Caldera() {
  /* ── Pregunta 1 · datos y sensores ─────────────────────────────────────── */
  const nSensores = tratamiento.length;
  const fuera = tratamiento.filter((r) => r.estado.startsWith("sospechoso"));
  const combinan = tratamiento.filter(
    (r) => !r.estado.startsWith("sospechoso") && (r.tratamiento.includes("mediana") || r.tratamiento.startsWith("promedio")),
  );
  const talCual = tratamiento.filter((r) => r.tratamiento === "usar");
  const cuidado = tratamiento.filter((r) => !fuera.includes(r) && !combinan.includes(r) && !talCual.includes(r));
  const usados = nSensores - fuera.length;
  const sinPrefijo = (t: string) => t.replace(/^(sospechoso|confiable)[:;,]?\s*/, "");
  const grupos: GrupoSensores[] = [
    {
      titulo: "Fuera de los modelos",
      explicacion: "No miden lo que dicen o son ruido. Se reportan a instrumentación y mantenimiento.",
      destacado: true,
      sensores: fuera.map((r) => ({ tag: r.indice, nombre: nombre(r.indice), nota: `${sinPrefijo(r.estado)}; ${r.tratamiento.replace(/^fuera de modelos;\s*/, "")}` })),
    },
    // Arriba lo accionable (fuera y con cuidado); abajo los dos grupos largos, que se usan.
    {
      titulo: "Con un cuidado particular",
      explicacion: "Se usan con una condición: a su resolución real, con sus faltantes o sabiendo que son un cálculo.",
      sensores: cuidado.map((r) => ({ tag: r.indice, nombre: nombre(r.indice), nota: sinPrefijo(r.estado) })),
    },
    {
      titulo: "Se combinan con sus pares",
      explicacion: "Sensores repetidos: para modelar entra la mediana o el promedio; para detectar fallas, cada uno.",
      // La nota se muestra una vez por par o familia (los sensores del mismo grupo van seguidos).
      sensores: combinan
        .map((r) => ({
          tag: r.indice,
          nombre: nombre(r.indice),
          nota: r.tratamiento.replace(/^modelos:\s*/, "") + (r.estado.includes(";") ? `; ${r.estado.split(";")[1].trim()}` : ""),
        }))
        .map((x, i, xs) => (i > 0 && xs[i - 1].nota === x.nota ? { ...x, nota: undefined } : x)),
    },
    {
      titulo: "Se usan tal cual",
      explicacion: "Confiables. Algunos traen eventos de operación que se conservan.",
      sensores: talCual.map((r) => ({ tag: r.indice, nombre: nombre(r.indice), nota: r.estado === "confiable" ? undefined : sinPrefijo(r.estado) })),
    },
  ];
  const auditoriaPor = Object.fromEntries(auditoria.map((a) => [a.sensor, a]));
  const filasSensores = tratamiento.map((r) => {
    const a = auditoriaPor[r.indice];
    return {
      sensor: nombre(r.indice),
      tag: r.indice,
      unidad: r.unidad,
      actualiza: a.actualiza_s,
      rango: `${num(a.p01, decimalesPara(Math.max(Math.abs(a.p01), Math.abs(a.p99))))} a ${num(a.p99, decimalesPara(Math.max(Math.abs(a.p01), Math.abs(a.p99))))}`,
      faltantes: a.faltantes,
      estado: r.estado,
      tratamiento: r.tratamiento,
    };
  });
  const dias = Math.round((minutoUTC(muestraModos[muestraModos.length - 1].date) - minutoUTC(muestraModos[0].date)) / 1440);
  const picosPorDia = p1.picos_tiro / dias;

  /* ── Pregunta 2 · modos ─────────────────────────────────────────────────── */
  const zonasOrden = ["Carga alta", "Carga media", "Carga baja"] as const;
  const perfil = p2.perfil;
  const zonas = zonasOrden.map((z) => ({ zona: z, vapor: perfil[z].vapor }));
  const puntosZonas = muestraModos.map((r) => ({ m: minutoUTC(r.date), v: redondear(r.vapor, 2), z: r.modo }));
  const puntosLecho = muestraModos.map((r) => ({ m: minutoUTC(r.date), p: Math.round(r.lecho) }));
  const descargas = ciclosLecho.filter((c) => c.fase === "descarga").map((c) => ({ a: minutoUTC(c.inicio), b: minutoUTC(c.fin) }));
  const vaporMin = Math.min(...muestraModos.map((r) => r.vapor));
  const vaporMax = Math.max(...muestraModos.map((r) => r.vapor));
  const cl = p2.ciclos_lecho;
  const ciclosN = cl.descarga.ciclos;
  const llenadoH = cl.llenado.minutos_mediana / 60;
  const descargaH = cl.descarga.minutos_mediana / 60;
  const cicloH = llenadoH + descargaH;
  const ccAgua = p2.cc_cambios["agua de atemperación → temperatura del vapor"];
  const rezagoAgua = p2.cc_rezagos
    .map((k, i) => ({ k, r: ccAgua[i] }))
    .filter((d) => d.k > 0)
    .reduce((a, b) => (b.r < a.r ? b : a));
  const tercios = p2.tercios;
  const difVaporTercios = tercios["hogar y vapor calientes"].t_vapor - tercios["más aire y atemperación"].t_vapor;
  const efDescarga = p2.efectos_descarga;
  const filasPerfil = [
    { variable: "Vapor (t/h)", clave: "vapor", dec: 1 },
    { variable: "Aire total (Nm³/h)", clave: "aire_total", dec: 0 },
    { variable: "Fracción de aire primario", clave: "frac_primario", dec: 2 },
    { variable: "Temperatura del hogar (°C)", clave: "t_hogar", dec: 1 },
    // Una decimal: el JSON trae 3 decimales y redondear a 2 daría 3.05 donde el notebook 07 imprime 3.04.
    { variable: "Agua de atemperación (t/h)", clave: "agua_atemp", dec: 1 },
    { variable: "Temperatura de gases (°C)", clave: "t_gases", dec: 1 },
    { variable: "Tiempo en la zona (%)", clave: "% del tiempo", dec: 1 },
    { variable: "Tramo mediano en la zona (min)", clave: "tramo mediano (min)", dec: 1 },
  ] as const;
  const tablaPerfil = filasPerfil.map((f) => ({
    variable: f.variable,
    baja: num(perfil["Carga baja"][f.clave], f.dec),
    media: num(perfil["Carga media"][f.clave], f.dec),
    alta: num(perfil["Carga alta"][f.clave], f.dec),
  }));

  /* ── Pregunta 3 · sensor virtual ───────────────────────────────────────── */
  const met = p3.metricas;
  const ridge = met["Ridge completo"];
  const hidra = met["Hidráulico √(ΔP·ρ)"];
  const combustion = met["Ridge de combustión"];
  const boosting = met["Gradient boosting"];
  const filasModelos = Object.entries(met).map(([modelo, m]) => ({
    modelo, mae: m.MAE_t_h, mape: m["MAPE_%"], elegido: modelo === "Ridge completo",
  }));
  const optimismos = Object.values(p3.al_azar).map((x) => x["optimismo (%)"]);
  const anidados = Object.entries(p3.anidados).map(([variables, mae]) => ({ variables, mae }));
  const dosVar = anidados[1].mae;
  const puntosHidra = muestraVapor.map((r) => ({ x: r.raiz_dp_rho, y: redondear(r.ZZQBCHLL, 3) }));
  const fechaMuestraVapor = fechaCorta(muestraVapor[0].date);
  // Mismo día que el HTML explicativo de la Serie II: el tercer día con predicción fuera de muestra.
  const diasConPrediccion = [...new Set(predicciones.filter((r) => r["Ridge completo"] !== null).map((r) => r.date.slice(0, 10)))].sort();
  const diaElegido = diasConPrediccion[2];
  const puntosDia = predicciones
    .filter((r) => r.date.startsWith(diaElegido) && r["Ridge completo"] !== null)
    .map((r) => ({
      h: Number(r.date.slice(11, 13)) + Number(r.date.slice(14, 16)) / 60,
      med: redondear(r.medido, 3),
      est: redondear(r["Ridge completo"] as number, 3),
    }));
  const maeDia = puntosDia.reduce((a, p) => a + Math.abs(p.est - p.med), 0) / puntosDia.length;
  const banda = p3.banda["Ridge completo"];
  const mec = p3.mecanismos;
  const ablacion = p3.rezagos_ablacion;
  const mejoraRezagos = ablacion["solo el valor actual"] - ablacion["actual + 1 y 2 min"];
  const compRidgeHidra = p3.comparaciones[0];
  // Rango del vapor en promedios de 1 min (el del sensor virtual): notebook 08, celda 1 imprime 51.5-70.6 t/h.
  const vaporMin1 = Math.min(...predicciones.map((r) => r.medido));
  const vaporMax1 = Math.max(...predicciones.map((r) => r.medido));

  /* ── Pregunta 4 · anomalías ────────────────────────────────────────────── */
  const reglas = Object.entries(p4.reglas);
  const reglasDia = reglas.reduce((a, [, r]) => a + r["eventos por día"], 0);
  const alarmasDia = reglasDia + p4.verificacion_episodios_dia + p4.monitor_episodios_dia;
  const sens = p4.sensibilidad;
  const vaporMedio = modos.media.vapor;
  const sensVaporPct = (sens["Vapor medido − virtual"]["falla mínima detectable"] / vaporMedio) * 100;
  const iny = p4.inyecciones;
  const aciertos = iny.filter((r) => r.acierta === "True").length;
  const porNombre = Object.fromEntries(iny.map((r) => [r.escenario, r]));
  const deriva = porNombre["Medidor de vapor con deriva"];
  const termopar = porNombre["Termopar de gases derecho con deriva"];
  const compuerta = porNombre["Compuerta de aire secundario abierta de más"];
  const sesgoO2 = porNombre["Analizador de O₂ izquierdo con sesgo"];
  const escenarios: EscenarioFalla[] = iny.map((r) => {
    const filas = inyeccionesSeries.filter((x) => x.escenario === r.escenario);
    const inicio = minutoUTC(filas[0].fecha);
    const t = filas.map((x) => minutoUTC(x.fecha) - inicio);
    const conFalla = filas.map((x, j) => (x.falla ? t[j] : null)).filter((x): x is number => x !== null);
    return {
      nombre: r.escenario,
      real: r.real,
      inicio,
      t,
      ver: filas.map((x) => redondear(x.verificacion, 3)),
      mon: filas.map((x) => redondear(x.monitor, 3)),
      fallaDesde: conFalla[0],
      fallaHasta: conFalla[conFalla.length - 1],
      verificacion: sinRepetir(legible(r["chequeos que saltan"])),
      monitor: legible(r["monitor de proceso"]).replace(/^sí \((.*)\)$/, "$1"),
      regla: r["reglas nuevas"],
      minutos: Number(r["minutos hasta la alarma"]),
      diagnostico: sinRepetir(legible(r["diagnóstico"]))
        .replace(/^sensor: /, "Falla de sensor: ")
        .replace(/^proceso\/equipo: /, "Proceso o equipo: "),
      acierta: r.acierta === "True",
    };
  });
  const ACCION: Record<string, string> = {
    "Hogar presurizado": "Revisar tiro inducido y alimentación; si se repite, bajar carga.",
    "O₂ bajo": "Subir aire secundario; revisar el analizador si el otro lado no coincide.",
    "O₂ alto": "Bajar aire secundario; revisar compuertas y fugas.",
    "Vapor caliente": "Revisar la atemperación: ¿válvula en manual?",
    "Vapor frío": "Revisar si se atempera de más y el exceso de aire.",
    "Lecho alto": "Descargar ceniza de fondo.",
    "Corriente del tiro alta": "Revisar ensuciamiento, fugas de aire y exceso de aire.",
  }; // fuente: notebook 09, celda 4

  /* ── Pregunta 5 · eficiencia ───────────────────────────────────────────── */
  const tend = p5.tendencias;
  const gases = tend["Gases a la salida del economizador superior"];
  const serr = p5.serrucho;
  const ens = p5.ensuciamiento_10C;
  const sup = p5.supuestos;
  const anio = Number(muestraModos[0].date.slice(0, 4));
  const puntosGases = p5.gases_hora.t
    .map((t, i) => ({ m: minutoDiaMes(t, anio), v: p5.gases_hora.v[i] }))
    .filter((p): p is { m: number; v: number } => typeof p.v === "number");
  const dolaresTiro = p5.kw_tiro * sup.horas_ano * sup.precio_kwh;
  const aire = p5.exceso_aire["total combustible"];
  const efO2 = p5.efectos_o2;
  // "10 °C": base de la valoración del ensuciamiento (fuente: notebook 09, celda 18; clave ensuciamiento_10C del JSON).
  const filasOportunidades = [
    { nombre: "Limpieza: recuperar 10 °C de gases", bajo: ens["0.3"].us_ano, medio: ens["0.5"].us_ano, alto: ens["0.7"].us_ano, destacado: true },
    { nombre: "Limpiar el doble de seguido", bajo: p5.limpiar_doble.us_ano, medio: p5.limpiar_doble.us_ano, alto: p5.limpiar_doble.us_ano, destacado: false },
    { nombre: "Bajar el O₂: combustible", bajo: aire.us_ano, medio: aire.us_ano, alto: aire.us_ano, destacado: false },
    { nombre: "Bajar el O₂: electricidad del tiro", bajo: dolaresTiro, medio: dolaresTiro, alto: dolaresTiro, destacado: false },
  ];
  const SUPUESTOS: [keyof typeof sup, string, (x: number) => string][] = [
    ["t_agua_alimentacion_c", "Temperatura del agua de alimentación", (x) => `${num(x, 0)} °C`],
    ["p_agua_alimentacion_mpa", "Presión del agua de alimentación", (x) => `${num(x, 1)} MPa`],
    ["eficiencia", "Eficiencia de la caldera", (x) => pctFraccion(x, 0)],
    ["pci_mj_kg", "Poder calorífico del combustible", (x) => `${num(x, 0)} MJ/kg`],
    ["precio_combustible_t", "Precio del combustible", (x) => `${usd(x, 0)}/t`],
    ["horas_ano", "Horas de operación al año", (x) => num(x, 0)],
    ["perdida_por_k", "Pérdida de eficiencia por cada °C de chimenea", (x) => `${num(x, 2)} puntos`],
    ["dt_chimenea_amb_k", "Chimenea sobre el ambiente", (x) => `${num(x, 0)} °C`],
    ["fraccion_a_chimenea", "Fracción del cambio de gases que llega a la chimenea", (x) => num(x, 1)],
    ["tension_tiro_kv", "Tensión del motor del tiro", (x) => `${num(x, 0)} kV`],
    ["factor_potencia", "Factor de potencia", (x) => num(x, 2)],
    ["precio_kwh", "Precio de la electricidad", (x) => `${usd(x, 2)}/kWh`],
  ];
  const DATOS_FALTANTES = [
    ["Flujo y poder calorífico del combustible (y humedad, en bagazo)", "Eficiencia absoluta: vapor producido por energía que entra."],
    ["Temperatura de gases a la salida del precalentador (chimenea)", "Pérdida real por gases; hoy se supone."],
    ["CO en gases", "Cuánto se puede bajar el O₂ sin inquemados."],
    ["Registro de soplado de hollín y de descargas de ceniza", "Separar ensuciamiento del ciclo normal de limpieza."],
    ["Corriente de los ventiladores primario y secundario", "Costo eléctrico del aire y del nivel del lecho."],
    ["Temperatura ambiente", "Descartar que la deriva de temperaturas sea clima."],
    ["Flujo y temperatura del agua de alimentación", `Balance de energía completo; hoy se suponen ${num(sup.t_agua_alimentacion_c, 0)} °C.`],
    ["Consignas y modo de los lazos (automático o manual)", "Separar decisiones del operador de respuestas del control."],
  ].map(([dato, para]) => ({ dato, para })); // fuente: notebook 09, celda 23 (sección B.4)

  const indice = [
    { id: "caldera", etiqueta: "La caldera" },
    { id: "datos", etiqueta: "Sensores" },
    { id: "modos", etiqueta: "Modos" },
    { id: "vapor", etiqueta: "Sensor virtual" },
    { id: "anomalias", etiqueta: "Anomalías" },
    { id: "eficiencia", etiqueta: "Eficiencia" },
    { id: "cierre", etiqueta: "Qué recomiendo" },
  ];
  const minimaVapor = sens["Vapor medido − virtual"]["falla mínima detectable"];
  const minimaGases = sens["Gases izq. − der."]["falla mínima detectable"];
  const nSensorIny = iny.filter((r) => r.real === "sensor").length;
  const milesUsd = `${num(ens["0.3"].us_ano / 1000, 0)} a ${num(ens["0.7"].us_ano / 1000, 0)}`;

  return (
    <div data-serie="caldera">
      <Portada
        serie="caldera"
        titulo="El vapor ya se mide dos veces"
        entrada={
          <p>
            Cinco días y {nSensores} sensores de una caldera a carbón. Los sensores repetidos se vigilan entre sí y la
            eficiencia está en limpiar los tubos.
          </p>
        }
        piezaPanel={false}
        pieza={
          <div className={s.piezaPortada}>
            <CifraPortada
              valor={num(ridge["MAPE_%"], 2)}
              unidad="% de error"
              etiqueta="al estimar el vapor sin su medidor, en días que el modelo no vio"
              detalle={`${num(ridge.MAE_t_h, 2)} t/h con la caída de presión del domo al colector y los demás sensores. Con la caída de presión sola, ${num(hidra["MAPE_%"], 1)} %.`}
            />
            <TrazoPortada puntos={puntosDia} dia={fechaCorta(diaElegido)} />
          </div>
        }
        acciones={
          <>
            <Link className="boton" href="/herramientas#caldera">Probar el vapor virtual</Link>
            <a href="#cierre">Ver qué recomiendo</a>
          </>
        }
        meta={[
          { clave: "Datos", valor: "Caldera de lecho fluidizado, China (Cao et al., 2025)" },
          { clave: "Período", valor: "27/03 al 01/04/2022" /* fuente: notebook 06, celda 1 */ },
          { clave: "Sensores", valor: `${nSensores}, una lectura cada ${sensores.periodo_s} s` },
          { clave: "Notebooks", valor: "06 a 09" },
        ]}
      />

      <IndiceLocal items={indice} serie="caldera" titulo="Caldera" />

      {/* ── La caldera ─────────────────────────────────────────────────────── */}
      <Seccion
        id="caldera"
        titulo={`${SENSORES_EN_RECORRIDO} sensores siguen el aire y el agua`}
        entrada={
          <p>
            Es una caldera de lecho fluidizado circulante a carbón de una planta química en China: unas 60 t/h de vapor
            a 9.8 MPa y 540 °C.{/* fuente: notebook 06, celda 0 */} El aire quema el carbón y el agua sale como vapor; cada
            una de sus siete partes dice qué sensores tiene.
          </p>
        }
        cifras={
          <Nota tipo="dato" titulo="Las calderas de bagazo del ingenio">
            <p>
              Queman bagazo húmedo (~50 % de agua) sobre una parrilla, no en un lecho fluidizado.{/* fuente: docs/serie2_template.html, sección "La caldera" */}{" "}
              Comparten casi todo lo demás: aire primario y secundario, O₂ en gases, tiro inducido, atemperación, vapor
              principal y ensuciamiento de superficies. De esta caldera traslado el método, no los valores.
            </p>
          </Nota>
        }
      >
        <Recorrido />
      </Seccion>

      {/* ── Pregunta 1 · datos y sensores ──────────────────────────────────── */}
      <Seccion
        id="datos"
        titulo={`${usados} de ${nSensores} sensores entran a los modelos`}
        entrada={
          <p>
            Los datos sirven, pero no tal como vienen. Trabajo con data.csv y una regla por sensor, y pido a
            instrumentación revisar {fuera.length === 2 ? "dos" : fuera.length}.
          </p>
        }
        cifras={
          <FilaCifras columnas={2}>
            <Cifra valor={p1.celdas_distintas_autoreg} unidad="valores" etiqueta="Inventados por data_AutoReg.csv" detalle="Todos en el agua de atemperación. Uso data.csv y dejo los faltantes como faltantes." />
            <Cifra valor={p1.picos_tiro} unidad="picos" etiqueta="De la corriente del tiro: son física" detalle={`${num(picosPorDia, 0)} por día. El hogar responde a cada uno: los conservo.`} />
          </FilaCifras>
        }
      >
        <Figura
          numero={1}
          titulo={`Así quedan los ${nSensores} sensores: ${usados} entran a los modelos`}
          ancho="total"
          /* fuente de "hasta ~40 Pa": notebook 06, celda 22 */
          nota="Cada sensor está en un solo grupo. Las seis presiones de hogar se mueven juntas, con desplazamientos fijos de hasta ~40 Pa entre ellas; por eso permiten detectar cuándo una se separa (pregunta 4). El tag de cada sensor está en el detalle técnico."
          fuente="notebook 06, sección 5 · outputs/tables/serie2_tratamiento_sensores.csv"
        >
          <MapaSensores grupos={grupos} />
        </Figura>

        <Par
          margen={
            <>
              <h3>Qué descarté</h3>
              <p>
                Que data_AutoReg.csv fuera una versión mejorada de los datos: inventa valores y falla justo en un escalón.
                Y que los picos del tiro fueran errores de transmisión: reemplazarlos por la mediana habría borrado eventos
                reales.
              </p>
              <EnLaApi ruta="GET /caldera/sensores">
                Devuelve los {nSensores} sensores con unidad, estado y tratamiento, y marca los {fuera.length} que quedan
                fuera de los modelos. Una prueba revisa que la válvula del atemperador siga en %, no como temperatura.
                {/* fuente: tests/test_api_caldera_mercado.py, test_sensores_diccionario_corregido */}
              </EnLaApi>
            </>
          }
        >
          <h3>Un diferencial que no es diferencial</h3>
          <p>
            Un diferencial entre la parte alta y la baja del hogar depende del lecho y del aire. El izquierdo copia la
            presión del hogar (r = {num(p1.r_sxltcyz_pt8313a, 2)}), mientras su gemelo derecho no se le parece
            (r = 0.14).{/* fuente: notebook 06, celda 20 */} Lo más probable es una toma inferior tapada con ceniza o un
            tag mal asignado. La vibración B del tiro no se relaciona con nada y su ruido es más de cuatro veces el de la
            A.{/* fuente: notebook 06, celda 20 */} Las dos quedan fuera de los modelos.
          </p>
          <h3>Tres cosas que parecen fallas y son operación</h3>
          <ul>
            <li>
              <strong>Los picos de la corriente del tiro inducido.</strong> Son {p1.picos_tiro} en {dias} días. La
              corriente sube cuando el hogar se presuriza y, justo después, la presión cambia 2.7 veces más rápido que
              en un momento cualquiera.{/* fuente: notebook 06, celda 15 */} Es el control de tiro trabajando.
            </li>
            <li>
              <strong>La válvula del atemperador quieta.</strong> Pasó {num(p1.horas_valvula_fija, 0)} h fija en{" "}
              {p1.tramos_valvula_fija} tramos de 30 min o más.{/* fuente: notebook 06, celda 17 */} El agua tampoco se movió: la válvula estuvo quieta de
              verdad, lo más probable con el lazo en manual.
            </li>
            <li>
              <strong>El aire de retorno del {fechaCorta(p1.salto_retorno)} a las {p1.salto_retorno.slice(11, 16)}.</strong>{" "}
              La izquierda bajó, la derecha subió y el total casi no cambió (1,324 a 1,315 Nm³/h).{/* fuente: notebook 06, celda 24 */}{" "}
              Dos sensores que fallan a la vez en sentidos opuestos no conservan la suma: fue el operador.
            </li>
          </ul>
        </Par>

        <div className={s.detalle}>
          <Desplegable titulo={`Detalle técnico: los archivos, las ${nSensores} decisiones y el notebook 06`}>
            <div className={s.lecturaDetalle}>
              <h3>Los archivos</h3>
              <p>
                <strong>data_AutoReg.csv es data.csv con {p1.celdas_distintas_autoreg} valores inventados.</strong> Rellena
                dos huecos del agua de atemperación con un modelo autorregresivo. El relleno prolonga la tendencia: en el
                segundo hueco sigue en ~2 t/h cuando el dato real siguiente es 3.9 t/h.{/* fuente: notebook 06, celda 3 */}{" "}
                Rellenar es una decisión del análisis, no del archivo.
              </p>
              <p>
                <strong>El diccionario no trae unidades y confunde una válvula con una temperatura.</strong> Las unidades las
                inferí de las magnitudes. &quot;Pot pressure&quot; es la presión del domo; TV_8329ZC es la apertura de una
                válvula (%). El flujo de vapor viene &quot;después de compensación&quot;: ya es un cálculo, no una medición
                directa.
              </p>
              <p>
                <strong>El reloj es perfecto, y eso delata que el archivo fue remuestreado.</strong> Son 86,400 filas exactas
                cada 5 s.{/* fuente: notebook 06, celda 8 */} Un historiador de planta (el sistema que guarda las lecturas)
                casi nunca entrega eso. {p1.sensores_cada_10s.length === 5 ? "Cinco" : p1.sensores_cada_10s.length} sensores
                cambian solo cada 10 s: la mitad de sus filas repite el valor anterior. Entre ellos está el flujo de vapor;
                por eso los modelos usan promedios de 1 min.
              </p>
            </div>
            <Tabla
              compacta
              titulo={`Las ${nSensores} decisiones, sensor por sensor`}
              columnas={[
                { clave: "sensor", titulo: "Sensor", ancho: "11rem", valor: (f) => <>{f.sensor}<code className={s.tag}>{f.tag}</code></> },
                { clave: "unidad", titulo: "Unidad" },
                { clave: "actualiza", titulo: "Cambia cada", tipo: "num", valor: (f) => `${f.actualiza} s` },
                { clave: "rango", titulo: "Rango normal (p1 a p99)", tipo: "num" },
                { clave: "faltantes", titulo: "Faltantes", tipo: "num" },
                { clave: "estado", titulo: "Estado" },
                { clave: "tratamiento", titulo: "Tratamiento" },
              ]}
              filas={filasSensores}
              destacar={(f) => f.estado.startsWith("sospechoso")}
              nota="Unidades inferidas de las magnitudes; la de la vibración no se puede confirmar. Fuente: notebook 06, secciones 2 y 5."
            />
            <h3>Figuras originales del notebook 06</h3>
            <div className={s.figurasNotebook}>
              <ImagenNotebook nombre="serie2_01_archivos" alt="Agua de atemperación en data.csv y data_AutoReg.csv: el relleno prolonga la tendencia." />
              <ImagenNotebook nombre="serie2_04_redundancia" alt="Redundancia entre sensores: las presiones de hogar coinciden y el diferencial izquierdo copia la presión." />
              <ImagenNotebook nombre="serie2_03_picos_tiro" alt="Presión del hogar alrededor de los picos de la corriente del tiro inducido." />
              <ImagenNotebook nombre="serie2_05_aire_retorno" alt="Redistribución del aire de retorno del 30/03: el total se conserva." />
            </div>
            <p><a href={archivoRepo(NOTEBOOKS.datos)}>Abrir el notebook 06 en GitHub</a></p>
          </Desplegable>
        </div>

        <Evaluacion
          serie="caldera"
          significa={
            <p>
              De {nSensores} sensores entran {usados} a los modelos. Seis son presiones de hogar redundantes, lo que es
              bueno: se verifican entre sí. Un diferencial no mide lo que dice y una vibración es ruido. El segundo archivo
              inventa valores y el diccionario no trae unidades.
            </p>
          }
          decision={
            <p>
              Recomiendo trabajar con data.csv y con las reglas por sensor de la figura 1, guardadas en
              serie2_sensores.json para que la API y las alertas las apliquen igual. Pedir a instrumentación revisar la
              toma inferior del diferencial izquierdo y la vibración B, y confirmar unidades. En el historiador del
              ingenio, guardar cada sensor a su frecuencia real, con unidades y sin rellenar huecos.
            </p>
          }
          impacto={
            <p>
              No se mide en dinero: es la condición para que las preguntas 3 a 5 valgan. Evita construir el sensor
              virtual y las alertas sobre un diferencial que no es diferencial, y evita borrar {num(picosPorDia, 0)}{" "}
              eventos diarios del tiro que son información.
            </p>
          }
          riesgo={
            <p>
              Unidades inferidas. Datos ya preprocesados por el proveedor, sin los originales. Cinco días no muestran
              derivas lentas de sensores, que tardan meses. La causa del problema del diferencial (toma tapada o tag mal
              asignado) solo se confirma en planta.
            </p>
          }
          certeza={{
            nivel: CERTEZA.datos,
            texto: `Alta en lo determinístico (diferencia entre archivos, reloj, actualización cada 10 s, diccionario) y en que el diferencial izquierdo copia la presión del hogar (r = ${num(p1.r_sxltcyz_pt8313a, 2)}). Media en la causa y en que la vibración B sea el sensor y no la chumacera.`,
          }}
        />
      </Seccion>

      {/* ── Pregunta 2 · modos ─────────────────────────────────────────────── */}
      <Seccion
        id="modos"
        titulo="No hay modos separados: la carga manda"
        entrada={
          <p>
            La caldera se mueve de forma continua y el lecho marca el único ciclo. Por eso cada alarma se compara con su
            zona de carga.
          </p>
        }
        cifras={
          <FilaCifras columnas={2}>
            <Cifra valor={pctFraccion(p2.pca1, 0)} etiqueta="De la variación la explica la carga" detalle="Un solo componente: vapor, aire, hogar, atemperación y gases suben juntos." />
            <Cifra valor={ciclosN} unidad="ciclos" etiqueta="Del lecho en cinco días" detalle={`Se llena ~${num(llenadoH, 1)} h y se descarga ~${num(descargaH, 1)} h, sin tocar la producción.`} />
          </FilaCifras>
        }
      >
        <Figura
          numero={2}
          titulo="El vapor se mueve de forma continua; las zonas de carga son cortes de ese continuo"
          ancho="total"
          nota={`Arriba, el vapor en promedios de 5 min (entre ${num(vaporMin, 0)} y ${num(vaporMax, 0)} t/h) y la media de cada zona en línea punteada. Abajo, la zona de cada ventana. La caldera cambió de zona ${p2.cambios_de_modo} veces en cinco días y el tramo mediano dura ${p2.tramo_mediano_min} min: son zonas por las que pasa, no estados en los que se queda.`}
          fuente="notebook 07 · outputs/tables/serie2_muestra_api_modos.csv"
        >
          <GraficoZonas puntos={puntosZonas} zonas={zonas} />
        </Figura>

        <Figura
          numero={3}
          titulo={`El lecho se llena unas ${num(llenadoH, 1)} h y se descarga en ${num(descargaH, 1)} h, ${ciclosN} veces en cinco días`}
          ancho="total"
          nota={`El diferencial del lecho mide cuánto material hay en el fondo del hogar. Es el único régimen discreto. A igual carga, durante la descarga entra más aire primario (+${num(efDescarga["Aire primario (Nm³/h)"]["efecto de estar descargando"], 0)} Nm³/h) y el hogar pierde depresión (+${num(efDescarga["Presión de hogar (Pa)"]["efecto de estar descargando"], 0)} Pa), pero el vapor no cambia (${conSigno(efDescarga["Flujo de vapor (t/h)"]["efecto de estar descargando"], 2)} t/h, una diferencia que no se distingue de cero): la descarga no le cuesta producción.`}
          fuente="notebook 07, sección 4 · outputs/tables/serie2_ciclos_lecho.csv"
        >
          <GraficoLecho puntos={puntosLecho} descargas={descargas} />
        </Figura>

        <Par
          margen={
            <>
              <h3>Qué descarté</h3>
              <p>
                Que la caldera tenga modos discretos: un componente explica el {pctFraccion(p2.pca1, 0)} de la variación y
                el resto es continuo. También descarté buscar un &quot;modo ineficiente&quot; entre los grupos. Con cuatro
                grupos aparecía, pero k = 4 (ARI {num(p2.estabilidad["4"]["ARI mediana"], 2)}) y k = 3
                ({num(p2.estabilidad["3"]["ARI mediana"], 2)}) quedan dentro del ruido del remuestreo. Lo medí directo con
                el eje a igual carga, que no depende del número de grupos.
              </p>
              <EnLaApi ruta="POST /caldera/modo">
                Recibe promedios de 5 min y devuelve la zona de carga y la distancia a cada zona. Una prueba comprueba que
                repite las {num(muestraModos.length, 0)} asignaciones del notebook 07.
                {/* fuente: tests/test_api_caldera_mercado.py, test_modo_reproduce_el_100_por_ciento_de_las_ventanas */}
              </EnLaApi>
            </>
          }
        >
          <h3>Primero pregunté si hay grupos</h3>
          <p>
            Un agrupamiento siempre devuelve grupos, aunque no existan. Comparé la separación de los grupos (la silueta: 1
            es muy separados, 0 superpuestos) contra la de una nube gaussiana con la misma correlación, que por
            construcción no tiene grupos. Con dos grupos la caldera no se distingue de esa nube (silueta{" "}
            {num(p2.nulo["2"].silueta, 3)} contra {num(p2.nulo["2"]["nulo gaussiano (media)"], 3)}). Con tres o más hay
            algo de estructura, pero poca.
          </p>
          <p>
            Elegí el número de zonas por reproducibilidad: remuestreé bloques de 2 h {/* fuente: notebook 07, celda 5 */}
            y medí si el agrupamiento se repite (ARI: 1 es idéntico, 0 es azar). Usé la misma regla de la Serie I: el más
            reproducible entre 3 y 6 zonas, sin zonas de menos del 5 % del tiempo.{/* fuente: notebook 07, celda 5 */} Sale
            k = {p2.k}, con ARI {num(p2.ari, 2)}.
          </p>
          <p>
            La atemperación sí tiene un efecto medible: más agua enfría el vapor unos {rezagoAgua.k} minutos después
            (r = {num(rezagoAgua.r, 2)} en cambios de 1 min; figura 4, en el detalle técnico).
          </p>
          <Tabla
            titulo="Qué distingue cada zona de carga"
            columnas={[
              { clave: "variable", titulo: "Promedio en la zona" },
              { clave: "baja", titulo: "Carga baja", tipo: "num" },
              { clave: "media", titulo: "Carga media", tipo: "num" },
              { clave: "alta", titulo: "Carga alta", tipo: "num" },
            ]}
            filas={tablaPerfil}
            nota="A más carga, más carbón y más aire. El aire primario tiene un mínimo para mantener el lecho en suspensión, así que a carga alta gana peso el secundario. El hogar se calienta, se atempera más y los gases salen más calientes. Fuente: notebook 07, sección 3."
          />
        </Par>

        <div className={s.detalle}>
          <Desplegable titulo="Detalle técnico: método, atemperación y el notebook 07">
            <div className={s.lecturaDetalle}>
              <p>
                Datos: promedios de 5 min ({num(muestraModos.length, 0)} ventanas) de nueve variables físicas, con las
                reglas de la pregunta 1: el promedio de cada par izquierda-derecha y nada de los dos sensores descartados.
                Agrupamiento k-means sobre variables estandarizadas. Prueba de grupos contra una nube gaussiana con la misma
                correlación. Reproducibilidad con 100 remuestreos de bloques de 2 h. Efectos de la descarga con errores
                robustos a autocorrelación (HAC, 1 h). {/* fuente: notebook 07, celdas 0, 5 y 14; bitácora D47 */}
              </p>
            </div>
            <Figura
              numero={4}
              titulo={`Más agua de atemperación enfría el vapor unos ${rezagoAgua.k} minutos después`}
              nota="Correlación entre los cambios de 1 minuto del agua y de la temperatura del vapor, desplazando una serie contra la otra. Antes de cero la relación es positiva: cuando el vapor se calienta, el control abre el agua. Después de cero es negativa: el agua enfría el vapor. Es un lazo de control funcionando."
              fuente="notebook 07, sección 3.1 · outputs/tables/serie2_resumen_p2.json"
            >
              <GraficoRezago rezagos={p2.cc_rezagos} r={ccAgua} />
            </Figura>
            <div className={s.lecturaDetalle}>
              <h3>A igual carga, dos formas de operar</h3>
              <p>
                Si a cada variable le quito lo que explica la carga, queda un eje propio. En un extremo hay más O₂, más
                agua de atemperación y el vapor más frío; en el otro, el hogar y el vapor calientes. Entre esos extremos el
                vapor cambia ~{num(difVaporTercios, 0)} °C. Es descriptivo y en parte sale por construcción, porque la
                temperatura del vapor pesa en el eje. Lo que sí medí como efecto es la atemperación (figura 4). El efecto
                propio del O₂ sobre el vapor no se distingue de cero.
              </p>
            </div>
            <h3>Figuras originales del notebook 07</h3>
            <div className={s.figurasNotebook}>
              <ImagenNotebook nombre="serie2_08_linea_de_tiempo" alt="Línea de tiempo de cinco días: vapor por zona, ciclo del lecho y válvula del atemperador." />
              <ImagenNotebook nombre="serie2_06_reproducibilidad" alt="Reproducibilidad de los agrupamientos según el número de grupos." />
              <ImagenNotebook nombre="serie2_09_atemperacion" alt="Correlación de cambios entre atemperación, O₂ y temperatura del vapor por rezago." />
            </div>
            <p><a href={archivoRepo(NOTEBOOKS.modos)}>Abrir el notebook 07 en GitHub</a></p>
          </Desplegable>
        </div>

        <Evaluacion
          serie="caldera"
          significa={
            <p>
              La caldera no cambia de modo como una máquina con estados: opera en un régimen normal cuya variable
              maestra es la carga. Dentro de ese régimen hay tres zonas de carga, un eje que decide la operación y no la
              demanda (más aire y más atemperación, vapor más frío) y el ciclo del lecho.
            </p>
          }
          decision={
            <p>
              Recomiendo usar la zona de carga y la fase del lecho como contexto de las alertas, para que lo normal se
              compare con su zona. Investigar el eje de más aire y atemperación como oportunidad de eficiencia. En el
              ingenio, registrar la carga y los eventos de operación (descargas, compuertas, lazos en manual), que hoy
              hay que deducir de los datos.
            </p>
          }
          impacto={
            <p>
              Directo, ninguno: es diagnóstico. Es la base de las alertas (pregunta 4) y de la eficiencia (pregunta 5).
              Que las alertas por zona den menos falsas alarmas que un umbral fijo es una hipótesis que pide más
              historia.
            </p>
          }
          riesgo={
            <p>
              Cinco días sin arranques, paros ni cargas extremas, que serían los regímenes realmente distintos: con más
              historia aparecerían como modos separados. Las zonas son cortes de un continuo, no estados: una ventana
              cerca del borde puede caer en una u otra.
            </p>
          }
          certeza={{
            nivel: CERTEZA.modos,
            texto: `Alta en que la carga domina, en el ciclo del lecho (${ciclosN} ciclos con el mismo patrón y llenados de ${num(cl.llenado.minutos_min / 60, 1)} a ${num(cl.llenado.minutos_max / 60, 1)} h) y en que la atemperación enfría el vapor (r = ${num(rezagoAgua.r, 2)}). Media en las zonas de carga (ARI ~${num(p2.ari, 1)}) y en la explicación física del eje de exceso de aire, que se confirma con una prueba en planta.`,
          }}
        />
      </Seccion>

      {/* ── Pregunta 3 · sensor virtual ────────────────────────────────────── */}
      <Seccion
        id="vapor"
        titulo="La caída de presión ya mide el vapor"
        entrada={
          <p>
            Un modelo lineal se equivoca {num(ridge.MAE_t_h, 2)} t/h ({num(ridge["MAPE_%"], 2)} %) en días que no vio, y
            uno más complejo es peor. Recomiendo ponerlo en línea como respaldo del medidor.
          </p>
        }
        cifras={
          <FilaCifras columnas={2}>
            <Cifra valor={num(ridge.MAE_t_h, 2)} unidad="t/h" etiqueta="Error típico del sensor virtual elegido" detalle={`Ridge completo: ${num(ridge["MAPE_%"], 2)} %, R² ${num(ridge.R2, 2)}, validado hacia adelante por día.`} />
            <Cifra tono="tinta" valor={num(hidra.MAE_t_h, 2)} unidad="t/h" etiqueta="Con una sola variable física" detalle={`√(ΔP·ρ) del sobrecalentador: ${num(hidra["MAPE_%"], 1)} %, R² ${num(hidra.R2, 2)}.`} />
          </FilaCifras>
        }
      >
        {/* fuente de "30 min de separación" y "banda de 90 %": notebook 08, celdas 7 y 16 */}
        <Figura
          numero={5}
          titulo={`Medido contra estimado el ${fechaCorta(diaElegido)}, un día que el modelo no vio`}
          ancho="total"
          nota={`Minuto a minuto. Ese día el error medio fue ${num(maeDia, 2)} t/h. El modelo se entrenó solo con los días anteriores, con 30 min de separación. La banda de 90 % que sale de los errores de días anteriores cubrió el ${pct(banda["cobertura (meta 90 %)"], 0)} de los minutos, con ${num(banda["ancho medio (t/h)"], 2)} t/h de ancho medio.`}
          fuente="notebook 08, secciones 3 y 5 · outputs/tables/serie2_predicciones_p3.csv"
        >
          <GraficoMedidoEstimado puntos={puntosDia} dia={fechaCorta(diaElegido)} />
        </Figura>

        <div className={s.pareja}>
          <Figura
            numero={6}
            titulo="El vapor sigue una recta contra la caída de presión"
            ancho="total"
            nota={`${muestraVapor.length} minutos del ${fechaMuestraVapor}. La recta es la del modelo hidráulico ajustado con los cinco días: vapor = ${num(p3.hidraulico.a, 2)} + ${num(p3.hidraulico.b, 1)} · √(ΔP·ρ). Vale en el rango observado, no para extrapolar a carga mínima.`}
            fuente="notebook 08 · outputs/tables/serie2_muestra_api_vapor.csv"
          >
            <GraficoHidraulico puntos={puntosHidra} a={p3.hidraulico.a} b={p3.hidraulico.b} />
          </Figura>
          <Figura
            numero={7}
            titulo="El Ridge completo gana; el gradient boosting no mejora al lineal"
            ancho="total"
            nota={`Error típico (MAE) en ${num(ridge.filas, 0)} minutos de cuatro días de prueba. La diferencia del Ridge contra el hidráulico es ${num(compRidgeHidra.dif_MAE, 3)} t/h (intervalo de 90 %: ${compRidgeHidra.IC90.replace(/-/g, "−")}); contra el boosting, ${num(p3.comparaciones[1].dif_MAE, 3)} t/h (${p3.comparaciones[1].IC90.replace(/-/g, "−")}). Ningún intervalo toca el cero: las dos diferencias son significativas por bootstrap de bloques de 1 h.`}
            fuente="notebook 08, sección 3 · outputs/tables/serie2_resumen_p3.json"
          >
            <GraficoModelos filas={filasModelos} />
          </Figura>
        </div>

        <Par
          margen={
            <>
              <h3>Qué descarté</h3>
              <p>
                Que un modelo no lineal estime mejor el vapor. El gradient boosting recibe la misma variable física y queda{" "}
                {num(boosting.MAE_t_h - ridge.MAE_t_h, 1)} t/h peor que el Ridge: la relación es lineal en la variable
                física correcta. Y descarté la validación cruzada al azar para series de tiempo. Cada minuto de prueba
                tiene a sus vecinos, casi iguales, en el entrenamiento, y el modelo recuerda en vez de predecir. El más
                engañado es el boosting: al azar promete {num(p3.al_azar["Gradient boosting"]["MAE al azar"], 2)} t/h y
                hacia adelante da {num(p3.al_azar["Gradient boosting"]["MAE hacia adelante"], 2)} t/h.
              </p>
              <EnLaApi ruta="POST /caldera/vapor-virtual" herramienta>
                Recibe los últimos {sensorVirtual.ventana_media_min} minutos de los demás sensores y devuelve el vapor
                estimado, su banda de 90 % y la comparación con el medido. Una prueba comprueba que da lo mismo que el
                Ridge del notebook 08.{/* fuente: tests/test_api_caldera_mercado.py, test_vapor_virtual_reproduce_el_ridge_final */}
              </EnLaApi>
            </>
          }
        >
          <p>
            Un <strong>sensor virtual</strong> estima con otras variables lo que mide un instrumento. Sirve de respaldo
            cuando el medidor falla, para verificarlo todo el tiempo y para tener una cifra de vapor confiable en el
            cálculo de eficiencia. Nunca usé el propio vapor del pasado: el sensor virtual tiene que funcionar cuando el
            medidor no está.
          </p>
          <p>
            La idea física es la de una placa de orificio. El vapor pierde presión por roce al pasar del domo al
            colector, y esa pérdida crece con el flujo. Si ΔP es esa caída de presión y ρ la densidad del vapor, el flujo
            es proporcional a √(ΔP·ρ).
          </p>
          <p>
            Comparé cinco modelos, del más simple al más complejo: la media de los días anteriores (el piso), el
            hidráulico con esa sola variable, un Ridge de combustión sin presiones de vapor, un Ridge completo con todas
            las variables y un gradient boosting. Ridge es una regresión lineal que reparte el peso entre variables
            parecidas. El gradient boosting suma muchos árboles de decisión y capta curvas, si las hay.
            {/* fuente: notebook 08, celda 7 */}
          </p>
          <p>
            Validé hacia adelante: entrenar con los días anteriores y probar el día siguiente completo. Una validación al
            azar habría escondido entre {num(Math.min(...optimismos), 0)} y {num(Math.max(...optimismos), 0)} % del error.
          </p>
          <Formula a={p3.dos_variables.a} b={p3.dos_variables.b} c={p3.dos_variables.c} mae={dosVar} />
          <p>
            Dos variables físicas hacen casi todo el trabajo. Con la caída de presión sola el error es{" "}
            {num(anidados[0].mae, 2)} t/h; al sumar el agua de atemperación baja a {num(dosVar, 2)} t/h. Todo lo demás
            junto (rezagos, temperaturas, aire) aporta ~{num(dosVar - ridge.MAE_t_h, 2)} t/h más.
          </p>
        </Par>

        <div className={s.detalle}>
          <Desplegable titulo="Detalle técnico: validación, respaldo sin presiones y el notebook 08">
            <div className={s.lecturaDetalle}>
              <p>
                Datos: promedios de 1 min. Variables: el valor actual de cada sensor, sus rezagos de 1, 2 y 5 min y su
                media de los últimos 10 min, sin el propio vapor. Validación hacia adelante por día: se entrena con los días
                anteriores y se predice el siguiente completo (4 pliegues), con 30 min de separación.
                {/* fuente: notebook 08, celdas 6 y 7 */}
              </p>
              <p>
                <strong>Sin presiones de vapor</strong>, el respaldo con aire, tiro, hogar y atemperación se equivoca{" "}
                {num(combustion.MAE_t_h, 2)} t/h ({num(combustion["MAPE_%"], 1)} %). Aire y tiro es el grupo que más pesa:
                sin él, el error sube {num(mec["Aire y tiro"]["aumento del MAE al quitarlo"], 2)} t/h. El lecho no ayuda.
                Sumar los valores de 1 y 2 minutos atrás baja el error ~{num(mejoraRezagos, 2)} t/h; ir más atrás no
                agrega. La caldera responde en 1 a 2 minutos.{/* fuente: notebook 08, celda 15 */}
              </p>
            </div>
            <Tabla
              compacta
              titulo="Validación al azar contra hacia adelante (MAE, t/h)"
              columnas={[
                { clave: "modelo", titulo: "Modelo" },
                { clave: "azar", titulo: "Al azar", tipo: "num", valor: (f) => num(f.azar, 3) },
                { clave: "adelante", titulo: "Hacia adelante", tipo: "num", valor: (f) => num(f.adelante, 3) },
                { clave: "optimismo", titulo: "Error que esconde", tipo: "num", valor: (f) => pct(f.optimismo, 0) },
              ]}
              filas={Object.entries(p3.al_azar).map(([modelo, x]) => ({ modelo, azar: x["MAE al azar"], adelante: x["MAE hacia adelante"], optimismo: x["optimismo (%)"] }))}
            />
            <Tabla
              compacta
              titulo="Modelos anidados: qué agrega cada variable (MAE hacia adelante, t/h)"
              columnas={[
                { clave: "variables", titulo: "Variables" },
                { clave: "mae", titulo: "MAE", tipo: "num", valor: (f) => num(f.mae, 3) },
              ]}
              filas={anidados}
            />
            <Tabla
              compacta
              titulo="Sin presiones de vapor: qué grupo de variables explica el vapor (MAE, t/h)"
              columnas={[
                { clave: "grupo", titulo: "Grupo" },
                { clave: "solo", titulo: "Solo con este grupo", tipo: "num", valor: (f) => num(f.solo, 2) },
                { clave: "quitar", titulo: "Aumento al quitarlo", tipo: "num", valor: (f) => num(f.quitar, 2) },
              ]}
              filas={Object.entries(mec).map(([grupo, x]) => ({ grupo, solo: x["MAE solo con este grupo"], quitar: x["aumento del MAE al quitarlo"] }))}
            />
            <h3>Figuras originales del notebook 08</h3>
            <div className={s.figurasNotebook}>
              <ImagenNotebook nombre="serie2_10_hidraulico" alt="Vapor medido contra la raíz de la caída de presión por la densidad." />
              <ImagenNotebook nombre="serie2_13_medido_vs_estimado" alt="Vapor medido contra estimado por los modelos." />
              <ImagenNotebook nombre="serie2_11_rezagos" alt="Correlación de cambios de cada variable con el vapor según el rezago." />
              <ImagenNotebook nombre="serie2_12_mecanismos" alt="Error del modelo de combustión por grupo de variables." />
            </div>
            <p><a href={archivoRepo(NOTEBOOKS.vapor)}>Abrir el notebook 08 en GitHub</a></p>
          </Desplegable>
        </div>

        <Evaluacion
          serie="caldera"
          significa={
            <p>
              La caldera ya trae un segundo medidor de vapor sin saberlo: la caída de presión entre el domo y el
              colector. Con ella sola, el vapor se estima con {num(hidra["MAPE_%"], 1)} % de error. Con todas las
              variables, un modelo lineal llega a {num(ridge["MAPE_%"], 2)} % en días que no vio. Si fallan las
              presiones, el aire, el tiro y el hogar dan un respaldo de {num(combustion["MAPE_%"], 1)} %.
            </p>
          }
          decision={
            <p>
              Recomiendo poner en línea el Ridge completo como sensor virtual, con el modelo de dos variables como
              verificación física y el de combustión como respaldo. La diferencia medido menos estimado sirve de alarma
              de deriva del medidor (pregunta 4). En las calderas de bagazo, revisar primero si existen las presiones del
              domo y de la salida del sobrecalentador: con ellas se replica el sensor hidráulico casi sin modelar.
            </p>
          }
          impacto={
            <p>
              Detecta desvíos sostenidos del medidor desde ~{num(minimaVapor, 1)} t/h (~{num(sensVaporPct, 0)} %). En la
              prueba de la pregunta 4, una deriva se detectó a las{" "}
              {num(Number(deriva["minutos hasta la alarma"]) / 60, 1)} h, con ~0.9 t/h de error.{/* fuente de "~0.9 t/h": notebook 09, celda 10 (0.87 t/h) */}{" "}
              Evita operar a ciegas si el medidor sale de servicio. Cada 1 % de error en 60 t/h son 0.6 t/h mal
              contadas, unas 14 t de vapor al día.{/* fuente: notebook 08, celda 25 */}
            </p>
          }
          riesgo={
            <p>
              Probado entre {num(vaporMin1, 1)} y {num(vaporMax1, 1)} t/h, en cinco días de operación normal: fuera de ese
              rango (arranques, carga mínima) no está probado. El vapor &quot;medido&quot; ya es un cálculo compensado, y
              el modelo aprende ese cálculo. Si las dos presiones fallan juntas, por ejemplo por una toma común, caen a la
              vez el modelo completo y el hidráulico. Las presiones tienen resolución de 0.01 MPa: sirven en promedios de
              1 min, no a 5 s.
            </p>
          }
          certeza={{
            nivel: CERTEZA.vapor,
            texto: `Alta en el orden de los modelos (4 días de prueba hacia adelante y diferencias significativas por bootstrap de bloques) y en que la relación es física. Media en la banda de 90 %: cubrió el ${pct(banda["cobertura (meta 90 %)"], 0)}.`,
          }}
        />
      </Seccion>

      {/* ── Pregunta 4 · anomalías ─────────────────────────────────────────── */}
      <Seccion
        id="anomalias"
        titulo="Un sensor dañado se separa de sus pares"
        entrada={
          <p>
            Una falla del equipo, en cambio, mueve varias variables a la vez. Con esa regla propongo vigilar la caldera
            en tres capas.
          </p>
        }
        cifras={
          <FilaCifras columnas={2}>
            <Cifra valor={`${aciertos} de ${iny.length}`} etiqueta="Fallas inyectadas bien diagnosticadas" detalle={`${nSensorIny} de sensor y ${iny.length - nSensorIny} de equipo, sobre datos reales.`} />
            <Cifra valor={`~${num(alarmasDia, 0)}`} unidad="por día" etiqueta="Alarmas entre las tres capas" detalle={`${num(reglasDia, 1)} de reglas, ${num(p4.verificacion_episodios_dia, 1)} de verificación y ${num(p4.monitor_episodios_dia, 1)} del monitor. Sale en parte por construcción.`} />
          </FilaCifras>
        }
      >
        <Figura
          numero={8}
          titulo="Con el O₂ dañado salta la verificación y el monitor no; con la compuerta abierta, al revés"
          ancho="total"
          nota={`Elija una falla. Las dos señales están en veces su umbral: por encima de 1 hay alarma si dura ${p4.parametros.persistencia_min} min. Fuera del sombreado, lo que pasa de 1 son eventos reales de esos días, como la redistribución del aire de retorno del ${fechaCorta(p1.salto_retorno)}.`}
          fuente="notebook 09, sección A.4 · outputs/tables/serie2_inyecciones_series.csv"
        >
          {/* Abre en el O₂ con sesgo, el caso del título; la compuerta es el contraste. */}
          <SimuladorFallas escenarios={escenarios} inicial={Math.max(0, escenarios.findIndex((e) => e.nombre === sesgoO2.escenario))} />
        </Figura>

        {/* fuente de "cada 5 s", "24 h", "cada hora" y de los días de cada tasa: notebook 09, celdas 2, 7 y 14 */}
        <Tabla
          titulo="Tres capas, cada una responde una pregunta distinta"
          ancho="total"
          movil="apilar"
          columnas={[
            { clave: "capa", titulo: "Capa" },
            { clave: "mira", titulo: "Qué mira" },
            { clave: "responde", titulo: "Responde" },
            { clave: "dia", titulo: "Alarmas por día", tipo: "num", valor: (f) => num(f.dia, 1) },
          ]}
          filas={[
            { capa: "Reglas físicas", mira: `${reglas.length} umbrales con persistencia, cada 5 s`, responde: "¿Hay que actuar ya?", dia: reglasDia },
            { capa: "Verificación de sensores", mira: `${Object.keys(sens).length} chequeos: cada sensor contra sus pares o un modelo físico`, responde: "¿Falló un sensor?", dia: p4.verificacion_episodios_dia },
            { capa: "Monitor de proceso", mira: "PCA (resume las variables en pocos ejes) de las últimas 24 h, reentrenada cada hora: T² mide operación inusual y SPE, variables que dejan de moverse juntas", responde: "¿La caldera opera fuera de lo normal?", dia: p4.monitor_episodios_dia },
          ]}
          nota="Reglas medidas en 5 días con umbrales calibrados en estos mismos datos; verificación en 3 días de evaluación; monitor en 4 días. Fuente: notebook 09, parte A."
        />

        <Par
          margen={
            <>
              <h3>Qué descarté</h3>
              <p>
                Un monitor de proceso fijo. Una PCA entrenada una vez con 36 h ponía en alarma el 75 % del tiempo de los
                días 3 a 5,{/* fuente: bitácora, Serie II, Uso de IA, error 6 */} por la deriva lenta de las temperaturas y
                la redistribución del aire de retorno. La ventana móvil de 24 h absorbe la deriva y conserva lo que cambia
                en minutos. También descarté un umbral único para todos los chequeos: con 8 desvíos no se veía una deriva
                del 3 % en el vapor ni un sesgo de 0.6 puntos en el O₂.{/* fuente: bitácora, Serie II, Uso de IA, error 7 */}{" "}
                Cada chequeo tiene su umbral y su falla mínima detectable.
              </p>
              {/* fuente de "de 1 a 120 minutos": docs/api.md, POST /caldera/verificar */}
              <EnLaApi ruta="POST /caldera/verificar" herramienta>
                Recibe de 1 a 120 minutos y devuelve el puntaje de cada chequeo, las alarmas y el diagnóstico. Las pruebas
                comprueban que coincide con el código del notebook 09 y que tres presiones movidas juntas dan un evento del
                hogar, no tres sensores dañados.{/* fuente: tests/test_api_caldera_mercado.py, test_verificar_* */}
              </EnLaApi>
            </>
          }
        >
          <p>
            La idea central es física. <strong>Un sensor que falla se separa de sus pares y de la física:</strong> su
            gemelo, sus vecinos y los balances siguen diciendo otra cosa. <strong>Un equipo que falla mueve varias
            variables acopladas a la vez, y los sensores redundantes coinciden.</strong> Si las seis presiones de hogar
            suben juntas, el hogar se presurizó; si sube una sola, falló esa.
          </p>
          <h3>La regla de diagnóstico</h3>
          <ol>
            <li>Si salta un chequeo de verificación o un sensor congelado, es <strong>falla de sensor</strong>, y se nombra cuál. Llamar a instrumentación y no corregir la operación por ese sensor.</li>
            <li>Si saltan dos o más presiones de hogar a la vez, no son varios sensores dañados: es un evento del hogar.</li>
            <li>Si no salta ningún chequeo pero sí el monitor o una regla, es <strong>proceso o equipo</strong>. Revisar la operación con las variables que señala.</li>
          </ol>
          <p>
            Cada chequeo ve hasta donde le deja su ruido. El del medidor de vapor ve una deriva desde{" "}
            {num(minimaVapor, 1)} t/h, ~{num(sensVaporPct, 0)} % del flujo. El más grueso es el de los termopares de gases:
            solo ve derivas de {num(minimaGases, 0)} °C, porque la diferencia izquierda-derecha varía mucho por sí sola.
          </p>
        </Par>

        <Tabla
          titulo="Reglas para el jefe de calderas"
          ancho="total"
          movil="apilar"
          columnas={[
            { clave: "regla", titulo: "Regla (umbral y persistencia)" },
            { clave: "dia", titulo: "Eventos por día", tipo: "num", valor: (f) => num(f.dia, 1) },
            { clave: "minutos", titulo: "Minutos en 5 días", tipo: "num", valor: (f) => num(f.minutos, 1) },
            { clave: "accion", titulo: "Qué hacer" },
          ]}
          filas={reglas.map(([regla, r]) => ({ regla, dia: r["eventos por día"], minutos: r["minutos en 5 días"], accion: ACCION[regla.split(" (")[0]] ?? "" }))}
          nota="Los umbrales se fijaron con estos mismos datos para que cada regla dispare cerca de una vez al día o menos: sus frecuencias salen en parte por construcción. Con los límites de diseño de la caldera se reemplazan."
        />

        <div className={s.detalle}>
          <Desplegable titulo="Detalle técnico: las cinco fallas, qué tan fina es cada verificación y el notebook 09">
            {/* fuente: notebook 09, celda 10: la deriva del vapor llevaba 0.87 t/h de error al detectarse */}
            <Tabla
              titulo="Las cinco fallas inyectadas y qué capa las vio"
              ancho="total"
              movil="apilar"
              columnas={[
                { clave: "escenario", titulo: "Falla" },
                { clave: "real", titulo: "Tipo real", valor: (f) => (f.real === "sensor" ? "sensor" : "equipo") },
                { clave: "verificacion", titulo: "Verificación" },
                { clave: "monitor", titulo: "Monitor" },
                { clave: "minutos", titulo: "Primera alarma (min)", tipo: "num", valor: (f) => num(f.minutos, 0) },
                { clave: "diagnostico", titulo: "Diagnóstico" },
              ]}
              filas={escenarios.map((e) => ({
                escenario: e.nombre,
                real: e.real,
                verificacion: e.verificacion === "ninguno" ? "no salta" : e.verificacion,
                monitor: e.monitor === "no" ? "no salta" : `salta (${e.monitor})`,
                minutos: e.minutos,
                diagnostico: `${e.diagnostico.startsWith("Falla de sensor") ? "sensor" : "proceso o equipo"} (${e.acierta ? "correcto" : "incorrecto"})`,
              }))}
              destacar={(f) => f.real !== "sensor"}
              nota={`La deriva del medidor de vapor se detectó a las ${num(Number(deriva["minutos hasta la alarma"]) / 60, 1)} h, cuando el error inyectado iba en ~0.9 t/h. El termopar con deriva también disparó el monitor, ${num(Number(termopar["minutos hasta la alarma"]) - Number(termopar["min. hasta el monitor"]), 0)} min antes que su chequeo: durante esos minutos el diagnóstico habría sido proceso, el costo de un chequeo de gases grueso. Cuando la verificación nombra un sensor, la alarma del monitor se atribuye a ese sensor. La compuerta la vio el monitor en ${num(Number(compuerta["min. hasta el monitor"]), 0)} min y la regla de O₂ alto en ${num(Number(compuerta["min. hasta la regla"]), 0)}.`}
            />
            {/* fuente de "5, 6, 7, 8 o 10 desvíos" y "2 días de referencia": notebook 09, celda 4 (sección A.2) */}
            <Tabla
              compacta
              titulo="Qué tan fina es cada verificación"
              columnas={[
                { clave: "chequeo", titulo: "Chequeo", valor: (f) => legible(f.chequeo) },
                { clave: "ruido", titulo: "Ruido normal (1 desvío)", tipo: "num", valor: (f) => num(f.ruido, 2) },
                { clave: "umbral", titulo: "Umbral (desvíos)", tipo: "num" },
                { clave: "minima", titulo: "Falla mínima detectable", tipo: "num", valor: (f) => num(f.minima, 2) },
                { clave: "unidad", titulo: "Unidad" },
              ]}
              // El ruido se calcula como falla mínima / umbral: así sale el valor sin el redondeo a 3 decimales del JSON
              // y coincide con el notebook 09 (0.26 t/h en el vapor, no 0.27).
              filas={Object.entries(sens).map(([chequeo, x]) => ({ chequeo, ruido: x["falla mínima detectable"] / x["umbral (desvíos)"], umbral: x["umbral (desvíos)"], minima: x["falla mínima detectable"], unidad: x.unidad }))}
              nota={`Hay alarma si el chequeo supera su umbral ${p4.parametros.persistencia_min} min seguidos; se apaga tras ${p4.parametros.apagado_min} min sin condición. El umbral de cada chequeo es el menor de 5, 6, 7, 8 o 10 desvíos que no dio alarmas en los 2 días de referencia. El sesgo del O₂ izquierdo se vio en ${num(Number(sesgoO2["minutos hasta la alarma"]), 0)} min.`}
            />
            <h3>Figura original del notebook 09</h3>
            <div className={s.figurasNotebook}>
              <ImagenNotebook nombre="serie2_14_sensor_vs_proceso" alt="Falla de sensor contra falla de equipo: qué capa responde en cada caso." />
            </div>
            <p><a href={archivoRepo(NOTEBOOKS.anomalias)}>Abrir el notebook 09 en GitHub</a></p>
          </Desplegable>
        </div>

        <Evaluacion
          serie="caldera"
          significa={
            <p>
              Con los sensores que ya tiene, una caldera se vigila en tres capas: reglas para actuar, verificación de
              sensores y un monitor que aprende lo normal del último día. La redundancia es lo que permite distinguir un
              sensor dañado de un problema real. Con un solo sensor por variable esa distinción no existe.
            </p>
          }
          decision={
            <p>
              Recomiendo empezar con las {reglas.length} reglas físicas y ajustar sus umbrales con los límites de
              diseño. Activar la verificación sobre los pares que existen, con confirmación del operador en cada alarma.
              Usar el monitor de proceso como segunda opinión diaria, no como alarma sonora, hasta juntar 2 a 3 meses de
              eventos confirmados.{/* fuente: notebook 09, celda 14 */} En las calderas de bagazo, instalar redundancia donde hoy hay un solo sensor crítico,
              como el O₂ y la presión de hogar.
            </p>
          }
          impacto={
            <p>
              Evita corregir la combustión por un analizador de O₂ dañado. Detecta desvíos del medidor de vapor desde
              ~{num(minimaVapor, 1)} t/h. Mantiene unas {num(alarmasDia, 0)} alarmas por día, todas con diagnóstico. El
              valor en dinero depende del costo de las fallas que se eviten: sin fallas reales en estos días no se puede
              estimar.
            </p>
          }
          riesgo={
            <p>
              {/* fuente: notebook 09, celda 14 (riesgos) */}
              Las fallas de prueba son sintéticas; las reales pueden ser más sutiles. La referencia de 2 días es corta: un
              cambio legítimo, como la redistribución del aire, alarma hasta que el operador lo confirma. Una falla común
              a los dos sensores de un par, como una toma compartida, no la ve la verificación.
            </p>
          }
          certeza={{
            nivel: CERTEZA.anomalias,
            texto: `Alta en el criterio sensor contra equipo: ${aciertos} de ${iny.length} bien clasificadas y el criterio es físico. Media en las tasas de alarma (3 días de evaluación). Baja en los umbrales exactos, que se ajustan con el jefe de calderas.`,
          }}
        />
      </Seccion>

      {/* ── Pregunta 5 · eficiencia ────────────────────────────────────────── */}
      <Seccion
        id="eficiencia"
        titulo="Limpiar los tubos vale más que bajar el aire"
        entrada={
          <p>
            Los gases se calientan {num(gases["°C por día"], 2)} °C por día a igual operación. Recomiendo limpiar por
            temperatura de gases, no por calendario.
          </p>
        }
        cifras={
          <FilaCifras columnas={2}>
            <Cifra valor={milesUsd} unidad="mil US$ al año" etiqueta="Si la deriva es ensuciamiento" detalle={`${num(ens["0.3"].puntos_eficiencia, 2)} a ${num(ens["0.7"].puntos_eficiencia, 2)} puntos de eficiencia, con supuestos declarados.`} />
            <Cifra tono="tinta" valor={num(aire.puntos_eficiencia, 2)} unidad="puntos" etiqueta="Lo que ahorra bajar el exceso de aire" detalle={`${usd(aire.us_ano, 0)} al año: la caldera ya opera con O₂ mediano de ${num(p5.o2_objetivo, 2)} %.`} />
          </FilaCifras>
        }
      >
        <Figura
          numero={9}
          titulo="Recuperar la deriva de los gases vale más que cualquier otra oportunidad, aun en su cálculo más bajo"
          ancho="total"
          nota={`Con los supuestos declarados (combustible a ${usd(sup.precio_combustible_t, 0)}/t, ${num(sup.horas_ano, 0)} h al año). El tramo de la limpieza sale de variar la fracción del calor que llega a la chimenea entre ${num(Number(Object.keys(ens)[0]), 1)} y ${num(Number(Object.keys(ens)[2]), 1)}; el punto es ${num(Number(Object.keys(ens)[1]), 1)}. Limpiar el doble de seguido vale poco porque cada ciclo ya se limpia.`}
          fuente="notebook 09, secciones B.1 y B.2 · outputs/tables/serie2_resumen_p5.json"
        >
          <GraficoOportunidades filas={filasOportunidades} sinEstimar="Temperatura del vapor" />
        </Figura>

        <Figura
          numero={10}
          titulo="Los gases suben entre limpiezas, caen de golpe y cada día terminan más arriba"
          ancho="total"
          nota={`Temperatura de gases a la salida del economizador menos lo que se espera por la carga y el O₂, promedio por hora. El serrucho es compatible con ensuciamiento y soplado de hollín (limpieza de los tubos con vapor o aire a presión), pero no hay registro de soplados: es una hipótesis. Los picos llegan ~${num(serr.desfase_descarga_h, 1)} h después de iniciar una descarga del lecho, antes de lo que daría el azar (~${num(serr.desfase_azar_h, 1)} h; p = ${num(serr.p_desfase, 3)}). O la limpieza va en la misma rutina del turno, o el ciclo del lecho mueve la temperatura de gases.`}
          fuente="notebook 09, sección B.1 · outputs/tables/serie2_resumen_p5.json"
        >
          <GraficoSerrucho puntos={puntosGases} pendiente={gases["°C por día"]} periodo={serr.periodo_h} />
        </Figura>

        <Par
          margen={
            <>
              <h3>Qué descarté</h3>
              <p>
                Que bajar el exceso de aire fuera la gran oportunidad en esta caldera: ya opera con ~{num(p5.o2_objetivo, 1)} %
                de O₂ y el ahorro es menor a 0.1 punto. También descarté leer la deriva de los gases como una tendencia
                lineal: el gráfico por hora mostró un serrucho. Queda una alternativa que no puedo separar: la temperatura
                ambiente subiendo en primavera también calienta el aire. No explica el serrucho, pero sin el dato de
                ambiente la deriva de la base no se separa del clima.
              </p>
            </>
          }
        >
          <p>
            Los datos no traen flujo de combustible, temperatura de chimenea ni CO. La eficiencia absoluta no se puede
            medir. Sí se pueden medir efectos relativos a igual carga y traducirlos a combustible con supuestos
            declarados: con ellos, la caldera usa {num(p5.combustible_t_h, 2)} t/h de combustible para{" "}
            {num(p5.calor_util_gj_h, 1)} GJ/h de calor útil.
          </p>
          <h3>Limpieza de superficies</h3>
          <p>
            Si los tubos del sobrecalentador y del economizador se ensucian, absorben menos calor y los gases salen más
            calientes. A igual carga y O₂, la temperatura de gases hace dos cosas. Primero, un serrucho: sube, cae de
            golpe ~{num(-serr.caida_c, 0)} °C y vuelve a subir, con un pico cada ~{num(serr.periodo_h, 1)} h ({serr.picos}{" "}
            picos en cinco días). Segundo, una base que sube {num(gases["°C por día"], 2)} °C por día (intervalo de 90 %:{" "}
            {num(gases["IC90 bajo"], 2)} a {num(gases["IC90 alto"], 2)}), ~{num(gases["°C por día"] * 5, 0)} °C en cinco
            días, también a igual hora del día. El aire precalentado también sube (
            {num(tend["Aire primario precalentado"]["°C por día"], 2)} °C por día) y el hogar casi no cambia: es coherente
            con superficies que absorben menos calor sin que cambie el fuego.
          </p>
        </Par>

        <div className={`columnas ${s.dosTextos}`}>
          <div>
            <h3>Exceso de aire</h3>
            <p>
              A igual carga, cada punto de O₂ calienta los gases {num(efO2["Temperatura de gases (°C por punto de O₂)"].efecto, 2)} °C,
              y la corriente del tiro sube {num(efO2["Corriente del tiro inducido (A por punto de O₂)"].efecto, 2)} A: más
              aire es más gas que calentar y que mover. Pero la caldera ya opera con poco exceso de aire. Bajar el O₂ a la
              mediana cuando la supera (en promedio {num(p5.o2_exceso_medio, 2)} puntos) ahorra{" "}
              {num(aire.puntos_eficiencia, 2)} puntos, unos {usd(aire.us_ano, 0)} al año, más {num(p5.kw_tiro, 1)} kW en el
              tiro. Sin un analizador de CO, bajar más el O₂ arriesga inquemados, que cuestan más de lo que se ahorra.
            </p>
            <p>
              <strong>En las calderas de bagazo esta es la palanca principal.</strong> Por la humedad del bagazo suelen
              operar con mucho más exceso de aire, y el mismo cálculo daría cifras varias veces mayores.
            </p>
          </div>
          <div>
            <h3>Temperatura del vapor, sin estimación</h3>
            <p>
              La válvula del atemperador pasó {num(p1.horas_valvula_fija, 0)} h fija. A igual carga y O₂, cada t/h de agua
              de atemperación baja el vapor {num(Math.abs(p5.vapor.efecto_agua), 1)} °C. El vapor promedia{" "}
              {num(p5.vapor.media, 1)} °C y pasa el {pctFraccion(p5.vapor.bajo535, 0)} del tiempo bajo 535 °C. Controlar
              mejor la atemperación protege los tubos y acerca la media a la de diseño, pero el beneficio está en la
              turbina y no se puede estimar sin sus datos.
            </p>
          </div>
        </div>

        <Tabla
          titulo="Qué datos harían falta para estimar con confianza"
          ancho="total"
          columnas={[
            { clave: "dato", titulo: "Dato" },
            { clave: "para", titulo: "Para qué" },
          ]}
          filas={DATOS_FALTANTES}
        />

        <div className={s.detalle}>
          <Desplegable titulo="Detalle técnico: supuestos del cálculo y el notebook 09">
            <Tabla
              compacta
              titulo="Supuestos del cálculo"
              columnas={[
                { clave: "supuesto", titulo: "Supuesto" },
                { clave: "valor", titulo: "Valor", tipo: "num" },
              ]}
              filas={SUPUESTOS.map(([clave, supuesto, formato]) => ({ supuesto, valor: formato(sup[clave]) }))}
              nota="Cada supuesto está en SupuestosCaldera (src/fabrica_eficiencia.py) y se reemplaza por el dato real. Solo varié la fracción a chimenea (±40 %); los demás moverían más el resultado."
            />
            <h3>Figura original del notebook 09</h3>
            <div className={s.figurasNotebook}>
              <ImagenNotebook nombre="serie2_15_ensuciamiento" alt="Temperatura de gases a igual carga y O₂: serrucho de limpieza y deriva de la base." />
            </div>
            <p><a href={archivoRepo(NOTEBOOKS.anomalias)}>Abrir el notebook 09 en GitHub</a></p>
          </Desplegable>
        </div>

        <Evaluacion
          serie="caldera"
          significa={
            <p>
              En esta caldera la oportunidad medible más clara es la limpieza de superficies. El exceso de aire ya está
              bajo y da poco. La temperatura del vapor tiene margen, pero su valor está en la turbina. La lección
              principal es de datos: sin combustible, chimenea y CO, la eficiencia solo se estima en relativo.
            </p>
          }
          decision={
            <p>
              Recomiendo cruzar el serrucho y la deriva de los gases con el registro de soplado de hollín, disparar la
              limpieza por temperatura de gases y no por calendario, y revisar qué zona no se está limpiando. Poner la
              atemperación en automático y revisar su sintonía. Instalar o recuperar la medición de combustible,
              temperatura de chimenea y CO: en bagazo, el control del exceso de aire con CO es la primera palanca.
            </p>
          }
          impacto={
            <p>
              Limpieza, si la deriva es ensuciamiento: {num(ens["0.3"].puntos_eficiencia, 2)} a{" "}
              {num(ens["0.7"].puntos_eficiencia, 2)} puntos de eficiencia, unos US${milesUsd} mil al año. Exceso de aire:{" "}
              {num(aire.puntos_eficiencia, 2)} puntos. En el ingenio, el mismo método con bagazo y O₂ alto daría cifras
              mayores, que habría que medir.
            </p>
          }
          riesgo={
            <p>
              {/* fuente de "±40 %": notebook 09, celda 25 (riesgos) */}
              El valor en dinero depende de supuestos: la fracción del calor que llega a la chimenea lo mueve ±40 %, y los
              demás no se variaron. La deriva puede ser en parte clima, el serrucho puede venir del ciclo del lecho y no de
              la limpieza, y bajar el O₂ sin CO arriesga inquemados.
            </p>
          }
          certeza={{
            nivel: CERTEZA.eficiencia,
            texto: "Alta en los efectos relativos medidos (el serrucho, la deriva de los gases y el efecto del O₂ en gases y tiro, con errores robustos a autocorrelación). Media en la causa del serrucho. Baja en el valor en dinero, que depende de supuestos.",
          }}
        />
      </Seccion>

      {/* ── Cierre ─────────────────────────────────────────────────────────── */}
      <Seccion
        id="cierre"
        titulo="Primero los sensores y el vapor virtual"
        entrada={
          <p>
            Lo que se traslada al ingenio es el método: auditar archivos y sensores, aprovechar la redundancia, validar
            hacia adelante y declarar cada supuesto.
          </p>
        }
        cifras={
          // Al lado del encabezado: cómo pasa el análisis a producción. Así la columna derecha trabaja desde el h2.
          <div className={s.panelCierre}>
            <h3>De los notebooks a producción</h3>
            <p>
              Los notebooks 06 a 09 guardan sus modelos en JSON. La API (FastAPI en Cloud Run) los lee y sirve cuatro
              consultas de la caldera: los sensores con su tratamiento, la zona de carga, el vapor virtual con su banda y
              la verificación de sensores con diagnóstico. Sus pruebas comprueban que repite las cifras de los
              notebooks.{/* fuente: api/caldera.py (lee outputs/models/serie2_*.json) y tests/test_api_caldera_mercado.py */}
            </p>
            <p className={s.enlaces}>
              <Link href="/herramientas#caldera">Probarla en Herramientas</Link>{" · "}
              <Link href="/api">Cómo funciona la API</Link>
            </p>
          </div>
        }
      >
        <Par
          margen={
            <>
              <h3>Para revisar cada cifra</h3>
              <p>
                En GitHub: <a href={archivoRepo(NOTEBOOKS.datos)}>notebook&nbsp;06</a>,{" "}
                <a href={archivoRepo(NOTEBOOKS.modos)}>notebook&nbsp;07</a>,{" "}
                <a href={archivoRepo(NOTEBOOKS.vapor)}>notebook&nbsp;08</a> y{" "}
                <a href={archivoRepo(NOTEBOOKS.anomalias)}>notebook&nbsp;09</a>, y las decisiones D42 a D52 e hipótesis H12 a H17
                en la <a href={archivoRepo("bitacora.md")}>bitácora</a>.
              </p>
              <p className={s.respaldo}>
                Datos: Cao et al. (2025), <em>A long-tailed distribution time-series dataset in boiler equipment</em>,
                Springer Nature y figshare.
              </p>
            </>
          }
        >
          <p>Recomiendo, en este orden:</p>
          <ol className={s.pasos}>
            <li>
              Revisar con instrumentación el diferencial izquierdo del hogar y la vibración B del tiro, y confirmar unidades.
              <p className={s.respaldo}>
                {usados} de {nSensores} sensores sirven. Certeza {CERTEZA.datos}. <a href="#datos">Ver los sensores</a>
              </p>
            </li>
            <li>
              Poner en línea el sensor virtual del vapor y su chequeo contra el medidor.
              <p className={s.respaldo}>
                Error de {num(ridge.MAE_t_h, 2)} t/h en días no vistos. Certeza {CERTEZA.vapor}.{" "}
                <a href="#vapor">Ver el sensor virtual</a>
              </p>
            </li>
            <li>
              Activar las reglas físicas con los límites de diseño y la verificación de sensores con confirmación del operador.
              <p className={s.respaldo}>
                {aciertos} de {iny.length} fallas bien diagnosticadas, ~{num(alarmasDia, 0)} alarmas por día. Certeza{" "}
                {CERTEZA.anomalias}. <a href="#anomalias">Ver las anomalías</a>
              </p>
            </li>
            <li>
              Cruzar la temperatura de gases con el registro de soplado de hollín y medir combustible, chimenea y CO.
              <p className={s.respaldo}>
                US${milesUsd} mil al año si la deriva es ensuciamiento. Certeza {CERTEZA.eficiencia}, baja en el dinero.{" "}
                <a href="#eficiencia">Ver la eficiencia</a>
              </p>
            </li>
            <li>
              En las calderas de bagazo, aplicar la misma auditoría y agregar redundancia donde hoy hay un solo sensor crítico.
              <p className={s.respaldo}>
                Se traslada el método, no los valores. <a href="#caldera">Ver la caldera</a>
              </p>
            </li>
          </ol>
        </Par>
      </Seccion>
    </div>
  );
}
