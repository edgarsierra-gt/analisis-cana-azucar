// Las consultas de la API (api/main.py), agrupadas por serie. Los ejemplos de petición y respuesta se copian tal cual
// de docs/api.md: todas sus cifras salen de llamar a la API con los artefactos del repo (las comprueba
// tests/test_api.py::test_ejemplos_de_la_documentacion). Los conteos se leen de los JSON de src/datos.
import Link from "next/link";
import curvas from "@/datos/serie1_curvas.json";
import modeloP2 from "@/datos/serie1_modelo_p2.json";
import segmentos from "@/datos/serie1_segmentos.json";
import modos from "@/datos/serie2_modos.json";
import sensores from "@/datos/serie2_sensores.json";
import sensorVirtual from "@/datos/serie2_sensor_virtual.json";
import verificacion from "@/datos/serie2_verificacion.json";
import pronostico from "@/datos/serie3_pronostico.json";
import resumenP4 from "@/datos/serie1_resumen_p4.json";
import { num, pctFraccion, usd } from "@/lib/formato";

/** Versión de la API (constante VERSION de api/main.py). La que corre se ve en vivo con GET /salud. */
export const VERSION_API = "1.2.0"; // fuente: api/main.py, VERSION

export type Bloque = { rotulo: string; texto: string };
export type Consulta = {
  metodo: "GET" | "POST";
  ruta: string;
  /** Serie y pregunta de la prueba que responde, como en docs/api.md */
  pregunta?: string;
  para: React.ReactNode;
  entrada: React.ReactNode;
  devuelve: React.ReactNode;
  ejemplo?: { titulo?: string; contexto?: React.ReactNode; bloques: Bloque[]; lectura?: React.ReactNode };
};
export type Grupo = {
  clave: string;
  serie?: "campo" | "caldera" | "mercado";
  titulo: string;
  descripcion?: React.ReactNode;
  consultas: Consulta[];
};

// ── Conteos que salen de los artefactos ─────────────────────────────────────────────────────────────────────────
export const conteos = {
  variedadesCiclo: Object.keys(curvas.variedades).length,
  variedadesPronostico: Object.keys(modeloP2.variedades).length,
  fincas: Object.keys(modeloP2.fincas_loc_rel).length,
  grupos: new Set((segmentos as { grupo: string }[]).map((f) => f.grupo)).size,
  sensores: Object.keys(sensores.sensores).length,
  excluidos: sensores.excluir_modelos,
  variablesModo: modos.variables.length,
  zonas: Object.keys(modos.centros_z).length,
  chequeos: Object.keys(verificacion.umbrales_z).length,
  persistencia: verificacion.persistencia_min,
  ventanaVapor: sensorVirtual.ventana_media_min,
  rezagos: sensorVirtual.rezagos_min.filter((r) => r > 0),
  // raiz_dp_rho no se manda: la API la calcula con la presión del domo, la del colector y la temperatura del vapor
  variablesVapor: sensorVirtual.variables_base.filter((v) => v !== "raiz_dp_rho").length,
  coberturaE1: modeloP2.validacion.cobertura_banda80["Escenario 1"],
  coberturaE2: modeloP2.validacion.cobertura_banda80["Escenario 2"],
  fechaCierre: pronostico.fecha_origen.split("-").reverse().join("/"),
  supuestos: curvas.supuestos,
  optimoMetrico: resumenP4.optimo,
};

const lista = (xs: (string | number)[]) =>
  xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`;

const s = conteos.supuestos;

// ── Ejemplos (docs/api.md, sin cambios) ─────────────────────────────────────────────────────────────────────────
const EJ_VARIEDADES = `{
  "testigo_promedio": {"ciclo_optimo_cortes": 4, "margen_anual_usd_acre": 526.28},
  "variedades": [
    {"puesto": 1, "variedad": "HOCP14-885", "ciclo_optimo_cortes": 4, "margen_anual_usd_acre": 798.1,
     "ganancia_vs_testigos_usd_acre": 271.82, "P_top3": 0.996, "ganancia_ic90_usd_acre": [226.1, 318.8]},
    {"puesto": 2, "variedad": "HOL15-508", "ciclo_optimo_cortes": 4, "margen_anual_usd_acre": 776.56,
     "ganancia_vs_testigos_usd_acre": 250.28, "P_top3": 0.934, "ganancia_ic90_usd_acre": [183.1, 324.7]}
  ]
}`;

const EJ_CICLO_PETICION = `{"variedad": "HOCP14-885", "precio": 0.15}`;
const EJ_CICLO = `{
  "ciclo_optimo_cortes": 4, "margen_anual_usd_acre": 331.4, "margen_anual_usd_ha": 818.91,
  "ganancia_vs_testigos_usd_acre": 190.4,
  "testigo_promedio": {"ciclo_optimo_cortes": 5, "margen_anual_usd_acre": 141.01},
  "precio_equilibrio_usd_lb": 0.1132,
  "margen_por_ciclo": [{"cortes": 1, "margen_anual_usd_acre": -372.89}, {"cortes": 2, "margen_anual_usd_acre": 161.7},
                       {"cortes": 3, "margen_anual_usd_acre": 290.3}, {"cortes": 4, "margen_anual_usd_acre": 331.4},
                       {"cortes": 5, "margen_anual_usd_acre": 323.79}]
}`;

const EJ_PRONOSTICO_PETICION = `{"variedad": "L01-299", "finca": "MAGNOLIA", "corte": 2, "ventaja_lote_anterior": 1.05}`;
const EJ_PRONOSTICO = `{
  "escenario": 1, "azucar_lb_acre": 6092.1, "banda_lb_acre": [4299.6, 8047.0],
  "azucar_t_ha": 6.828, "banda_t_ha": [4.819, 9.02], "cobertura_real_banda": 0.736,
  "desglose_log": {"base_del_corte": 8.8363, "efecto_finca": -0.2443, "ventaja_variedad": 0.1138,
                   "ventaja_lote_anterior": 0.0091}
}`;

const EJ_SEGMENTO_PETICION = `{"cana_vs_testigos_pct": 9.9, "trs_vs_testigos_pct": 7.5, "cana_por_corte_vs_testigos_pct": 1.7, "sigma_interaccion_pct": 8.5}`;
const EJ_SEGMENTO = `{
  "grupo": "Completas: caña, calidad y longevidad", "segundo_grupo": "Sin ventaja clara",
  "distancias": {"Completas: caña, calidad y longevidad": 1.81, "Sin ventaja clara": 2.389, "Calidad sin caña": 2.665,
                 "Mucha caña, menos calidad": 2.827, "Inestables y de vida corta": 4.046},
  "estabilidad_del_grupo_jaccard": 0.698
}`;

// La petición es la de tests/test_api.py::test_ejemplos_de_la_documentacion, que produce la respuesta de docs/api.md.
const EJ_AUDITORIA_PETICION = `{"cosechas": [
  {"zafra": 2016, "finca": "F01", "lote": "F01-L1", "variedad": "CG02-163", "corte": 0, "tch": 125.0},
  {"zafra": 2017, "finca": "F01", "lote": "F01-L1", "variedad": "CG02-163", "corte": 1, "tch": 112.0},
  {"zafra": 2018, "finca": "F01", "lote": "F01-L1", "variedad": "CP72-2086", "corte": 0, "tch": 130.0},
  {"zafra": 2019, "finca": "F01", "lote": "F01-L1", "variedad": "CP72-2086", "corte": 1, "tch": 118.0},
  {"zafra": 2020, "finca": "F01", "lote": "F01-L1", "variedad": "CP72-2086", "corte": 2, "tch": 105.0},
  {"zafra": 2021, "finca": "F01", "lote": "F01-L1", "variedad": "CP72-2086", "corte": 3, "tch": 96.0}
]}`;
const EJ_AUDITORIA = `{
  "optimo_cortes": 4,
  "ciclos": [
    {"variedad": "CG02-163", "zafra_inicio": 2016, "zafra_fin": 2017, "cortes_ciclo": 2, "cerrado": true,
     "estado": "renovación temprana"},
    {"variedad": "CP72-2086", "zafra_inicio": 2018, "zafra_fin": 2021, "cortes_ciclo": 4, "cerrado": false,
     "estado": "renovar al cerrar la zafra"}
  ],
  "lotes": [{"lote": "F01-L1", "diagnostico": "renueva antes de tiempo"}],
  "decisiones": [{"lote": "F01-L1", "corte_siguiente": 4, "tch_esperado": 87.21, "margen_siguiente": 2415.33,
                  "margen_ciclo_nuevo": 3553.32, "decision": "renovar"}]
}`;

const EJ_CSV = `zafra,finca,lote,variedad,corte,tch,rendimiento`;

const EJ_MODO_PETICION = `{"vapor": 60.47, "aire_total": 67678.6, "frac_primario": 0.7, "o2": 1.78, "t_hogar": 775.56, "lecho": 10687.39,
 "agua_atemp": 2.79, "t_vapor": 538.23, "t_gases": 365.98}`;
const EJ_MODO = `{"modo": "Carga media", "distancias": {"Carga media": 2.091, "Carga alta": 2.478, "Carga baja": 3.921}}`;

const EJ_VAPOR_MINUTO = `{"PTCA_8322A": 9.691, "PTCA_8324": 9.351, "TE_8313B": 771.866, "TE_8303": 213.499, "TE_8304": 225.017,
 "TV_8329ZC": 12.522, "FT_8301": 47123.846, "FT_8302": 18743.768, "YFJ3_AI": 22.62, "YFJ3_ZD1": 5.929,
 "SXLTCYY": -345.106, "YJJWSLL": 2.732, "TE_8332A": 535.816, "presion_hogar": -160.557, "lecho": 10390.36,
 "o2": 2.174, "t_gases": 376.258, "retorno_total": 1329.331, "ZZQBCHLL": 60.526}`;
const EJ_VAPOR = `{
  "vapor_t_h": 60.71, "banda_90_t_h": [60.35, 61.08], "error_tipico_t_h": 0.18,
  "otras_estimaciones": {"hidraulico_una_variable": 60.95, "formula_dos_variables": 60.78},
  "vapor_medido_t_h": 60.53, "medido_menos_estimado_t_h": -0.19
}`;

const EJ_VERIFICAR_PETICION = `{"minutos": [...], "retorno_confirmado": true}`;
const EJ_VERIFICAR = `{
  "diagnostico": "sensor: Vapor medido − virtual",
  "chequeos_en_alarma": ["Vapor medido − virtual"],
  "chequeos": {
    "Vapor medido − virtual": {"z": 11.8, "umbral_z": 5, "minutos_seguidos_fuera": 6, "alarma": true,
                               "falla_minima_detectable": 1.323},
    "PT_8313C": {"z": -1.21, "umbral_z": 5, "minutos_seguidos_fuera": 0, "alarma": false,
                 "falla_minima_detectable": 63.418}
  }
}`;

const EJ_MERCADO = `{
  "horizonte_meses": 3, "mes_objetivo": "agosto 2024", "fecha_ultimo_cierre": "2024-05-31",
  "centro_centavos_lb": 18.3,
  "bandas_centavos_lb": {"80": [15.73, 21.32], "95": [14.52, 22.64]},
  "bandas_pct": {"80": [-14.0, 16.5], "95": [-20.6, 23.7]},
  "centro_usd_t": 403.4, "bandas_usd_t": {"80": [346.9, 470.1], "95": [320.2, 499.1]},
  "ingreso_usd": {"toneladas": 10000.0, "centro": 4034454, "80": [3468669, 4700980], "95": [3202035, 4991044]}
}`;

// GET /salud devuelve estos campos (api/main.py); los valores son los conteos de los mismos JSON que carga la API.
// fuente: docs/api.md, sección "Asistente" (la redacción cambia en cada llamada; la forma no)
const EJ_ASISTENTE_PETICION = `POST /asistente
{"pregunta": "¿Qué precio del azúcar se espera el próximo mes?", "historial": []}`;
const EJ_ASISTENTE = `{
  "respuesta": "Se espera alrededor de 18.30 ¢/lb, el último cierre ... (notebook 12)",
  "herramientas": [{"nombre": "pronostico_precio", "etiqueta": "Pronóstico del precio",
                    "argumentos": {"h": 1}}],
  "restantes_hoy": 29, "modelo": "gemini-3.5-flash", "pasos": 2
}`;

const EJ_SALUD = `{"estado": "ok", "version": "${VERSION_API}", "variedades_ciclo": ${conteos.variedadesCiclo}, "variedades_pronostico": ${conteos.variedadesPronostico}, "grupos": ${conteos.grupos}}`;

// ── Grupos ──────────────────────────────────────────────────────────────────────────────────────────────────────
export const GRUPOS: Grupo[] = [
  {
    clave: "campo",
    serie: "campo",
    titulo: "Campo · Serie I",
    descripcion: "Las cuatro preguntas de campo, con los ensayos de etapa 5 de Louisiana.",
    consultas: [
      {
        metodo: "GET",
        ruta: "/campo/variedades",
        pregunta: "I · 1",
        para: "Qué variedades ampliar: el ranking por margen anual.",
        entrada: <>Precio del azúcar en US$/lb (opcional, <code>?precio=0.20</code>).</>,
        devuelve: <>Las {conteos.variedadesCiclo} variedades ordenadas por margen, con ciclo óptimo y certeza, y el catálogo de variedades y fincas que acepta cada consulta.</>,
        ejemplo: {
          contexto: <>Con los supuestos de la prueba: {usd(s.precio, 2)}/lb, {usd(s.corte)}/t de corte, {usd(s.mantenimiento)}/acre/año de mantenimiento y {usd(s.renovacion)}/acre de renovación.</>,
          bloques: [{ rotulo: "Petición", texto: "GET /campo/variedades?precio=0.20" }, { rotulo: `Respuesta (2 de las ${conteos.variedadesCiclo} variedades)`, texto: EJ_VARIEDADES }],
          lectura: <><code>P_top3</code> es la probabilidad de quedar entre las 3 mejores al remuestrear ensayos. El IC90 es el intervalo de la ganancia. Ambos se calcularon con los supuestos base.</>,
        },
      },
      {
        metodo: "POST",
        ruta: "/campo/ciclo",
        pregunta: "I · 1",
        para: "Cada cuántos cortes renovar una variedad y con qué precio deja de convenir.",
        entrada: <>Variedad y, opcionales, los supuestos: <code>precio</code>, <code>corte</code>, <code>mantenimiento</code>, <code>renovacion</code>, <code>barbecho</code> (años sin caña) y <code>extrapolar</code>.</>,
        devuelve: "Ciclo óptimo, margen por acre y por hectárea, ganancia contra el testigo, precio de equilibrio, margen de cada ciclo posible y curva por corte.",
        ejemplo: {
          contexto: <>HOCP14-885 si el azúcar baja a US$0.15/lb.</>,
          bloques: [{ rotulo: "Petición", texto: EJ_CICLO_PETICION }, { rotulo: "Respuesta (recortada)", texto: EJ_CICLO }],
          lectura: <>A US$0.15/lb la variedad sigue rindiendo más con 4 cortes y deja de cubrir costos por debajo de US$0.113/lb. El testigo promedio pasa a convenir con 5 cortes. La respuesta completa trae además la curva por corte, la evidencia, la certeza y los supuestos usados.</>,
        },
      },
      {
        metodo: "POST",
        ruta: "/campo/pronostico",
        pregunta: "I · 2",
        para: "Cuánto azúcar esperar de una variedad en una finca y corte, con banda de error.",
        entrada: <>Variedad, finca (o <code>&quot;nueva&quot;</code>), corte de 0 a 4 y, opcional, la ventaja del lote el año pasado.</>,
        devuelve: "Azúcar esperado en lb/acre y t/ha, banda de error con su cobertura real y desglose del cálculo.",
        ejemplo: {
          bloques: [{ rotulo: "Petición", texto: EJ_PRONOSTICO_PETICION }, { rotulo: "Respuesta (recortada)", texto: EJ_PRONOSTICO }],
          lectura: (
            <>
              <code>ventaja_lote_anterior</code> es el azúcar de la variedad dividido entre el de los testigos en el mismo
              lote el año pasado (1.05 = 5 % arriba). Si no se conoce, se omite. La banda cubrió el{" "}
              {pctFraccion(conteos.coberturaE1)} de los casos en la validación por zafra, no el 80 % nominal: por eso la
              respuesta dice su cobertura real. Con <code>finca: &quot;nueva&quot;</code> usa el modelo para fincas sin
              historia; la banda es más ancha y cubrió el {pctFraccion(conteos.coberturaE2)}.
            </>
          ),
        },
      },
      {
        metodo: "POST",
        ruta: "/campo/segmento",
        pregunta: "I · 3",
        para: "A qué grupo de comportamiento se parece una variedad.",
        entrada: "Cuatro indicadores en % contra los testigos: caña por acre en plantía, TRS, cambio de la caña por corte y desvío de la ventaja entre fincas y años.",
        devuelve: "Grupo, segundo grupo más cercano y distancia a cada uno.",
        ejemplo: {
          contexto: "Son los cuatro indicadores de HOCP14-885 en la tabla del notebook 04.",
          bloques: [{ rotulo: "Petición", texto: EJ_SEGMENTO_PETICION }, { rotulo: "Respuesta (recortada)", texto: EJ_SEGMENTO }],
          lectura: "No hay grupos naturales en estas variedades. Por eso la respuesta trae el segundo grupo y las distancias: si están cerca, conviene decidir con la pregunta 1.",
        },
      },
      {
        metodo: "POST",
        ruta: "/campo/auditoria",
        pregunta: "I · 4",
        para: "Qué lotes se renuevan antes o después de tiempo y qué hacer con los lotes en pie.",
        entrada: <>Registros de cosecha en JSON, una fila por lote y corte: <code>zafra</code>, <code>finca</code>, <code>lote</code>, <code>variedad</code>, <code>corte</code> (0 = plantía; recomendado), <code>tch</code> y <code>rendimiento</code> (opcional).</>,
        devuelve: "Estado de cada ciclo, diagnóstico por lote y decisión para los lotes en pie.",
        ejemplo: {
          contexto: "Un lote que renovó CG02-163 después de 2 cortes y lleva 4 cortes de CP72-2086.",
          bloques: [{ rotulo: "Petición", texto: EJ_AUDITORIA_PETICION }, { rotulo: "Respuesta (recortada)", texto: EJ_AUDITORIA }],
          lectura: <><code>decision</code> compara el margen esperado del próximo corte del lote con el margen promedio de un ciclo nuevo en ese mismo lote (US$/ha). El óptimo es el del testigo con los supuestos en unidades métricas: {conteos.optimoMetrico} cortes.</>,
        },
      },
      {
        metodo: "POST",
        ruta: "/campo/auditoria/csv",
        pregunta: "I · 4",
        para: "La misma auditoría, desde una hoja de cálculo.",
        entrada: "Archivo CSV de cosechas, con los mismos nombres de columna (hasta 10 MB).",
        devuelve: "Lo mismo que la consulta anterior. Cada fila se valida con el mismo esquema que el JSON.",
        ejemplo: {
          titulo: "Formato del archivo",
          bloques: [{ rotulo: "Encabezado del CSV", texto: EJ_CSV }],
          lectura: <>Sin la columna <code>corte</code> la API igual responde, pero avisa con <code>corte_registrado: false</code>: no puede detectar las renovaciones que repiten variedad.</>,
        },
      },
    ],
  },
  {
    clave: "caldera",
    serie: "caldera",
    titulo: "Caldera · Serie II",
    descripcion: "Entradas en promedios de 1 min (o de 5 min para la zona de carga), como en los notebooks. La API no guarda estado: quien consulta manda la ventana de minutos que hace falta.",
    consultas: [
      {
        metodo: "GET",
        ruta: "/caldera/sensores",
        pregunta: "II · 1",
        para: "Qué mide cada sensor y cuáles son confiables.",
        entrada: "Ninguna.",
        devuelve: <>Los {conteos.sensores} sensores con nombre en español, unidad, grupo, cada cuánto se actualizan, estado y tratamiento. Marca los {conteos.excluidos.length} que quedan fuera de los modelos ({lista(conteos.excluidos)}).</>,
      },
      {
        metodo: "POST",
        ruta: "/caldera/modo",
        pregunta: "II · 2",
        para: "En qué zona de carga opera la caldera.",
        entrada: <>Promedios de 5 min de {conteos.variablesModo} variables.</>,
        devuelve: "Zona de carga y distancia a cada zona.",
        ejemplo: {
          bloques: [{ rotulo: "Petición", texto: EJ_MODO_PETICION }, { rotulo: "Respuesta (recortada)", texto: EJ_MODO }],
          lectura: <>No hay modos discretos (notebook 07): son {conteos.zonas} zonas de un continuo dominado por la carga. Si dos distancias están cerca, la ventana está en el borde entre zonas.</>,
        },
      },
      {
        metodo: "POST",
        ruta: "/caldera/vapor-virtual",
        pregunta: "II · 3",
        para: "Cuánto vapor sale según los demás sensores: un respaldo del medidor.",
        entrada: <>Al menos {conteos.ventanaVapor} minutos consecutivos de promedios de 1 min, del más antiguo al más reciente.</>,
        devuelve: "Vapor estimado, banda de 90 %, error típico y comparación con el medido.",
        ejemplo: {
          contexto: <>La petición es <code>{`{"minutos": [...]}`}</code>. Cada minuto trae {conteos.variablesVapor} variables; este es el último de la ventana:</>,
          bloques: [{ rotulo: "Último minuto de la petición", texto: EJ_VAPOR_MINUTO }, { rotulo: "Respuesta (recortada)", texto: EJ_VAPOR }],
          lectura: <>Usa el Ridge final del notebook 08: valor actual, rezagos de {lista(conteos.rezagos)} min y media de {conteos.ventanaVapor} min de cada variable. Nunca usa el vapor medido: <code>ZZQBCHLL</code> es opcional y solo sirve para compararlo. <code>otras_estimaciones</code> trae la fórmula hidráulica de una variable y la de dos variables.</>,
        },
      },
      {
        metodo: "POST",
        ruta: "/caldera/verificar",
        pregunta: "II · 4",
        para: "Si un instrumento se separó de sus pares o si es un evento del hogar.",
        entrada: "De 1 a 120 minutos de promedios de 1 min: presiones de hogar, pares izquierda-derecha, vapor, agua, válvula, presiones y temperatura del vapor.",
        devuelve: <>El z de los {conteos.chequeos} chequeos, las alarmas y el diagnóstico.</>,
        ejemplo: {
          contexto: "Seis minutos con el medidor de vapor 3 t/h arriba de lo real.",
          bloques: [{ rotulo: "Petición", texto: EJ_VERIFICAR_PETICION }, { rotulo: "Respuesta (2 de los chequeos)", texto: EJ_VERIFICAR }],
          lectura: <>Un chequeo alarma cuando lleva {conteos.persistencia} minutos seguidos fuera de su umbral. Si alarman dos o más presiones de hogar y nada más, es un evento del hogar (proceso), no sensores dañados. Si alarma otro chequeo, es ese sensor.</>,
        },
      },
    ],
  },
  {
    clave: "mercado",
    serie: "mercado",
    titulo: "Mercado · Serie III",
    consultas: [
      {
        metodo: "GET",
        ruta: "/mercado/pronostico",
        pregunta: "III · 3",
        para: "En qué rango estará el precio del azúcar a 1 y 3 meses.",
        entrada: <>Horizonte <code>h</code> (1 o 3 meses) y, opcional, <code>toneladas</code> sin fijar.</>,
        devuelve: "Centro y bandas de 80 % y 95 % en ¢/lb, en % y en US$/t; con toneladas, el rango de ingreso.",
        ejemplo: {
          bloques: [{ rotulo: "Petición", texto: "GET /mercado/pronostico?h=3&toneladas=10000" }, { rotulo: "Respuesta (recortada)", texto: EJ_MERCADO }],
          lectura: <>El centro es el último cierre: ningún modelo probado le ganó a 1 ni a 3 meses (notebook 12). Las bandas salen de los errores pasados, medidos en unidades de la volatilidad de 3 meses × √h; por eso se ensanchan cuando el mercado está agitado. Es el precio No. 11 sin primas, flete ni tipo de cambio; 1 ¢/lb = US$22.05 por tonelada{/* fuente: api/mercado.py, USD_T_POR_CENTAVO_LB */}.</>,
        },
      },
    ],
  },
  {
    clave: "asistente",
    titulo: "Asistente",
    descripcion: (
      <>
        Preguntas en español sobre las tres series. Gemini en Vertex AI pide a la API las consultas de arriba y redacta
        solo con lo que devuelven. Detalle en la <Link href="/asistente">página del asistente</Link>.
      </>
    ),
    consultas: [
      {
        metodo: "POST",
        ruta: "/asistente",
        para: "Preguntar en lenguaje natural sobre campo, caldera o mercado.",
        entrada: "La pregunta (hasta 500 caracteres) y, opcional, los últimos 8 mensajes de la conversación.",
        devuelve: "La respuesta en Markdown, las herramientas que consultó y las preguntas que le quedan hoy.",
        ejemplo: {
          bloques: [{ rotulo: "Petición", texto: EJ_ASISTENTE_PETICION }, { rotulo: "Respuesta (recortada)", texto: EJ_ASISTENTE }],
          lectura: "Tiene su propia cuota: 30 preguntas por IP al día y 5 por minuto. Sin Google Cloud (por ejemplo, en Docker local) responde 503 y el resto de la API funciona igual.",
        },
      },
      {
        metodo: "GET",
        ruta: "/asistente/estado",
        para: "Saber si el asistente está activo y cuántas preguntas quedan hoy.",
        entrada: "Ninguna.",
        devuelve: "Si está disponible, el modelo, el límite diario y las preguntas restantes. No gasta la cuota.",
      },
    ],
  },
  {
    clave: "general",
    titulo: "General",
    consultas: [
      {
        metodo: "GET",
        ruta: "/salud",
        para: "Confirmar que la API corre y que los JSON cargaron.",
        entrada: "Ninguna.",
        devuelve: "Estado, versión y cuántas variedades y grupos cargó.",
        ejemplo: {
          titulo: "Ejemplo de respuesta",
          bloques: [{ rotulo: "Respuesta", texto: EJ_SALUD }],
          lectura: "El estado en vivo, al inicio de esta página, hace esta misma consulta.",
        },
      },
    ],
  },
];

export const TOTAL_CONSULTAS = GRUPOS.reduce((n, g) => n + g.consultas.length, 0);

/** "1 consulta", "6 consultas" */
export const nConsultas = (n: number) => `${num(n)} ${n === 1 ? "consulta" : "consultas"}`;
