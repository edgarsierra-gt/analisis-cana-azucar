"use client";

import * as Plot from "@observablehq/plot";
import { COLORES, PlotFigura } from "@/components/graficos/PlotFigura";
import { num } from "@/lib/formato";
import s from "./presentacion.module.css";
import { useLienzo } from "./useLienzo";

export type FilaModelo = { modelo: string; error: number; destacada: boolean };

/** Caldera · P3: error de cada forma de estimar el vapor, validada hacia adelante por día. */
export function GraficoSensorVirtual({ filas }: { filas: FilaModelo[] }) {
  const { ref, alto, cqw } = useLienzo<HTMLDivElement>();
  const elegido = filas.find((f) => f.destacada);
  const maximo = Math.max(...filas.map((f) => f.error));

  return (
    <div ref={ref} className={s.lienzoGrafica}>
      {alto > 0 && cqw > 0 && (
        <PlotFigura
          alto={alto}
          dependencias={[cqw, filas]}
          etiqueta={`Error medio de cada forma de estimar el vapor. La elegida, ${elegido?.modelo ?? ""}, tiene el menor error: ${num(elegido?.error, 2)} %.`}
          crear={() => ({
            marginTop: 0.6 * cqw,
            marginRight: 5.5 * cqw,
            marginBottom: 4.4 * cqw,
            marginLeft: 17 * cqw,
            style: { fontSize: "1.1cqw" },
            x: {
              domain: [0, maximo],
              label: "Error medio absoluto, % del vapor medido",
              labelAnchor: "center",
              labelArrow: "none",
              labelOffset: 3.8 * cqw,
              grid: true,
              ticks: 4,
              tickSize: 0,
              tickPadding: 0.8 * cqw,
              tickFormat: (d: number) => `${num(d, 1)} %`,
            },
            y: { domain: filas.map((f) => f.modelo), axis: null, padding: 0.3 },
            marks: [
              Plot.barX(filas, {
                y: "modelo", x: "error",
                fill: (d: FilaModelo) => (d.destacada ? COLORES.caldera : COLORES.contexto),
              }),
              Plot.ruleX([0], { stroke: COLORES.tinta, strokeWidth: 0.12 * cqw }),
              Plot.text(filas, {
                y: "modelo", x: "error", dx: 0.8 * cqw, textAnchor: "start",
                fill: (d: FilaModelo) => (d.destacada ? COLORES.caldera : COLORES.tinta2),
                text: (d: FilaModelo) => `${num(d.error, 2)} %`,
              }),
              Plot.text(filas.filter((f) => !f.destacada), {
                y: "modelo", frameAnchor: "left", dx: -1 * cqw, textAnchor: "end", fill: COLORES.tinta2, text: "modelo",
              }),
              Plot.text(filas.filter((f) => f.destacada), {
                y: "modelo", frameAnchor: "left", dx: -1 * cqw, textAnchor: "end", fill: COLORES.caldera, fontWeight: 650,
                text: "modelo",
              }),
            ],
          })}
        />
      )}
    </div>
  );
}
