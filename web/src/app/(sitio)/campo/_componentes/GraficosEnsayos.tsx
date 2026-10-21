"use client";

import * as Plot from "@observablehq/plot";
import { COLORES, PlotFigura } from "@/components/graficos/PlotFigura";
import { num } from "@/lib/formato";

const halo = { stroke: "var(--papel)", strokeWidth: 3 } as const;

/* ── Fincas necesarias para detectar una ventaja de 10 % ─────────────────── */
type FilaFincas = { interaccion: string; anios: string; fincas: number; destacada: boolean };

export function GraficoFincas({ filas, recomendacion, ordenInteraccion, ordenAnios }: {
  filas: FilaFincas[]; recomendacion: number; ordenInteraccion: string[]; ordenAnios: string[];
}) {
  return (
    <PlotFigura
      alto={340}
      etiqueta={`Fincas por cohorte necesarias para detectar una ventaja de 10 % con 80 % de potencia, según cuánto mayor sea la interacción variedad por ambiente que en Louisiana y cuántos años de cosecha se acumulen. ${filas
        .map((f) => `${f.anios}, interacción ${f.interaccion}: ${f.fincas}`)
        .join("; ")}. Recomiendo ${recomendacion} fincas.`}
      crear={(ancho) => ({
        marginLeft: 44,
        marginTop: 44,
        marginBottom: 40,
        fx: { label: null, domain: ordenInteraccion, padding: 0.12, tickFormat: (d: string) => (ancho < 560 ? d : `interacción ${d}`) },
        x: { domain: ordenAnios, label: "Años de cosecha acumulados", padding: 0.12, tickFormat: (d: string) => (ancho < 560 ? d.replace(" años", "") : d) },
        y: { label: "Fincas por cohorte", grid: true, tickFormat: (d: number) => num(d), domain: [0, Math.max(...filas.map((f) => f.fincas)) * 1.15] },
        marks: [
          Plot.barY(filas, {
            fx: "interaccion", x: "anios", y: "fincas", fill: (d: FilaFincas) => (d.destacada ? COLORES.campo : COLORES.contexto),
            tip: true, title: (d: FilaFincas) => `${d.anios}\nInteracción ${d.interaccion} la de Louisiana\n${d.fincas} fincas`,
          }),
          Plot.text(filas, { fx: "interaccion", x: "anios", y: "fincas", text: (d: FilaFincas) => num(d.fincas), dy: -9, fill: COLORES.tinta, fontWeight: 600 }),
          Plot.ruleY([recomendacion], { stroke: COLORES.tinta, strokeWidth: 1.5 }),
          Plot.ruleY([0], { stroke: COLORES.tinta }),
          Plot.text([recomendacion], {
            fx: () => ordenInteraccion[0], y: (d: number) => d, frameAnchor: "left", text: (d: number) => (ancho < 560 ? `${d} fincas` : `recomendación: ${d} fincas`),
            dy: -9, textAnchor: "start", fill: COLORES.tinta, fontWeight: 650, ...halo,
          }),
        ],
      })}
    />
  );
}

/* ── Costo por tonelada en que el mejor ciclo deja de cubrir costos ──────── */
type FilaDistancia = { serie: string; equilibrio: number; destacada: boolean };

export function GraficoDistancia({ filas, supuesto }: { filas: FilaDistancia[]; supuesto: number }) {
  const max = Math.max(...filas.map((f) => f.equilibrio));
  return (
    <PlotFigura
      alto={filas.length * 40 + 80}
      etiqueta={`Costo de corte, alce y transporte por tonelada en que el mejor ciclo deja de cubrir costos. ${filas
        .map((f) => `${f.serie}: US$${num(f.equilibrio, 1)}/t`)
        .join("; ")}. El supuesto del caso es US$${num(supuesto, 2)}/t.`}
      crear={(ancho) => ({
        marginLeft: ancho < 560 ? 112 : 150,
        marginRight: 80,
        marginTop: 30,
        x: { label: "US$ por tonelada métrica de caña", grid: true, domain: [0, Math.ceil(max / 10) * 10], tickFormat: (d: number) => num(d) },
        y: { label: null, domain: filas.map((f) => f.serie), padding: 0.35 },
        marks: [
          Plot.barX(filas, {
            y: "serie", x: "equilibrio", fill: (d: FilaDistancia) => (d.destacada ? COLORES.campo : COLORES.contexto),
            tip: true, title: (d: FilaDistancia) => `${d.serie}\nDeja de cubrir costos a US$${num(d.equilibrio, 1)}/t`,
          }),
          Plot.ruleX([0], { stroke: COLORES.tinta }),
          Plot.text(filas, { y: "serie", x: "equilibrio", text: (d: FilaDistancia) => `US$${num(d.equilibrio, 1)}/t`, dx: 6, textAnchor: "start", fill: COLORES.tinta, fontWeight: 600 }),
          Plot.ruleX([supuesto], { stroke: COLORES.tinta2, strokeWidth: 1.5 }),
          Plot.text([supuesto], { x: (d: number) => d, frameAnchor: "top", text: (d: number) => `supuesto del caso: US$${num(d, 2)}/t`, dy: -18, textAnchor: "start", dx: -4, fill: COLORES.tinta2, fontSize: 11 }),
        ],
      })}
    />
  );
}
