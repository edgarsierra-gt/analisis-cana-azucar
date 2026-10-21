"use client";

import * as Plot from "@observablehq/plot";
import { COLORES, PlotFigura } from "@/components/graficos/PlotFigura";
import { num } from "@/lib/formato";

export type BandaMes = { mes: string; fecha: string; centro: number; p2_5: number; p10: number; p90: number; p97_5: number };

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const mesCorto = (x: Date) => `${MESES[x.getUTCMonth()]} ${x.getUTCFullYear()}`;

/** Marcas del eje cada `paso` meses (enero, abril, julio, octubre o enero y julio), dentro del dominio. */
function marcas(desde: Date, hasta: Date, paso: number): Date[] {
  const xs: Date[] = [];
  for (let a = desde.getUTCFullYear(); a <= hasta.getUTCFullYear(); a++)
    for (let m = 0; m < 12; m += paso) {
      const x = new Date(Date.UTC(a, m, 1));
      if (x >= desde && x <= hasta) xs.push(x);
    }
  return xs;
}

/**
 * Promedios mensuales reales y la banda vigente del pronóstico (junio y agosto de 2024), desde el último cierre.
 * Raya gruesa: banda 80 %; raya fina: banda 95 %. Círculo vacío: promedio real de junio hasta el día 24.
 */
export function GraficoBanda({
  reales, bandas, origen, realParcial, etiqueta,
}: {
  reales: { fecha: string; valor: number }[];
  bandas: BandaMes[];
  origen: { fecha: string; valor: number };
  realParcial: { fecha: string; valor: number };
  etiqueta: string;
}) {
  const serie = reales.map((r) => ({ fecha: d(r.fecha), valor: r.valor }));
  const banda = bandas.map((b) => ({ ...b, x: d(b.fecha) }));
  const ultima = banda[banda.length - 1];
  const centro = [
    { fecha: d(origen.fecha), valor: origen.valor },
    { fecha: ultima.x, valor: origen.valor },
  ];
  const finDominio = new Date(+ultima.x + 75 * 86_400_000);

  return (
    <PlotFigura
      alto={340}
      etiqueta={etiqueta}
      crear={(ancho) => {
        // En pantallas angostas: un año de historia, rótulos cortos y rayas más delgadas.
        const angosto = ancho < 520;
        const historia = angosto ? serie.slice(-12) : serie;
        return {
          marginLeft: 40,
          marginRight: 12,
          x: {
            type: "utc",
            label: null,
            domain: [historia[0].fecha, finDominio],
            ticks: marcas(historia[0].fecha, finDominio, angosto ? 6 : 3),
            tickFormat: mesCorto,
          },
          y: { label: "¢/lb, promedio del mes", grid: true, nice: true },
          marks: [
            Plot.lineY(historia, { x: "fecha", y: "valor", stroke: COLORES.tinta2, strokeWidth: 1.4 }),
            Plot.dot(historia, { x: "fecha", y: "valor", r: 2.2, fill: COLORES.tinta2 }),
            Plot.line(centro, { x: "fecha", y: "valor", stroke: COLORES.mercado, strokeDasharray: "3 3" }),
            Plot.ruleX(banda, { x: "x", y1: "p2_5", y2: "p97_5", stroke: COLORES.mercado, strokeOpacity: 0.55, strokeWidth: 3 }),
            Plot.ruleX(banda, { x: "x", y1: "p10", y2: "p90", stroke: COLORES.mercado, strokeWidth: angosto ? 9 : 12 }),
            Plot.dot(banda, { x: "x", y: "centro", r: 2.6, fill: COLORES.rejilla, stroke: COLORES.tinta, strokeWidth: 1 }),
            Plot.dot([{ x: d(realParcial.fecha), y: realParcial.valor }], {
              x: "x", y: "y", r: 5, stroke: COLORES.tinta, strokeWidth: 1.6, fill: "none", dx: angosto ? 11 : 15,
            }),
            Plot.text(banda, {
              x: "x", y: "p97_5", text: (b: BandaMes) => (angosto ? b.mes.slice(0, 3) : b.mes), dy: -10,
              fill: COLORES.mercado, fontWeight: 600, fontSize: 11.5,
            }),
            Plot.tip(
              banda,
              Plot.pointerX({
                x: "x",
                y: "centro",
                title: (b: BandaMes) =>
                  `${b.mes}\nCentro: ${num(b.centro, 2)} ¢/lb\nBanda 80 %: ${num(b.p10, 2)} a ${num(b.p90, 2)}\nBanda 95 %: ${num(b.p2_5, 2)} a ${num(b.p97_5, 2)}`,
              }),
            ),
          ],
        };
      }}
    />
  );
}
