"use client";

import * as Plot from "@observablehq/plot";
import { COLORES, PlotFigura } from "@/components/graficos/PlotFigura";
import { num, pctFraccion } from "@/lib/formato";

type Fila = { corte: number; cruda: number; ajustada: number; inf: number; sup: number; parcelas: number };

const nombreCorte = (k: number) => (k === 0 ? "Plantía" : `Soca ${k}`);

/** Caída de socas: promedio crudo contra la curva ajustada por lugar y año (con su IC95). */
export function GraficoCaidaSocas({ filas }: { filas: Fila[] }) {
  const ultima = filas[filas.length - 1];
  const socas = filas.filter((f) => f.corte > 0);
  return (
    <PlotFigura
      alto={380}
      etiqueta={`Rendimiento de cada soca frente a la plantía. Ajustada por lugar y año, la soca ${ultima.corte} rinde ${pctFraccion(ultima.ajustada)} de la plantía; el promedio crudo dice ${pctFraccion(ultima.cruda)} porque a esa soca solo llegaron ${ultima.parcelas} parcelas de ensayos buenos.`}
      crear={(ancho) => ({
        marginLeft: 52,
        x: { ticks: filas.map((f) => f.corte), tickFormat: nombreCorte, label: null, inset: 24 },
        y: { domain: [0.55, 1.03], label: "Azúcar por acre, % de la plantía", grid: true, tickFormat: (d: number) => num(d * 100) },
        marks: [
          Plot.areaY(filas, { x: "corte", y1: "inf", y2: "sup", fill: COLORES.campo, fillOpacity: 0.14 }),
          Plot.lineY(filas, { x: "corte", y: "cruda", stroke: COLORES.contexto, strokeWidth: 2 }),
          Plot.lineY(filas, { x: "corte", y: "ajustada", stroke: COLORES.campo, strokeWidth: 2 }),
          Plot.dot(filas, { x: "corte", y: "cruda", r: 4, fill: COLORES.contexto, stroke: "var(--fondo)", strokeWidth: 1.5 }),
          Plot.dot(filas, {
            x: "corte", y: "ajustada", r: 4.5, fill: COLORES.campo, stroke: "var(--fondo)", strokeWidth: 1.5,
            tip: true,
            title: (d: Fila) =>
              `${nombreCorte(d.corte)}\nAjustada: ${pctFraccion(d.ajustada)} (IC95 ${pctFraccion(d.inf)} a ${pctFraccion(d.sup)})\nCruda: ${pctFraccion(d.cruda)}\nParcelas: ${num(d.parcelas)}`,
          }),
          // Valores de la curva ajustada sobre cada soca
          Plot.text(socas, {
            x: "corte", y: "ajustada", text: (d: Fila) => pctFraccion(d.ajustada), dy: -14,
            fill: COLORES.tinta, fontWeight: 600, stroke: "var(--fondo)", strokeWidth: 3,
          }),
          // Rótulos directos de las dos series, en la última soca
          Plot.text([ultima], {
            x: "corte", y: "ajustada", text: () => (ancho < 560 ? "Ajustada" : "Ajustada por lugar y año"), dy: 30, textAnchor: "end", dx: 4,
            fill: COLORES.tinta, stroke: "var(--fondo)", strokeWidth: 3,
          }),
          Plot.text([ultima], {
            x: "corte", y: "cruda", text: (d: Fila) => `${ancho < 560 ? "Crudo" : "Promedio crudo"}: ${pctFraccion(d.cruda)}`, dy: ancho < 560 ? -32 : -14, textAnchor: "end", dx: 4,
            fill: COLORES.tinta2, stroke: "var(--fondo)", strokeWidth: 3,
          }),
          Plot.text([ultima], {
            x: "corte", y: 0.55, text: (d: Fila) => `solo ${num(d.parcelas)} parcelas`, dy: -8, textAnchor: "end", dx: 4,
            fill: COLORES.tinta2, fontSize: 13,
          }),
        ],
      })}
    />
  );
}
