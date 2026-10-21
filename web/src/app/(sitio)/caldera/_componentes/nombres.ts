// Nombres cortos de los 30 sensores de la caldera, para gráficas y tablas. La descripción completa, la unidad,
// el estado y el tratamiento salen de serie2_tratamiento_sensores.json (notebook 06).
export const NOMBRE_CORTO: Record<string, string> = {
  PT_8313A: "Presión de hogar A",
  PT_8313B: "Presión de hogar B",
  PT_8313C: "Presión de hogar C",
  PT_8313D: "Presión de hogar D",
  PT_8313E: "Presión de hogar E",
  PT_8313F: "Presión de hogar F",
  PTCA_8322A: "Presión del domo",
  PTCA_8324: "Presión del colector",
  TE_8319A: "Temperatura de gases (izq.)",
  TE_8319B: "Temperatura de gases (der.)",
  TE_8313B: "Temperatura del hogar",
  TE_8303: "Aire primario precalentado",
  TE_8304: "Aire secundario precalentado",
  TV_8329ZC: "Válvula del atemperador",
  FT_8301: "Flujo de aire primario",
  FT_8302: "Flujo de aire secundario",
  FT_8306A: "Aire de retorno (izq.)",
  FT_8306B: "Aire de retorno (der.)",
  AIR_8301A: "O₂ en gases (izq.)",
  AIR_8301B: "O₂ en gases (der.)",
  YFJ3_AI: "Corriente del tiro inducido",
  YFJ3_ZD1: "Vibración del tiro A",
  YFJ3_ZD2: "Vibración del tiro B",
  SXLTCYZ: "Diferencial del hogar (izq.)",
  SXLTCYY: "Diferencial del hogar (der.)",
  ZCLCCY: "Diferencial del lecho (izq.)",
  YCLCCY: "Diferencial del lecho (der.)",
  YJJWSLL: "Agua de atemperación",
  ZZQBCHLL: "Flujo de vapor",
  TE_8332A: "Temperatura del vapor",
};

// Variables derivadas que usan los notebooks 08 y 09 (promedios de pares, medianas, totales).
const VARIABLES: Record<string, string> = {
  aire_total: "aire total",
  corriente_tiro: "corriente del tiro",
  t_gases: "temperatura de gases",
  t_vapor: "temperatura del vapor",
  t_hogar: "temperatura del hogar",
  frac_primario: "fracción de aire primario",
  retorno_total: "aire de retorno",
  agua_atemp: "agua de atemperación",
  presion_hogar: "presión de hogar",
};

/** Cambia los tags (PT_8313C) y las variables de código (aire_total) de un texto del notebook por nombres legibles. */
export function legible(texto: string): string {
  return texto
    .replace(/\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b/g, (tag) => NOMBRE_CORTO[tag] ?? tag)
    .replace(/\b[a-z]+_[a-z_]+\b/g, (v) => VARIABLES[v] ?? v.replace(/_/g, " "))
    .replace(/\bO2\b/g, "O₂");
}

/** Fecha "2022-03-27 14:25:00" a minutos desde 1970 (UTC, para que la hora se muestre igual que en los datos). */
export function minutoUTC(fecha: string): number {
  const [dia, hora = "00:00:00"] = fecha.split(" ");
  const [a, m, d] = dia.split("-").map(Number);
  const [hh, mm] = hora.split(":").map(Number);
  return Date.UTC(a, m - 1, d, hh, mm) / 60000;
}

/** Fecha "27/03 14:00" (sin año) a minutos desde 1970, UTC. */
export function minutoDiaMes(texto: string, anio: number): number {
  const [fecha, hora] = texto.split(" ");
  const [d, m] = fecha.split("/").map(Number);
  const [hh, mm] = hora.split(":").map(Number);
  return Date.UTC(anio, m - 1, d, hh, mm) / 60000;
}

export const redondear = (x: number, decimales = 2) => Math.round(x * 10 ** decimales) / 10 ** decimales;
