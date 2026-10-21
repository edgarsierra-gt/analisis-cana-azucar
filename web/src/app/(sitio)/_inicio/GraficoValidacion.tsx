"use client";

import * as Plot from "@observablehq/plot";
import { COLORES, PlotFigura } from "@/components/graficos/PlotFigura";
import { num } from "@/lib/formato";

export type FilaValidacion = { modelo: string; azar: number; adelante: number; optimismo: number };

/**
 * Error del sensor virtual de vapor con dos validaciones: al azar (anillo) y hacia adelante por día (punto de color).
 * Junto al anillo, cuánto menos error promete la validación al azar. Las filas llegan ordenadas de la página.
 * En pantallas angostas el nombre del modelo va sobre su fila y los rótulos del anillo y el punto van debajo de la
 * primera fila, para dejarle todo el ancho a la escala.
 */
export function GraficoValidacion({ filas }: { filas: FilaValidacion[] }) {
  const tope = Math.ceil(Math.max(...filas.map((f) => f.adelante)) * 10 + 0.5) / 10;
  const descripcion = filas
    .map((f) => `${f.modelo}: ${num(f.azar, 2)} t/h al azar y ${num(f.adelante, 2)} t/h hacia adelante`)
    .join("; ");
  const primera = filas.slice(0, 1);

  return (
    <PlotFigura
      alto={46 * filas.length + 66}
      etiqueta={`La validación al azar promete menos error que el real en los tres modelos. ${descripcion}.`}
      dependencias={[filas]}
      crear={(ancho) => {
        const angosto = ancho < 440;
        // Rótulos de la primera fila: encima en pantallas anchas; debajo en angostas (encima va el nombre del modelo)
        const dy = angosto ? 17 : -15;
        return {
          height: angosto ? 62 * filas.length + 60 : 46 * filas.length + 66,
          marginTop: 28,
          marginLeft: angosto ? 8 : 150,
          marginRight: 16,
          x: { label: "Error medio absoluto (t/h)", domain: [0, tope], grid: true },
          y: { label: null, domain: filas.map((f) => f.modelo), tickSize: 0, axis: angosto ? null : "left" },
          marks: [
            Plot.ruleY(filas, { y: "modelo", x1: "azar", x2: "adelante", stroke: COLORES.contextoSuave, strokeWidth: 3 }),
            Plot.dot(filas, { y: "modelo", x: "azar", r: 5, stroke: COLORES.tinta2, strokeWidth: 1.5 }),
            Plot.dot(filas, { y: "modelo", x: "adelante", r: 5, fill: COLORES.caldera }),
            Plot.text(filas, {
              y: "modelo", x: "azar", text: (d: FilaValidacion) => `−${num(d.optimismo, 0)} %`,
              dx: -10, textAnchor: "end", fill: COLORES.tinta2, fontWeight: 600,
            }),
            Plot.text(primera, {
              y: "modelo", x: "azar", text: () => "al azar", dy, dx: 6, textAnchor: "end", fill: COLORES.tinta2,
            }),
            Plot.text(primera, {
              y: "modelo", x: "adelante", text: () => "hacia adelante", dy, dx: -6, textAnchor: "start",
              fill: COLORES.caldera, fontWeight: 600,
            }),
            ...(angosto
              ? [Plot.text(filas, { y: "modelo", x: () => 0, text: "modelo", dy: -17, textAnchor: "start", fill: COLORES.tinta2 })]
              : []),
          ],
        };
      }}
    />
  );
}
