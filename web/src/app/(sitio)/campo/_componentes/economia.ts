// Economía del ciclo de renovación, con las mismas fórmulas de src/campo_economia.py (clone_curve,
// cycle_economics, best_cycle y break_even_price). Lee las curvas guardadas por el notebook 02
// (outputs/models/serie1_curvas.json), así que las cifras que salen de aquí reproducen las del notebook.
import curvas from "@/datos/serie1_curvas.json";

export type Supuestos = { precio: number; corte: number; mantenimiento: number; renovacion: number; barbecho: number };
type ParametrosVariedad = { a: number; b: number; trs_rel: number; ultimo_corte_medido: number };
type Corte = { azucar: number; cana: number };

/** Supuestos del caso: US$/lb, US$/t de caña, US$/acre/año, US$/acre al renovar, años de barbecho. */
export const SUPUESTOS = curvas.supuestos as Supuestos;
export const TESTIGOS_NUCLEO = curvas.testigos_nucleo;

/**
 * Curva absoluta por corte: azúcar (lb/acre) y caña (t/acre). Sin parámetros es el testigo núcleo promedio.
 * Con `ultimo`, la ventaja relativa se congela en el último corte medido (regla conservadora del notebook 02).
 */
export function curva(a = 0, b = 0, trsRel = 1, ultimo?: number): Corte[] {
  return curvas.curva_testigos.map((r) => {
    const k = ultimo === undefined ? r.corte : Math.min(r.corte, ultimo);
    const azucar = r.sugar * Math.exp(a + b * k);
    return { azucar, cana: azucar / (r.trs * trsRel) };
  });
}

/** Curva de una variedad evaluada (con la regla conservadora). */
export function curvaDe(variedad: string): Corte[] {
  const p = (curvas.variedades as Record<string, ParametrosVariedad>)[variedad];
  return curva(p.a, p.b, p.trs_rel, p.ultimo_corte_medido);
}

/** Margen promedio anual (US$/acre/año) si se renueva después de 1, 2, … 5 cortes. */
export function margenPromedio(c: Corte[], s: Supuestos = SUPUESTOS): number[] {
  let acumulado = 0;
  return c.map((x, i) => {
    acumulado += x.azucar * s.precio - s.corte * x.cana - s.mantenimiento - (i === 0 ? s.renovacion : 0);
    return acumulado / (i + 1 + s.barbecho);
  });
}

/** Número de cortes con el mejor margen promedio anual y ese margen. */
export function mejorCiclo(c: Corte[], s: Supuestos = SUPUESTOS): { cortes: number; margen: number } {
  const v = margenPromedio(c, s);
  let i = 0;
  v.forEach((x, j) => { if (x > v[i]) i = j; });
  return { cortes: i + 1, margen: v[i] };
}

/** Precio mínimo (US$/lb) con el que el mejor ciclo cubre todos sus costos (bisección, como el notebook). */
export function precioEquilibrio(c: Corte[], s: Supuestos = SUPUESTOS, bajo = 0.02, alto = 0.6): number {
  for (let i = 0; i < 50; i++) {
    const medio = (bajo + alto) / 2;
    if (mejorCiclo(c, { ...s, precio: medio }).margen >= 0) alto = medio;
    else bajo = medio;
  }
  return alto;
}
