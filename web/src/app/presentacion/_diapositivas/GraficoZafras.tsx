"use client";

import * as Plot from "@observablehq/plot";
import { COLORES, PlotFigura } from "@/components/graficos/PlotFigura";
import { conSigno } from "@/lib/formato";
import s from "./presentacion.module.css";
import { useLienzo } from "./useLienzo";

export type FilaZafra = { zafra: string; sesgo: number; destacada: boolean };

/** Campo · P2: cuánto quedó el azúcar real arriba o abajo de lo planificado, en promedio, en cada zafra. */
export function GraficoZafras({ filas }: { filas: FilaZafra[] }) {
  const { ref, alto, cqw } = useLienzo<HTMLDivElement>();
  const arriba = filas.filter((f) => f.destacada && f.sesgo >= 0);
  const abajo = filas.filter((f) => f.destacada && f.sesgo < 0);
  const peor = filas.reduce((a, b) => (b.sesgo < a.sesgo ? b : a), filas[0]);
  const mejor = filas.reduce((a, b) => (b.sesgo > a.sesgo ? b : a), filas[0]);
  // Margen arriba y abajo para que las etiquetas de las barras no choquen con los años.
  const dominio = [Math.min(0, peor.sesgo) * 1.4, Math.max(0, mejor.sesgo) * 1.35];

  return (
    <div ref={ref} className={s.lienzoGrafica}>
      {alto > 0 && cqw > 0 && (
        <PlotFigura
          alto={alto}
          dependencias={[cqw, filas]}
          etiqueta={`Sesgo medio del pronóstico por zafra. Cambia de signo de un año a otro; el peor año, ${peor.zafra}, quedó ${conSigno(peor.sesgo, 1)} % contra lo planificado.`}
          crear={() => ({
            marginTop: 3.2 * cqw,
            marginRight: 1 * cqw,
            marginBottom: 3 * cqw,
            marginLeft: 4.6 * cqw,
            style: { fontSize: "1.1cqw" },
            x: { domain: filas.map((f) => f.zafra), label: null, tickSize: 0, tickPadding: 0.9 * cqw, padding: 0.28 },
            y: {
              domain: dominio,
              label: "%",
              labelArrow: "none",
              grid: true,
              ticks: 5,
              tickSize: 0,
              tickPadding: 0.6 * cqw,
              tickFormat: (d: number) => conSigno(d, 0),
            },
            marks: [
              Plot.barY(filas, {
                x: "zafra", y: "sesgo",
                fill: (d: FilaZafra) => (d.destacada ? COLORES.campo : COLORES.contexto),
              }),
              Plot.ruleY([0], { stroke: COLORES.tinta, strokeWidth: 0.12 * cqw }),
              Plot.text(arriba, {
                x: "zafra", y: "sesgo", dy: -0.9 * cqw, lineAnchor: "bottom", fill: COLORES.campo, fontWeight: 650,
                text: (d: FilaZafra) => `${conSigno(d.sesgo, 1)} %`,
              }),
              Plot.text(abajo, {
                x: "zafra", y: "sesgo", dy: 0.9 * cqw, lineAnchor: "top", fill: COLORES.campo, fontWeight: 650,
                text: (d: FilaZafra) => `${conSigno(d.sesgo, 1)} %`,
              }),
            ],
          })}
        />
      )}
    </div>
  );
}
