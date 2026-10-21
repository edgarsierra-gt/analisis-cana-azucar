"use client";

import * as Plot from "@observablehq/plot";
import { COLORES, PlotFigura } from "@/components/graficos/PlotFigura";
import { num } from "@/lib/formato";

export type PuntoPais = {
  pais: string;
  nombre: string;
  crecArea: number;
  rend: number;
  grupo: string;
  papel: "guatemala" | "par" | "cuadrante" | "otro";
};

// Dónde va cada rótulo para que no se encimen los países cercanos (El Salvador y Nicaragua, Brasil y Sudán).
const ROTULO: Record<string, { dx: number; dy: number; textAnchor: "start" | "end" | "middle" }> = {
  Guatemala: { dx: 9, dy: -2, textAnchor: "start" },
  "El Salvador": { dx: 0, dy: 13, textAnchor: "middle" },
  Nicaragua: { dx: -8, dy: -4, textAnchor: "end" },
  Eswatini: { dx: 7, dy: -6, textAnchor: "start" },
  Brazil: { dx: 7, dy: 7, textAnchor: "start" },
  Sudan: { dx: 7, dy: -6, textAnchor: "start" },
  Egypt: { dx: -7, dy: 0, textAnchor: "end" },
};
const ESTILO = {
  guatemala: { fill: COLORES.mercado, fontWeight: 700 },
  par: { fill: COLORES.tinta, fontWeight: 500 },
  cuadrante: { fill: COLORES.tinta2, fontWeight: 400 },
} as const;

/** Mapa de trayectorias: crecimiento del área contra rendimiento reciente, con Guatemala y sus pares rotulados. */
export function GraficoPaises({
  puntos, corteArea, corteRend, etiqueta,
}: { puntos: PuntoPais[]; corteArea: number; corteRend: number; etiqueta: string }) {
  const de = (papel: PuntoPais["papel"]) => puntos.filter((p) => p.papel === papel);
  // En pantallas angostas, los rótulos de los países de la derecha van a la izquierda del punto para no salirse.
  const rotulos = (angosto: boolean) =>
    puntos
      .filter((p) => p.papel !== "otro")
      .map((p) =>
        Plot.text([p], {
          x: "crecArea",
          y: "rend",
          text: "nombre",
          fontSize: 11.5,
          ...(angosto && p.crecArea > 3.9
            ? { dx: -9, dy: p.pais === "Guatemala" ? -9 : -7, textAnchor: "end" as const }
            : (ROTULO[p.pais] ?? { dx: 7, dy: 0, textAnchor: "start" as const })),
          ...ESTILO[p.papel as keyof typeof ESTILO],
        }),
      );

  return (
    <PlotFigura
      alto={440}
      etiqueta={etiqueta}
      crear={(ancho) => ({
        marginLeft: 44,
        marginBottom: 42,
        x: { label: "Crecimiento del área, 1961-2023 (% anual)", nice: true },
        y: { label: "Rendimiento 2014-2023 (t/ha)", grid: true, nice: true },
        marks: [
          Plot.ruleX([corteArea], { stroke: COLORES.tinta2, strokeDasharray: "3 4", strokeOpacity: 0.6 }),
          Plot.ruleY([corteRend], { stroke: COLORES.tinta2, strokeDasharray: "3 4", strokeOpacity: 0.6 }),
          Plot.text(["Cuartil superior en los dos ejes ↗"], {
            frameAnchor: "top-right", dx: -2, dy: 2, fill: COLORES.tinta2, fontSize: 11, textAnchor: "end",
          }),
          Plot.dot(de("otro"), { x: "crecArea", y: "rend", r: 3.6, fill: COLORES.contexto }),
          Plot.dot(de("cuadrante"), { x: "crecArea", y: "rend", r: 3.6, fill: COLORES.contexto, stroke: COLORES.tinta2, strokeWidth: 1.2 }),
          Plot.dot(de("par"), { x: "crecArea", y: "rend", r: 4.2, fill: COLORES.tinta2 }),
          Plot.dot(de("guatemala"), { x: "crecArea", y: "rend", r: 6.5, fill: COLORES.mercado, stroke: COLORES.tinta, strokeWidth: 0.8 }),
          ...rotulos(ancho < 560),
          Plot.tip(
            puntos,
            Plot.pointer({
              x: "crecArea",
              y: "rend",
              title: (p: PuntoPais) =>
                `${p.nombre}\nÁrea: ${num(p.crecArea, 2)} % anual\nRendimiento: ${num(p.rend, 1)} t/ha\nGrupo: ${p.grupo}`,
            }),
          ),
        ],
      })}
    />
  );
}
