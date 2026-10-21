// Contrato del asistente (api/asistente.py) y sus límites (api/limites.py). La página muestra estos valores; el chat
// usa los que devuelve GET /asistente/estado en vivo, por si cambian en el servidor.

export type Serie = "campo" | "caldera" | "mercado";

/** GET /asistente/estado. No gasta la cuota. */
export type EstadoAsistente = {
  disponible: boolean;
  modelo: string;
  limite_dia: number;
  restantes_hoy: number;
  max_caracteres: number;
  max_pasos: number;
};

export type Mensaje = { rol: "usuario" | "asistente"; texto: string };

export type LlamadaHerramienta = { nombre: string; etiqueta: string; argumentos: Record<string, unknown> };

/** POST /asistente, respuesta 200. */
export type RespuestaAsistente = {
  respuesta: string;
  herramientas: LlamadaHerramienta[];
  restantes_hoy: number;
  modelo: string;
  pasos: number;
};

// fuente: api/asistente.py y api/limites.py (contrato del asistente)
export const LIMITES = {
  porDia: 30,
  porMinuto: 5,
  globalDia: 300,
  maxCaracteres: 500,
  maxPasos: 6,
  /** Mensajes del historial que acepta la API (el navegador manda los últimos). */
  maxHistorial: 8,
  /** Caracteres por mensaje del historial. */
  maxTextoHistorial: 2000,
  /** Tokens de salida del modelo por respuesta (api/asistente.py, MAX_SALIDA_TOKENS). */
  maxTokensRespuesta: 2048,
  /** Minutos que se usa el modelo de respaldo cuando el principal está saturado (PAUSA_SATURADO_S). */
  minutosRespaldo: 5,
};

// fuente: api/asistente.py (MODELO y RESPALDO por defecto) y bitácora D82. El chat muestra el modelo que respondió.
export const MODELO = "gemini-3.5-flash";
export const RESPALDO = "gemini-3.5-flash-lite";

/** "gemini-3.5-flash" → "Gemini 3.5 Flash"; "gemini-3.5-flash-lite" → "Gemini 3.5 Flash-Lite" */
export const nombreModelo = (id: string) =>
  id
    .split("-")
    .map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p))
    .join(" ")
    .replace(/ Lite$/, "-Lite");

/** Las herramientas que el modelo puede pedir. Nombre, etiqueta y fuente son los de api/asistente.py (HERRAMIENTAS). */
export type Herramienta = {
  nombre: string;
  etiqueta: string;
  serie: Serie | null;
  devuelve: string;
  origen: string;
  /** Sección del caso donde se verifica la cifra. null en "hallazgos": depende de la serie que se pida. */
  caso: string | null;
  /** La herramienta del sitio que hace la misma consulta con controles en lugar de preguntas, si la hay. */
  probar?: string;
};

export const HERRAMIENTAS: Herramienta[] = [
  {
    nombre: "ranking_variedades",
    etiqueta: "Ranking de variedades",
    serie: "campo",
    devuelve: "Las variedades ordenadas por margen anual en su ciclo óptimo, con su ganancia contra el testigo y su certeza. Acepta otro precio o costos.",
    origen: "Notebook 02",
    caso: "/campo#variedades",
  },
  {
    nombre: "ciclo_renovacion",
    etiqueta: "Ciclo de renovación",
    serie: "campo",
    devuelve: "Cada cuántos cortes renovar una variedad, su margen y su precio de equilibrio, con el precio y los costos que se pidan.",
    origen: "Notebook 02",
    caso: "/campo#variedades",
    probar: "/herramientas#ciclo",
  },
  {
    nombre: "pronostico_azucar",
    etiqueta: "Pronóstico de azúcar por finca",
    serie: "campo",
    devuelve: "El azúcar esperado de una variedad en una finca y corte, con su banda de error.",
    origen: "Notebook 03",
    caso: "/campo#pronostico",
    probar: "/herramientas#pronostico",
  },
  {
    nombre: "catalogo",
    etiqueta: "Variedades y fincas disponibles",
    serie: "campo",
    devuelve: "Las variedades, fincas, testigos y grupos que aceptan las demás herramientas, y los supuestos base.",
    origen: "Notebooks 02 y 03",
    caso: "/campo#variedades",
  },
  {
    nombre: "grupos_variedades",
    etiqueta: "Grupos de variedades",
    serie: "campo",
    devuelve: "El grupo de comportamiento de cada variedad, con su certeza y la estabilidad de cada grupo.",
    origen: "Notebook 04",
    caso: "/campo#perfiles",
  },
  {
    nombre: "sensores_caldera",
    etiqueta: "Sensores de la caldera",
    serie: "caldera",
    devuelve: "Qué mide cada sensor, su unidad, su estado y su tratamiento, y cuáles quedan fuera de los modelos.",
    origen: "Notebook 06",
    caso: "/caldera#datos",
  },
  {
    nombre: "modelos_vapor",
    etiqueta: "Sensor virtual del vapor",
    serie: "caldera",
    devuelve: "El error de cada modelo que estima el vapor sin el medidor, la cobertura de su banda y la fórmula de dos variables.",
    origen: "Notebook 08",
    caso: "/caldera#vapor",
    probar: "/herramientas#caldera",
  },
  {
    nombre: "pronostico_precio",
    etiqueta: "Pronóstico del precio",
    serie: "mercado",
    devuelve: "El rango del precio No. 11 a 1 y 3 meses y el ingreso de las toneladas sin fijar.",
    origen: "Notebook 12",
    caso: "/mercado#pronostico",
    probar: "/herramientas#mercado",
  },
  {
    nombre: "hallazgos",
    etiqueta: "Hallazgos y recomendaciones de una serie",
    serie: null,
    devuelve: "El resumen gerencial de la serie que se pida: hallazgos, decisiones recomendadas y límites.",
    origen: "README, resumen de cada serie",
    caso: null,
  },
];

const PAGINA_SERIE: Record<Serie, string> = { campo: "/campo", caldera: "/caldera", mercado: "/mercado" };

/**
 * Dónde verificar lo que devolvió una herramienta: la sección de su caso y su notebook. "hallazgos" lleva a la página de
 * la serie que pidió el modelo. Si el nombre no está en el contrato (una versión nueva de la API), no hay enlace.
 */
export function dondeVerificar(nombre: string, argumentos?: Record<string, unknown>): { href: string; fuente: string } | null {
  const h = HERRAMIENTAS.find((x) => x.nombre === nombre);
  if (!h) return null;
  if (h.caso) return { href: h.caso, fuente: h.origen.toLowerCase() };
  const serie = String(argumentos?.serie ?? "").toLowerCase();
  return serie in PAGINA_SERIE ? { href: PAGINA_SERIE[serie as Serie], fuente: "resumen de la serie" } : null;
}

/** Preguntas sugeridas de las tres series, con cifras que el visitante puede verificar en los casos. */
export const SUGERENCIAS: { serie: Serie; rotulo: string; pregunta: string }[] = [
  {
    serie: "campo",
    rotulo: "Campo",
    pregunta: "¿Qué variedades conviene ampliar y cada cuántos cortes renovarlas?",
  },
  {
    serie: "campo",
    rotulo: "Campo",
    pregunta: "¿Qué pasa con el margen de HOCP14-885 si el azúcar baja a US$0.15/lb?",
  },
  {
    serie: "campo",
    rotulo: "Campo",
    pregunta: "¿Cuánto azúcar se espera de L01-299 en la finca MAGNOLIA en soca 2?",
  },
  {
    serie: "caldera",
    rotulo: "Caldera",
    pregunta: "¿Qué sensores de la caldera no son confiables y por qué?",
  },
  {
    serie: "caldera",
    rotulo: "Caldera",
    pregunta: "¿Qué recomienda el análisis para la caldera?",
  },
  {
    serie: "mercado",
    rotulo: "Mercado",
    pregunta: "¿Qué rango de precio se espera a 3 meses y cuánto ingreso darían 10,000 toneladas?",
  },
];
