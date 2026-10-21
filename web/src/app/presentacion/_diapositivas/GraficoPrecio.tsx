"use client";

import * as Plot from "@observablehq/plot";
import { COLORES } from "@/components/graficos/PlotFigura";
import { num } from "@/lib/formato";
import { GraficoD } from "./GraficoD";

export type PuntoPrecio = { fecha: string; valor: number };
export type BandaPrecio = { fecha: string; mes: string; centro: number; p2_5: number; p10: number; p90: number; p97_5: number };

const fecha = (d: { fecha: string }) => new Date(`${d.fecha}T00:00:00Z`);
const desplazar = (d: { fecha: string }, dias: number) => new Date(fecha(d).getTime() + dias * 24 * 60 * 60 * 1000);

/**
 * Mercado · P3: promedio mensual del azúcar No. 11 y el pronóstico vigente a 1 y 3 meses.
 * El centro es el último cierre; las barras son las bandas de 80 % (llena) y 95 % (clara).
 */
export function GraficoPrecio({
  historia, cierre, bandas, realParcial,
}: {
  historia: PuntoPrecio[];
  cierre: PuntoPrecio;
  bandas: BandaPrecio[];
  realParcial?: PuntoPrecio;
}) {
  const ultima = bandas[bandas.length - 1];
  const fin = desplazar(ultima, 45);

  return (
    <GraficoD
      dependencias={[historia, bandas]}
      etiqueta={`Precio promedio mensual del azúcar y pronóstico. El centro es el último cierre, ${num(cierre.valor, 1)} centavos por libra; la banda de 80 % para ${ultima.mes.toLowerCase()} va de ${num(ultima.p10, 1)} a ${num(ultima.p90, 1)}.`}
      crear={({ u }) => ({
        marginTop: 2.6 * u,
        marginRight: 2.2 * u,
        marginBottom: 2.8 * u,
        marginLeft: 4.2 * u,
        x: {
          type: "utc",
          domain: [fecha(historia[0]), fin],
          label: null,
          ticks: "year",
          tickFormat: "%Y",
          tickSize: 0,
          tickPadding: 0.9 * u,
        },
        y: {
          label: "¢/lb",
          labelArrow: "none",
          grid: true,
          ticks: 5,
          tickSize: 0,
          tickPadding: 0.6 * u,
          nice: true,
        },
        marks: [
          Plot.lineY(historia, { x: fecha, y: "valor", stroke: COLORES.contexto, strokeWidth: 0.22 * u }),
          Plot.ruleX(bandas, { x: fecha, y1: "p2_5", y2: "p97_5", stroke: COLORES.mercado, strokeOpacity: 0.3, strokeWidth: 1.6 * u }),
          Plot.ruleX(bandas, { x: fecha, y1: "p10", y2: "p90", stroke: COLORES.mercado, strokeWidth: 1.6 * u }),
          Plot.ruleY(bandas, {
            y: "centro", x1: (d: BandaPrecio) => desplazar(d, -13), x2: (d: BandaPrecio) => desplazar(d, 13),
            stroke: COLORES.fondo, strokeWidth: 0.18 * u,
          }),
          Plot.text(bandas, {
            x: fecha, y: "p97_5", dy: -0.9 * u, lineAnchor: "bottom", fill: COLORES.mercado, fontWeight: 600,
            text: (d: BandaPrecio) => d.mes,
          }),
          Plot.dot([cierre], { x: fecha, y: "valor", fill: COLORES.tinta, r: 0.45 * u }),
          Plot.text([cierre], {
            x: fecha, y: "valor", dy: 1.7 * u, dx: -0.6 * u, textAnchor: "end", lineAnchor: "top", fill: COLORES.tinta,
            text: (d: PuntoPrecio) => `Último cierre: ${num(d.valor, 1)}`,
          }),
          ...(realParcial
            ? [
                // Halo blanco para que la × se lea sobre la banda llena
                Plot.dot([realParcial], { x: fecha, y: "valor", stroke: COLORES.fondo, strokeWidth: 0.5 * u, symbol: "times", r: 0.65 * u }),
                Plot.dot([realParcial], { x: fecha, y: "valor", stroke: COLORES.tinta, strokeWidth: 0.2 * u, symbol: "times", r: 0.65 * u }),
              ]
            : []),
        ],
      })}
    />
  );
}
