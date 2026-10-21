"use client";

import * as Plot from "@observablehq/plot";
import { COLORES } from "@/components/graficos/PlotFigura";
import { num } from "@/lib/formato";
import { GraficoD } from "./GraficoD";

export type FilaModelo = { modelo: string; error: number; destacada: boolean };

/** Caldera · P3: error de cada forma de estimar el vapor, validada hacia adelante por día. */
export function GraficoSensorVirtual({ filas }: { filas: FilaModelo[] }) {
  const elegido = filas.find((f) => f.destacada);
  const maximo = Math.max(...filas.map((f) => f.error));

  return (
    <GraficoD
      dependencias={[filas]}
      etiqueta={`Error medio de cada forma de estimar el vapor. La elegida, ${elegido?.modelo ?? ""}, tiene el menor error: ${num(elegido?.error, 2)} %.`}
      crear={({ u }) => ({
        marginTop: 0.6 * u,
        marginRight: 5.4 * u,
        marginBottom: 4.2 * u,
        marginLeft: 17.5 * u,
        x: {
          domain: [0, maximo],
          label: "Error medio absoluto, % del vapor medido",
          labelAnchor: "center",
          labelArrow: "none",
          labelOffset: 3.6 * u,
          grid: true,
          ticks: 4,
          tickSize: 0,
          tickPadding: 0.8 * u,
          tickFormat: (d: number) => `${num(d, 1)} %`,
        },
        y: { domain: filas.map((f) => f.modelo), axis: null, padding: 0.3 },
        marks: [
          Plot.barX(filas, {
            y: "modelo", x: "error",
            fill: (d: FilaModelo) => (d.destacada ? COLORES.caldera : COLORES.contexto),
          }),
          Plot.ruleX([0], { stroke: COLORES.tinta, strokeWidth: 0.12 * u }),
          Plot.text(filas.filter((f) => !f.destacada), {
            y: "modelo", x: "error", dx: 0.8 * u, textAnchor: "start", fill: COLORES.tinta,
            text: (d: FilaModelo) => `${num(d.error, 2)} %`,
          }),
          Plot.text(filas.filter((f) => f.destacada), {
            y: "modelo", x: "error", dx: 0.8 * u, textAnchor: "start", fill: COLORES.caldera, fontWeight: 600,
            text: (d: FilaModelo) => `${num(d.error, 2)} %`,
          }),
          Plot.text(filas.filter((f) => !f.destacada), {
            y: "modelo", frameAnchor: "left", dx: -1 * u, textAnchor: "end", fill: COLORES.tinta, text: "modelo",
          }),
          Plot.text(filas.filter((f) => f.destacada), {
            y: "modelo", frameAnchor: "left", dx: -1 * u, textAnchor: "end", fill: COLORES.caldera, fontWeight: 600,
            text: "modelo",
          }),
        ],
      })}
    />
  );
}
