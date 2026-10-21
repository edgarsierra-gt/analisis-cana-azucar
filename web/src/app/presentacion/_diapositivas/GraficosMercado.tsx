"use client";

import * as Plot from "@observablehq/plot";
import { COLORES } from "@/components/graficos/PlotFigura";
import { num } from "@/lib/formato";
import { GraficoD } from "./GraficoD";

export type RezagoD = { etiqueta: string; coef: number; placebo: boolean; destaca: boolean };

/** Oferta: elasticidad del área al precio según cuántos años antes cambió el precio. El placebo va en gris claro. */
export function GraficoRezagos({ filas, etiqueta }: { filas: RezagoD[]; etiqueta: string }) {
  const minimo = Math.min(0, ...filas.map((f) => f.coef));
  const maximo = Math.max(...filas.map((f) => f.coef));
  const relleno = (d: RezagoD) => (d.destaca ? COLORES.mercado : d.placebo ? COLORES.contextoSuave : COLORES.contexto);
  return (
    <GraficoD
      dependencias={[filas]}
      etiqueta={etiqueta}
      crear={({ u }) => ({
        marginTop: 0.6 * u,
        marginRight: 1.4 * u,
        marginBottom: 4.4 * u,
        marginLeft: 16.5 * u,
        x: {
          domain: [minimo * 1.6, maximo * 1.3],
          label: "Cambio del área, en %, por cada 1 % de alza del precio",
          labelAnchor: "center",
          labelArrow: "none",
          labelOffset: 3.7 * u,
          grid: true,
          ticks: 5,
          tickSize: 0,
          tickPadding: 0.8 * u,
          tickFormat: (v: number) => num(v, 2),
        },
        y: { domain: filas.map((f) => f.etiqueta), axis: null, padding: 0.3 },
        marks: [
          Plot.barX(filas, { x: "coef", y: "etiqueta", fill: relleno }),
          Plot.ruleX([0], { stroke: COLORES.tinta, strokeWidth: 0.12 * u }),
          Plot.text(filas.filter((f) => f.coef >= 0), {
            x: "coef", y: "etiqueta", dx: 0.7 * u, textAnchor: "start", fill: COLORES.tinta,
            text: (d: RezagoD) => num(d.coef, 3),
          }),
          Plot.text(filas.filter((f) => f.coef < 0), {
            x: () => 0, y: "etiqueta", dx: 0.7 * u, textAnchor: "start", fill: COLORES.apagado,
            text: (d: RezagoD) => num(d.coef, 3),
          }),
          Plot.text(filas.filter((f) => !f.destaca), {
            y: "etiqueta", frameAnchor: "left", dx: -1 * u, textAnchor: "end", fill: COLORES.tinta, text: "etiqueta",
          }),
          Plot.text(filas.filter((f) => f.destaca), {
            y: "etiqueta", frameAnchor: "left", dx: -1 * u, textAnchor: "end", fill: COLORES.mercado, fontWeight: 600,
            text: "etiqueta",
          }),
        ],
      })}
    />
  );
}

export type PaisD = { nombre: string; crecArea: number; rend: number; papel: "guatemala" | "cuadrante" | "otro" };

/** Países: crecimiento del área contra rendimiento reciente; las líneas son los cuartiles superiores. */
export function GraficoPaises({
  puntos, corteArea, corteRend, etiqueta,
}: {
  puntos: PaisD[];
  corteArea: number;
  corteRend: number;
  etiqueta: string;
}) {
  const otros = puntos.filter((p) => p.papel === "otro");
  const cuadrante = puntos.filter((p) => p.papel === "cuadrante");
  const gt = puntos.filter((p) => p.papel === "guatemala");
  return (
    <GraficoD
      dependencias={[puntos, corteArea, corteRend]}
      etiqueta={etiqueta}
      crear={({ u }) => ({
        marginTop: 1.4 * u,
        marginRight: 1.4 * u,
        marginBottom: 4.4 * u,
        marginLeft: 5.4 * u,
        x: {
          label: "Crecimiento del área, % al año (1961-2023)",
          labelAnchor: "center",
          labelArrow: "none",
          labelOffset: 3.7 * u,
          ticks: 6,
          tickSize: 0,
          tickPadding: 0.8 * u,
          nice: true,
        },
        y: { label: "t/ha", labelArrow: "none", grid: true, ticks: 5, tickSize: 0, tickPadding: 0.6 * u, nice: true },
        marks: [
          Plot.ruleX([corteArea], { stroke: COLORES.contexto, strokeWidth: 0.12 * u }),
          Plot.ruleY([corteRend], { stroke: COLORES.contexto, strokeWidth: 0.12 * u }),
          Plot.dot(otros, { x: "crecArea", y: "rend", r: 0.42 * u, fill: COLORES.contextoSuave }),
          Plot.dot(cuadrante, { x: "crecArea", y: "rend", r: 0.5 * u, fill: COLORES.mercado }),
          Plot.text(cuadrante, {
            x: "crecArea", y: "rend", dx: 0.9 * u, textAnchor: "start", fill: COLORES.tinta, text: "nombre",
          }),
          Plot.dot(gt, { x: "crecArea", y: "rend", r: 0.75 * u, fill: COLORES.mercado, stroke: COLORES.tinta, strokeWidth: 0.14 * u }),
          Plot.text(gt, {
            x: "crecArea", y: "rend", dx: 1.1 * u, textAnchor: "start", fill: COLORES.mercado, fontWeight: 600, text: "nombre",
          }),
        ],
      })}
    />
  );
}
