"use client";

import * as Plot from "@observablehq/plot";
import { COLORES } from "@/components/graficos/PlotFigura";
import s from "./presentacion.module.css";
import { useLienzo } from "./useLienzo";

/** Medidas de la diapositiva para dibujar: `u` vale 1cqw en px; `alto` y `ancho` son los del lienzo. */
export type Medidas = { u: number; alto: number; ancho: number };

/**
 * Gráfica de Observable Plot a la escala de la diapositiva. Ocupa todo el lienzo que le deja la maqueta y fija textos,
 * márgenes y grosores en múltiplos de 1cqw (convertidos a px: así el SVG escala parejo al imprimir). Ejes y unidades
 * en `apagado`; cada marca que importa lleva su color explícito.
 *
 * Dibuja sin PlotFigura: en la presentación no hay animación ni retoque de ejes, y así el primer dibujo no espera a
 * ningún ResizeObserver (el PDF impreso sin ventana sale con todas las gráficas). Mismo estilo base que PlotFigura.
 */
export function GraficoD({
  etiqueta, dependencias = [], crear,
}: {
  etiqueta: string;
  dependencias?: unknown[];
  crear: (m: Medidas) => Plot.PlotOptions;
}) {
  const ref = useLienzo<HTMLDivElement>(({ alto, ancho, cqw }, lienzo) => {
    const o = crear({ u: cqw, alto, ancho });
    const grafica = Plot.plot({
      width: ancho,
      height: alto,
      marginTop: 24,
      marginRight: 16,
      marginBottom: 40,
      marginLeft: 52,
      ...o,
      style: {
        background: "transparent",
        color: COLORES.apagado,
        fontFamily: "var(--fuente-texto)",
        fontSize: `${(1.15 * cqw).toFixed(2)}px`,
        fontVariantNumeric: "tabular-nums",
        overflow: "visible",
        ...(typeof o.style === "object" ? o.style : {}),
      },
    });
    grafica.setAttribute("role", "img");
    grafica.setAttribute("aria-label", etiqueta);
    lienzo.replaceChildren(grafica);
  }, [etiqueta, ...dependencias]);

  return <div ref={ref} className={s.lienzoGrafica} />;
}
