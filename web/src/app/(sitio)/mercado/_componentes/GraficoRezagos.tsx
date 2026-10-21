"use client";

import * as Plot from "@observablehq/plot";
import { COLORES, PlotFigura } from "@/components/graficos/PlotFigura";
import { num } from "@/lib/formato";

export type Rezago = {
  etiqueta: string;
  /** elasticidad del modelo simple */
  coef: number;
  /** p con errores agrupados por año, ya como texto */
  p: string;
  /** elasticidad con la inercia del área (ARDL) */
  inercia: number;
  placebo: boolean;
  destaca: boolean;
};

/** Elasticidad del área por rezago del precio: barras del modelo simple y raya del modelo con inercia. */
export function GraficoRezagos({ filas, etiqueta }: { filas: Rezago[]; etiqueta: string }) {
  const minimo = Math.min(0, ...filas.map((f) => Math.min(f.coef, f.inercia)));
  const maximo = Math.max(...filas.map((f) => Math.max(f.coef, f.inercia)));
  return (
    <PlotFigura
      alto={300}
      etiqueta={etiqueta}
      crear={(ancho) => ({
        marginLeft: ancho < 520 ? 150 : 170,
        marginRight: 8,
        x: { label: "Elasticidad del área", domain: [minimo * 1.3, maximo + (ancho < 520 ? 0.05 : 0.035)], grid: true, tickFormat: (v: number) => num(v, 2) },
        y: { label: null, domain: filas.map((f) => f.etiqueta), padding: 0.3 },
        marks: [
          Plot.barX(filas, {
            x: "coef",
            y: "etiqueta",
            fill: (d: Rezago) => (d.destaca ? COLORES.mercado : COLORES.contexto),
            fillOpacity: (d: Rezago) => (d.placebo ? 0.55 : 1),
          }),
          Plot.ruleX([0], { stroke: COLORES.tinta }),
          Plot.tickX(filas, { x: "inercia", y: "etiqueta", stroke: COLORES.tinta, strokeWidth: 2 }),
          Plot.text(filas, {
            x: (d: Rezago) => Math.max(d.coef, d.inercia, 0),
            y: "etiqueta",
            text: "p",
            dx: 6,
            textAnchor: "start",
            fontSize: 11,
            fill: COLORES.tinta2,
          }),
          Plot.tip(
            filas,
            Plot.pointerY({
              x: "coef",
              y: "etiqueta",
              title: (d: Rezago) => `${d.etiqueta}\nSimple: ${num(d.coef, 3)} (${d.p})\nCon inercia: ${num(d.inercia, 3)}`,
            }),
          ),
        ],
      })}
    />
  );
}
