"use client";

import * as Plot from "@observablehq/plot";
import { COLORES, PlotFigura } from "@/components/graficos/PlotFigura";
import { conSigno, usd } from "@/lib/formato";
import s from "./presentacion.module.css";
import { useLienzo } from "./useLienzo";

export type FilaGanancia = { variedad: string; estimacion: number; p05: number; p95: number; destacada: boolean };

/** Campo · P1: ganancia de cada variedad contra el testigo promedio, con su intervalo de 90 %. */
export function GraficoGanancia({ filas }: { filas: FilaGanancia[] }) {
  const { ref, alto, cqw } = useLienzo<HTMLDivElement>();
  const destacadas = filas.filter((f) => f.destacada);
  const resto = filas.filter((f) => !f.destacada);
  const piso = Math.min(...destacadas.map((f) => f.p05));

  return (
    <div ref={ref} className={s.lienzoGrafica}>
      {alto > 0 && cqw > 0 && (
        <PlotFigura
          alto={alto}
          dependencias={[cqw, filas]}
          etiqueta={`Ganancia contra el testigo promedio de las ${filas.length} primeras variedades. Las ${destacadas.length} recomendadas tienen todo su intervalo de 90 % por encima de ${usd(piso, 0)} por acre al año.`}
          crear={() => ({
            marginTop: 2.6 * cqw,
            marginRight: 5 * cqw,
            marginBottom: 4.4 * cqw,
            marginLeft: 8.6 * cqw,
            style: { fontSize: "1.1cqw" },
            x: {
              label: "US$ por acre al año, contra el testigo promedio",
              labelAnchor: "center",
              labelArrow: "none",
              labelOffset: 3.8 * cqw,
              grid: true,
              ticks: 5,
              tickSize: 0,
              tickPadding: 0.8 * cqw,
              tickFormat: (d: number) => conSigno(d, 0),
            },
            y: { domain: filas.map((f) => f.variedad), axis: null, padding: 0.45 },
            marks: [
              Plot.ruleX([0], { stroke: COLORES.tinta, strokeWidth: 0.12 * cqw }),
              Plot.text([0], {
                x: (d: number) => d, frameAnchor: "top", dy: -1.3 * cqw, textAnchor: "start", dx: 0.5 * cqw,
                text: () => "Testigo promedio", fill: COLORES.tinta2,
              }),
              Plot.ruleY(resto, { y: "variedad", x1: "p05", x2: "p95", stroke: COLORES.contexto, strokeWidth: 0.22 * cqw }),
              Plot.dot(resto, { y: "variedad", x: "estimacion", fill: COLORES.contexto, r: 0.42 * cqw }),
              Plot.ruleY(destacadas, { y: "variedad", x1: "p05", x2: "p95", stroke: COLORES.campo, strokeWidth: 0.34 * cqw }),
              Plot.dot(destacadas, { y: "variedad", x: "estimacion", fill: COLORES.campo, r: 0.55 * cqw }),
              Plot.text(destacadas, {
                y: "variedad", x: "p95", dx: 0.9 * cqw, textAnchor: "start", fill: COLORES.campo, fontWeight: 650,
                text: (d: FilaGanancia) => conSigno(d.estimacion, 0),
              }),
              Plot.text(resto, {
                y: "variedad", frameAnchor: "left", dx: -1 * cqw, textAnchor: "end", fill: COLORES.tinta2, text: "variedad",
              }),
              Plot.text(destacadas, {
                y: "variedad", frameAnchor: "left", dx: -1 * cqw, textAnchor: "end", fill: COLORES.campo, fontWeight: 650,
                text: "variedad",
              }),
            ],
          })}
        />
      )}
    </div>
  );
}
