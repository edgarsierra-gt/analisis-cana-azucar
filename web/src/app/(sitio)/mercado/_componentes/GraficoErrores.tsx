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

function barras(filas: ErrorModelo[], mayor: number, ancho: number): Plot.PlotOptions {
  // Espacio a la derecha para el rótulo de 13 px de cada barra: el doble del mayor error en el teléfono, menos en pantallas anchas.
  const maximo = mayor * (ancho < 520 ? 2 : 1.45);
  return {
    marginLeft: 180,   // "Regresión con momentum" a 14 px no cabía en 156 y se cortaba en el borde del teléfono
    marginRight: 8,
    marginTop: 4,
    marginBottom: 44,   // el título del eje va bajo las marcas, sin pisar 3.5-4.5
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
        fontSize: 13,
        fill: COLORES.tinta,
        text: (d: ErrorModelo) => (d.ganador ? `${num(d.mae, 2)} (el menor)` : `${num(d.mae, 2)} · ${num(d.peor, 0)} % más`),
      }),
    ],
  };
}

/** Error de cada modelo en la validación hacia adelante, a 1 y a 3 meses, con la misma escala. */
export function GraficoErrores({ h1, h3, etiqueta }: { h1: ErrorModelo[]; h3: ErrorModelo[]; etiqueta: string }) {
  const mayor = Math.max(...h1.map((f) => f.mae), ...h3.map((f) => f.mae));
  return (
    <div className={s.apilado}>
      <p className={s.subtitulo}>A 1 mes</p>
      <PlotFigura alto={162} etiqueta={`${etiqueta} Horizonte de 1 mes.`} crear={(ancho) => barras(h1, mayor, ancho)} />
      <p className={s.subtitulo}>A 3 meses</p>
      <PlotFigura alto={162} etiqueta={`${etiqueta} Horizonte de 3 meses.`} crear={(ancho) => barras(h3, mayor, ancho)} />
    </div>
  );
}
