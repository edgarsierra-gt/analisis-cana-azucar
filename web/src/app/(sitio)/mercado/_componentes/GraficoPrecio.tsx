"use client";

import * as Plot from "@observablehq/plot";
import { COLORES, PlotFigura } from "@/components/graficos/PlotFigura";
import { num } from "@/lib/formato";

const fechaCorta = (d: Date) =>
  d.toLocaleDateString("es-GT", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });

/** Cierre semanal del No. 11 (precio crudo) con los tramos de turbulencia sombreados. */
export function GraficoPrecio({
  semanas, turbulencia, etiqueta,
}: {
  semanas: { fecha: string; cierre: number }[];
  turbulencia: { desde: string; hasta: string }[];
  etiqueta: string;
}) {
  const datos = semanas.map((s) => ({ fecha: new Date(`${s.fecha}T00:00:00Z`), cierre: s.cierre }));
  const tramos = turbulencia.map((t) => ({ x1: new Date(`${t.desde}T00:00:00Z`), x2: new Date(`${t.hasta}T00:00:00Z`) }));
  const masLargo = tramos.reduce((a, b) => (+b.x2 - +b.x1 > +a.x2 - +a.x1 ? b : a), tramos[0]);

  return (
    <PlotFigura
      alto={360}
      etiqueta={etiqueta}
      crear={(ancho) => ({
        marginLeft: 40,
        x: { type: "utc", label: null, ticks: ancho < 520 ? 5 : 10 },
        y: { label: "¢/lb", grid: true, zero: true, nice: true },
        marks: [
          Plot.rect(tramos, { x1: "x1", x2: "x2", fill: COLORES.resalte, fillOpacity: 0.24 }),
          Plot.text([{ x: new Date((+masLargo.x1 + +masLargo.x2) / 2), texto: "Turbulencia" }], {
            x: "x", text: "texto", frameAnchor: "bottom", dy: -8, fill: COLORES.tinta2, fontSize: 13,
          }),
          Plot.ruleY([0], { stroke: COLORES.tinta }),
          Plot.lineY(datos, { x: "fecha", y: "cierre", stroke: COLORES.mercado, strokeWidth: 1.25 }),
          Plot.tip(
            datos,
            Plot.pointerX({
              x: "fecha",
              y: "cierre",
              title: (d: { fecha: Date; cierre: number }) => `Semana al ${fechaCorta(d.fecha)}\nCierre: ${num(d.cierre, 2)} ¢/lb`,
            }),
          ),
        ],
      })}
    />
  );
}
