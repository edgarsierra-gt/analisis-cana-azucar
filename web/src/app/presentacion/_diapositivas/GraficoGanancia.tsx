"use client";

import * as Plot from "@observablehq/plot";
import { COLORES } from "@/components/graficos/PlotFigura";
import { conSigno, usd } from "@/lib/formato";
import { GraficoD } from "./GraficoD";

export type FilaGanancia = { variedad: string; estimacion: number; p05: number; p95: number; destacada: boolean };

/** Campo · P1: ganancia de cada variedad contra el testigo promedio, con su intervalo de 90 %. */
export function GraficoGanancia({ filas }: { filas: FilaGanancia[] }) {
  const destacadas = filas.filter((f) => f.destacada);
  const resto = filas.filter((f) => !f.destacada);
  const piso = Math.min(...destacadas.map((f) => f.p05));
  const tope = Math.max(...filas.map((f) => f.p95));

  return (
    <GraficoD
      dependencias={[filas]}
      etiqueta={`Ganancia contra el testigo promedio de las ${filas.length} primeras variedades. Las ${destacadas.length} recomendadas tienen todo su intervalo de 90 % por encima de ${usd(piso, 0)} por acre al año.`}
      crear={({ u }) => ({
        marginTop: 2.2 * u,
        marginRight: 5.2 * u,
        marginBottom: 4.4 * u,
        marginLeft: 9.4 * u,
        x: {
          domain: [0, tope * 1.04],
          label: "US$ por acre al año, contra el testigo promedio",
          labelAnchor: "center",
          labelArrow: "none",
          labelOffset: 3.8 * u,
          grid: true,
          ticks: 5,
          tickSize: 0,
          tickPadding: 0.8 * u,
          tickFormat: (d: number) => conSigno(d, 0),
        },
        y: { domain: filas.map((f) => f.variedad), axis: null, padding: 0.45 },
        marks: [
          Plot.ruleX([0], { stroke: COLORES.tinta, strokeWidth: 0.12 * u }),
          Plot.text([0], {
            x: (d: number) => d, frameAnchor: "top", dy: -1.1 * u, textAnchor: "start", dx: 0.5 * u,
            text: () => "Testigo promedio", fill: COLORES.apagado,
          }),
          Plot.ruleY(resto, { y: "variedad", x1: "p05", x2: "p95", stroke: COLORES.contexto, strokeWidth: 0.24 * u }),
          Plot.dot(resto, { y: "variedad", x: "estimacion", fill: COLORES.contexto, r: 0.45 * u }),
          Plot.ruleY(destacadas, { y: "variedad", x1: "p05", x2: "p95", stroke: COLORES.campo, strokeWidth: 0.36 * u }),
          Plot.dot(destacadas, { y: "variedad", x: "estimacion", fill: COLORES.campo, r: 0.6 * u }),
          Plot.text(destacadas, {
            y: "variedad", x: "p95", dx: 0.9 * u, textAnchor: "start", fill: COLORES.campo, fontWeight: 600,
            text: (d: FilaGanancia) => conSigno(d.estimacion, 0),
          }),
          Plot.text(resto, {
            y: "variedad", frameAnchor: "left", dx: -1 * u, textAnchor: "end", fill: COLORES.apagado, text: "variedad",
          }),
          Plot.text(destacadas, {
            y: "variedad", frameAnchor: "left", dx: -1 * u, textAnchor: "end", fill: COLORES.campo, fontWeight: 600,
            text: "variedad",
          }),
        ],
      })}
    />
  );
}
