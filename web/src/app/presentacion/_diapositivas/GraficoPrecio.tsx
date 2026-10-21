"use client";

import * as Plot from "@observablehq/plot";
import { COLORES, PlotFigura } from "@/components/graficos/PlotFigura";
import { num } from "@/lib/formato";
import s from "./presentacion.module.css";
import { useLienzo } from "./useLienzo";

export type PuntoPrecio = { fecha: string; valor: number };
export type BandaPrecio = { fecha: string; mes: string; centro: number; p2_5: number; p10: number; p90: number; p97_5: number };

const fecha = (d: { fecha: string }) => new Date(`${d.fecha}T00:00:00Z`);
const desplazar = (d: { fecha: string }, dias: number) => new Date(fecha(d).getTime() + dias * 24 * 60 * 60 * 1000);

/**
 * Mercado · P3: promedio mensual del azúcar No. 11 y el pronóstico vigente a 1 y 3 meses.
 * El centro es el último cierre; las barras son las bandas de 80 % (oscura) y 95 % (clara).
 */
export function GraficoPrecio({
  historia, cierre, bandas, realParcial,
}: {
  historia: PuntoPrecio[];
  cierre: PuntoPrecio;
  bandas: BandaPrecio[];
  realParcial?: PuntoPrecio;
}) {
  const { ref, alto, cqw } = useLienzo<HTMLDivElement>();
  const ultima = bandas[bandas.length - 1];
  const fin = desplazar(ultima, 40);

  return (
    <div ref={ref} className={s.lienzoGrafica}>
      {alto > 0 && cqw > 0 && (
        <PlotFigura
          alto={alto}
          dependencias={[cqw, historia, bandas]}
          etiqueta={`Precio promedio mensual del azúcar y pronóstico. El centro es el último cierre, ${num(cierre.valor, 1)} centavos por libra; la banda de 80 % para ${ultima.mes.toLowerCase()} va de ${num(ultima.p10, 1)} a ${num(ultima.p90, 1)}.`}
          crear={() => ({
            marginTop: 3 * cqw,
            marginRight: 3 * cqw,
            marginBottom: 3 * cqw,
            marginLeft: 4 * cqw,
            style: { fontSize: "1.1cqw" },
            x: {
              type: "utc",
              domain: [fecha(historia[0]), fin],
              label: null,
              ticks: "year",
              tickFormat: "%Y",
              tickSize: 0,
              tickPadding: 0.9 * cqw,
            },
            y: {
              label: "¢/lb",
              labelArrow: "none",
              grid: true,
              ticks: 5,
              tickSize: 0,
              tickPadding: 0.6 * cqw,
              nice: true,
            },
            marks: [
              Plot.lineY(historia, { x: fecha, y: "valor", stroke: COLORES.contexto, strokeWidth: 0.22 * cqw }),
              Plot.ruleX(bandas, { x: fecha, y1: "p2_5", y2: "p97_5", stroke: COLORES.mercado, strokeOpacity: 0.32, strokeWidth: 1.5 * cqw }),
              Plot.ruleX(bandas, { x: fecha, y1: "p10", y2: "p90", stroke: COLORES.mercado, strokeWidth: 1.5 * cqw }),
              Plot.ruleY(bandas, {
                y: "centro", x1: (d: BandaPrecio) => desplazar(d, -12), x2: (d: BandaPrecio) => desplazar(d, 12),
                stroke: COLORES.tinta, strokeWidth: 0.16 * cqw,
              }),
              Plot.text(bandas, {
                x: fecha, y: "p97_5", dy: -1 * cqw, lineAnchor: "bottom", fill: COLORES.mercado, fontWeight: 650,
                text: (d: BandaPrecio) => d.mes,
              }),
              Plot.dot([cierre], { x: fecha, y: "valor", fill: COLORES.tinta, r: 0.45 * cqw }),
              Plot.text([cierre], {
                x: fecha, y: "valor", dy: 1.6 * cqw, dx: -0.6 * cqw, textAnchor: "end", lineAnchor: "top", fill: COLORES.tinta,
                text: (d: PuntoPrecio) => `Último cierre: ${num(d.valor, 1)}`,
              }),
              ...(realParcial
                ? [
                    // Halo claro para que la × se lea sobre la banda oscura
                    Plot.dot([realParcial], { x: fecha, y: "valor", stroke: COLORES.rejilla, strokeWidth: 0.42 * cqw, symbol: "times", r: 0.6 * cqw }),
                    Plot.dot([realParcial], { x: fecha, y: "valor", stroke: COLORES.tinta, strokeWidth: 0.18 * cqw, symbol: "times", r: 0.6 * cqw }),
                  ]
                : []),
            ],
          })}
        />
      )}
    </div>
  );
}
