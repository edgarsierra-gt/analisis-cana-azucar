"use client";

import * as Plot from "@observablehq/plot";
import { COLORES, PlotFigura } from "@/components/graficos/PlotFigura";
import { num } from "@/lib/formato";
import s from "./Mercado.module.css";

export type ErrorModelo = {
  modelo: string;
  /** error absoluto medio en ¢/lb */
  mae: number;
  /** cuánto más se equivoca que el último cierre, en % (0 para el último cierre) */
  peor: number;
  ganador: boolean;
};

function barras(filas: ErrorModelo[], maximo: number): Plot.PlotOptions {
  return {
    marginLeft: 156,
    marginRight: 8,
    marginTop: 4,
    marginBottom: 32,
    x: { label: "Error absoluto medio (¢/lb)", domain: [0, maximo], grid: true },
    y: { label: null, domain: filas.map((f) => f.modelo), padding: 0.25 },
    marks: [
      Plot.barX(filas, { x: "mae", y: "modelo", fill: (d: ErrorModelo) => (d.ganador ? COLORES.mercado : COLORES.contexto) }),
      Plot.ruleX([0], { stroke: COLORES.tinta }),
      Plot.text(filas, {
        x: "mae",
        y: "modelo",
        dx: 5,
        textAnchor: "start",
        fontSize: 11.5,
        fill: COLORES.tinta,
        text: (d: ErrorModelo) => (d.ganador ? `${num(d.mae, 2)} (el menor)` : `${num(d.mae, 2)} · ${num(d.peor, 0)} % más`),
      }),
    ],
  };
}

/** Error de cada modelo en la validación hacia adelante, a 1 y a 3 meses, con la misma escala. */
export function GraficoErrores({ h1, h3, etiqueta }: { h1: ErrorModelo[]; h3: ErrorModelo[]; etiqueta: string }) {
  // Espacio a la derecha para el rótulo de cada barra.
  const maximo = Math.max(...h1.map((f) => f.mae), ...h3.map((f) => f.mae)) * 1.55;
  return (
    <div className={s.apilado}>
      <p className={`etiqueta ${s.subtitulo}`}>A 1 mes</p>
      <PlotFigura alto={150} etiqueta={`${etiqueta} Horizonte de 1 mes.`} crear={() => barras(h1, maximo)} />
      <p className={`etiqueta ${s.subtitulo}`}>A 3 meses</p>
      <PlotFigura alto={150} etiqueta={`${etiqueta} Horizonte de 3 meses.`} crear={() => barras(h3, maximo)} />
    </div>
  );
}
