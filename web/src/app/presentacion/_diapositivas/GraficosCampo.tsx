"use client";

import * as Plot from "@observablehq/plot";
import { COLORES } from "@/components/graficos/PlotFigura";
import { conSigno, usd } from "@/lib/formato";
import { GraficoD } from "./GraficoD";

export type PerfilD = { grupo: string; variedades: number; mediana: number; destacado: boolean };

/** Perfiles de variedad: mediana de la ganancia contra el testigo en cada perfil. */
export function GraficoPerfiles({ filas }: { filas: PerfilD[] }) {
  const minimo = Math.min(0, ...filas.map((f) => f.mediana));
  const maximo = Math.max(...filas.map((f) => f.mediana));
  const rotulo = (d: PerfilD) => `${conSigno(d.mediana, 0)} · ${d.variedades} variedades`;
  return (
    <GraficoD
      dependencias={[filas]}
      etiqueta={`Mediana de la ganancia contra el testigo por perfil de variedad. ${filas.find((f) => f.destacado)?.grupo ?? ""} es el único perfil con ventaja clara.`}
      crear={({ u }) => ({
        marginTop: 0.6 * u,
        marginRight: 1.4 * u,
        marginBottom: 4.4 * u,
        marginLeft: 22 * u,
        x: {
          domain: [minimo * 1.15, maximo * 1.75],
          label: "US$ por acre al año contra el testigo (mediana del perfil)",
          labelAnchor: "center",
          labelArrow: "none",
          labelOffset: 3.7 * u,
          grid: true,
          ticks: 5,
          tickSize: 0,
          tickPadding: 0.8 * u,
          tickFormat: (d: number) => conSigno(d, 0),
        },
        y: { domain: filas.map((f) => f.grupo), axis: null, padding: 0.3 },
        marks: [
          Plot.barX(filas, { x: "mediana", y: "grupo", fill: (d: PerfilD) => (d.destacado ? COLORES.campo : COLORES.contexto) }),
          Plot.ruleX([0], { stroke: COLORES.tinta, strokeWidth: 0.12 * u }),
          Plot.text(filas, {
            x: (d: PerfilD) => Math.max(0, d.mediana), y: "grupo", dx: 0.7 * u, textAnchor: "start", fill: COLORES.tinta, text: rotulo,
          }),
          Plot.text(filas.filter((f) => !f.destacado), {
            y: "grupo", frameAnchor: "left", dx: -1 * u, textAnchor: "end", fill: COLORES.tinta, text: "grupo",
          }),
          Plot.text(filas.filter((f) => f.destacado), {
            y: "grupo", frameAnchor: "left", dx: -1 * u, textAnchor: "end", fill: COLORES.campo, fontWeight: 600, text: "grupo",
          }),
        ],
      })}
    />
  );
}

export type DistanciaD = { variedad: string; equilibrio: number; destacada: boolean };

/** Distancia: costo de cosecha y transporte (US$/t) con el que cada variedad deja de cubrir costos. */
export function GraficoDistancia({ filas }: { filas: DistanciaD[] }) {
  const maximo = Math.max(...filas.map((f) => f.equilibrio));
  return (
    <GraficoD
      dependencias={[filas]}
      etiqueta={`Costo de cosecha y transporte con el que cada variedad deja de cubrir costos. El testigo aguanta ${usd(filas.find((f) => !f.destacada)?.equilibrio, 1)} por tonelada; las recomendadas, más.`}
      crear={({ u }) => ({
        marginTop: 0.4 * u,
        marginRight: 1 * u,
        marginBottom: 4.2 * u,
        marginLeft: 11 * u,
        x: {
          domain: [0, maximo * 1.3],
          label: "US$ por tonelada de caña",
          labelAnchor: "center",
          labelArrow: "none",
          labelOffset: 3.6 * u,
          grid: true,
          ticks: 4,
          tickSize: 0,
          tickPadding: 0.8 * u,
        },
        y: { domain: filas.map((f) => f.variedad), axis: null, padding: 0.42 },
        marks: [
          Plot.barX(filas, { x: "equilibrio", y: "variedad", fill: (d: DistanciaD) => (d.destacada ? COLORES.campo : COLORES.contexto) }),
          Plot.ruleX([0], { stroke: COLORES.tinta, strokeWidth: 0.12 * u }),
          Plot.text(filas, {
            x: "equilibrio", y: "variedad", dx: 0.7 * u, textAnchor: "start", fill: COLORES.tinta,
            text: (d: DistanciaD) => `${usd(d.equilibrio, 1)}/t`,
          }),
          Plot.text(filas.filter((f) => !f.destacada), {
            y: "variedad", frameAnchor: "left", dx: -1 * u, textAnchor: "end", fill: COLORES.tinta, text: "variedad",
          }),
          Plot.text(filas.filter((f) => f.destacada), {
            y: "variedad", frameAnchor: "left", dx: -1 * u, textAnchor: "end", fill: COLORES.campo, fontWeight: 600, text: "variedad",
          }),
        ],
      })}
    />
  );
}
