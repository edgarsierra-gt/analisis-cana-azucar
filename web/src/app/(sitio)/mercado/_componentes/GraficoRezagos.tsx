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

/**
 * Elasticidad del área por rezago del precio: barras del modelo simple y raya del modelo con inercia.
 * En pantallas angostas (menos de 520 px) el rótulo de cada rezago va encima de su barra, así las barras usan todo el
 * ancho en vez de quedar aplastadas junto a rótulos de 166 px.
 */
export function GraficoRezagos({ filas, etiqueta }: { filas: Rezago[]; etiqueta: string }) {
  const minimo = Math.min(0, ...filas.map((f) => Math.min(f.coef, f.inercia)));
  const maximo = Math.max(...filas.map((f) => Math.max(f.coef, f.inercia)));
  return (
    <PlotFigura
      alto={300}
      etiqueta={etiqueta}
      crear={(ancho) => {
        const angosto = ancho < 520;
        const marcas: Plot.Markish[] = [
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
            fontSize: 13,
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
        ];
        const x = {
          label: "Elasticidad del área",
          domain: [minimo * 1.3, maximo + (angosto ? 0.05 : 0.035)],
          grid: true,
          tickFormat: (v: number) => num(v, 2),
        };
        if (!angosto) {
          return {
            marginLeft: 180,   // "Año siguiente (placebo)" a 14 px sin salirse del marco
            marginRight: 8,
            x,
            y: { label: null, domain: filas.map((f) => f.etiqueta), padding: 0.3 },
            marks: marcas,
          };
        }
        // Teléfono: filas más altas y el rótulo sobre la barra, pegado al borde izquierdo del marco.
        const alto = 60 * filas.length + 48;
        const margenArriba = 28;
        const margenAbajo = 40;
        const relleno = 0.5;
        const paso = (alto - margenArriba - margenAbajo) / (filas.length + relleno);
        const grosor = paso * (1 - relleno);
        return {
          height: alto,
          marginLeft: 8,
          marginRight: 8,
          marginTop: margenArriba,
          marginBottom: margenAbajo,
          x,
          y: { label: null, domain: filas.map((f) => f.etiqueta), padding: relleno, axis: null },
          marks: [
            ...marcas,
            Plot.text(filas, {
              y: "etiqueta",
              text: "etiqueta",
              frameAnchor: "left",
              textAnchor: "start",
              lineAnchor: "bottom",
              dy: -(grosor / 2 + 4),
              fontSize: 14,
              fill: COLORES.tinta,
              // Halo blanco: el rótulo cruza la raya del cero y la del modelo con inercia
              stroke: COLORES.fondo,
              strokeWidth: 4,
              paintOrder: "stroke",
            }),
          ],
        };
      }}
    />
  );
}
