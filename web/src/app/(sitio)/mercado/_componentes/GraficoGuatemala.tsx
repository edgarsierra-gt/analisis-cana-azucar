"use client";

import * as Plot from "@observablehq/plot";
import { COLORES, PlotFigura } from "@/components/graficos/PlotFigura";
import { num } from "@/lib/formato";
import s from "./Mercado.module.css";

export type AnioGuatemala = {
  anio: number;
  /** miles de ha */
  area: number;
  /** millones de t */
  prod: number;
  banderaArea: string;
  banderaProd: string;
};

const BANDERA: Record<string, string> = { A: "oficial", E: "estimado por FAO", I: "imputado por FAO", X: "de otro organismo" };

function panel(
  filas: AnioGuatemala[],
  campo: "area" | "prod",
  bandera: "banderaArea" | "banderaProd",
  etiquetaY: string,
  unidad: string,
  extra: Plot.Markish[] = [],
): Plot.PlotOptions {
  return {
    marginLeft: 44,
    x: { label: null, tickFormat: "d", ticks: 6 },
    y: { label: etiquetaY, grid: true, zero: true, nice: true },
    marks: [
      ...extra,
      Plot.line(filas, { x: "anio", y: campo, stroke: COLORES.contexto, strokeWidth: 1.2 }),
      Plot.dot(filas, {
        x: "anio",
        y: campo,
        r: 2.8,
        fill: (d: AnioGuatemala) => (d[bandera] === "A" ? COLORES.contexto : COLORES.mercado),
      }),
      Plot.tip(
        filas,
        Plot.pointerX({
          x: "anio",
          y: campo,
          title: (d: AnioGuatemala) => `${d.anio}: ${num(d[campo], 1)} ${unidad}\nDato ${BANDERA[d[bandera]] ?? d[bandera]}`,
        }),
      ),
    ],
  };
}

/** Área y producción de Guatemala en FAOSTAT, con los datos no oficiales en color. */
export function GraficoGuatemala({ filas, saltoDesde, saltoHasta }: { filas: AnioGuatemala[]; saltoDesde: number; saltoHasta: number }) {
  const maxProd = Math.max(...filas.map((f) => f.prod));
  return (
    <div className={s.par}>
      <div>
        <p className={s.subtitulo}>Área cosechada</p>
        <PlotFigura
          alto={260}
          etiqueta="Área cosechada de caña en Guatemala por año, 1961-2023. De 2017 en adelante el dato es estimado y luego imputado por FAO, no oficial."
          crear={() => panel(filas, "area", "banderaArea", "miles de ha", "miles de ha")}
        />
      </div>
      <div>
        <p className={s.subtitulo}>Producción de caña</p>
        <PlotFigura
          alto={260}
          etiqueta="Producción de caña en Guatemala por año, 1961-2023. La producción de 1977 a 1985 es estimada. La de 2014 a 2016 tiene bandera oficial pero sube y vuelve a bajar sin cambio de área."
          crear={() =>
            panel(filas, "prod", "banderaProd", "millones de t", "millones de t", [
              Plot.rect([{ x1: saltoDesde - 0.5, x2: saltoHasta + 0.5 }], { x1: "x1", x2: "x2", fill: COLORES.resalte, fillOpacity: 0.22 }),
              Plot.text([{ x: saltoHasta + 0.5, y: maxProd }], {
                x: "x", y: "y", text: () => `${saltoDesde}-${saltoHasta}`, dx: -2, dy: -10, textAnchor: "end",
                fill: COLORES.tinta2, fontSize: 13,
              }),
            ])
          }
        />
      </div>
    </div>
  );
}
