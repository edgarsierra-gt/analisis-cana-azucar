"use client";

import * as Plot from "@observablehq/plot";
import { COLORES } from "@/components/graficos/PlotFigura";
import { conSigno } from "@/lib/formato";
import { GraficoD } from "./GraficoD";

export type FilaZafra = { zafra: string; sesgo: number; destacada: boolean };

/** Campo · P2: cuánto quedó el azúcar real arriba o abajo de lo planificado, en promedio, en cada zafra. */
export function GraficoZafras({ filas }: { filas: FilaZafra[] }) {
  const arriba = filas.filter((f) => f.destacada && f.sesgo >= 0);
  const abajo = filas.filter((f) => f.destacada && f.sesgo < 0);
  const peor = filas.reduce((a, b) => (b.sesgo < a.sesgo ? b : a), filas[0]);
  const mejor = filas.reduce((a, b) => (b.sesgo > a.sesgo ? b : a), filas[0]);
  // Margen arriba y abajo para que los rótulos de las barras no choquen con los años.
  const dominio = [Math.min(0, peor.sesgo) * 1.35, Math.max(0, mejor.sesgo) * 1.35];

  return (
    <GraficoD
      dependencias={[filas]}
      etiqueta={`Sesgo medio del pronóstico por zafra. Cambia de signo de un año a otro; el peor año, ${peor.zafra}, quedó ${conSigno(peor.sesgo, 1)} % contra lo planificado.`}
      crear={({ u }) => ({
        marginTop: 1.6 * u,
        marginRight: 0.6 * u,
        marginBottom: 2.8 * u,
        marginLeft: 4.4 * u,
        x: { domain: filas.map((f) => f.zafra), label: null, tickSize: 0, tickPadding: 0.9 * u, padding: 0.28 },
        y: {
          domain: dominio,
          label: "%",
          labelArrow: "none",
          grid: true,
          ticks: 5,
          tickSize: 0,
          tickPadding: 0.6 * u,
          tickFormat: (d: number) => conSigno(d, 0),
        },
        marks: [
          Plot.barY(filas, {
            x: "zafra", y: "sesgo",
            fill: (d: FilaZafra) => (d.destacada ? COLORES.campo : COLORES.contexto),
          }),
          Plot.ruleY([0], { stroke: COLORES.tinta, strokeWidth: 0.12 * u }),
          Plot.text(arriba, {
            x: "zafra", y: "sesgo", dy: -0.9 * u, lineAnchor: "bottom", fill: COLORES.campo, fontWeight: 600,
            text: (d: FilaZafra) => `${conSigno(d.sesgo, 0)} %`,
          }),
          Plot.text(abajo, {
            x: "zafra", y: "sesgo", dy: 0.9 * u, lineAnchor: "top", fill: COLORES.campo, fontWeight: 600,
            text: (d: FilaZafra) => `${conSigno(d.sesgo, 0)} %`,
          }),
        ],
      })}
    />
  );
}
